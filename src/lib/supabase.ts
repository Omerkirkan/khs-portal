import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[KHS] Supabase yapılandırması eksik. .env.local içine VITE_SUPABASE_URL ve ' +
      'VITE_SUPABASE_ANON_KEY değerlerini ekleyin (örnek için .env.example dosyasına bakın).',
  )
}

/**
 * Uygulama genelinde tek Supabase client örneği.
 * Auth ve Database erişimi için tüm composable/store'lar bunu kullanır.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
