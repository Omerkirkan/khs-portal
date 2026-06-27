<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { CalendarClock, Coins, Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAppSettings } from '@/composables/useAppSettings'

const auth = useAuthStore()
const {
  duesStart,
  fullPrice,
  discountPrice,
  loading,
  submitting,
  error,
  loadSettings,
  updateDuesStart,
  updatePrices,
} = useAppSettings()

const canManage = auth.isAdmin

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

/** type="month" girdisi için 'YYYY-MM'. */
const monthValue = ref('')
const saved = ref(false)

// Fiyat girdileri.
const fullInput = ref(0)
const discountInput = ref(0)
const pricesSaved = ref(false)

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
function periodLabel(ymd: string | null): string {
  if (!ymd) return 'Belirlenmedi'
  const [y, m] = ymd.split('-')
  return `${MONTHS_TR[Number(m) - 1] ?? m} ${y}`
}

// Yüklenen değeri ay girdisine yansıt ('YYYY-MM-DD' -> 'YYYY-MM').
watch(duesStart, (v) => { monthValue.value = v ? v.slice(0, 7) : '' }, { immediate: true })
watch(fullPrice, (v) => { fullInput.value = v }, { immediate: true })
watch(discountPrice, (v) => { discountInput.value = v }, { immediate: true })

async function save(): Promise<void> {
  saved.value = false
  // 'YYYY-MM' -> ayın ilki olarak sakla; boşsa temizle.
  const value = monthValue.value ? `${monthValue.value}-01` : null
  const ok = await updateDuesStart(value)
  if (ok) saved.value = true
}

async function savePrices(): Promise<void> {
  pricesSaved.value = false
  const ok = await updatePrices(Number(fullInput.value) || 0, Number(discountInput.value) || 0)
  if (ok) pricesSaved.value = true
}

onMounted(loadSettings)
</script>

<template>
  <div class="flex flex-col gap-5">
    <header>
      <h2 class="text-lg font-semibold tracking-tight">Genel</h2>
      <p class="mt-1 text-sm text-muted">Portal genelinde geçerli ayarlar.</p>
    </header>

    <div class="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div class="flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <CalendarClock class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-medium text-content">Aidat Takibi Başlangıcı</h3>
          <p class="mt-1 text-sm text-muted">
            Borç, ödeme ve aylık aidat hesabı bu aydan itibaren yapılır; daha önceki aylar
            dikkate alınmaz. Boş bırakılırsa en erken üyelik/ödeme ayından itibaren hesaplanır.
          </p>

          <div v-if="loading" class="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 class="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>

          <!-- Admin: düzenlenebilir -->
          <div v-else-if="canManage" class="mt-4 flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-muted">Başlangıç ayı</span>
              <input
                v-model="monthValue"
                type="month"
                class="rounded-lg border border-line bg-input px-3 py-2 text-sm text-content focus:border-accent"
                @change="saved = false"
              >
            </label>
            <button
              class="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submitting"
              @click="save"
            >
              <component :is="submitting ? Loader2 : Save" class="h-4 w-4" :class="submitting && 'animate-spin'" />
              {{ submitting ? 'Kaydediliyor…' : 'Kaydet' }}
            </button>
            <button
              v-if="monthValue"
              type="button"
              class="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/10 hover:text-content"
              @click="monthValue = ''; saved = false"
            >
              Temizle
            </button>
          </div>

          <!-- Yetkisiz: salt okunur -->
          <p v-else class="mt-4 font-mono text-sm text-content">{{ periodLabel(duesStart) }}</p>

          <p
            v-if="saved && !error"
            class="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 class="h-4 w-4" /> Kaydedildi · {{ periodLabel(duesStart) }}'dan itibaren.
          </p>
        </div>
      </div>
    </div>

    <!-- Aidat fiyatları -->
    <div class="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div class="flex items-start gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Coins class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-medium text-content">Aidat Fiyatları</h3>
          <p class="mt-1 text-sm text-muted">
            Tüm üyeler standart (tam) fiyattan borçlanır. Üyenin indirim dönemlerindeki aylarda
            ise indirimli fiyat uygulanır. İndirim dönemleri üye düzenleme ekranından tanımlanır.
          </p>

          <div v-if="loading" class="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 class="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>

          <!-- Admin: düzenlenebilir -->
          <div v-else-if="canManage" class="mt-4 flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-muted">Tam fiyat (₺)</span>
              <input
                v-model.number="fullInput"
                type="number"
                min="0"
                step="50"
                class="w-36 rounded-lg border border-line bg-input px-3 py-2 font-mono text-sm text-content focus:border-accent"
                @input="pricesSaved = false"
              >
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-muted">İndirimli fiyat (₺)</span>
              <input
                v-model.number="discountInput"
                type="number"
                min="0"
                step="50"
                class="w-36 rounded-lg border border-line bg-input px-3 py-2 font-mono text-sm text-content focus:border-accent"
                @input="pricesSaved = false"
              >
            </label>
            <button
              class="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="submitting"
              @click="savePrices"
            >
              <component :is="submitting ? Loader2 : Save" class="h-4 w-4" :class="submitting && 'animate-spin'" />
              {{ submitting ? 'Kaydediliyor…' : 'Kaydet' }}
            </button>
          </div>

          <!-- Yetkisiz: salt okunur -->
          <p v-else class="mt-4 font-mono text-sm text-content">
            Tam {{ tl.format(fullPrice) }} · İndirimli {{ tl.format(discountPrice) }}
          </p>

          <p
            v-if="pricesSaved && !error"
            class="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 class="h-4 w-4" /> Kaydedildi · Tam {{ tl.format(fullPrice) }}, indirimli {{ tl.format(discountPrice) }}.
          </p>
          <p
            v-if="error"
            class="mt-3 flex items-center gap-2 text-sm text-danger"
          >
            <AlertCircle class="h-4 w-4" /> {{ error }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
