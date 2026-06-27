import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { nameKey } from '@/lib/nameKey'
import type { TxnKind } from '@/types'

/** Hesap hareketleri tablosunda gösterilen tek bir işlem (görünüm modeli). */
export interface ActivityRow {
  id: string
  /** ISO zaman damgası (txn_date). */
  date: string
  channel: string | null
  receiptNo: string | null
  description: string
  counterpartyName: string | null
  kind: TxnKind
  period: string | null
  refNo: string | null
  amount: number
  /** Eşleşen üyenin adı (member_id ya da isim eşleşmesi); yoksa null. */
  memberName: string | null
}

export interface ActivitySummary {
  /** Toplam işlem sayısı. */
  count: number
  /** Gelen (pozitif) tutarların toplamı. */
  incoming: number
  /** Giden (negatif) tutarların toplamı (mutlak değer). */
  outgoing: number
  /** Net (gelen - giden). */
  net: number
}

export function useTransactions() {
  const rows = ref<ActivityRow[]>([])
  const summary = ref<ActivitySummary>({ count: 0, incoming: 0, outgoing: 0, net: 0 })
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

  /** Tüm banka işlemlerini üye eşleşmeleriyle birlikte yükler (en yeni en üstte). */
  async function loadTransactions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [txnRes, membersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(
            'id, txn_date, channel, receipt_no, description, counterparty_name, kind, period, ref_no, amount, member_id',
          )
          .order('txn_date', { ascending: false }),
        supabase.from('members').select('id, full_name'),
      ])
      if (txnRes.error) throw txnRes.error
      if (membersRes.error) throw membersRes.error

      const members = membersRes.data ?? []
      const byId = new Map(members.map((m) => [m.id, m.full_name]))
      const byKey = new Map(members.map((m) => [nameKey(m.full_name), m.full_name]))

      let incoming = 0
      let outgoing = 0

      rows.value = (txnRes.data ?? []).map((t) => {
        const amount = Number(t.amount)
        if (amount >= 0) incoming += amount
        else outgoing += -amount

        const memberName =
          (t.member_id ? byId.get(t.member_id) : undefined) ??
          (t.counterparty_name ? byKey.get(nameKey(t.counterparty_name)) : undefined) ??
          null

        return {
          id: t.id,
          date: t.txn_date,
          channel: t.channel,
          receiptNo: t.receipt_no,
          description: t.description,
          counterpartyName: t.counterparty_name,
          kind: t.kind,
          period: t.period,
          refNo: t.ref_no,
          amount,
          memberName,
        }
      })

      summary.value = {
        count: rows.value.length,
        incoming,
        outgoing,
        net: incoming - outgoing,
      }
    } catch (err) {
      error.value = toMessage(err, 'Hesap hareketleri yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  return { rows, summary, loading, error, loadTransactions }
}
