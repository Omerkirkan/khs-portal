<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
} from 'lucide-vue-next'
import { useMembers } from '@/composables/useMembers'
import { useTransactionImport, type ImportRow } from '@/composables/useTransactionImport'
import { TXN_KIND_LABELS, type TxnKind } from '@/types'

const members = useMembers()
const imp = useTransactionImport()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
/** O an "Ekle" ile eklenen üyenin nameKey'i (buton kilidi için). */
const addingKey = ref<string | null>(null)
const summary = ref<{ inserted: number; skipped: number } | null>(null)

const kindBadge: Record<TxnKind, string> = {
  aidat: 'bg-accent/10 text-accent ring-accent/20',
  bagis: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
  diger: 'bg-zinc-500/10 text-muted ring-zinc-500/20',
}

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })

// --- Özet sayaçları -------------------------------------------------------
const stats = computed(() => {
  const r = imp.rows.value
  const aidat = r.filter((x) => x.kind === 'aidat')
  const bagis = r.filter((x) => x.kind === 'bagis')
  const diger = r.filter((x) => x.kind === 'diger')
  const matched = r.filter((x) => x.memberId)
  const unmatched = r.filter((x) => !x.memberId && x.kind !== 'diger' && x.counterpartyName)
  return {
    total: r.length,
    aidat: aidat.length,
    bagis: bagis.length,
    diger: diger.length,
    matched: matched.length,
    unmatched: unmatched.length,
  }
})

/** Bu satır için "Ekle" butonu gösterilsin mi? (Yalnızca aidat; bağış/diğer için gösterilmez.) */
function showAdd(row: ImportRow): boolean {
  return !row.memberId && row.kind === 'aidat' && !!row.counterpartyName
}

// --- Dosya seçimi ---------------------------------------------------------
async function handleFiles(files: FileList | null): Promise<void> {
  summary.value = null
  const file = files?.[0]
  if (!file) return
  if (members.members.value.length === 0) await members.listMembers()
  await imp.parseFile(file, members.members.value)
}

function onInputChange(e: Event): void {
  handleFiles((e.target as HTMLInputElement).files)
}

