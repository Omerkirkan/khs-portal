import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AppRole, CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/types'

/**
 * Kullanıcı yönetimi (yalnızca admin/superadmin için anlamlıdır).
 * Yeni kullanıcı oluşturma `admin_create_user` RPC'si üzerinden yapılır;
 * yetki kontrolleri DB tarafında (SECURITY DEFINER) zorlanır.
 */
export function useUserManagement() {
  const users = ref<ManagedUser[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  function toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message: unknown }).message
      if (typeof m === 'string') return m
    }
    return fallback
  }

  /** profiles + user_roles birleşik kullanıcı listesini çeker (RLS: admin tümünü görür). */
  async function listUsers(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
      ])
      if (profilesRes.error) throw profilesRes.error
      if (rolesRes.error) throw rolesRes.error

      const roleByUser = new Map<string, AppRole>(
        (rolesRes.data ?? []).map((r) => [r.user_id, r.role]),
      )

      users.value = (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: roleByUser.get(p.id) ?? 'member',
        created_at: p.created_at,
      }))
    } catch (err) {
      error.value = toMessage(err, 'Kullanıcılar yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  /**
   * Yeni kullanıcı oluşturur. Başarılıysa yeni user id döner, aksi halde null
   * ve `error` doldurulur (yetkisiz / e-posta mevcut / vb.).
   */
  async function createUser(payload: CreateUserPayload): Promise<string | null> {
    submitting.value = true
    error.value = null
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_create_user', {
        p_email: payload.email.trim(),
        p_password: payload.password,
        p_role: payload.role,
        p_full_name: payload.full_name.trim(),
      })
      if (rpcError) throw rpcError
      await listUsers()
      return typeof data === 'string' ? data : null
    } catch (err) {
      error.value = toMessage(err, 'Kullanıcı oluşturulamadı.')
      return null
    } finally {
      submitting.value = false
    }
  }

  /**
   * Mevcut kullanıcıyı günceller. `payload.password` boş/atlanmışsa şifre korunur.
   * Başarılıysa true döner; aksi halde false ve `error` doldurulur.
   */
  async function updateUser(payload: UpdateUserPayload): Promise<boolean> {
    submitting.value = true
    error.value = null
    try {
      const pwd = payload.password?.trim()
      const { error: rpcError } = await supabase.rpc('admin_update_user', {
        p_user_id: payload.id,
        p_full_name: payload.full_name.trim(),
        p_email: payload.email.trim(),
        p_role: payload.role,
        ...(pwd ? { p_password: pwd } : {}),
      })
      if (rpcError) throw rpcError
      await listUsers()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Kullanıcı güncellenemedi.')
      return false
    } finally {
      submitting.value = false
    }
  }

  /** Kullanıcıyı kalıcı olarak siler. Başarılıysa true döner. */
  async function deleteUser(id: string): Promise<boolean> {
    deleting.value = true
    error.value = null
    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_user', { p_user_id: id })
      if (rpcError) throw rpcError
      await listUsers()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Kullanıcı silinemedi.')
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    users,
    loading,
    submitting,
    deleting,
    error,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
  }
}
