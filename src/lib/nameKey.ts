/**
 * Türkçe-duyarlı isim normalleştirme. Üye eşleştirme ve tekilleştirme için
 * kullanılır; DB'deki public.member_name_key() ile birebir aynı sonucu üretir.
 * "YAKUP SELİM UÇAR" -> "yakup selim ucar".
 *
 * Ayrı (xlsx'siz) bir modüldür: hem banka çözümleyici hem de aidat hesabı bunu
 * kullanır, böylece aidat ekranı ağır XLSX paketini yüklemez.
 */
const TR_FROM = 'ÇĞİÖŞÜçğıöşü'
const TR_TO = 'CGIOSUcgiosu'

/** Türkçe karakterleri ASCII'ye indirger ve küçük harfe çevirir. */
export function fold(s: string): string {
  let out = ''
  for (const ch of s) {
    const i = TR_FROM.indexOf(ch)
    out += i >= 0 ? TR_TO.charAt(i) : ch
  }
  return out.toLowerCase()
}

/** Eşleştirme/tekilleştirme anahtarı. */
export function nameKey(name: string): string {
  return fold(name.trim().replace(/\s+/g, ' '))
}
