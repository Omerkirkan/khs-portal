import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { parseBankStatement, type ParsedTransaction, type ParseResult } from '@/lib/parseBankStatement'
import { nameKey } from '@/lib/nameKey'
import type { MemberRow } from '@/types'

/** İçe aktarma tablosunda gösterilen satır: çözümlenmiş işlem + üye eşleşmesi. */
export interface ImportRow extends ParsedTransaction {
  /** Eşleşen üye id'si (yoksa null). */
  memberId: string | null
  /** Eşleşen üyenin tam adı (yoksa null). */
  memberName: string | null
}

/** Kaydetme sonucu özeti. */
export interface ImportSummary {
  inserted: number
  skipped: number
}

export function useTransactionImport() {
  const rows = ref<ImportRow[]>([])
  const meta = ref<ParseResult['meta'] | null>(null)
  const fileName = ref<string | null>(null)
  const parsing = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  function toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message: unknown }).message
      if (typeof m === 'string') return m
    }
    return fallback
  }

  /** name_key -> üye eşlemesi kurar. */
  function indexMembers(members: MemberRow[]): Map<string, MemberRow> {
    const map = new Map<string, MemberRow>()
    for (const m of members) map.set(nameKey(m.full_name), m)
    return map
  }

  /** Mevcut satırları güncel üye listesine göre yeniden eşleştirir. */
  function rematch(members: MemberRow[]): void {
    const map = indexMembers(members)
    rows.value = rows.value.map((r) => {
      const hit = r.nameKey ? map.get(r.nameKey) : undefined
      return { ...r, memberId: hit?.id ?? null, memberName: hit?.full_name ?? null }
    })
  }

  /** Bir dosyayı çözümler ve üye listesine göre eşleştirir. */
  async function parseFile(file: File, members: MemberRow[]): Promise<void> {
    parsing.value = true
    error.value = null
    rows.value = []
    meta.value = null
    fileName.value = file.name
    try {
      const buf = await file.arrayBuffer()
      const result = parseBankStatement(buf)
      const map = indexMembers(members)

      meta.value = result.meta
      rows.value = result.transactions.map((t) => {
        const hit = t.nameKey ? map.get(t.nameKey) : undefined
        return { ...t, memberId: hit?.id ?? null, memberName: hit?.full_name ?? null }
      })
    } catch (err) {
      error.value = toMessage(err, 'Excel dosyası okunamadı.')
      fileName.value = null
    } finally {
      parsing.value = false
    }
  }

  /**
   * Çözümlenmiş işlemleri veritabanına kaydeder. Doğal anahtar (fiş no + tarih +
   * tutar) ile tekrar içe aktarmada çift kayıt oluşmaz. Eşleşen üye varsa
   * member_id de yazılır.
   */
  async function save(): Promise<ImportSummary | null> {
    if (rows.value.length === 0) return { inserted: 0, skipped: 0 }
    saving.value = true
    error.value = null
    try {
      const payload = rows.value.map((r) => ({
        txn_date: r.txnDate,
        channel: r.channel || null,
        receipt_no: r.receiptNo || null,
        description: r.description,
        amount: r.amount,
        kind: r.kind,
        counterparty_name: r.counterpartyName,
        counterparty_sn: r.counterpartySn,
        ref_no: r.refNo,
        period: r.period || null,
        member_id: r.memberId,
      }))

      const { data, error: upErr } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'receipt_no,txn_date,amount', ignoreDuplicates: true })
        .select('id')
      if (upErr) throw upErr

      const inserted = data?.length ?? 0
      return { inserted, skipped: payload.length - inserted }
    } catch (err) {
      error.value = toMessage(err, 'İşlemler kaydedilemedi.')
      return null
    } finally {
      saving.value = false
    }
  }

  function reset(): void {
    rows.value = []
    meta.value = null
    fileName.value = null
    error.value = null
  }

  return { rows, meta, fileName, parsing, saving, error, parseFile, rematch, save, reset }
}
