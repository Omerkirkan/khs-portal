<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ShieldAlert, ArrowLeft } from 'lucide-vue-next'
</script>

<template>
  <section class="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
    <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger">
      <ShieldAlert class="h-8 w-8" />
    </span>
    <div>
      <p class="text-sm font-medium text-danger">403 — Erişim reddedildi</p>
      <h1 class="mt-1 text-2xl font-semibold tracking-tight">Bu sayfaya yetkiniz yok</h1>
      <p class="mt-2 text-sm text-muted">
        Bu bölüm, rolünüzün erişim seviyesinin dışında.
      </p>
    </div>
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-card transition hover:bg-accent-dim"
    >
      <ArrowLeft class="h-4 w-4" />
      Genel Bakış'a dön
    </RouterLink>
  </section>
</template>
