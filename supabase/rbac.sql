-- =============================================================================
-- KHS — Hackerspace Portal: Rol Tabanlı Erişim Kontrolü (RBAC)
-- -----------------------------------------------------------------------------
-- Supabase Dashboard → SQL Editor → New query içine yapıştırıp RUN edin.
-- Idempotent yazılmıştır; tekrar çalıştırmak güvenlidir.
--
-- Roller:  superadmin > admin > keyholder > member
-- Kural :  admin/superadmin oluşturma+atama YALNIZCA superadmin'e aittir.
--          admin yalnızca member/keyholder oluşturabilir.
-- =============================================================================

-- 0) Şifre hash'leme için pgcrypto (Supabase'de "extensions" şemasında bulunur)
create extension if not exists pgcrypto with schema extensions;

-- 1) Rol enum'u -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('superadmin', 'admin', 'keyholder', 'member');
  end if;
end $$;

-- 2) Tablolar ----------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  role        public.app_role not null default 'member',
  created_at  timestamptz not null default now()
);

-- 3) SECURITY DEFINER yardımcıları -------------------------------------------
--    RLS politikalarında kullanılır; RLS'i bypass ederek özyinelemeyi önler.
--    search_path = '' + tam şema niteleme = güvenli (search_path enjeksiyonuna kapalı).

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.user_roles where user_id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role in ('superadmin', 'admin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = 'superadmin'
  );
$$;

-- 4) RLS politikaları --------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;

-- profiles: kendi profilini veya (admin ise) herkesi görebilir
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- profiles: kendi profilini veya (admin ise) herkesinkini güncelleyebilir
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- user_roles: kendi rolünü veya (admin ise) herkesinkini görebilir
drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- NOT: user_roles için INSERT/UPDATE/DELETE politikası YOK.
-- Rol değişiklikleri yalnızca aşağıdaki SECURITY DEFINER fonksiyonlardan yapılır.

-- 5) İç yardımcı: auth.users + auth.identities kaydı oluşturur -----------------
--    Doğrudan çağrılmaz; yalnızca admin_create_user / bootstrap kullanır.
create or replace function public._create_auth_user(
  p_email     text,
  p_password  text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_now     timestamptz := now();
  v_email   text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'E-posta zorunludur.' using errcode = 'check_violation';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Bu e-posta zaten kayıtlı: %', v_email using errcode = 'unique_violation';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name),
    v_now, v_now,
    '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', v_now, v_now, v_now
  );

  return v_user_id;
end;
$$;

-- 6) admin_create_user: panel içinden yeni kullanıcı oluşturur -----------------
create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_role      public.app_role default 'member',
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  -- En az admin olmalı
  if not public.is_admin() then
    raise exception 'Yetkisiz: kullanıcı oluşturmak için admin veya superadmin olmalısınız.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Yetki yükseltme koruması: admin/superadmin yalnızca superadmin tarafından atanır
  if p_role in ('admin', 'superadmin') and not public.is_superadmin() then
    raise exception 'Yetkisiz: "%" rolü yalnızca superadmin tarafından atanabilir.', p_role
      using errcode = 'insufficient_privilege';
  end if;

  v_user_id := public._create_auth_user(p_email, p_password, p_full_name);

  insert into public.profiles (id, email, full_name)
  values (v_user_id, lower(trim(p_email)), p_full_name);

  insert into public.user_roles (user_id, role)
  values (v_user_id, p_role);

  return v_user_id;
end;
$$;

