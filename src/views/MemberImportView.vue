<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  UserPlus,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  X,
} from 'lucide-vue-next'
import { useMembers } from '@/composables/useMembers'
import { useMemberImport } from '@/composables/useMemberImport'
import { MEMBER_STATUS_LABELS } from '@/types'

const members = useMembers()
const imp = useMemberImport()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const summary = ref<{ inserted: number; updated: number; failed: number } | null>(null)

// --- Özet sayaçları -------------------------------------------------------
const stats = computed(() => {
  const r = imp.rows.value
  return {
    total: r.length,
    fresh: r.filter((x) => !x.matchedId).length,
    existing: r.filter((x) => x.matchedId).length,
    active: r.filter((x) => x.status === 'active').length,
    passive: r.filter((x) => x.status === 'inactive').length,
    selected: r.filter((x) => x.selected).length,
  }
})

/** Tüm satırlar seçili mi? (başlık checkbox'ı için) */
const allSelected = computed({
  get: () => imp.rows.value.length > 0 && imp.rows.value.every((r) => r.selected),
  set: (val: boolean) => {
    for (const r of imp.rows.value) r.selected = val
  },
})

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

// --- Kaydetme -------------------------------------------------------------
async function saveSelected(): Promise<void> {
  const res = await imp.save()
  if (res) {
    summary.value = res
    await members.listMembers()
    imp.rematch(members.members.value)
  }
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
        <h1 class="text-2xl font-semibold tracking-tight">Üye Aktar</h1>
        <p class="mt-1 text-sm text-muted">
          “Kurum Üyelik Listesi” (.xlsx) dosyasını yükleyin; seçtiğiniz üyeler detaylarıyla eklenir,
          zaten kayıtlı olanlar güncellenir.
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
        <p class="mt-1 text-sm text-muted">veya bilgisayarınızdan seçin (.xlsx)</p>
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
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
        <div class="flex items-center gap-2 text-sm text-muted">
          <FileSpreadsheet class="h-4 w-4 text-accent" />
          <span class="font-medium text-content">{{ imp.fileName.value }}</span>
        </div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-full bg-zinc-500/10 px-2.5 py-1 font-medium text-muted">Toplam {{ stats.total }}</span>
          <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">Yeni {{ stats.fresh }}</span>
          <span class="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">Mevcut {{ stats.existing }}</span>
          <span class="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">Aktif {{ stats.active }}</span>
          <span class="rounded-full bg-zinc-500/10 px-2.5 py-1 font-medium text-faint">Pasif {{ stats.passive }}</span>
        </div>
      </div>

      <!-- Üye tablosu -->
      <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
            <tr>
              <th class="px-4 py-3.5">
                <input
                  v-model="allSelected"
                  type="checkbox"
                  class="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  title="Tümünü seç"
                >
              </th>
              <th class="px-4 py-3.5 font-medium">Ad Soyad</th>
              <th class="px-4 py-3.5 font-medium">T.C. Kimlik</th>
              <th class="px-4 py-3.5 font-medium">Telefon</th>
              <th class="px-4 py-3.5 font-medium">Meslek</th>
              <th class="px-4 py-3.5 font-medium">Durum</th>
              <th class="px-4 py-3.5 text-right font-medium">Eşleşme</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr
              v-for="(row, i) in imp.rows.value"
              :key="i"
              class="transition hover:bg-zinc-500/5"
              :class="!row.selected && 'opacity-50'"
            >
              <td class="px-4 py-3">
                <input
                  v-model="row.selected"
                  type="checkbox"
                  class="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                >
              </td>
              <td class="px-4 py-3 font-medium text-content">{{ row.fullName }}</td>
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{{ row.tcNo ?? '—' }}</td>
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{{ row.phone ?? '—' }}</td>
              <td class="px-4 py-3 text-muted">{{ row.profession ?? '—' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  :class="row.status === 'active'
                    ? 'bg-accent/10 text-accent ring-accent/20'
                    : 'bg-zinc-500/10 text-muted ring-zinc-500/20'"
                >
                  {{ MEMBER_STATUS_LABELS[row.status] }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <span
                    v-if="row.matchedId"
                    class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"
                    :title="`Mevcut üye (${row.matchBy === 'tc' ? 'T.C.' : 'isim'} eşleşti): ${row.matchedName} — üzerine yazılacak`"
                  >
                    <UserCheck class="h-3.5 w-3.5" /> Üzerine yaz
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    title="Yeni üye olarak eklenecek"
                  >
                    <UserPlus class="h-3.5 w-3.5" /> Yeni
                  </span>
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
          <span>
            {{ summary.inserted }} üye eklendi, {{ summary.updated }} üye güncellendi.
            <span v-if="summary.failed > 0" class="text-danger">{{ summary.failed }} satır hatalı.</span>
          </span>
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
          :disabled="imp.saving.value || stats.selected === 0"
          @click="saveSelected"
        >
          <component :is="imp.saving.value ? Loader2 : Users" class="h-4 w-4" :class="imp.saving.value && 'animate-spin'" />
          {{ imp.saving.value ? 'Aktarılıyor…' : `Seçilenleri Aktar (${stats.selected})` }}
        </button>
      </div>
    </template>
  </section>
</template>
