import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { nameKey } from '@/lib/nameKey'
import type { MemberStatus } from '@/types'

/** Bir üyenin tek bir döneme (ay) ait aidat durumu. */
export type DuesState = 'paid' | 'partial' | 'unpaid' | 'credit' | 'none'

export interface DuesCell {
  period: string
  expected: number
  paid: number
  state: DuesState
}

export interface DuesMemberRow {
  id: string
  full_name: string
  status: MemberStatus
  monthlyDue: number
  joinedPeriod: string
  /** period -> hücre. */
  cells: Record<string, DuesCell>
  totalExpected: number
  totalPaid: number
  /** paid - expected. Negatif = borç, pozitif = fazla/alacak. */
  balance: number
}

export interface DuesSummary {
  totalExpected: number
  totalPaid: number
  totalDebt: number
  debtorCount: number
  /** Hiçbir üyeyle eşleşmeyen aidat ödemelerinin toplamı. */
  unmatchedPaid: number
  /** İçinde bulunduğumuz aya ait toplam aidat tahsilatı (eşleşen + eşleşmeyen). */
  currentMonthPaid: number
}

/** "YYYY-MM" döneminin bugünkü değerini döner. */
function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** [start, end] arası (dahil) ayları artan sırada üretir. */
function monthRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return []
  const out: string[] = []
  let [y, m] = start.split('-').map(Number) as [number, number]
  const [ey, em] = end.split('-').map(Number) as [number, number]
  // Aşırı geniş aralıkları sınırla (güvenlik): en fazla 60 ay.
  let guard = 0
  while ((y < ey || (y === ey && m <= em)) && guard < 60) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
    guard++
  }
  return out
}

