/**
 * KHS — Hackerspace Portal alan (domain) tipleri.
 * Supabase tablolarıyla hizalı; Aşama B'de composable'lar bunları kullanır.
 */

/** public.member_status enum'u ile birebir. */
export type MemberStatus = 'active' | 'inactive' | 'overdue'

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  overdue: 'Borçlu',
}

/**
 * public.members satırı. Üye login ZORUNLU DEĞİL: `user_id` null ise üye giriş
 * yapamaz; `member_set_login` ile sonradan bir auth hesabına bağlanabilir.
 * Not: Supabase `Database` jeneriği gereği `interface` değil `type` (bkz. Profile).
 */
export type Member = {
  id: string
  full_name: string
  name_key: string
  email: string | null
  phone: string | null
  status: MemberStatus
  user_id: string | null
  monthly_due: number
  joined_at: string
  created_at: string
}

/** public.txn_kind enum'u ile birebir. */
export type TxnKind = 'aidat' | 'bagis' | 'diger'

export const TXN_KIND_LABELS: Record<TxnKind, string> = {
  aidat: 'Aidat',
  bagis: 'Bağış',
  diger: 'Diğer',
}

/** public.transactions satırı. (Yukarıdaki nedenle `type`.) */
export type Transaction = {
  id: string
  txn_date: string
  channel: string | null
  receipt_no: string | null
  description: string
  amount: number
  kind: TxnKind
  counterparty_name: string | null
  counterparty_sn: string | null
  ref_no: string | null
  period: string | null
  member_id: string | null
  applied: boolean
  created_at: string
}

/**
 * Üyeler listesi görünüm modeli: members satırı + (varsa) login rolü.
 * `role` null ise üyenin giriş hesabı yoktur.
 */
export interface MemberRow {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  status: MemberStatus
  user_id: string | null
  role: AppRole | null
  /** Aylık aidat tutarı (TL). */
  monthly_due: number
  /** Üyelik başlangıcı (YYYY-MM-DD) — borç bu aydan itibaren hesaplanır. */
  joined_at: string
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

