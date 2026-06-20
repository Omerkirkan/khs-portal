<script setup lang="ts">
import { Users, CreditCard, AlertTriangle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'

const auth = useAuthStore()

interface Stat {
  label: string
  value: string
  hint: string
  icon: typeof Users
  tone: 'accent' | 'success' | 'warning'
}

// Aşama B'de gerçek Supabase verileriyle değiştirilecek özet kartlar.
const stats: Stat[] = [
  { label: 'Toplam Üye', value: '—', hint: 'Kayıtlı üye sayısı', icon: Users, tone: 'accent' },
  { label: 'Bu Ay Tahsilat', value: '—', hint: 'Toplanan aidat', icon: CreditCard, tone: 'success' },
  { label: 'Borçlu Üye', value: '—', hint: 'Aidatı geciken', icon: AlertTriangle, tone: 'warning' },
]

const toneClass: Record<Stat['tone'], string> = {
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
}
</script>

<template>
  <section class="flex flex-col gap-8">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
      <p class="mt-1 text-sm text-muted">
        Merhaba {{ auth.displayName }}, hackerspace'in güncel durumu burada.
      </p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/40"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-muted">{{ stat.label }}</p>
            <p class="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{{ stat.value }}</p>
          </div>
          <span class="flex h-10 w-10 items-center justify-center rounded-lg" :class="toneClass[stat.tone]">
            <component :is="stat.icon" class="h-5 w-5" />
          </span>
        </div>
        <p class="mt-3 text-xs text-faint">{{ stat.hint }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-dashed border-line bg-surface px-6 py-5">
      <p class="text-sm text-muted">
        Canlı metrikler ve grafikler yakında bu alanda yer alacak.
      </p>
    </div>
  </section>
</template>