export function useDues() {
  const periods = ref<string[]>([])
  const rows = ref<DuesMemberRow[]>([])
  const summary = ref<DuesSummary>({
    totalExpected: 0,
    totalPaid: 0,
    totalDebt: 0,
    debtorCount: 0,
    unmatchedPaid: 0,
    currentMonthPaid: 0,
  })
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

  /** Üyeler + aidat işlemlerinden aidat matrisini hesaplar. */
  async function loadDues(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [membersRes, txnRes, discountsRes, settingsRes] = await Promise.all([
        supabase.from('members').select('id, full_name, status, joined_at'),
        supabase
          .from('transactions')
          .select('counterparty_name, period, amount')
          .eq('kind', 'aidat'),
        supabase.from('member_discounts').select('member_id, start_month, end_month'),
        supabase
          .from('app_settings')
          .select('dues_start, full_price, discount_price')
          .eq('id', true)
          .maybeSingle(),
      ])
      if (membersRes.error) throw membersRes.error
      if (txnRes.error) throw txnRes.error
      if (discountsRes.error) throw discountsRes.error
      if (settingsRes.error) throw settingsRes.error

      // Global aidat takibi başlangıcı ('YYYY-MM'); öncesi hesaba katılmaz.
      const duesStart = settingsRes.data?.dues_start ? settingsRes.data.dues_start.slice(0, 7) : null
      // Global fiyatlar (tam / indirimli).
      const fullPrice = settingsRes.data?.full_price != null ? Number(settingsRes.data.full_price) : 2000
      const discountPrice = settingsRes.data?.discount_price != null ? Number(settingsRes.data.discount_price) : 500

      // İndirim dönemleri: üye id -> [{ s:'YYYY-MM', e:'YYYY-MM' }] (iki uç dahil).
      const discountsByMember = new Map<string, { s: string; e: string }[]>()
      for (const d of discountsRes.data ?? []) {
        const list = discountsByMember.get(d.member_id) ?? []
        list.push({ s: d.start_month.slice(0, 7), e: d.end_month.slice(0, 7) })
        discountsByMember.set(d.member_id, list)
      }

      const members = membersRes.data ?? []
      const txns = txnRes.data ?? []
      const cur = currentPeriod()

      // Ödemeleri name_key + dönem bazında topla.
      const paidByKey = new Map<string, Map<string, number>>()
      const memberKeys = new Set(members.map((m) => nameKey(m.full_name)))
      let unmatchedPaid = 0
      let currentMonthPaid = 0
      for (const t of txns) {
        const period = t.period || cur
        if (period === cur) currentMonthPaid += Number(t.amount)
        if (!t.counterparty_name) {
          unmatchedPaid += Number(t.amount)
          continue
        }
        const key = nameKey(t.counterparty_name)
        if (!memberKeys.has(key)) {
          unmatchedPaid += Number(t.amount)
          continue
        }
        const byPeriod = paidByKey.get(key) ?? new Map<string, number>()
        byPeriod.set(period, (byPeriod.get(period) ?? 0) + Number(t.amount))
        paidByKey.set(key, byPeriod)
      }

      // Sütun aralığı: en erken (üyelik ayı / ödeme ayı) → bugün (veya en geç ödeme).
      let minP = cur
      let maxP = cur
      for (const m of members) {
        const jp = (m.joined_at ?? '').slice(0, 7)
        if (jp && m.status !== 'inactive' && jp < minP) minP = jp
      }
      for (const byPeriod of paidByKey.values()) {
        for (const p of byPeriod.keys()) {
          if (p < minP) minP = p
          if (p > maxP) maxP = p
        }
      }
      // Aidat takibi başlangıcı ayarlıysa bu aydan öncesini kırp (üye o aydan
      // önce katılmış olsa bile borç bu aydan itibaren sayılır).
      if (duesStart && duesStart > minP) minP = duesStart
      const cols = monthRange(minP, maxP)
      periods.value = cols

      // Her üye için hücreleri ve bakiyeyi hesapla.
      const memberRows: DuesMemberRow[] = []
      let sumExpected = 0
      let sumPaid = 0
      let sumDebt = 0
      let debtors = 0

      for (const m of members) {
        const key = nameKey(m.full_name)
        const joinedPeriod = (m.joined_at ?? '').slice(0, 7)
        const liable = m.status !== 'inactive'
        const byPeriod = paidByKey.get(key) ?? new Map<string, number>()
        // Standart aylık aidat tam fiyattır; indirim dönemlerindeki aylarda
        // beklenen tutar indirimli fiyat olur (hücre bazında hesaplanır).
        const periods = discountsByMember.get(m.id) ?? []
        const monthlyDue = fullPrice

        const cells: Record<string, DuesCell> = {}
        let totalExpected = 0
        let totalPaid = 0

        for (const p of cols) {
          const inRange = liable && joinedPeriod && p >= joinedPeriod && p <= cur
          const discounted = periods.some((per) => per.s <= p && p <= per.e)
          const expected = inRange ? (discounted ? discountPrice : fullPrice) : 0
          const paid = byPeriod.get(p) ?? 0
          totalExpected += expected
          totalPaid += paid

          let state: DuesState
          if (expected === 0 && paid === 0) state = 'none'
          else if (expected === 0 && paid > 0) state = 'credit'
          else if (paid >= expected) state = 'paid'
          else if (paid > 0) state = 'partial'
          else state = 'unpaid'

          cells[p] = { period: p, expected, paid, state }
        }

        const balance = totalPaid - totalExpected
        sumExpected += totalExpected
        sumPaid += totalPaid
        if (balance < 0) {
          sumDebt += -balance
          debtors++
        }

        memberRows.push({
          id: m.id,
          full_name: m.full_name,
          status: m.status,
          monthlyDue,
          joinedPeriod,
          cells,
          totalExpected,
          totalPaid,
          balance,
        })
      }

      // Borçluyu öne, sonra ada göre sırala.
      memberRows.sort((a, b) => {
        if ((a.balance < 0) !== (b.balance < 0)) return a.balance < 0 ? -1 : 1
        return a.full_name.localeCompare(b.full_name, 'tr')
      })

      rows.value = memberRows
      summary.value = {
        totalExpected: sumExpected,
        totalPaid: sumPaid,
        totalDebt: sumDebt,
        debtorCount: debtors,
        unmatchedPaid,
        currentMonthPaid,
      }
    } catch (err) {
      error.value = toMessage(err, 'Aidat verileri yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  return { periods, rows, summary, loading, error, loadDues }
}
