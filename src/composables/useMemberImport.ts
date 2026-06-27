import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { parseMemberList, type ParsedMember } from '@/lib/parseMemberList'
import { nameKey } from '@/lib/nameKey'
import type { MemberRow } from '@/types'
import type { Database } from '@/types/database'

/** members tablosu güncelleme yükü tipi (Supabase Update). */
type MemberUpdate = Database['public']['Tables']['members']['Update']

/**
 * İçe aktarma tablosunda gösterilen satır: çözümlenmiş üye + mevcut kayıt eşleşmesi.
 * Eşleşme önce T.C. Kimlik No, yoksa Türkçe-duyarlı isim (name_key) ile kurulur.
 */
export interface MemberImportRow extends ParsedMember {
  /** Eşleşen mevcut üye id'si (yoksa null = yeni üye). */
  matchedId: string | null
  /** Eşleşen mevcut üyenin adı (yoksa null). */
  matchedName: string | null
  /** Eşleşmenin neye göre kurulduğu. */
  matchBy: 'tc' | 'name' | null
  /** Kullanıcı bu satırı aktarmak için seçti mi? */
  selected: boolean
}

/** Kaydetme sonucu özeti. */
export interface MemberImportSummary {
  inserted: number
  updated: number
  failed: number
}

/**
 * Yeni üye için tam ekleme yükü (auth'a dokunmaz; null değerler de yazılır).
 */
function insertPayload(r: MemberImportRow) {
  return {
    full_name: r.fullName.trim(),
    email: r.email,
    phone: r.phone,
    status: r.status,
    tc_no: r.tcNo,
    gender: r.gender,
    profession: r.profession,
    education: r.education,
    website: r.website,
    member_type: r.memberType,
    birth_date: r.birthDate,
    ...(r.joinedAt ? { joined_at: r.joinedAt } : {}),
  }
}

/**
 * Mevcut üyeyi güncelleme (üzerine yazma) yükü. Yalnızca Excel'de DOLU olan
 * alanlar yazılır; boş hücreler mevcut veriyi (örn. e-posta, telefon) silmez.
 * `full_name` ve `status` her zaman güncellenir.
 */
function updatePayload(r: MemberImportRow): MemberUpdate {
  const p: MemberUpdate = { full_name: r.fullName.trim(), status: r.status }
  if (r.email) p.email = r.email
  if (r.phone) p.phone = r.phone
  if (r.tcNo) p.tc_no = r.tcNo
  if (r.gender) p.gender = r.gender
  if (r.profession) p.profession = r.profession
  if (r.education) p.education = r.education
  if (r.website) p.website = r.website
  if (r.memberType) p.member_type = r.memberType
  if (r.birthDate) p.birth_date = r.birthDate
  if (r.joinedAt) p.joined_at = r.joinedAt
  return p
}

export function useMemberImport() {
  const rows = ref<MemberImportRow[]>([])
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

  /** Mevcut üyeleri T.C. ve isim anahtarına göre indeksler. */
  function indexMembers(members: MemberRow[]): {
    byTc: Map<string, MemberRow>
    byName: Map<string, MemberRow>
  } {
    const byTc = new Map<string, MemberRow>()
    const byName = new Map<string, MemberRow>()
    for (const m of members) {
      if (m.tc_no) byTc.set(m.tc_no.trim(), m)
      byName.set(m.name_key || nameKey(m.full_name), m)
    }
    return { byTc, byName }
  }

  /** Tek bir çözümlenmiş üyeyi mevcut kayıtlarla eşleştirir (önce T.C., sonra isim). */
  function matchOne(
    p: ParsedMember,
    idx: { byTc: Map<string, MemberRow>; byName: Map<string, MemberRow> },
  ): { matchedId: string | null; matchedName: string | null; matchBy: 'tc' | 'name' | null } {
    const byTc = p.tcNo ? idx.byTc.get(p.tcNo.trim()) : undefined
    if (byTc) return { matchedId: byTc.id, matchedName: byTc.full_name, matchBy: 'tc' }
    const byName = p.nameKey ? idx.byName.get(p.nameKey) : undefined
    if (byName) return { matchedId: byName.id, matchedName: byName.full_name, matchBy: 'name' }
    return { matchedId: null, matchedName: null, matchBy: null }
  }

  /** Mevcut satırları güncel üye listesine göre yeniden eşleştirir (seçimi korur). */
  function rematch(members: MemberRow[]): void {
    const idx = indexMembers(members)
    rows.value = rows.value.map((r) => ({ ...r, ...matchOne(r, idx) }))
  }

  /** Dosyayı çözümler ve mevcut üyelerle eşleştirir. */
  async function parseFile(file: File, members: MemberRow[]): Promise<void> {
    parsing.value = true
    error.value = null
    rows.value = []
    fileName.value = file.name
    try {
      const buf = await file.arrayBuffer()
      const { members: parsed } = parseMemberList(buf)
      const idx = indexMembers(members)
      rows.value = parsed.map((p) => ({ ...p, ...matchOne(p, idx), selected: true }))
      if (rows.value.length === 0) {
        error.value = 'Dosyada üye satırı bulunamadı.'
      }
    } catch (err) {
      error.value = toMessage(err, 'Excel dosyası okunamadı.')
      fileName.value = null
    } finally {
      parsing.value = false
    }
  }

  /**
   * Seçili satırları members tablosuna yazar. Eşleşmeyen satırlar eklenir;
   * eşleşenler (T.C. veya isim) güncellenir (üzerine yazılır). Giriş hesabı,
   * dues_type_id ve monthly_due'ya DOKUNULMAZ. Hatalar satır bazında sayılır.
   */
  async function save(): Promise<MemberImportSummary | null> {
    const selected = rows.value.filter((r) => r.selected)
    if (selected.length === 0) return { inserted: 0, updated: 0, failed: 0 }
    saving.value = true
    error.value = null
    let inserted = 0
    let updated = 0
    let failed = 0
    try {
      for (const r of selected) {
        if (r.matchedId) {
          const { error: updErr } = await supabase
            .from('members')
            .update(updatePayload(r))
            .eq('id', r.matchedId)
          if (updErr) failed++
          else updated++
        } else {
          const { error: insErr } = await supabase.from('members').insert(insertPayload(r))
          if (insErr) failed++
          else inserted++
        }
      }
      if (failed > 0 && inserted === 0 && updated === 0) {
        error.value = 'Seçili üyeler kaydedilemedi. Veriyi ve yetkilerinizi kontrol edin.'
      }
      return { inserted, updated, failed }
    } catch (err) {
      error.value = toMessage(err, 'Üyeler kaydedilemedi.')
      return null
    } finally {
      saving.value = false
    }
  }

  function reset(): void {
    rows.value = []
    fileName.value = null
    error.value = null
  }

  return { rows, fileName, parsing, saving, error, parseFile, rematch, save, reset }
}
