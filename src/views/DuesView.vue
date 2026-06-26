<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  CreditCard,
  Loader2,
  RefreshCw,
  Check,
  X,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Users as UsersIcon,
} from 'lucide-vue-next'
import { useDues, type DuesCell } from '@/composables/useDues'
import { MEMBER_STATUS_LABELS } from '@/types'

const { periods, rows, summary, loading, error, loadDues } = useDues()

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
function periodLabel(p: string): string {
  const [y, m] = p.split('-')
  const idx = Number(m) - 1
  return `${MONTHS_TR[idx] ?? m} ${y?.slice(2) ?? ''}`
}

const hasData = computed(() => rows.value.length > 0)

/** Bakiyeye göre durum etiketi. */
function balanceLabel(balance: number): { text: string; cls: string } {
  if (balance < 0) return { text: 'Borçlu', cls: 'text-danger' }
  if (balance > 0) return { text: 'Fazla', cls: 'text-sky-600 dark:text-sky-400' }
  return { text: 'Güncel', cls: 'text-emerald-600 dark:text-emerald-400' }
}

/** Hücre arkaplan/yazı sınıfı. */
const cellClass: Record<DuesCell['state'], string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  unpaid: 'bg-danger/10 text-danger',
  credit: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  none: 'text-faint',
}

function cellTitle(c: DuesCell): string {
  const labels: Record<DuesCell['state'], string> = {
    paid: 'Ödendi',
    partial: 'Kısmi ödeme',
    unpaid: 'Ödenmedi',
    credit: 'Fazla ödeme',
    none: 'Aidat yok',
  }
  return `${c.period} · ${labels[c.state]} · Ödenen ${tl.format(c.paid)} / Beklenen ${tl.format(c.expected)}`
}

onMounted(loadDues)
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Aidatlar</h1>
        <p class="mt-1 text-sm text-muted">
          Üye bazında aylık aidat takibi. Ödemeler içe aktarılan banka işlemlerinden otomatik düşülür.
        </p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
        :disabled="loading"
        @click="loadDues"
      >
        <component :is="loading ? Loader2 : RefreshCw" class="h-4 w-4" :class="loading && 'animate-spin'" />
        Yenile
      </button>
    </header>

    <!-- Özet kartları -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Wallet class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Tahsil edilen</p>
          <p class="font-mono text-lg font-semibold text-content">{{ tl.format(summary.totalPaid) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <TrendingUp class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Beklenen (toplam)</p>
          <p class="font-mono text-lg font-semibold text-content">{{ tl.format(summary.totalExpected) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <AlertTriangle class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Toplam borç</p>
          <p class="font-mono text-lg font-semibold text-danger">{{ tl.format(summary.totalDebt) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <UsersIcon class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Borçlu üye</p>
          <p class="font-mono text-lg font-semibold text-content">{{ summary.debtorCount }}</p>
        </div>
      </div>
    </div>

    <!-- Eşleşmeyen ödeme uyarısı -->
    <p
      v-if="summary.unmatchedPaid > 0"
      class="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle class="h-4 w-4 shrink-0" />
      {{ tl.format(summary.unmatchedPaid) }} tutarında aidat ödemesi hiçbir üyeyle eşleşmedi.
      İçe Aktar sayfasından ilgili kişileri üye olarak ekleyin.
    </p>

    <!-- Matris -->
    <div v-if="loading && !hasData" class="flex justify-center rounded-xl border border-line bg-surface py-16 shadow-card">
      <Loader2 class="h-6 w-6 animate-spin text-muted" />
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!hasData"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <CreditCard class="h-6 w-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-content">Henüz aidat verisi yok</p>
        <p class="mt-1 text-sm text-muted">Üye ekleyin ve İçe Aktar'dan banka işlemlerini yükleyin.</p>
      </div>
    </div>

    <template v-else>
      <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table class="w-full border-collapse text-left text-sm">
          <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
            <tr>
              <th class="sticky left-0 z-10 bg-surface px-4 py-3 font-medium">Üye</th>
              <th v-for="p in periods" :key="p" class="whitespace-nowrap px-3 py-3 text-center font-medium">
                {{ periodLabel(p) }}
              </th>
              <th class="whitespace-nowrap px-4 py-3 text-right font-medium">Bakiye</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="m in rows" :key="m.id" class="transition hover:bg-zinc-500/5">
              <td class="sticky left-0 z-10 bg-surface px-4 py-2.5">
                <div class="min-w-0">
                  <p class="truncate font-medium text-content">{{ m.full_name }}</p>
                  <p class="font-mono text-xs text-faint">
                    {{ tl.format(m.monthlyDue) }}/ay
                    <span v-if="m.status !== 'active'">· {{ MEMBER_STATUS_LABELS[m.status] }}</span>
                  </p>
                </div>
              </td>
              <td v-for="p in periods" :key="p" class="px-2 py-2.5 text-center">
                <span
                  class="mx-auto flex h-7 min-w-14 items-center justify-center rounded-md px-1.5 font-mono text-xs"
                  :class="cellClass[m.cells[p]?.state ?? 'none']"
                  :title="m.cells[p] ? cellTitle(m.cells[p]!) : ''"
                >
                  <template v-if="m.cells[p]?.state === 'paid'"><Check class="h-3.5 w-3.5" /></template>
                  <template v-else-if="m.cells[p]?.state === 'unpaid'"><X class="h-3.5 w-3.5" /></template>
                  <template v-else-if="m.cells[p]?.state === 'partial'">{{ tl.format(m.cells[p]!.paid) }}</template>
                  <template v-else-if="m.cells[p]?.state === 'credit'">+{{ tl.format(m.cells[p]!.paid) }}</template>
                  <template v-else>·</template>
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-2.5 text-right">
                <span class="font-mono font-semibold" :class="balanceLabel(m.balance).cls">
                  {{ m.balance > 0 ? '+' : '' }}{{ tl.format(m.balance) }}
                </span>
                <span class="ml-2 text-xs" :class="balanceLabel(m.balance).cls">{{ balanceLabel(m.balance).text }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Açıklama (lejant) -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span class="flex items-center gap-1.5">
          <span class="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Check class="h-3 w-3" /></span> Ödendi
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-5 w-5 rounded bg-amber-500/10" /> Kısmi ödeme
        </span>
        <span class="flex items-center gap-1.5">
          <span class="flex h-5 w-5 items-center justify-center rounded bg-danger/10 text-danger"><X class="h-3 w-3" /></span> Ödenmedi
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-5 w-5 rounded bg-sky-500/10" /> Fazla ödeme
        </span>
        <span class="flex items-center gap-1.5">
          <span class="flex h-5 w-5 items-center justify-center rounded text-faint">·</span> Aidat yok
        </span>
      </div>
    </template>
  </section>
</template>