-- 7) admin_update_user: mevcut bir kullanıcıyı düzenler -----------------------
--    Yetki kuralları admin_create_user ile aynıdır:
--      • en az admin olunmalı,
--      • admin yalnızca member/keyholder kullanıcıları yönetebilir/atayabilir,
--      • admin/superadmin hedefleri ve rolleri yalnızca superadmin değiştirebilir.
--    p_password boş/NULL ise şifre değişmez.
create or replace function public.admin_update_user(
  p_user_id   uuid,
  p_full_name text,
  p_email     text,
  p_role      public.app_role,
  p_password  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.app_role;
  v_email       text := lower(trim(p_email));
  v_caller      uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz: kullanıcı düzenlemek için admin veya superadmin olmalısınız.'
      using errcode = 'insufficient_privilege';
  end if;

  select role into v_target_role from public.user_roles where user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- admin, admin/superadmin kullanıcıları düzenleyemez
  if not public.is_superadmin() and v_target_role in ('admin', 'superadmin') then
    raise exception 'Yetkisiz: bu kullanıcıyı yalnızca superadmin düzenleyebilir.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Yetki yükseltme koruması: admin/superadmin rolünü yalnızca superadmin atar
  if p_role in ('admin', 'superadmin') and not public.is_superadmin() then
    raise exception 'Yetkisiz: "%" rolü yalnızca superadmin tarafından atanabilir.', p_role
      using errcode = 'insufficient_privilege';
  end if;

  -- Kilitlenmeyi önlemek için kullanıcı kendi rolünü değiştiremez
  if p_user_id = v_caller and p_role <> v_target_role then
    raise exception 'Kendi rolünüzü değiştiremezsiniz.' using errcode = 'check_violation';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'E-posta zorunludur.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from auth.users where email = v_email and id <> p_user_id) then
    raise exception 'Bu e-posta zaten kayıtlı: %', v_email using errcode = 'unique_violation';
  end if;
  if p_password is not null and p_password <> '' and length(p_password) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır.' using errcode = 'check_violation';
  end if;

  update public.profiles
     set email = v_email, full_name = p_full_name
   where id = p_user_id;

  update public.user_roles
     set role = p_role
   where user_id = p_user_id;

  update auth.users
     set email = v_email,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('full_name', p_full_name),
         encrypted_password = case
           when p_password is not null and p_password <> ''
             then extensions.crypt(p_password, extensions.gen_salt('bf'))
           else encrypted_password
         end,
         updated_at = now()
   where id = p_user_id;

  -- E-posta kimliğini de senkron tut
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', v_email),
         updated_at = now()
   where user_id = p_user_id and provider = 'email';
end;
$$;

-- 7b) admin_delete_user: bir kullanıcıyı tamamen siler ------------------------
--     auth.users silinince profiles & user_roles ON DELETE CASCADE ile gider.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.app_role;
  v_caller      uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz: kullanıcı silmek için admin veya superadmin olmalısınız.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = v_caller then
    raise exception 'Kendi hesabınızı silemezsiniz.' using errcode = 'check_violation';
  end if;

  select role into v_target_role from public.user_roles where user_id = p_user_id;
  if v_target_role is null then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'no_data_found';
  end if;

  -- admin, admin/superadmin kullanıcıları silemez
  if not public.is_superadmin() and v_target_role in ('admin', 'superadmin') then
    raise exception 'Yetkisiz: bu kullanıcıyı yalnızca superadmin silebilir.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from auth.users where id = p_user_id;  -- cascade: profiles, user_roles
end;
$$;

-- 7c) admin_bootstrap_superadmin: tek seferlik ilk superadmin ------------------
--    Yalnızca hiç superadmin yoksa çalışır.
create or replace function public.admin_bootstrap_superadmin(
  p_email     text,
  p_password  text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if exists (select 1 from public.user_roles where role = 'superadmin') then
    raise exception 'Zaten bir superadmin mevcut. Bootstrap iptal edildi.';
  end if;

  v_user_id := public._create_auth_user(p_email, p_password, p_full_name);

  insert into public.profiles (id, email, full_name)
  values (v_user_id, lower(trim(p_email)), p_full_name);

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'superadmin');

  return v_user_id;
end;
$$;

-- 8) İzinler (grants) --------------------------------------------------------
-- Tablo erişimi (RLS yine de satır bazında kısıtlar)
grant select         on public.user_roles to authenticated;
grant select, update on public.profiles   to authenticated;

-- Fonksiyon execute izinleri
revoke execute on function public._create_auth_user(text, text, text)              from public;
revoke execute on function public.admin_bootstrap_superadmin(text, text, text)     from public;
revoke execute on function public.admin_create_user(text, text, public.app_role, text) from public;
revoke execute on function public.admin_update_user(uuid, text, text, public.app_role, text) from public;
revoke execute on function public.admin_delete_user(uuid)                          from public;

grant  execute on function public.admin_create_user(text, text, public.app_role, text) to authenticated;
grant  execute on function public.admin_update_user(uuid, text, text, public.app_role, text) to authenticated;
grant  execute on function public.admin_delete_user(uuid)                          to authenticated;
-- bootstrap ve _create_auth_user yalnızca SQL Editor (postgres) üzerinden çağrılır.

-- =============================================================================
-- KURULUM: İlk superadmin'i oluşturun (e-posta/şifre/adı kendinize göre değiştirin)
-- -----------------------------------------------------------------------------
-- select public.admin_bootstrap_superadmin('sen@khs.org', 'cok-guclu-sifre-123', 'Omer Kirkan');
--
-- Çalıştırdıktan sonra bu satırı tekrar çalıştırmayın (tek seferlik koruması var).
-- Güvenlik için isterseniz bootstrap fonksiyonunu sonradan kaldırabilirsiniz:
-- drop function if exists public.admin_bootstrap_superadmin(text, text, text);
-- =============================================================================
