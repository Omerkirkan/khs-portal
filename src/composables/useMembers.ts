import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AppRole, MemberRow, MemberStatus } from '@/types'

/** Üyenin Excel/forma açık detay alanları (banka ekstresinde yoktur). */
export interface MemberDetailFields {
  /** T.C. Kimlik No. */
  tc_no?: string | null
  /** Cinsiyet (ERKEK/KADIN). */
  gender?: string | null
  /** Meslek. */
  profession?: string | null
  /** Öğrenim durumu. */
  education?: string | null
  /** İnternet sitesi. */
  website?: string | null
  /** Üye türü (Üye/Kurucu/Geçici Başkan …). */
  member_type?: string | null
  /** Doğum tarihi (YYYY-MM-DD). */
  birth_date?: string | null
}

/** Yeni üye (login opsiyonel) oluşturma girdisi. */
export interface CreateMemberInput extends MemberDetailFields {
  full_name: string
  email?: string | null
  phone?: string | null
  status?: MemberStatus
  monthly_due?: number
  /** Atanan aidat tipi; null ise özel tutar (monthly_due) geçerlidir. */
  dues_type_id?: string | null
  joined_at?: string
  /** Dolu ise üyeye giriş hesabı da açılır (e-posta + bu şifre + rol). */
  password?: string
  role?: AppRole
}

/** Üye güncelleme girdisi. */
export interface UpdateMemberInput extends MemberDetailFields {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  status: MemberStatus
  monthly_due?: number
  /** Atanan aidat tipi; null ise özel tutar (monthly_due) geçerlidir. */
  dues_type_id?: string | null
  joined_at?: string
  /** Üyenin login rolü (giriş hesabı varsa veya açılacaksa). */
  role?: AppRole
  /** Yeni şifre; login yoksa girilirse hesap açılır, varsa değiştirilir. Boşsa korunur. */
  password?: string
}

