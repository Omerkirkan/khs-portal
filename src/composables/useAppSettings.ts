import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * Tek satırlık (singleton) portal ayarları. Şimdilik yalnızca global aidat
 * takibi başlangıcını (`dues_start`) tutar; borç/ödeme matrisi bu aydan itibaren
 * hesaplanır (bkz. {@link import('./useDues').useDues}).
 */
export function useAppSettings() {
  /** Aidat takibi başlangıcı, 'YYYY-MM-DD' (ayın ilki) ya da null. */
  const duesStart = ref<string | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)

  function toMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const m = (err as { message: unknown }).message
      if (typeof m === 'string') return m
    }
    return fallback
  }

  async function loadSettings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data, error: selErr } = await supabase
        .from('app_settings')
        .select('dues_start')
        .eq('id', true)
        .maybeSingle()
      if (selErr) throw selErr
      duesStart.value = data?.dues_start ?? null
    } catch (err) {
      error.value = toMessage(err, 'Ayarlar yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  /**
   * Aidat takibi başlangıcını günceller. `value` 'YYYY-MM-DD' ya da temizlemek
   * için null. Başarılıysa true döner.
   */
  async function updateDuesStart(value: string | null): Promise<boolean> {
    submitting.value = true
    error.value = null
    try {
      const { error: updErr } = await supabase
        .from('app_settings')
        .update({ dues_start: value, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (updErr) throw updErr
      duesStart.value = value
      return true
    } catch (err) {
      error.value = toMessage(err, 'Ayar kaydedilemedi.')
      return false
    } finally {
      submitting.value = false
    }
  }

  return { duesStart, loading, submitting, error, loadSettings, updateDuesStart }
}
