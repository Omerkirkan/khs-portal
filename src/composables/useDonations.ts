import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { nameKey } from '@/lib/nameKey'

/** Tek bir bağış işlemi (görünüm modeli). */
export interface DonationRow {
  id: string
  date: string
  name: string
  amount: number
  description: string
  refNo: string | null
  /** Bağışçı kayıtlı bir üye mi (isim eşleşmesine göre)? */
  isMember: boolean
}

/** Bağışçı bazında toplam. */
export interface DonorTotal {
  name: string
  total: number
  count: number
  isMember: boolean
}

export interface DonationsSummary {
  total: number
  count: number
  donorCount: number
  thisMonth: number
}

/** "YYYY-MM" bugün. */
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useDonations() {
  const donations = ref<DonationRow[]>([])
  const donors = ref<DonorTotal[]>([])
  const summary = ref<DonationsSummary>({ total: 0, count: 0, donorCount: 0, thisMonth: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

  function toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message: unknown }).message
      if (typeof m === 'string') return m
    }
    return fallback
  }

  async function loadDonations(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [txnRes, membersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, txn_date, counterparty_name, amount, description, ref_no')
          .eq('kind', 'bagis')
          .order('txn_date', { ascending: false }),
        supabase.from('members').select('full_name'),
      ])
      if (txnRes.error) throw txnRes.error
      if (membersRes.error) throw membersRes.error

      const memberKeys = new Set((membersRes.data ?? []).map((m) => nameKey(m.full_name)))
      const month = currentMonth()

      let total = 0
      let thisMonth = 0
      const donorMap = new Map<string, DonorTotal>()

      const list: DonationRow[] = (txnRes.data ?? []).map((t) => {
        const name = t.counterparty_name?.trim() || 'Bilinmeyen'
        const key = t.counterparty_name ? nameKey(t.counterparty_name) : `__${t.id}`
        const isMember = t.counterparty_name ? memberKeys.has(key) : false
        const amount = Number(t.amount)

        total += amount
        if ((t.txn_date ?? '').slice(0, 7) === month) thisMonth += amount

        const agg = donorMap.get(key) ?? { name, total: 0, count: 0, isMember }
        agg.total += amount
        agg.count += 1
        donorMap.set(key, agg)

        return {
          id: t.id,
          date: t.txn_date,
          name,
          amount,
          description: t.description,
          refNo: t.ref_no,
          isMember,
        }
      })

      donations.value = list
      donors.value = Array.from(donorMap.values()).sort((a, b) => b.total - a.total)
      summary.value = {
        total,
        count: list.length,
        donorCount: donorMap.size,
        thisMonth,
      }
    } catch (err) {
      error.value = toMessage(err, 'Bağışlar yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  return { donations, donors, summary, loading, error, loadDonations }
}
