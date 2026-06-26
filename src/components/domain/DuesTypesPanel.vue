<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Loader2, RefreshCw, Plus, Pencil, Trash2, Tag, Users as UsersIcon } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useDuesTypes, type DuesTypeRow } from '@/composables/useDuesTypes'
import DuesTypeFormModal, { type DuesTypeFormValues } from '@/components/domain/DuesTypeFormModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const auth = useAuthStore()
const {
  types,
  loading,
  submitting,
  deleting,
  error,
  listTypes,
  createType,
  updateType,
  deleteType,
} = useDuesTypes()

const canManage = auth.isAdmin

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

// --- Oluştur / düzenle modali --------------------------------------------
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<DuesTypeRow | null>(null)

function openCreate(): void {
  error.value = null
  formMode.value = 'create'
  editing.value = null
  formOpen.value = true
}
function openEdit(t: DuesTypeRow): void {
  error.value = null
  formMode.value = 'edit'
  editing.value = t
  formOpen.value = true
}

async function handleSubmit(values: DuesTypeFormValues): Promise<void> {
  const ok =
    formMode.value === 'create'
      ? await createType(values)
      : editing.value
        ? await updateType(editing.value.id, values)
        : false
  if (ok) formOpen.value = false
}

// --- Silme onayı ----------------------------------------------------------
const deleteTarget = ref<DuesTypeRow | null>(null)
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  const ok = await deleteType(deleteTarget.value.id)
  if (ok) deleteTarget.value = null
}

onMounted(listTypes)
</script>

<template>
  <div class="flex flex-col gap-5">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Aidat Tipleri</h2>
        <p class="mt-1 text-sm text-muted">
          Adlandırılmış aidat şablonları tanımlayın (örn. Tam, Öğrenci, İşsiz). Üyelere bu tipleri
          atadığınızda beklenen aylık aidatları tipin güncel tutarı olur.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
          :disabled="loading"
          @click="listTypes"
        >
          <component :is="loading ? Loader2 : RefreshCw" class="h-4 w-4" :class="loading && 'animate-spin'" />
          Yenile
        </button>
        <button
          v-if="canManage"
          class="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Yeni Tip
        </button>
      </div>
    </header>

    <p
      v-if="error && !formOpen && !deleteTarget"
      class="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {{ error }}
    </p>

    <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
          <tr>
            <th class="px-4 py-3.5 font-medium">Tip</th>
            <th class="px-4 py-3.5 font-medium">Aylık Tutar</th>
            <th class="px-4 py-3.5 font-medium">Üye Sayısı</th>
            <th v-if="canManage" class="px-4 py-3.5 text-right font-medium">İşlemler</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-if="loading && types.length === 0">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-12 text-center text-muted">
              <Loader2 class="mx-auto h-5 w-5 animate-spin" />
            </td>
          </tr>
          <tr v-else-if="types.length === 0">
            <td :colspan="canManage ? 4 : 3" class="px-4 py-14 text-center">
              <Tag class="mx-auto mb-3 h-8 w-8 text-faint" />
              <p class="text-sm font-medium text-content">Henüz aidat tipi yok</p>
              <p class="mt-1 text-sm text-muted">İlk tipi ekleyerek başlayın (örn. Tam = 2000 ₺).</p>
            </td>
          </tr>
          <tr v-for="t in types" :key="t.id" class="transition hover:bg-zinc-500/5">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Tag class="h-4 w-4" />
                </span>
                <p class="font-medium text-content">{{ t.name }}</p>
              </div>
            </td>
            <td class="px-4 py-3 font-mono text-content">{{ tl.format(t.amount) }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5 text-sm text-muted">
                <UsersIcon class="h-3.5 w-3.5 text-faint" />
                {{ t.memberCount }}
              </span>
            </td>
            <td v-if="canManage" class="px-4 py-3">
              <div class="flex items-center justify-end gap-1">
                <button
                  class="rounded-lg p-2 text-muted transition hover:bg-accent/10 hover:text-accent"
                  title="Düzenle"
                  @click="openEdit(t)"
                >
                  <Pencil class="h-4 w-4" />
                </button>
                <button
                  class="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
                  title="Sil"
                  @click="deleteTarget = t"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DuesTypeFormModal
      :open="formOpen"
      :mode="formMode"
      :type="editing"
      :submitting="submitting"
      :error="error"
      @submit="handleSubmit"
      @close="formOpen = false"
    />

    <ConfirmDialog
      :open="deleteTarget !== null"
      title="Aidat tipini sil"
      :message="`“${deleteTarget?.name ?? 'Bu tip'}” silinecek.${
        deleteTarget && deleteTarget.memberCount > 0
          ? ` ${deleteTarget.memberCount} üye özel tutara düşecek.`
          : ''
      } Bu işlem geri alınamaz.`"
      :busy="deleting"
      :error="error"
      @confirm="confirmDelete"
      @close="deleteTarget = null"
    />
  </div>
</template>
