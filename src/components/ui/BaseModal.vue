<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
}>()

const emit = defineEmits<{ close: [] }>()

/**
 * Modal açıkken sayfa kaydırmasını kilitler.
 * Not: Tasarım gereği modal YALNIZCA ✕ butonu veya içerideki "İptal"
 * ile kapanır — arkaplana tıklamak ya da Esc tuşu modalı kapatmaz.
 */
watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
      >
        <div class="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface shadow-pop">
          <header class="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div class="min-w-0">
              <h2 class="text-base font-semibold tracking-tight text-content">{{ title }}</h2>
              <p v-if="subtitle" class="mt-0.5 truncate text-sm text-muted">{{ subtitle }}</p>
            </div>
            <button
              type="button"
              class="-mr-1.5 shrink-0 rounded-lg p-1.5 text-faint transition hover:bg-zinc-500/10 hover:text-content"
              title="Kapat"
              @click="emit('close')"
            >
              <X class="h-5 w-5" />
            </button>
          </header>

          <div class="overflow-y-auto px-6 py-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.15s ease;
}
.modal-enter-from > div,
.modal-leave-to > div {
  transform: translateY(0.5rem) scale(0.98);
}
</style>
