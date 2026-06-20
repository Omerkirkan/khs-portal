/**
 * KHS — Hackerspace Portal alan (domain) tipleri.
 * Supabase tablolarıyla hizalı; Aşama B'de composable'lar bunları kullanır.
 */

export type MemberStatus = 'active' | 'inactive' | 'overdue'

export interface Member {
  id: string
  /** İnsan-okur üye numarası, örn. KHS-0042 */
  member_no: string
  full_name: string
  email: string
  phone: string | null
  status: MemberStatus
  joined_at: string
  created_at: string
}

export type DueStatus = 'paid' | 'pending' | 'overdue'

export interface Due {
  id: string
  member_id: string
  /** Aidat dönemi, örn. 2026-06 */
  period: string
  amount: number
  currency: string
  status: DueStatus
  paid_at: string | null
  created_at: string
}

/** RBAC rolleri — DB'deki public.app_role enum'u ile birebir aynı sırada. */
export type AppRole = 'superadmin' | 'admin' | 'keyholder' | 'member'

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Süper Admin',
  admin: 'Admin',
  keyholder: 'Anahtar Sahibi',
  member: 'Üye',
}

/**
 * public.profiles satırı.
 * Not: `type` (interface değil) — Supabase `Database` jeneriği satır tiplerinin
 * `Record<string, unknown>` ile uyumlu olmasını ister; interface'lerde örtük index
 * signature olmadığından bu uyum sağlanmaz.
 */
export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  created_at: string
}

/** public.user_roles satırı. (Yukarıdaki nedenle `type`.) */
export type UserRole = {
  id: string
  user_id: string
  role: AppRole
  created_at: string
}

/** profiles + user_roles birleşik görünümü (kullanıcı listesi için). */
export interface ManagedUser {
  id: string
  email: string | null
  full_name: string | null
  role: AppRole
  created_at: string
}

/** admin_create_user RPC girdisi. */
export interface CreateUserPayload {
  email: string
  password: string
  role: AppRole
  full_name: string
}

/** admin_update_user RPC girdisi. `password` boş bırakılırsa şifre değişmez. */
export interface UpdateUserPayload {
  id: string
  email: string
  full_name: string
  role: AppRole
  password?: string
}
