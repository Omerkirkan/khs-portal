<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UserPlus, Save, Loader2, AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import BaseModal from '@/components/ui/BaseModal.vue'
import { ROLE_LABELS, type AppRole, type ManagedUser } from '@/types'

/** MemberFormModal'in dışarı verdiği ham form değerleri. */
export interface MemberFormValues {
  email: string
  full_name: string
  password: string
  role: AppRole
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  /** edit modunda düzenlenen kullanıcı; create modunda null. */
  member: ManagedUser | null
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [values: MemberFormValues]
  close: []
}>()

const auth = useAuthStore()

const email = ref('')
const fullName = ref('')
const password = ref('')
const role = ref<AppRole>('member')
const showPassword = ref(false)

const isEdit = computed(() => props.mode === 'edit')

/** Yetki kuralı: admin yalnızca member/keyholder atayabilir; superadmin hepsini. */
const availableRoles = computed<AppRole[]>(() =>
  auth.isSuperadmin ? ['member', 'keyholder', 'admin', 'superadmin'] : ['member', 'keyholder'],
)

/** Kullanıcı kendi rolünü değiştiremez (DB de bunu zorlar). */
const roleLocked = computed(
  () => isEdit.value && props.member?.id === auth.user?.id,
)

// Modal her açıldığında alanları moda göre doldur / sıfırla.
watch(
  () => [props.open, props.member] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.member) {
      email.value = props.member.email ?? ''
      fullName.value = props.member.full_name ?? ''
      role.value = props.member.role
    } else {
      email.value = ''
      fullName.value = ''
      role.value = 'member'
    }
    password.value = ''
    showPassword.value = false
  },
  { immediate: true },
)

/** Kriptografik olarak güvenli, 16 karakterlik güçlü şifre üretir. */
function generatePassword(): void {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?'
  const bytes = new Uint32Array(16)
  crypto.getRandomValues(bytes)
  password.value = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  showPassword.value = true
}

function onSubmit(): void {
  if (props.submitting) return
  emit('submit', {
    email: email.value,
    full_name: fullName.value,
    password: password.value,
    role: role.value,
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? 'Üyeyi düzenle' : 'Yeni üye ekle'"
    :subtitle="isEdit ? (member?.email ?? undefined) : 'Yeni bir hesap oluşturun ve rol atayın.'"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Ad Soyad</span>
          <input
            v-model="fullName"
            type="text"
            required
            placeholder="Ada Lovelace"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content placeholder:text-faint focus:border-accent"
          >
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">E-posta</span>
          <input
            v-model="email"
            type="email"
            required
            placeholder="uye@hackerspace.org"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content placeholder:text-faint focus:border-accent"
          >
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="flex items-center justify-between">
            <span class="text-sm font-medium text-content">Şifre</span>
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-accent transition hover:text-accent-dim"
              @click="generatePassword"
            >
              <RefreshCw class="h-3 w-3" /> Oluştur
            </button>
          </span>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :required="!isEdit"
              minlength="8"
              :placeholder="isEdit ? 'Değiştirmemek için boş bırakın' : 'En az 8 karakter'"
              class="w-full rounded-lg border border-line bg-input px-3 py-2 pr-10 font-mono text-sm text-content placeholder:font-sans placeholder:text-faint focus:border-accent"
            >
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-content"
              :title="showPassword ? 'Gizle' : 'Göster'"
              @click="showPassword = !showPassword"
            >
              <component :is="showPassword ? EyeOff : Eye" class="h-4 w-4" />
            </button>
          </div>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Rol</span>
          <select
            v-model="role"
            :disabled="roleLocked"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option v-for="r in availableRoles" :key="r" :value="r">
              {{ ROLE_LABELS[r] }}
            </option>
          </select>
          <span v-if="roleLocked" class="text-xs text-faint">
            Kendi rolünüzü değiştiremezsiniz.
          </span>
        </label>
      </div>

      <p
        v-if="error"
        class="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ error }}</span>
      </p>

      <div class="flex justify-end gap-3 pt-1">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/10 hover:text-content"
          @click="emit('close')"
        >
          İptal
        </button>
        <button
          type="submit"
          :disabled="submitting"
          class="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          <component
            :is="submitting ? Loader2 : isEdit ? Save : UserPlus"
            class="h-4 w-4"
            :class="submitting && 'animate-spin'"
          />
          {{ submitting ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri Kaydet' : 'Üye Ekle' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
