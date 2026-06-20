<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
    <!-- Yumuşak kurumsal arka plan parıltısı -->
    <div
      class="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
    />

    <div class="relative w-full max-w-sm">
      <div class="mb-7 flex flex-col items-center gap-3 text-center">
        <img
          src="/logo-white.png"
          alt="Konya Hackerspace"
          class="h-14 w-14 invert dark:invert-0"
        >
        <div>
          <h1 class="text-base font-semibold tracking-tight">KHS Portal</h1>
          <p class="text-xs text-faint">Hackerspace Yönetim Sistemi</p>
        </div>
      </div>

      <div class="rounded-2xl border border-line bg-surface p-7 shadow-pop">
        <RouterView />
      </div>

      <p class="mt-6 text-center text-xs text-faint">
        © {{ new Date().getFullYear() }} KHS Hackerspace
      </p>
    </div>
  </div>
</template>
