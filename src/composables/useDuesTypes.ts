import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { DuesType } from '@/types'

/** Aidat tipi + o tipe atanmış üye sayısı (liste görünümü için). */
export interface DuesTypeRow extends DuesType {
  memberCount: number
}

export interface DuesTypeInput {
  name: string
  amount: number
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

/**
 * Aidat tipi yönetimi (`public.dues_types`). Tipler adlandırılmış aidat
 * şablonlarıdır (örn. "Tam" = 2000 ₺) ve üyelere atanır; üyenin beklenen aylık
 * aidatı atandığı tipin GÜNCEL tutarıdır. Yönetim yalnızca admin'e açıktır (RLS).
 */
export function useDuesTypes() {
  const types = ref<DuesTypeRow[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  /** Tipleri + her tipe atanmış üye sayısını yükler. */
  async function listTypes(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [typesRes, membersRes] = await Promise.all([
        supabase.from('dues_types').select('*').order('amount', { ascending: false }),
        supabase.from('members').select('dues_type_id'),
      ])
      if (typesRes.error) throw typesRes.error
      if (membersRes.error) throw membersRes.error

      const countByType = new Map<string, number>()
      for (const m of membersRes.data ?? []) {
        if (m.dues_type_id) countByType.set(m.dues_type_id, (countByType.get(m.dues_type_id) ?? 0) + 1)
      }

      types.value = (typesRes.data ?? []).map((t) => ({
        ...t,
        amount: Number(t.amount),
        memberCount: countByType.get(t.id) ?? 0,
      }))
    } catch (err) {
      error.value = toMessage(err, 'Aidat tipleri yüklenemedi.')
    } finally {
      loading.value = false
    }
  }

  async function createType(input: DuesTypeInput): Promise<boolean> {
    submitting.value = true
    error.value = null
    try {
      const { error: insErr } = await supabase
        .from('dues_types')
        .insert({ name: input.name.trim(), amount: input.amount })
      if (insErr) throw insErr
      await listTypes()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Aidat tipi oluşturulamadı.')
      return false
    } finally {
      submitting.value = false
    }
  }

  async function updateType(id: string, input: DuesTypeInput): Promise<boolean> {
    submitting.value = true
    error.value = null
    try {
      const { error: updErr } = await supabase
        .from('dues_types')
        .update({ name: input.name.trim(), amount: input.amount })
        .eq('id', id)
      if (updErr) throw updErr
      await listTypes()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Aidat tipi güncellenemedi.')
      return false
    } finally {
      submitting.value = false
    }
  }

  /** Tipi siler. Atanmış üyeler DB'de otomatik özel tutara (null) düşer. */
  async function deleteType(id: string): Promise<boolean> {
    deleting.value = true
    error.value = null
    try {
      const { error: delErr } = await supabase.from('dues_types').delete().eq('id', id)
      if (delErr) throw delErr
      await listTypes()
      return true
    } catch (err) {
      error.value = toMessage(err, 'Aidat tipi silinemedi.')
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    types,
    loading,
    submitting,
    deleting,
    error,
    listTypes,
    createType,
    updateType,
    deleteType,
  }
}