function onDrop(e: DragEvent): void {
  dragOver.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

// --- Tek tıkla üye ekleme --------------------------------------------------
async function addMember(row: ImportRow): Promise<void> {
  if (!row.counterpartyName || addingKey.value) return
  addingKey.value = row.nameKey
  try {
    const id = await members.addMemberByName(row.counterpartyName)
    if (id) {
      await members.listMembers()
      imp.rematch(members.members.value)
    }
  } finally {
    addingKey.value = null
  }
}

// --- Kaydetme -------------------------------------------------------------
async function saveAll(): Promise<void> {
  const res = await imp.save()
  if (res) summary.value = res
}

function clearAll(): void {
  imp.reset()
  summary.value = null
  if (fileInput.value) fileInput.value.value = ''
}

onMounted(members.listMembers)
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">İçe Aktar</h1>
        <p class="mt-1 text-sm text-muted">
          Banka hesap hareketleri (.xls) dosyasını yükleyin; aidat ve bağışlar otomatik ayrıştırılır.
        </p>
      </div>
      <button
        v-if="imp.rows.value.length > 0"
        class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/5 hover:text-content"
        @click="clearAll"
      >
        <X class="h-4 w-4" /> Temizle
      </button>
    </header>

    <!-- Yükleme alanı -->
    <div
      v-if="imp.rows.value.length === 0"
      class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition"
      :class="dragOver ? 'border-accent bg-accent/5' : 'border-line bg-surface'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <component :is="imp.parsing.value ? Loader2 : Upload" class="h-6 w-6" :class="imp.parsing.value && 'animate-spin'" />
      </span>
      <div>
        <p class="text-sm font-medium text-content">
          {{ imp.parsing.value ? 'Dosya okunuyor…' : 'Excel dosyasını buraya sürükleyin' }}
        </p>
        <p class="mt-1 text-sm text-muted">veya bilgisayarınızdan seçin (.xls / .xlsx)</p>
      </div>
      <button
        class="mt-2 flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:opacity-60"
        :disabled="imp.parsing.value"
        @click="fileInput?.click()"
      >
        <FileSpreadsheet class="h-4 w-4" /> Dosya Seç
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        class="hidden"
        @change="onInputChange"
      >
      <p
        v-if="imp.error.value"
        class="mt-2 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        <AlertCircle class="h-4 w-4 shrink-0" /> {{ imp.error.value }}
      </p>
    </div>

    <!-- Sonuçlar -->
    <template v-else>
      <!-- Üst bilgi + özet -->
      <div class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-sm text-muted">
            <FileSpreadsheet class="h-4 w-4 text-accent" />
            <span class="font-medium text-content">{{ imp.fileName.value }}</span>
            <span v-if="imp.meta.value?.dateRange" class="text-faint">· {{ imp.meta.value.dateRange }}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-full bg-zinc-500/10 px-2.5 py-1 font-medium text-muted">Toplam {{ stats.total }}</span>
          <span class="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">Aidat {{ stats.aidat }}</span>
          <span class="rounded-full bg-sky-500/10 px-2.5 py-1 font-medium text-sky-700 dark:text-sky-400">Bağış {{ stats.bagis }}</span>
          <span class="rounded-full bg-zinc-500/10 px-2.5 py-1 font-medium text-faint">Diğer {{ stats.diger }}</span>
          <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">Eşleşen üye {{ stats.matched }}</span>
          <span v-if="stats.unmatched > 0" class="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">Üye değil {{ stats.unmatched }}</span>
        </div>
      </div>

      <!-- İşlem tablosu -->
      <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
            <tr>
              <th class="px-4 py-3.5 font-medium">Tarih</th>
              <th class="px-4 py-3.5 font-medium">Gönderen</th>
              <th class="px-4 py-3.5 font-medium">Tür</th>
              <th class="px-4 py-3.5 font-medium">Dönem</th>
              <th class="px-4 py-3.5 text-right font-medium">Tutar</th>
              <th class="px-4 py-3.5 text-right font-medium">Durum</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr
              v-for="(row, i) in imp.rows.value"
              :key="i"
              class="transition hover:bg-zinc-500/5"
              :class="row.kind === 'diger' && 'text-faint'"
            >
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{{ row.rawDate }}</td>
              <td class="px-4 py-3">
                <span :class="row.counterpartyName ? 'font-medium text-content' : 'text-faint'">
                  {{ row.counterpartyName ?? '—' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="kindBadge[row.kind]"
                >
                  {{ TXN_KIND_LABELS[row.kind] }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-muted">{{ row.period || '—' }}</td>
              <td
                class="whitespace-nowrap px-4 py-3 text-right font-mono"
                :class="row.amount < 0 ? 'text-danger' : 'text-content'"
              >
                {{ tl.format(row.amount) }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <span
                    v-if="row.memberId"
                    class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    :title="`Üye: ${row.memberName}`"
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" /> Üye
                  </span>
                  <button
                    v-else-if="showAdd(row)"
                    class="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-content transition hover:border-accent hover:bg-accent/5 hover:text-accent disabled:opacity-60"
                    :disabled="addingKey === row.nameKey"
                    @click="addMember(row)"
                  >
                    <component
                      :is="addingKey === row.nameKey ? Loader2 : UserPlus"
                      class="h-3.5 w-3.5"
                      :class="addingKey === row.nameKey && 'animate-spin'"
                    />
                    Üye Ekle
                  </button>
                  <span v-else class="text-xs text-faint">—</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Kaydet / hata / özet -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p
          v-if="summary"
          class="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 class="h-4 w-4 shrink-0" />
          {{ summary.inserted }} işlem kaydedildi.
          <span v-if="summary.skipped > 0" class="text-emerald-600/80">{{ summary.skipped }} işlem zaten kayıtlıydı (atlandı).</span>
        </p>
        <p
          v-else-if="imp.error.value || members.error.value"
          class="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <AlertCircle class="h-4 w-4 shrink-0" /> {{ imp.error.value || members.error.value }}
        </p>
        <span v-else />

        <button
          class="ml-auto flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="imp.saving.value || !!summary"
          @click="saveAll"
        >
          <component :is="imp.saving.value ? Loader2 : Save" class="h-4 w-4" :class="imp.saving.value && 'animate-spin'" />
          {{ imp.saving.value ? 'Kaydediliyor…' : 'İşlemleri Kaydet' }}
        </button>
      </div>
    </template>
  </section>
</template>
