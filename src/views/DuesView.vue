<script setup lang="ts">
import { CreditCard } from 'lucide-vue-next'
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Aidatlar</h1>
      <p class="mt-1 text-sm text-muted">Aidat takibi ve ödeme kayıtları.</p>
    </header>

    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center"
    >
      <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <CreditCard class="h-6 w-6" />
      </span>
      <div>
        <p class="text-sm font-medium text-content">Aidat modülü yakında</p>
        <p class="mt-1 text-sm text-muted">Ödeme kayıtları ve borç takibi bir sonraki sürümde gelecek.</p>
      </div>
    </div>
  </section>
</template>
