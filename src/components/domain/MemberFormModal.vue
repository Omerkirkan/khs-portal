<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UserPlus, Save, Loader2, AlertCircle, Eye, EyeOff, RefreshCw, KeyRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import BaseModal from '@/components/ui/BaseModal.vue'
import {
  ROLE_LABELS,
  MEMBER_STATUS_LABELS,
  type AppRole,
  type DuesType,
  type MemberRow,
  type MemberStatus,
} from '@/types'

/** MemberFormModal'in dışarı verdiği ham form değerleri. */
export interface MemberFormValues {
  full_name: string
  email: string
  phone: string
  status: MemberStatus
  monthly_due: number
  /** Atanan aidat tipi; null ise özel tutar (monthly_due) geçerlidir. */
  dues_type_id: string | null
  joined_at: string
  password: string
  role: AppRole
}

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  /** edit modunda düzenlenen üye; create modunda null. */
  member: MemberRow | null
  /** Atanabilir aidat tipleri (Ayarlar → Aidatlar'da tanımlanır). */
  duesTypes: DuesType[]
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [values: MemberFormValues]
  close: []
}>()

const auth = useAuthStore()

const fullName = ref('')
const email = ref('')
const phone = ref('')
const status = ref<MemberStatus>('active')
const monthlyDue = ref(2000)
/** '' = özel tutar; aksi halde seçili aidat tipinin id'si. */
const duesTypeId = ref('')
const joinedAt = ref('')
const password = ref('')
const role = ref<AppRole>('member')
const showPassword = ref(false)

/** "YYYY-MM-DD" bugün (date input varsayılanı için). */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const isEdit = computed(() => props.mode === 'edit')
/** Düzenlenen üyenin halihazırda giriş hesabı var mı? */
const hasLogin = computed(() => isEdit.value && !!props.member?.user_id)

const statuses: MemberStatus[] = ['active', 'inactive', 'overdue']

/** Seçili aidat tipi (yoksa null = özel tutar). */
const selectedType = computed<DuesType | null>(
  () => props.duesTypes.find((t) => t.id === duesTypeId.value) ?? null,
)
/** Tabloda/önizlemede gösterilecek beklenen aylık aidat. */
const effectiveDue = computed(() =>
  selectedType.value ? selectedType.value.amount : Number(monthlyDue.value) || 0,
)
const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

/** Yetki kuralı: admin yalnızca member/keyholder atayabilir; superadmin hepsini. */
const availableRoles = computed<AppRole[]>(() =>
  auth.isSuperadmin ? ['member', 'keyholder', 'admin', 'superadmin'] : ['member', 'keyholder'],
)

/** Kullanıcı kendi rolünü değiştiremez (DB de bunu zorlar). */
const roleLocked = computed(() => hasLogin.value && props.member?.user_id === auth.user?.id)

// Modal her açıldığında alanları moda göre doldur / sıfırla.
watch(
  () => [props.open, props.member] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.member) {
      fullName.value = props.member.full_name
      email.value = props.member.email ?? ''
      phone.value = props.member.phone ?? ''
      status.value = props.member.status
      monthlyDue.value = props.member.monthly_due
      duesTypeId.value = props.member.dues_type_id ?? ''
      joinedAt.value = props.member.joined_at?.slice(0, 10) ?? today()
      role.value = props.member.role ?? 'member'
    } else {
      fullName.value = ''
      email.value = ''
      phone.value = ''
      status.value = 'active'
      monthlyDue.value = 2000
      duesTypeId.value = ''
      joinedAt.value = today()
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
    full_name: fullName.value,
    email: email.value,
    phone: phone.value,
    status: status.value,
    monthly_due: Number(monthlyDue.value) || 0,
    dues_type_id: duesTypeId.value || null,
    joined_at: joinedAt.value,
    password: password.value,
    role: role.value,
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="isEdit ? 'Üyeyi düzenle' : 'Yeni üye ekle'"
    :subtitle="isEdit ? (hasLogin ? (member?.email ?? undefined) : 'Giriş hesabı yok') : 'Üye kaydı oluşturun; giriş hesabı opsiyoneldir.'"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <!-- Üye bilgileri -->
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
          <span class="text-sm font-medium text-content">Telefon</span>
          <input
            v-model="phone"
            type="tel"
            placeholder="0555 555 55 55"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content placeholder:text-faint focus:border-accent"
          >
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Üyelik Tarihi</span>
          <input
            v-model="joinedAt"
            type="date"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content focus:border-accent"
          >
          <span class="text-xs text-faint">Borç bu aydan itibaren hesaplanır.</span>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Aidat Tipi</span>
          <select
            v-model="duesTypeId"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content focus:border-accent"
          >
            <option value="">Özel tutar</option>
            <option v-for="t in duesTypes" :key="t.id" :value="t.id">
              {{ t.name }} — {{ tl.format(t.amount) }}
            </option>
          </select>
          <span class="text-xs text-faint">
            Tip seçilirse beklenen aidat tipin güncel tutarıdır.
          </span>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Aylık Aidat (₺)</span>
          <input
            v-if="!selectedType"
            v-model.number="monthlyDue"
            type="number"
            min="0"
            step="50"
            placeholder="2000"
            class="rounded-lg border border-line bg-input px-3 py-2 font-mono text-sm text-content placeholder:font-sans placeholder:text-faint focus:border-accent"
          >
          <input
            v-else
            :value="tl.format(effectiveDue)"
            type="text"
            readonly
            class="cursor-not-allowed rounded-lg border border-line bg-base/40 px-3 py-2 font-mono text-sm text-muted"
          >
          <span v-if="selectedType" class="text-xs text-faint">“{{ selectedType.name }}” tipinden geliyor.</span>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-content">Durum</span>
          <select
            v-model="status"
            class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content focus:border-accent"
          >
            <option v-for="s in statuses" :key="s" :value="s">{{ MEMBER_STATUS_LABELS[s] }}</option>
          </select>
        </label>
      </div>

      <!-- Giriş bilgileri -->
      <div class="rounded-lg border border-line bg-base/40 p-4">
        <div class="mb-3 flex items-center gap-2">
          <KeyRound class="h-4 w-4 text-muted" />
          <span class="text-sm font-medium text-content">Giriş Bilgileri</span>
          <span class="text-xs text-faint">{{ hasLogin ? '(bu üye giriş yapabiliyor)' : '(opsiyonel)' }}</span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-content">E-posta</span>
            <input
              v-model="email"
              type="email"
              :required="hasLogin"
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
                minlength="8"
                :placeholder="hasLogin ? 'Değiştirmemek için boş bırakın' : 'Giriş için şifre belirleyin'"
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
              <option v-for="r in availableRoles" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
            </select>
            <span v-if="roleLocked" class="text-xs text-faint">Kendi rolünüzü değiştiremezsiniz.</span>
          </label>
        </div>

        <p v-if="!hasLogin" class="mt-3 text-xs text-faint">
          E-posta ve şifre girilirse üye panele giriş yapabilir. Boş bırakılırsa yalnızca üye kaydı tutulur.
        </p>
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
