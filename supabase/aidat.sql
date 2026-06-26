-- =============================================================================
-- KHS — Hackerspace Portal: Üyeler + Aidat/Bağış İşlemleri (Aşama 1 — İçe Aktarma)
-- -----------------------------------------------------------------------------
-- Supabase Dashboard → SQL Editor → New query içine yapıştırıp RUN edin.
-- Idempotent yazılmıştır; tekrar çalıştırmak güvenlidir.
-- Önce `rbac.sql` çalıştırılmış olmalıdır (profiles, user_roles, is_admin vb.).
--
-- Bu betik üç şey kurar:
--   1) public.members      — üye kayıt defteri (login ZORUNLU DEĞİL; user_id ile
--                            bir auth hesabına bağlanabilir, sonradan da bağlanabilir).
--   2) public.transactions — banka ekstresinden içe aktarılan işlemler (aidat/bağış/diğer).
--                            (Aidat borç düşümü Aşama 2'de, bağış raporu Aşama 3'te kullanır.)
--   3) member_set_login     — login'siz bir üyeye sonradan e-posta+şifre tanımlayıp
--                            giriş yapabilir hâle getiren RPC.
-- =============================================================================

-- 1) Enum'lar ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type public.member_status as enum ('active', 'inactive', 'overdue');
  end if;
  if not exists (select 1 from pg_type where typname = 'txn_kind') then
    create type public.txn_kind as enum ('aidat', 'bagis', 'diger');
  end if;
end $$;

-- 2) Türkçe-duyarlı isim anahtarı --------------------------------------------
--    "YAKUP SELİM UÇAR" -> "yakup selim ucar". Frontend'deki nameKey() ile birebir
--    aynı sonucu üretir (eşleştirme ve tekilleştirme için kullanılır).
create or replace function public.member_name_key(p text)
returns text
language sql
immutable
as $$
  select lower(
    translate(
      regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'),
      'ÇĞİÖŞÜçğıöşü',
      'CGIOSUcgiosu'
    )
  );
$$;

-- 3) Tablolar ----------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  -- Eşleştirme/tekilleştirme anahtarı; full_name'den otomatik üretilir.
  name_key    text generated always as (public.member_name_key(full_name)) stored,
  email       text,
  phone       text,
  status      public.member_status not null default 'active',
  -- Login hesabı (opsiyonel). NULL ise üye giriş yapamaz; member_set_login ile bağlanır.
  user_id     uuid references auth.users(id) on delete set null,
  -- Aylık aidat tutarı (Aşama 2'de borç hesabı için).
  monthly_due numeric(12, 2) not null default 2000,
  joined_at   date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Aynı isimden ikinci üye eklenmesini engeller (büyük/küçük ve Türkçe karakter duyarsız).
create unique index if not exists members_name_key_uniq on public.members (name_key);
-- Bir auth hesabı en fazla bir üyeye bağlanır.
create unique index if not exists members_user_id_uniq on public.members (user_id) where user_id is not null;

create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  txn_date          timestamptz not null,
  channel           text,
  receipt_no        text,
  description       text not null,
  amount            numeric(12, 2) not null,
  kind              public.txn_kind not null default 'diger',
  counterparty_name text,
  counterparty_sn   text,
  ref_no            text,
  -- 'YYYY-MM' — açıklamadaki ay adından ya da işlem tarihinden çıkarılır (Aşama 2).
  period            text,
  member_id         uuid references public.members(id) on delete set null,
  -- Aşama 2'de aidatın bir döneme uygulanıp uygulanmadığını işaretler.
  applied           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Aynı banka satırının tekrar içe aktarılınca çift kaydını engeller (idempotent import).
create unique index if not exists transactions_natural_uniq
  on public.transactions (receipt_no, txn_date, amount);

-- 4) RLS politikaları --------------------------------------------------------
alter table public.members      enable row level security;
alter table public.transactions enable row level security;

-- members: admin tümünü yönetebilir; üye kendi kaydını görebilir.
drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members
  for select to authenticated
  using (public.is_admin() or user_id = (select auth.uid()));

drop policy if exists "members_insert" on public.members;
create policy "members_insert" on public.members
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "members_update" on public.members;
create policy "members_update" on public.members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "members_delete" on public.members;
create policy "members_delete" on public.members
  for delete to authenticated
  using (public.is_admin());

-- transactions: yalnızca admin görür ve yönetir.
drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select" on public.transactions
  for select to authenticated using (public.is_admin());

drop policy if exists "transactions_insert" on public.transactions;
create policy "transactions_insert" on public.transactions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "transactions_update" on public.transactions;
create policy "transactions_update" on public.transactions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "transactions_delete" on public.transactions;
create policy "transactions_delete" on public.transactions
  for delete to authenticated using (public.is_admin());

-- 5) member_set_login: login'siz üyeye e-posta+şifre tanımlar ------------------
--    Yetki kuralları admin_create_user ile aynıdır:
--      • çağıran en az admin olmalı,
--      • admin yalnızca member/keyholder rolü atayabilir; admin/superadmin yalnız superadmin.
create or replace function public.member_set_login(
  p_member_id uuid,
  p_email     text,
  p_password  text,
  p_role      public.app_role default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email   text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz: giriş tanımlamak için admin veya superadmin olmalısınız.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_role in ('admin', 'superadmin') and not public.is_superadmin() then
    raise exception 'Yetkisiz: "%" rolü yalnızca superadmin tarafından atanabilir.', p_role
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Üye bulunamadı.' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.members where id = p_member_id and user_id is not null) then
    raise exception 'Bu üyenin zaten bir giriş hesabı var.' using errcode = 'unique_violation';
  end if;

  -- auth.users + auth.identities (rbac.sql'deki yardımcı; e-posta/şifre doğrulamasını yapar)
  v_user_id := public._create_auth_user(
    v_email,
    p_password,
    (select full_name from public.members where id = p_member_id)
  );

  insert into public.profiles (id, email, full_name)
  values (v_user_id, v_email, (select full_name from public.members where id = p_member_id));

  insert into public.user_roles (user_id, role)
  values (v_user_id, p_role);

  update public.members
     set user_id = v_user_id,
         email   = v_email
   where id = p_member_id;

  return v_user_id;
end;
$$;

-- 6) İzinler (grants) --------------------------------------------------------
grant select, insert, update, delete on public.members      to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

revoke execute on function public.member_set_login(uuid, text, text, public.app_role) from public;
grant  execute on function public.member_set_login(uuid, text, text, public.app_role) to authenticated;

-- 7) Mevcut login kullanıcılarını üye olarak aktarma (tek seferlik seed) -------
--    Hâlihazırda giriş yapabilen kullanıcılar (örn. ilk superadmin) Üyeler
--    listesinde de görünsün diye members'a kopyalanır ve user_id ile bağlanır.
insert into public.members (full_name, email, user_id)
select coalesce(nullif(btrim(p.full_name), ''), p.email, 'İsimsiz Üye'),
       p.email,
       p.id
from public.profiles p
where not exists (select 1 from public.members m where m.user_id = p.id)
on conflict (name_key) do nothing;

-- =============================================================================
-- NOT: Bu betiği çalıştırdıktan sonra `src/types/database.ts` zaten members/
-- transactions tablolarını ve member_set_login RPC'sini içerir; ek bir şey
-- yapmanıza gerek yoktur.
-- =============================================================================
