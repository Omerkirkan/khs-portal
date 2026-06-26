<script setup lang="ts">
import { computed, ref } from 'vue'
import { Coins, SlidersHorizontal, type LucideIcon } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import DuesTypesPanel from '@/components/domain/DuesTypesPanel.vue'

const auth = useAuthStore()

type TabId = 'dues' | 'general'

interface Tab {
  id: TabId
  label: string
  icon: LucideIcon
  /** Görünür olması için admin gerekiyor mu? */
  adminOnly: boolean
}

const allTabs: Tab[] = [
  { id: 'dues', label: 'Aidatlar', icon: Coins, adminOnly: true },
  { id: 'general', label: 'Genel', icon: SlidersHorizontal, adminOnly: false },
]

const tabs = computed(() => allTabs.filter((t) => !t.adminOnly || auth.isAdmin))
const active = ref<TabId>(tabs.value[0]?.id ?? 'general')
</script>

<template>
  <section class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">Ayarlar</h1>
      <p class="mt-1 text-sm text-muted">Portal ve hesap ayarları.</p>
    </header>

    <div class="flex flex-col gap-6 md:flex-row md:gap-8">
      <!-- Sekme kenar çubuğu -->
      <aside class="md:w-56 md:shrink-0">
        <nav class="flex gap-1 overflow-x-auto md:flex-col">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition"
            :class="
              active === tab.id
                ? 'bg-accent/10 text-accent'
                : 'text-muted hover:bg-zinc-500/10 hover:text-content'
            "
            @click="active = tab.id"
          >
            <component :is="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </button>
        </nav>
      </aside>

      <!-- Sekme içeriği -->
      <div class="min-w-0 flex-1">
        <DuesTypesPanel v-if="active === 'dues'" />

        <div
          v-else-if="active === 'general'"
          class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <SlidersHorizontal class="h-6 w-6" />
          </span>
          <div>
            <p class="text-sm font-medium text-content">Genel ayarlar yakında</p>
            <p class="mt-1 text-sm text-muted">Hesap ve portal tercihleri bir sonraki sürümde gelecek.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
