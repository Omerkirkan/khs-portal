<script setup lang="ts">
import GeneralSettingsPanel from '@/components/domain/GeneralSettingsPanel.vue'
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Ayarlar</h1>
      <p class="mt-1 text-sm text-muted">Portal ve hesap ayarları.</p>
    </header>

    <GeneralSettingsPanel />
  </section>
</template>
