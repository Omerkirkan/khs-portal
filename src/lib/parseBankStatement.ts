/**
 * Banka ekstresi (.xls/.xlsx) çözümleyici.
 *
 * Konya Teknoloji Derneği hesap hareketleri dökümünü okuyup her satırı
 * yapılandırılmış bir {@link ParsedTransaction}'a dönüştürür. Açıklama (description)
 * alanındaki desenlerden işlem türünü (aidat / bağış / diğer), gönderen kişiyi ve
 * dönem bilgisini çıkarır.
 *
 * İki açıklama biçimi desteklenir:
 *   • Fast:  "SN:6584415 ÖMER KIRKAN Açıklama: Aidat GönBanka:205 FastRef:2570495 ..."
 *   • EFT :  "Ref No:  SN:9794196 AHMET SAFA ORHAN Aidat GönBanka:205 EftRef:6 ..."
 *
 * Saf (yan etkisiz) bir modüldür; XLSX okuma çağıran tarafça yapılır.
 */
import * as XLSX from 'xlsx'
import { fold, nameKey } from '@/lib/nameKey'
import type { TxnKind } from '@/types'

export { nameKey } from '@/lib/nameKey'

export interface ParsedTransaction {
  /** ISO-8601 yerel zaman damgası, örn. "2026-06-09T22:02:00". */
  txnDate: string
  /** Ekstredeki ham tarih metni, örn. "09.06.2026 22:02". */
  rawDate: string
  /** Kanal (BATCH / SUBE / INTERNET …), boşlukları kırpılmış. */
  channel: string
  /** Fiş No. */
  receiptNo: string
  /** Ham Açıklama metni. */
  description: string
  /** Tutar (TL). Gelen pozitif, giden negatif. */
  amount: number
  /** İşlem türü. */
  kind: TxnKind
  /** Gönderen kişi adı (ekstredeki BÜYÜK harfli hâliyle) ya da null. */
  counterpartyName: string | null
  /** Gönderen SN numarası ya da null. */
  counterpartySn: string | null
  /** FastRef / EftRef değeri ya da null. */
  refNo: string | null
  /** Aidat dönemi 'YYYY-MM'. Açıklamadaki ay adından, yoksa işlem tarihinden. */
  period: string
  /** Türkçe-duyarlı eşleştirme anahtarı, örn. "yakup selim ucar". İsim yoksa "". */
  nameKey: string
}

export interface ParseResult {
  /** Ekstre üst bilgisi (hesap sahibi, IBAN, tarih aralığı). */
  meta: { accountName: string | null; iban: string | null; dateRange: string | null }
  transactions: ParsedTransaction[]
}

/** ASCII-folded ay adları (Türkçe), Ocak=0 … Aralık=11. */
const MONTHS = [
  'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
  'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
]

/** Açıklama metninden işlem türünü belirler. */
function classify(descFold: string): TxnKind {
  if (descFold.includes('bagis')) return 'bagis'
  if (descFold.includes('aidat')) return 'aidat'
  return 'diger'
}

/** Yalnızca Türkçe BÜYÜK harf (ve kesme işareti) içeren bir ad parçası mı? */
function isNameToken(tok: string): boolean {
  return /^[A-ZÇĞİÖŞÜ'][A-ZÇĞİÖŞÜ']*$/u.test(tok)
}

/** "SN:<rakam> <İSİM> …" deseninden SN ve ardışık BÜYÜK harfli adı çıkarır. */
function extractParty(desc: string): { sn: string | null; name: string | null } {
  const m = /SN:\s*(\d+)\s+(.*)/u.exec(desc)
  if (!m) return { sn: null, name: null }
  const tokens = (m[2] ?? '').split(/\s+/)
  const nameToks: string[] = []
  for (const t of tokens) {
    if (isNameToken(t)) nameToks.push(t)
    else break
  }
  return { sn: m[1] ?? null, name: nameToks.length ? nameToks.join(' ') : null }
}

