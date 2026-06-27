/**
 * "Kurum Üyelik Listesi" (.xlsx) çözümleyici.
 *
 * Dernek panelinden indirilen üye listesini okuyup her satırı yapılandırılmış bir
 * {@link ParsedMember}'a dönüştürür. Banka ekstresi çözümleyicisinin
 * ({@link import('./parseBankStatement')}) aksine burada üye başına çok daha fazla
 * detay vardır: T.C. Kimlik No, cinsiyet, meslek, öğrenim durumu, doğum tarihi vb.
 *
 * Sütunlar sabit indeksle değil **başlık adıyla** eşlenir (kolon sırası değişebilir).
 * Tarih hücreleri Excel seri numarası (örn. 46119.42894) olarak gelir ve ISO tarihe
 * çevrilir.
 *
 * Saf (yan etkisiz) bir modüldür; XLSX okuma bu modülde yapılır, DB'ye dokunmaz.
 */
import * as XLSX from 'xlsx'
import { nameKey } from '@/lib/nameKey'
import type { MemberStatus } from '@/types'

export interface ParsedMember {
  /** Ad Soyad (Excel'deki hâliyle). */
  fullName: string
  /** T.C. Kimlik No ya da null. */
  tcNo: string | null
  /** Cinsiyet (ERKEK/KADIN) ya da null. */
  gender: string | null
  /** Telefon ya da null. */
  phone: string | null
  /** Meslek ya da null. */
  profession: string | null
  /** Öğrenim durumu ya da null. */
  education: string | null
  /** E-posta ya da null. */
  email: string | null
  /** İnternet sitesi ya da null. */
  website: string | null
  /** Üye türü (Üye/Kurucu/Geçici Başkan) ya da null. */
  memberType: string | null
  /** Durum: "Pasif" → inactive, aksi halde active. */
  status: MemberStatus
  /** Doğum tarihi 'YYYY-MM-DD' ya da null. */
  birthDate: string | null
  /** Kayıt (üyelik) tarihi 'YYYY-MM-DD' ya da null. */
  joinedAt: string | null
  /** Türkçe-duyarlı eşleştirme anahtarı (DB name_key ile birebir aynı). */
  nameKey: string
  /** Excel'deki 1 tabanlı satır numarası (kullanıcıya gösterim için). */
  rowIndex: number
}

export interface MemberParseResult {
  members: ParsedMember[]
}

/** Excel seri numarasını 'YYYY-MM-DD'ye çevirir. Geçersizse null. */
function serialToISODate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  // Excel epoğu 1899-12-30 (1900 artık yıl hatası dahil). Tam kısım = gün, ondalık
  // = saat; tarihi almak için FLOOR (round olsaydı öğleden sonraki kayıtlar ertesi
  // güne yuvarlanırdı).
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Bir tarih hücresini ('YYYY-MM-DD') çözer: önce seri no, sonra "DD.MM.YYYY". */
function parseDateCell(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  // Seri numarası (örn. "46119.42894").
  if (/^\d+(\.\d+)?$/.test(s)) return serialToISODate(parseFloat(s))
  // "09.06.2026" / "09.06.2026 22:02" biçimi (savunmacı).
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

/** Boş/whitespace metni null'a indirger, aksi halde kırpılmış metni döner. */
function clean(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  return s || null
}

/** Başlık satırında, etiketi içeren ilk sütunun indeksini bulur (-1 yoksa). */
function colIndex(header: string[], label: string): number {
  return header.findIndex((h) => h.includes(label))
}

/** Başlık satırında etikete birebir eşit sütunun indeksini bulur (-1 yoksa). */
function exactCol(header: string[], label: string): number {
  return header.findIndex((h) => h === label)
}

/**
 * Bir "Kurum Üyelik Listesi" XLSX dosyasını (ArrayBuffer) çözümler.
 * @throws Beklenen "Ad Soyad" başlık sütunu bulunamazsa Error fırlatır.
 */
export function parseMemberList(data: ArrayBuffer): MemberParseResult {
  const wb = XLSX.read(data, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws) throw new Error('Excel dosyasında sayfa bulunamadı.')

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  // Başlık satırını bul ("Ad Soyad" sütununu içeren satır).
  const headerIdx = rows.findIndex((r) => r.some((c) => String(c).includes('Ad Soyad')))
  if (headerIdx < 0) {
    throw new Error('Beklenen "Ad Soyad" sütun başlığı bulunamadı. Doğru dosyayı seçtiğinizden emin olun.')
  }

  const header = (rows[headerIdx] ?? []).map((c) => String(c).trim())
  const cName = colIndex(header, 'Ad Soyad')
  const cTc = colIndex(header, 'T.C')
  const cGender = colIndex(header, 'Cinsiyet')
  const cPhone = colIndex(header, 'Telefon')
  const cProfession = colIndex(header, 'Meslek')
  const cEducation = colIndex(header, 'Öğrenim')
  const cEmail = colIndex(header, 'Posta')
  const cWebsite = colIndex(header, 'İnternet')
  const cMemberType = colIndex(header, 'Üye Tür')
  // "Durum" tam eşleşmeli: "Öğrenim Durumu" da "Durum" içerir.
  const cStatus = exactCol(header, 'Durum')
  const cBirth = colIndex(header, 'Doğum')
  const cJoined = colIndex(header, 'Kayıt')

  const at = (r: string[], i: number): unknown => (i >= 0 ? r[i] : '')

  const members: ParsedMember[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const fullName = String(at(r, cName) ?? '').trim()
    if (!fullName) continue

    const statusRaw = String(at(r, cStatus) ?? '').trim().toLocaleLowerCase('tr')
    const status: MemberStatus = statusRaw.startsWith('pasif') ? 'inactive' : 'active'

    members.push({
      fullName,
      tcNo: clean(at(r, cTc)),
      gender: clean(at(r, cGender)),
      phone: clean(at(r, cPhone)),
      profession: clean(at(r, cProfession)),
      education: clean(at(r, cEducation)),
      email: clean(at(r, cEmail)),
      website: clean(at(r, cWebsite)),
      memberType: clean(at(r, cMemberType)),
      status,
      birthDate: parseDateCell(at(r, cBirth)),
      joinedAt: parseDateCell(at(r, cJoined)),
      nameKey: nameKey(fullName),
      rowIndex: i + 1,
    })
  }

  return { members }
}
