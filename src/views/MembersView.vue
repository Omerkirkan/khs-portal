<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Users as UsersIcon,
  Loader2,
  RefreshCw,
  UserPlus,
  Pencil,
  Trash2,
  Search,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserManagement } from '@/composables/useUserManagement'
import MemberFormModal, { type MemberFormValues } from '@/components/domain/MemberFormModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { ROLE_LABELS, type AppRole, type ManagedUser } from '@/types'

const auth = useAuthStore()
const {
  users,
  loading,
  submitting,
  deleting,
  error,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = useUserManagement()

const roleBadgeClass: Record<AppRole, string> = {
  superadmin: 'bg-accent/10 text-accent ring-accent/20',
  admin: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
  keyholder: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400',
  member: 'bg-zinc-500/10 text-muted ring-zinc-500/20',
}

/** Avatar için ad/e-postadan baş harf üretir. */
function initialOf(u: ManagedUser): string {
  return (u.full_name ?? u.email ?? '?').trim().charAt(0).toUpperCase()
}

// --- Arama / filtre -------------------------------------------------------
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) =>
      (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q),
  )
})

// --- Yetki yardımcıları ---------------------------------------------------
const canCreate = computed(() => auth.isAdmin)
const isSelf = (u: ManagedUser): boolean => u.id === auth.user?.id
/** superadmin herkesi; admin yalnızca member/keyholder kullanıcıları yönetebilir. */
function canManage(u: ManagedUser): boolean {
  if (auth.isSuperadmin) return true
  if (!auth.isAdmin) return false
  return u.role === 'member' || u.role === 'keyholder'
}

// --- Oluştur / düzenle modali --------------------------------------------
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editing = ref<ManagedUser | null>(null)

function openCreate(): void {
  error.value = null
  formMode.value = 'create'
  editing.value = null
  formOpen.value = true
}
function openEdit(u: ManagedUser): void {
  error.value = null
  formMode.value = 'edit'
  editing.value = u
  formOpen.value = true
}
function closeForm(): void {
  formOpen.value = false
}

async function handleSubmit(values: MemberFormValues): Promise<void> {
  if (formMode.value === 'create') {
    const id = await createUser({
      email: values.email,
      password: values.password,
      role: values.role,
      full_name: values.full_name,
    })
    if (id) formOpen.value = false
  } else if (editing.value) {
    const ok = await updateUser({
      id: editing.value.id,
      email: values.email,
      full_name: values.full_name,
      role: values.role,
      password: values.password,
    })
    if (ok) formOpen.value = false
  }
}

// --- Silme onayı ----------------------------------------------------------
const deleteTarget = ref<ManagedUser | null>(null)
function openDelete(u: ManagedUser): void {
  error.value = null
  deleteTarget.value = u
}
function closeDelete(): void {
  deleteTarget.value = null
}
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  const ok = await deleteUser(deleteTarget.value.id)
  if (ok) deleteTarget.value = null
}

onMounted(listUsers)
</script>

<template>
  <section class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Üyeler</h1>
        <p class="mt-1 text-sm text-muted">
          Üyeleri görüntüleyin, arayın ve yönetin.
          <span class="text-faint">Toplam {{ users.length }} kayıt.</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted shadow-card transition hover:bg-zinc-500/5 hover:text-content disabled:opacity-60"
          :disabled="loading"
          @click="listUsers"
        >
          <component
            :is="loading ? Loader2 : RefreshCw"
            class="h-4 w-4"
            :class="loading && 'animate-spin'"
          />
          Yenile
        </button>

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
            <th class="px-4 py-3.5 font-medium">Rol</th>
            <th class="px-4 py-3.5 font-medium">Kayıt Tarihi</th>
            <th v-if="canCreate" class="px-4 py-3.5 text-right font-medium">İşlemler</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-if="loading && users.length === 0">
            <td :colspan="canCreate ? 4 : 3" class="px-4 py-12 text-center text-muted">
              <Loader2 class="mx-auto h-5 w-5 animate-spin" />
            </td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td :colspan="canCreate ? 4 : 3" class="px-4 py-14 text-center">
              <UsersIcon class="mx-auto mb-3 h-8 w-8 text-faint" />
              <p class="text-sm font-medium text-content">
                {{ search ? 'Eşleşen üye bulunamadı' : 'Henüz üye yok' }}
              </p>
              <p class="mt-1 text-sm text-muted">
                {{ search ? 'Farklı bir arama deneyin.' : 'İlk üyeyi ekleyerek başlayın.' }}
              </p>
            </td>
          </tr>
          <tr v-for="u in filtered" :key="u.id" class="transition hover:bg-zinc-500/5">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
                >
                  {{ initialOf(u) }}
                </span>
                <div class="min-w-0">
                  <p class="truncate font-medium text-content">
                    {{ u.full_name ?? '—' }}
                    <span v-if="isSelf(u)" class="ml-1 text-xs font-normal text-faint">(siz)</span>
                  </p>
                  <p class="truncate font-mono text-xs text-muted">{{ u.email ?? '—' }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="roleBadgeClass[u.role]"
              >
                {{ ROLE_LABELS[u.role] }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-faint">
              {{ new Date(u.created_at).toLocaleDateString('tr-TR') }}
            </td>
            <td v-if="canCreate" class="px-4 py-3">
              <div class="flex items-center justify-end gap-1">
                <button
                  v-if="canManage(u)"
                  class="rounded-lg p-2 text-muted transition hover:bg-accent/10 hover:text-accent"
                  title="Düzenle"
                  @click="openEdit(u)"
                >
                  <Pencil class="h-4 w-4" />
                </button>
                <button
                  v-if="canManage(u) && !isSelf(u)"
                  class="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
                  title="Sil"
                  @click="openDelete(u)"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
                <span
                  v-if="!canManage(u)"
                  class="px-2 text-xs text-faint"
                  title="Bu kullanıcıyı yönetme yetkiniz yok"
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
      :submitting="submitting"
      :error="error"
      @submit="handleSubmit"
      @close="closeForm"
    />

    <!-- Silme onayı -->
    <ConfirmDialog
      :open="deleteTarget !== null"
      title="Üyeyi sil"
      :message="`“${deleteTarget?.full_name ?? deleteTarget?.email ?? 'Bu üye'}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`"
      :busy="deleting"
      :error="error"
      @confirm="confirmDelete"
      @close="closeDelete"
    />
  </section>
</template>