/** "2,000.00" / "-631.00" gibi metni sayıya çevirir (binlik virgülü atılır). */
function parseAmount(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** "09.06.2026 22:02" -> { iso, period: 'YYYY-MM' }. */
function parseDate(raw: unknown): { iso: string; rawDate: string; period: string } {
  const rawDate = String(raw ?? '').trim()
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(rawDate)
  if (!m) return { iso: '', rawDate, period: '' }
  const dd = m[1] ?? '', mm = m[2] ?? '', yyyy = m[3] ?? '', hh = m[4] ?? '00', mi = m[5] ?? '00'
  return { iso: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`, rawDate, period: `${yyyy}-${mm}` }
}

/** Açıklamada ay adı geçiyorsa onu, yoksa işlem ayını döner ('YYYY-MM'). */
function resolvePeriod(descFold: string, txnPeriod: string): string {
  const year = txnPeriod.slice(0, 4)
  for (let i = 0; i < MONTHS.length; i++) {
    const month = MONTHS[i]
    if (year && month && descFold.includes(month)) {
      return `${year}-${String(i + 1).padStart(2, '0')}`
    }
  }
  return txnPeriod
}

/** Bir başlık etiketiyle başlayan sütunun indeksini bulur. */
function colIndex(header: string[], label: string): number {
  return header.findIndex((h) => h.startsWith(label))
}

/**
 * Bir XLSX çalışma kitabı dosyasını (ArrayBuffer) çözümler.
 * @throws Beklenen başlık satırı bulunamazsa Error fırlatır.
 */
export function parseBankStatement(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) throw new Error('Excel dosyasında sayfa bulunamadı.')

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  // Üst bilgi (başlıktan önceki etiketli satırlar).
  const findMeta = (label: string): string | null => {
    const row = rows.find((r) => String(r[0] ?? '').trim().startsWith(label))
    const val = row ? String(row[1] ?? '').trim() : ''
    return val || null
  }
  const meta = {
    accountName: findMeta('Ad Soyad'),
    iban: findMeta('IBAN'),
    dateRange: findMeta('Tarih Aralığı'),
  }

  // Başlık satırını bul (Tarih + Açıklama sütunlarını içeren satır).
  const headerIdx = rows.findIndex(
    (r) =>
      r.some((c) => String(c).trim() === 'Tarih') &&
      r.some((c) => String(c).trim().startsWith('Açıklama')),
  )
  if (headerIdx < 0) {
    throw new Error('Beklenen sütun başlıkları (Tarih, Açıklama …) bulunamadı.')
  }

  const header = (rows[headerIdx] ?? []).map((c) => String(c).trim())
  const cDate = colIndex(header, 'Tarih')
  const cChannel = colIndex(header, 'Kanal')
  const cReceipt = colIndex(header, 'Fiş')
  const cDesc = colIndex(header, 'Açıklama')
  const cAmount = colIndex(header, 'Tutar')

  const transactions: ParsedTransaction[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const description = String(r[cDesc] ?? '').trim()
    if (!description) continue

    const descFold = fold(description)
    const { iso, rawDate, period: txnPeriod } = parseDate(r[cDate])
    const { sn, name } = extractParty(description)

    transactions.push({
      txnDate: iso,
      rawDate,
      channel: String(r[cChannel] ?? '').trim(),
      receiptNo: String(r[cReceipt] ?? '').trim(),
      description,
      amount: parseAmount(r[cAmount]),
      kind: classify(descFold),
      counterpartyName: name,
      counterpartySn: sn,
      refNo: (/(?:FastRef|EftRef):\s*(\d+)/i.exec(description) ?? [])[1] ?? null,
      period: resolvePeriod(descFold, txnPeriod),
      nameKey: name ? nameKey(name) : '',
    })
  }

  return { meta, transactions }
}