/** Detay alanlarını members tablosu yüküne çevirir (boş metinleri null'a indirger). */
function detailPayload(input: MemberDetailFields) {
  const norm = (v: string | null | undefined): string | null => {
    if (v == null) return null
    const t = v.trim()
    return t || null
  }
  return {
    tc_no: norm(input.tc_no),
    gender: norm(input.gender),
    profession: norm(input.profession),
    education: norm(input.education),
    website: norm(input.website),
    member_type: norm(input.member_type),
    birth_date: input.birth_date || null,
  }
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

/**
 * Üye yönetimi. `public.members` tablosu kayıt defteridir; giriş hesabı (auth)
 * opsiyoneldir ve `user_id` ile bağlanır. Banka içe aktarmadan eklenen üyeler
 * genelde login'sizdir ve sonradan {@link UpdateMemberInput.password} ile giriş
 * hesabına bağlanabilir.
 */
export function useMembers() {
  const members = ref<MemberRow[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  /** members + (login'i olanlar için) user_roles birleşik listesi. */
  async function listMembers(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [membersRes, rolesRes] = await Promise.all([
        supabase.from('members').select('*').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
      ])
      if (membersRes.error) throw membersRes.error
      if (rolesRes.error) throw rolesRes.error

      const roleByUser = new Map<string, AppRole>(
        (rolesRes.data ?? []).map((r) => [r.user_id, r.role]),
      )

      members.value = (membersRes.data ?? []).map((m) => ({
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        phone: m.phone,
        status: m.status,
        user_id: m.user_id,
        role: m.user_id ? (roleByUser.get(m.user_id) ?? null) : null,
        monthly_due: m.monthly_due,
        dues_type_id: m.dues_type_id,
        joined_at: m.joined_at,
        name_key: m.name_key,
        tc_no: m.tc_no,
        gender: m.gender,
        profession: m.profession,
        education: m.education,
        website: m.website,
        member_type: m.member_type,
        birth_date: m.birth_date,
        created_at: m.created_at,
      }))
    } catch (err) {
      error.value = toMessage(err, 'Üyeler yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  /**
   * Yeni üye oluşturur. `password` verilmişse ayrıca giriş hesabı açar.
   * Başarılıysa yeni üye id'si döner.
   */
  async function createMember(input: CreateMemberInput): Promise<string | null> {
    submitting.value = true
    error.value = null
    try {
      const { data, error: insErr } = await supabase
        .from('members')
        .insert({
          full_name: input.full_name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          status: input.status ?? 'active',
          ...(input.monthly_due != null ? { monthly_due: input.monthly_due } : {}),
          dues_type_id: input.dues_type_id ?? null,
          ...(input.joined_at ? { joined_at: input.joined_at } : {}),
          ...detailPayload(input),
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      // İstenmişse giriş hesabı bağla.
      if (input.password && input.email) {
        const { error: rpcErr } = await supabase.rpc('member_set_login', {
          p_member_id: data.id,
          p_email: input.email.trim(),
          p_password: input.password,
          p_role: input.role ?? 'member',
        })
        // Giriş açılamazsa (örn. e-posta zaten kayıtlı) yarım kalan üyeyi geri al.
        if (rpcErr) {
          await supabase.from('members').delete().eq('id', data.id)
          throw rpcErr
        }
      }

      await listMembers()
      return data.id
    } catch (err) {
      error.value = toMessage(err, 'Üye oluşturulamadı.')
      return null
    } finally {
      submitting.value = false
    }
  }

  /**
   * Banka içe aktarmadan tek tıkla üye ekler (yalnızca ad). Çağıran tekrar
   * eklemeyi önlemek için sonucu kontrol etmelidir.
   */
  async function addMemberByName(fullName: string): Promise<string | null> {
    error.value = null
    try {
      const { data, error: insErr } = await supabase
        .from('members')
        .insert({ full_name: fullName.trim() })
        .select('id')
        .single()
      if (insErr) throw insErr
      return data.id
    } catch (err) {
      error.value = toMessage(err, 'Üye eklenemedi.')
      return null
    }
  }

  /**
   * Mevcut üyeyi günceller. Giriş hesabı varsa e-posta/ad/rol/şifre auth ile
   * senkron tutulur; yoksa ve şifre girilmişse yeni giriş hesabı açılır.
   */
  async function updateMember(input: UpdateMemberInput, currentUserId: string | null): Promise<boolean> {
    submitting.value = true
    error.value = null
    try {
      const email = input.email?.trim() || null
      const pwd = input.password?.trim()

      // 1) members tablosunu güncelle.
      const { error: updErr } = await supabase
        .from('members')
        .update({
          full_name: input.full_name.trim(),
          email,
          phone: input.phone?.trim() || null,
          status: input.status,
          ...(input.monthly_due != null ? { monthly_due: input.monthly_due } : {}),
          dues_type_id: input.dues_type_id ?? null,
          ...(input.joined_at ? { joined_at: input.joined_at } : {}),
          ...detailPayload(input),
        })
        .eq('id', input.id)
      if (updErr) throw updErr

      // 2) Giriş hesabıyla ilgili senkron.
      if (currentUserId) {
        // Var olan hesabı güncelle (ad/e-posta/rol/şifre).
        if (!email) throw new Error('Giriş hesabı olan üyede e-posta zorunludur.')
        const { error: rpcErr } = await supabase.rpc('admin_update_user', {
          p_user_id: currentUserId,
          p_full_name: input.full_name.trim(),
          p_email: email,
          p_role: input.role ?? 'member',
          ...(pwd ? { p_password: pwd } : {}),
        })
        if (rpcErr) throw rpcErr
      } else if (pwd && email) {
        // Login yoktu; e-posta+şifre verildiyse yeni hesap aç ve bağla.
        const { error: rpcErr } = await supabase.rpc('member_set_login', {
          p_member_id: input.id,
          p_email: email,
          p_password: pwd,
          p_role: input.role ?? 'member',
        })
        if (rpcErr) throw rpcErr
      }

      await listMembers()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Üye güncellenemedi.')
      return false
    } finally {
      submitting.value = false
    }
  }

  /** Üyeyi siler. Giriş hesabı varsa o da (auth.users) silinir. */
  async function deleteMember(id: string, userId: string | null): Promise<boolean> {
    deleting.value = true
    error.value = null
    try {
      if (userId) {
        const { error: rpcErr } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
        if (rpcErr) throw rpcErr
      }
      const { error: delErr } = await supabase.from('members').delete().eq('id', id)
      if (delErr) throw delErr

      await listMembers()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Üye silinemedi.')
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    members,
    loading,
    submitting,
    deleting,
    error,
    listMembers,
    createMember,
    addMemberByName,
    updateMember,
    deleteMember,
  }
}
