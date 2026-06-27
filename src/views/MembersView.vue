<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Users as UsersIcon,
  Loader2,
  RefreshCw,
  UserPlus,
  Upload,
  Pencil,
  Trash2,
  Search,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMembers } from '@/composables/useMembers'
import { useDuesTypes } from '@/composables/useDuesTypes'
import MemberFormModal, { type MemberFormValues } from '@/components/domain/MemberFormModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  ROLE_LABELS,
  MEMBER_STATUS_LABELS,
  type AppRole,
  type MemberRow,
  type MemberStatus,
} from '@/types'

const auth = useAuthStore()
const {
  members,
  loading,
  submitting,
  deleting,
  error,
  listMembers,
  createMember,
  updateMember,
  deleteMember,
} = useMembers()
const { types: duesTypes, listTypes } = useDuesTypes()

const roleBadgeClass: Record<AppRole, string> = {
  superadmin: 'bg-accent/10 text-accent ring-accent/20',
  admin: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
  keyholder: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400',
  member: 'bg-zinc-500/10 text-muted ring-zinc-500/20',
}

const statusBadgeClass: Record<MemberStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  inactive: 'bg-zinc-500/10 text-muted ring-zinc-500/20',
  overdue: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
}

/** Avatar için ad/e-postadan baş harf üretir. */
function initialOf(m: MemberRow): string {
  return (m.full_name || m.email || '?').trim().charAt(0).toUpperCase()
}

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

/** Üyenin beklenen aylık aidatı: tip atanmışsa tipin adı+tutarı, yoksa tip yok. */
function memberDue(m: MemberRow): { label: string; amount: string } {
  const type = m.dues_type_id ? duesTypes.value.find((t) => t.id === m.dues_type_id) : null
  if (type) return { label: type.name, amount: tl.format(type.amount) }
  return { label: 'Aidat tipi yok', amount: '—' }
}

// --- Arama / filtre -------------------------------------------------------
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter(
    (m) =>
      m.full_name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q),
  )
})

// --- Yetki yardımcıları ---------------------------------------------------
const canCreate = computed(() => auth.isAdmin)
const isSelf = (m: MemberRow): boolean => !!m.user_id && m.user_id === auth.user?.id
/** superadmin herkesi; admin yalnızca admin/superadmin OLMAYAN üyeleri yönetebilir. */
function canManage(m: MemberRow): boolean {
  if (auth.isSuperadmin) return true
  if (!auth.isAdmin) return false
  return m.role !== 'admin' && m.role !== 'superadmin'
}

// --- Oluştur / düzenle modali --------------------------------------------
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<MemberRow | null>(null)

function openCreate(): void {
  error.value = null
  formMode.value = 'create'
  editing.value = null
  formOpen.value = true
}
function openEdit(m: MemberRow): void {
  error.value = null
  formMode.value = 'edit'
  editing.value = m
  formOpen.value = true
}
function closeForm(): void {
  formOpen.value = false
}

async function handleSubmit(values: MemberFormValues): Promise<void> {
  if (formMode.value === 'create') {
    const id = await createMember({
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      status: values.status,
      monthly_due: values.monthly_due,
      dues_type_id: values.dues_type_id,
      joined_at: values.joined_at,
      password: values.password,
      role: values.role,
      tc_no: values.tc_no,
      gender: values.gender,
      profession: values.profession,
      education: values.education,
      website: values.website,
      member_type: values.member_type,
      birth_date: values.birth_date,
    })
    if (id) formOpen.value = false
  } else if (editing.value) {
    const ok = await updateMember(
      {
        id: editing.value.id,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        status: values.status,
        monthly_due: values.monthly_due,
        dues_type_id: values.dues_type_id,
        joined_at: values.joined_at,
        role: values.role,
        password: values.password,
        tc_no: values.tc_no,
        gender: values.gender,
        profession: values.profession,
        education: values.education,
        website: values.website,
        member_type: values.member_type,
        birth_date: values.birth_date,
      },
      editing.value.user_id,
    )
    if (ok) formOpen.value = false
  }
}

// --- Silme onayı ----------------------------------------------------------
const deleteTarget = ref<MemberRow | null>(null)
function openDelete(m: MemberRow): void {
  error.value = null
  deleteTarget.value = m
}
function closeDelete(): void {
  deleteTarget.value = null
}
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  const ok = await deleteMember(deleteTarget.value.id, deleteTarget.value.user_id)
  if (ok) deleteTarget.value = null
}

