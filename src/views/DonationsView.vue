<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  Gift,
  Loader2,
  RefreshCw,
  Heart,
  Users as UsersIcon,
  CalendarDays,
  CheckCircle2,
} from 'lucide-vue-next'
import { useDonations } from '@/composables/useDonations'

const { donations, donors, summary, loading, error, loadDonations } = useDonations()

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})
const tlExact = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const hasData = computed(() => donations.value.length > 0)

onMounted(loadDonations)
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Bağışlar</h1>
        <p class="mt-1 text-sm text-muted">
          Üyelerden ve dışarıdan gelen bağışlar. Banka işlemlerinden otomatik ayrıştırılır.
        </p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
        :disabled="loading"
        @click="loadDonations"
      >
        <component :is="loading ? Loader2 : RefreshCw" class="h-4 w-4" :class="loading && 'animate-spin'" />
        Yenile
      </button>
    </header>

    <!-- Özet kartları -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Heart class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Toplam bağış</p>
          <p class="font-mono text-lg font-semibold text-content">{{ tl.format(summary.total) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Gift class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Bağış sayısı</p>
          <p class="font-mono text-lg font-semibold text-content">{{ summary.count }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <UsersIcon class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Bağışçı sayısı</p>
          <p class="font-mono text-lg font-semibold text-content">{{ summary.donorCount }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CalendarDays class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Bu ay</p>
          <p class="font-mono text-lg font-semibold text-content">{{ tl.format(summary.thisMonth) }}</p>
        </div>
      </div>
    </div>

    <!-- Yükleniyor / hata / boş -->
    <div v-if="loading && !hasData" class="flex justify-center rounded-xl border border-line bg-surface py-16 shadow-card">
      <Loader2 class="h-6 w-6 animate-spin text-muted" />
    </div>
    <div v-else-if="error" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {{ error }}
    </div>
    <div
      v-else-if="!hasData"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Gift class="h-6 w-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-content">Henüz bağış kaydı yok</p>
        <p class="mt-1 text-sm text-muted">İçe Aktar'dan banka işlemlerini yükleyin; "Bağış" açıklamalılar burada görünür.</p>
      </div>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-3">
      <!-- Bağış listesi -->
      <div class="lg:col-span-2 overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
            <tr>
              <th class="px-4 py-3.5 font-medium">Tarih</th>
              <th class="px-4 py-3.5 font-medium">Bağışçı</th>
              <th class="px-4 py-3.5 text-right font-medium">Tutar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="d in donations" :key="d.id" class="transition hover:bg-zinc-500/5">
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{{ formatDate(d.date) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-content">{{ d.name }}</span>
                  <span
                    v-if="d.isMember"
                    class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 class="h-3 w-3" /> Üye
                  </span>
                  <span
                    v-else
                    class="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-medium text-muted"
                  >Dışarıdan</span>
                </div>
                <p class="mt-0.5 truncate text-xs text-faint" :title="d.description">{{ d.description }}</p>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-sky-600 dark:text-sky-400">
                {{ tlExact.format(d.amount) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bağışçı bazında toplam -->
      <div class="rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 class="mb-3 text-sm font-semibold text-content">Bağışçı bazında toplam</h2>
        <ul class="flex flex-col divide-y divide-line">
          <li v-for="(donor, i) in donors" :key="i" class="flex items-center justify-between gap-2 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-content">{{ donor.name }}</p>
              <p class="text-xs text-faint">{{ donor.count }} bağış · {{ donor.isMember ? 'Üye' : 'Dışarıdan' }}</p>
            </div>
            <span class="shrink-0 font-mono text-sm font-semibold text-sky-600 dark:text-sky-400">
              {{ tl.format(donor.total) }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
