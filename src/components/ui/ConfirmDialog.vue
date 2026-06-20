<script setup lang="ts">
import { Loader2, AlertCircle, Trash2, AlertTriangle } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    busy?: boolean
    error?: string | null
  }>(),
  { confirmLabel: 'Sil', busy: false, error: null },
)

const emit = defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <BaseModal :open="open" :title="title" @close="emit('close')">
    <div class="flex flex-col gap-5">
      <div class="flex gap-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle class="h-5 w-5" />
        </span>
        <p class="pt-1.5 text-sm text-muted">{{ message }}</p>
      </div>

      <p
        v-if="error"
        class="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ error }}</span>
      </p>

      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/10 hover:text-content"
          @click="emit('close')"
        >
          İptal
        </button>
        <button
          type="button"
          :disabled="busy"
          class="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          @click="emit('confirm')"
        >
          <component :is="busy ? Loader2 : Trash2" class="h-4 w-4" :class="busy && 'animate-spin'" />
          {{ busy ? 'Siliniyor…' : confirmLabel }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