onMounted(() => {
  listMembers()
  listTypes()
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Üyeler</h1>
        <p class="mt-1 text-sm text-muted">
          Üyeleri görüntüleyin, arayın ve yönetin.
          <span class="text-faint">Toplam {{ members.length }} kayıt.</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
          :disabled="loading"
          @click="listMembers"
        >
          <component
            :is="loading ? Loader2 : RefreshCw"
            class="h-4 w-4"
            :class="loading && 'animate-spin'"
          />
          Yenile
        </button>

        <RouterLink
          v-if="canCreate"
          :to="{ name: 'member-import' }"
          class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content"
        >
          <Upload class="h-4 w-4" />
          Üye Aktar
        </RouterLink>

        <button
          v-if="canCreate"
          class="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim"
          @click="openCreate"
        >
          <UserPlus class="h-4 w-4" />
          Yeni Üye
        </button>
      </div>
    </header>

    <!-- Arama -->
    <div class="relative max-w-sm">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        v-model="search"
        type="search"
        placeholder="İsim veya e-posta ara…"
        class="w-full rounded-lg border border-line bg-input py-2.5 pl-9 pr-3 text-sm text-content placeholder:text-faint focus:border-accent"
      >
    </div>

    <!-- Üye tablosu -->
    <div class="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-line text-xs font-medium uppercase tracking-wider text-faint">
          <tr>
            <th class="px-4 py-3.5 font-medium">Üye</th>
            <th class="px-4 py-3.5 font-medium">Rol / Giriş</th>
            <th class="px-4 py-3.5 font-medium">Aidat</th>
            <th class="px-4 py-3.5 font-medium">Durum</th>
            <th class="px-4 py-3.5 font-medium">Kayıt Tarihi</th>
            <th v-if="canCreate" class="px-4 py-3.5 text-right font-medium">İşlemler</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-if="loading && members.length === 0">
            <td :colspan="canCreate ? 6 : 5" class="px-4 py-12 text-center text-muted">
              <Loader2 class="mx-auto h-5 w-5 animate-spin" />
            </td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td :colspan="canCreate ? 6 : 5" class="px-4 py-14 text-center">
              <UsersIcon class="mx-auto mb-3 h-8 w-8 text-faint" />
              <p class="text-sm font-medium text-content">
                {{ search ? 'Eşleşen üye bulunamadı' : 'Henüz üye yok' }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ search ? 'Farklı bir arama deneyin.' : 'İlk üyeyi ekleyerek ya da Excel içe aktararak başlayın.' }}
              </p>
            </td>
          </tr>
          <tr v-for="m in filtered" :key="m.id" class="transition hover:bg-zinc-500/5">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                >
                  {{ initialOf(m) }}
                </span>
                <div class="min-w-0">
                  <p class="truncate font-medium text-content">
                    {{ m.full_name }}
                    <span v-if="isSelf(m)" class="ml-1 text-xs font-normal text-faint">(siz)</span>
                  </p>
                  <p class="truncate font-mono text-xs text-muted">{{ m.email ?? '—' }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="m.role"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="roleBadgeClass[m.role]"
              >
                {{ ROLE_LABELS[m.role] }}
              </span>
              <span v-else class="text-xs text-faint">Giriş yok</span>
            </td>
            <td class="px-4 py-3">
              <p class="font-mono text-sm text-content">{{ memberDue(m).amount }}</p>
              <p class="text-xs text-faint">{{ memberDue(m).label }}</p>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="statusBadgeClass[m.status]"
              >
                {{ MEMBER_STATUS_LABELS[m.status] }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-faint">
              {{ new Date(m.created_at).toLocaleDateString('tr-TR') }}
            </td>
            <td v-if="canCreate" class="px-4 py-3">
              <div class="flex items-center justify-end gap-1">
                <button
                  v-if="canManage(m)"
                  class="rounded-lg p-2 text-muted transition hover:bg-accent/10 hover:text-accent"
                  title="Düzenle"
                  @click="openEdit(m)"
                >
                  <Pencil class="h-4 w-4" />
                </button>
                <button
                  v-if="canManage(m) && !isSelf(m)"
                  class="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
                  title="Sil"
                  @click="openDelete(m)"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
                <span
                  v-if="!canManage(m)"
                  class="px-2 text-xs text-faint"
                  title="Bu üyeyi yönetme yetkiniz yok"
                >—</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Oluştur / düzenle modali -->
    <MemberFormModal
      :open="formOpen"
      :mode="formMode"
      :member="editing"
      :dues-types="duesTypes"
      :submitting="submitting"
      :error="error"
      @submit="handleSubmit"
      @close="closeForm"
    />

    <!-- Silme onayı -->
    <ConfirmDialog
      :open="deleteTarget !== null"
      title="Üyeyi sil"
      :message="`“${deleteTarget?.full_name ?? 'Bu üye'}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`"
      :busy="deleting"
      :error="error"
      @confirm="confirmDelete"
      @close="closeDelete"
    />
  </section>
</template>
