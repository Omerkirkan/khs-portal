<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Receipt,
  Loader2,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CheckCircle2,
} from 'lucide-vue-next'
import { useTransactions } from '@/composables/useTransactions'
import { TXN_KIND_LABELS, type TxnKind } from '@/types'

const { rows, summary, loading, error, loadTransactions } = useTransactions()

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

const kindBadge: Record<TxnKind, string> = {
  aidat: 'bg-accent/10 text-accent ring-accent/20',
  bagis: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
  diger: 'bg-zinc-500/10 text-muted ring-zinc-500/20',
}

// --- Filtreler ------------------------------------------------------------
const search = ref('')
const kindFilter = ref<'all' | TxnKind>('all')
const kindTabs: { id: 'all' | TxnKind; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'aidat', label: 'Aidat' },
  { id: 'bagis', label: 'Bağış' },
  { id: 'diger', label: 'Diğer' },
]

const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr')
  return rows.value.filter((r) => {
    if (kindFilter.value !== 'all' && r.kind !== kindFilter.value) return false
    if (!q) return true
    return (
      (r.counterpartyName ?? '').toLocaleLowerCase('tr').includes(q) ||
      r.description.toLocaleLowerCase('tr').includes(q) ||
      (r.memberName ?? '').toLocaleLowerCase('tr').includes(q) ||
      (r.receiptNo ?? '').toLocaleLowerCase('tr').includes(q)
    )
  })
})

onMounted(loadTransactions)
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Hesap Hareketleri</h1>
        <p class="mt-1 text-sm text-muted">
          İçe aktarılan tüm banka işlemleri tek listede. Aidat, bağış ve diğer hareketleri arayın ve inceleyin.
        </p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
        :disabled="loading"
        @click="loadTransactions"
      >
        <component :is="loading ? Loader2 : RefreshCw" class="h-4 w-4" :class="loading && 'animate-spin'" />
        Yenile
      </button>
    </header>

    <!-- Özet kartları -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/10 text-muted">
          <Receipt class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Toplam işlem</p>
          <p class="font-mono text-lg font-semibold text-content">{{ summary.count }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ArrowDownLeft class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Gelen</p>
          <p class="font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400">{{ tl.format(summary.incoming) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <ArrowUpRight class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Giden</p>
          <p class="font-mono text-lg font-semibold text-danger">{{ tl.format(summary.outgoing) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Scale class="h-5 w-5" />
        </span>
        <div>
          <p class="text-xs text-muted">Net</p>
          <p class="font-mono text-lg font-semibold" :class="summary.net < 0 ? 'text-danger' : 'text-content'">
            {{ tl.format(summary.net) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Filtreler -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative max-w-sm flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          v-model="search"
          type="text"
          placeholder="Gönderen, açıklama, üye veya fiş ara…"
          class="w-full rounded-lg border border-line bg-input py-2 pl-9 pr-3 text-sm text-content placeholder:text-faint focus:border-accent"
        >
      </div>
      <div class="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
        <button
          v-for="tab in kindTabs"
          :key="tab.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition"
          :class="kindFilter === tab.id ? 'bg-accent text-accent-fg shadow-card' : 'text-muted hover:bg-zinc-500/10 hover:text-content'"
          @click="kindFilter = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Hata -->
    <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {{ error }}
    </div>

    <!-- Yükleniyor -->
    <div v-else-if="loading && rows.length === 0" class="flex justify-center rounded-xl border border-line bg-surface py-16 shadow-card">
      <Loader2 class="h-6 w-6 animate-spin text-muted" />
    </div>

    <!-- Boş -->
    <div
      v-else-if="rows.length === 0"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Receipt class="h-6 w-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-content">Henüz hareket yok</p>
        <p class="mt-1 text-sm text-muted">İçe Aktar'dan banka işlemlerini yükleyin.</p>
      </div>
    </div>

    <!-- Tablo -->
    <template v-else>
      <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
            <tr>
              <th class="px-4 py-3.5 font-medium">Tarih</th>
              <th class="px-4 py-3.5 font-medium">Tür</th>
              <th class="px-4 py-3.5 font-medium">Gönderen</th>
              <th class="px-4 py-3.5 font-medium">Açıklama</th>
              <th class="px-4 py-3.5 font-medium">Dönem</th>
              <th class="px-4 py-3.5 font-medium">Üye</th>
              <th class="px-4 py-3.5 font-medium">Kanal</th>
              <th class="px-4 py-3.5 font-medium">Fiş No</th>
              <th class="px-4 py-3.5 text-right font-medium">Tutar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr
              v-for="r in filtered"
              :key="r.id"
              class="transition hover:bg-zinc-500/5"
              :class="r.kind === 'diger' && 'text-faint'"
            >
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{{ formatDate(r.date) }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="kindBadge[r.kind]"
                >
                  {{ TXN_KIND_LABELS[r.kind] }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="r.counterpartyName ? 'font-medium text-content' : 'text-faint'">
                  {{ r.counterpartyName ?? '—' }}
                </span>
              </td>
              <td class="max-w-xs px-4 py-3">
                <span class="block truncate text-muted" :title="r.description">{{ r.description }}</span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-muted">{{ r.period || '—' }}</td>
              <td class="px-4 py-3">
                <span
                  v-if="r.memberName"
                  class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 class="h-3.5 w-3.5" /> {{ r.memberName }}
                </span>
                <span v-else class="text-xs text-faint">—</span>
              </td>
              <td class="px-4 py-3 text-xs text-muted">{{ r.channel || '—' }}</td>
              <td class="px-4 py-3 font-mono text-xs text-faint">{{ r.receiptNo || '—' }}</td>
              <td
                class="whitespace-nowrap px-4 py-3 text-right font-mono font-medium"
                :class="r.amount < 0 ? 'text-danger' : 'text-content'"
              >
                {{ tl.format(r.amount) }}
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-sm text-muted">
                Aramanızla eşleşen hareket yok.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-faint">{{ filtered.length }} / {{ rows.length }} hareket gösteriliyor.</p>
    </template>
  </section>
</template>
