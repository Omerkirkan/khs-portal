<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Users, CreditCard, AlertTriangle, Loader2, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMembers } from '@/composables/useMembers'
import { useDues } from '@/composables/useDues'

const auth = useAuthStore()
const { members, loading: membersLoading, error: membersError, listMembers } = useMembers()
const { summary, loading: duesLoading, error: duesError, loadDues } = useDues()

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const loading = computed(() => membersLoading.value || duesLoading.value)
const error = computed(() => membersError.value || duesError.value)

interface Stat {
  label: string
  value: string
  hint: string
  icon: typeof Users
  tone: 'accent' | 'success' | 'warning'
}

const stats = computed<Stat[]>(() => [
  {
    label: 'Toplam Üye',
    value: String(members.value.length),
    hint: 'Kayıtlı üye sayısı',
    icon: Users,
    tone: 'accent',
  },
  {
    label: 'Bu Ay Tahsilat',
    value: tl.format(summary.value.currentMonthPaid),
    hint: 'Bu ay toplanan aidat',
    icon: CreditCard,
    tone: 'success',
  },
  {
    label: 'Borçlu Üye',
    value: String(summary.value.debtorCount),
    hint: 'Aidatı geciken',
    icon: AlertTriangle,
    tone: 'warning',
  },
])

const toneClass: Record<Stat['tone'], string> = {
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
}

async function load(): Promise<void> {
  await Promise.all([listMembers(), loadDues()])
}

onMounted(load)
</script>

<template>
  <section class="flex flex-col gap-8">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
        <p class="mt-1 text-sm text-muted">
          Merhaba {{ auth.displayName }}, hackerspace'in güncel durumu burada.
        </p>
      </div>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-zinc-500/10 disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        Yenile
      </button>
    </header>

    <p
      v-if="error"
      class="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {{ error }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/40"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-muted">{{ stat.label }}</p>
            <p class="mt-2 flex h-9 items-center text-3xl font-semibold tracking-tight tabular-nums">
              <Loader2 v-if="loading" class="h-6 w-6 animate-spin text-faint" />
              <span v-else>{{ stat.value }}</span>
            </p>
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
