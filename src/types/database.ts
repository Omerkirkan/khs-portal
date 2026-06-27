import type { AppRole, AppSettings, DuesType, Member, MemberStatus, Profile, Transaction, TxnKind, UserRole } from '@/types'

/**
 * Supabase şemasının TypeScript tip tanımı.
 * `createClient<Database>()` ile bağlandığında tüm `.from()` / `.rpc()` çağrıları
 * tam tipli olur — böylece `any` kullanmadan satır ve dönüş tipleri çıkarılır.
 *
 * supabase/rbac.sql ile elle senkron tutulur (proje gerçek Supabase tip üretimine
 * geçerse `supabase gen types typescript` çıktısıyla değiştirilebilir).
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: UserRole
        Insert: {
          id?: string
          user_id: string
          role?: AppRole
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: AppRole
          created_at?: string
        }
        Relationships: []
      }
      members: {
        Row: Member
        // name_key DB tarafında üretilir (generated); Insert/Update'te yer almaz.
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone?: string | null
          status?: MemberStatus
          user_id?: string | null
          monthly_due?: number
          dues_type_id?: string | null
          joined_at?: string
          tc_no?: string | null
          gender?: string | null
          profession?: string | null
          education?: string | null
          website?: string | null
          member_type?: string | null
          birth_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          status?: MemberStatus
          user_id?: string | null
          monthly_due?: number
          dues_type_id?: string | null
          joined_at?: string
          tc_no?: string | null
          gender?: string | null
          profession?: string | null
          education?: string | null
          website?: string | null
          member_type?: string | null
          birth_date?: string | null
          created_at?: string
        }
        Relationships: []
      }
      dues_types: {
        Row: DuesType
        Insert: {
          id?: string
          name: string
          amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: AppSettings
        Insert: {
          id?: boolean
          dues_start?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          dues_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: {
          id?: string
          txn_date: string
          channel?: string | null
          receipt_no?: string | null
          description: string
          amount: number
          kind?: TxnKind
          counterparty_name?: string | null
          counterparty_sn?: string | null
          ref_no?: string | null
          period?: string | null
          member_id?: string | null
          applied?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          txn_date?: string
          channel?: string | null
          receipt_no?: string | null
          description?: string
          amount?: number
          kind?: TxnKind
          counterparty_name?: string | null
          counterparty_sn?: string | null
          ref_no?: string | null
          period?: string | null
          member_id?: string | null
          applied?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string
          p_password: string
          p_role?: AppRole
          p_full_name?: string
        }
        Returns: string
      }
      admin_update_user: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_email: string
          p_role: AppRole
          p_password?: string
        }
        Returns: undefined
      }
      admin_delete_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_bootstrap_superadmin: {
        Args: {
          p_email: string
          p_password: string
          p_full_name?: string
        }
        Returns: string
      }
      member_set_login: {
        Args: {
          p_member_id: string
          p_email: string
          p_password: string
          p_role?: AppRole
        }
        Returns: string
      }
      current_user_role: { Args: Record<string, never>; Returns: AppRole }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_superadmin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      app_role: AppRole
      member_status: MemberStatus
      txn_kind: TxnKind
    }
    CompositeTypes: { [_ in never]: never }
  }
}
