<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogIn, Loader2, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function onSubmit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  errorMsg.value = null
  try {
    await auth.signIn(email.value.trim(), password.value)
    // Açık yönlendirmeyi (open redirect) engelle: yalnızca site-içi mutlak yollar.
    const redirect = route.query.redirect
    const isSafe = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    await router.push(isSafe ? redirect : { name: 'dashboard' })
  } catch (err) {
    errorMsg.value =
      err instanceof Error ? err.message : 'Giriş başarısız oldu. Bilgilerinizi kontrol edin.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <div class="space-y-1">
      <h1 class="text-lg font-semibold text-content">Tekrar hoş geldiniz</h1>
      <p class="text-sm text-muted">Devam etmek için hesabınıza giriş yapın.</p>
    </div>

    <label class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-content">E-posta</span>
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        placeholder="uye@hackerspace.org"
        :disabled="loading"
        class="rounded-lg border border-line bg-input px-3.5 py-2.5 text-sm text-content placeholder:text-faint transition focus:border-accent disabled:opacity-60"
      >
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-sm font-medium text-content">Şifre</span>
      <input
        v-model="password"
        type="password"
        required
        autocomplete="current-password"
        placeholder="••••••••"
        :disabled="loading"
        class="rounded-lg border border-line bg-input px-3.5 py-2.5 text-sm text-content placeholder:text-faint transition focus:border-accent disabled:opacity-60"
      >
    </label>

    <p
      v-if="errorMsg"
      class="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
      <span>{{ errorMsg }}</span>
    </p>

    <button
      type="submit"
      :disabled="loading"
      class="mt-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
    >
      <component
        :is="loading ? Loader2 : LogIn"
        class="h-4 w-4"
        :class="loading && 'animate-spin'"
      />
      {{ loading ? 'Doğrulanıyor…' : 'Giriş yap' }}
    </button>
  </form>
</template>
