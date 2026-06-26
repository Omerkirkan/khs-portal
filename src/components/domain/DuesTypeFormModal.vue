<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Tag, Save, Loader2, AlertCircle } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import type { DuesTypeRow } from '@/composables/useDuesTypes'

/** Dışarı verilen ham form değerleri. */
export interface DuesTypeFormValues {
  name: string
  amount: number
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  /** edit modunda düzenlenen tip; create modunda null. */
  type: DuesTypeRow | null
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [values: DuesTypeFormValues]
  close: []
}>()

const name = ref('')
const amount = ref(0)

const isEdit = computed(() => props.mode === 'edit')

watch(
  () => [props.open, props.type] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.type) {
      name.value = props.type.name
      amount.value = props.type.amount
    } else {
      name.value = ''
      amount.value = 0
    }
  },
  { immediate: true },
)

function onSubmit(): void {
  if (props.submitting) return
  emit('submit', { name: name.value, amount: Number(amount.value) || 0 })
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? 'Aidat tipini düzenle' : 'Yeni aidat tipi'"
    subtitle="Örn. “Tam” = 2000 ₺, “Öğrenci” = 500 ₺"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium text-content">Tip Adı</span>
        <input
          v-model="name"
          type="text"
          required
          maxlength="40"
          placeholder="Tam"
          class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content placeholder:text-faint focus:border-accent"
        >
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium text-content">Aylık Tutar (₺)</span>
        <input
          v-model.number="amount"
          type="number"
          min="0"
          step="50"
          required
          placeholder="2000"
          class="rounded-lg border border-line bg-input px-3 py-2 font-mono text-sm text-content placeholder:font-sans placeholder:text-faint focus:border-accent"
        >
      </label>

      <p
        v-if="error"
        class="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ error }}</span>
      </p>

      <div class="flex justify-end gap-3 pt-1">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/10 hover:text-content"
          @click="emit('close')"
        >
          İptal
        </button>
        <button
          type="submit"
          :disabled="submitting"
          class="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          <component
            :is="submitting ? Loader2 : isEdit ? Save : Tag"
            class="h-4 w-4"
            :class="submitting && 'animate-spin'"
          />
          {{ submitting ? 'Kaydediliyor…' : isEdit ? 'Kaydet' : 'Tip Ekle' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
