<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, RouterLink, RouterView } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Gift,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/useAuthStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { ROLE_LABELS, type AppRole } from '@/types'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const mobileOpen = ref(false)

/**
 * Masaüstünde sidebar daraltılmış mı (yalnızca ikonlar)? localStorage'da saklanır.
 * Mobilde etkisizdir (orada sidebar tam genişlikte slide-over olarak açılır).
 */
const collapsed = ref(localStorage.getItem('sidebar-collapsed') === '1')
function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', collapsed.value ? '1' : '0')
}

interface NavItem {
  name: string
  label: string
  icon: typeof LayoutDashboard
  section: string
  /** Tanımlıysa yalnızca bu rollerde görünür (route guard ile aynı kural). */
  allowedRoles?: AppRole[]
}

const nav: NavItem[] = [
  { name: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard, section: 'Yönetim' },
  { name: 'members', label: 'Üyeler', icon: Users, section: 'Yönetim', allowedRoles: ['superadmin', 'admin', 'keyholder'] },
  { name: 'dues', label: 'Aidatlar', icon: CreditCard, section: 'Yönetim', allowedRoles: ['superadmin', 'admin'] },
  { name: 'donations', label: 'Bağışlar', icon: Gift, section: 'Yönetim', allowedRoles: ['superadmin', 'admin'] },
  { name: 'account-activity', label: 'Hesap Hareketleri', icon: Receipt, section: 'Yönetim', allowedRoles: ['superadmin', 'admin'] },
  { name: 'settings', label: 'Ayarlar', icon: Settings, section: 'Hesap' },
]

const visibleNav = computed(() =>
  nav.filter((item) => !item.allowedRoles || auth.hasRole(item.allowedRoles)),
)

/** Görünür nav öğelerini bölümlerine göre gruplar (sıra korunur). */
const navSections = computed(() => {
  const groups = new Map<string, NavItem[]>()
  for (const item of visibleNav.value) {
    const list = groups.get(item.section) ?? []
    list.push(item)
    groups.set(item.section, list)
  }
  return Array.from(groups, ([title, items]) => ({ title, items }))
})

const userEmail = computed(() => auth.user?.email ?? 'misafir')
const userInitial = computed(() => userEmail.value.charAt(0).toUpperCase())
const roleLabel = computed(() => (auth.role ? ROLE_LABELS[auth.role] : '—'))

async function handleLogout(): Promise<void> {
  try {
    await auth.signOut()
  } finally {
    // Sunucu çıkışı başarısız olsa bile kullanıcıyı login'e götür (yerel state temizlendi).
    await router.push({ name: 'login' })
  }
}
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Mobil arkaplan örtüsü -->
    <Transition name="overlay">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-20 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        @click="mobileOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-30 flex w-64 transform flex-col border-r border-line bg-sidebar transition-[transform,width] duration-200 ease-out lg:static lg:translate-x-0"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64']"
    >
      <div
        class="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5"
        :class="collapsed && 'lg:justify-center lg:px-2'"
      >
        <div class="flex min-w-0 items-center gap-3" :class="collapsed && 'lg:hidden'">
          <img
            src="/logo-white.png"
            alt="Konya Hackerspace"
            class="h-9 w-9 shrink-0 invert dark:invert-0"
          >
          <span class="flex flex-col leading-tight">
            <span class="text-sm font-semibold tracking-tight">KHS Portal</span>
            <span class="text-xs text-faint">Hackerspace Yönetimi</span>
          </span>
        </div>
        <button
          class="ml-auto hidden shrink-0 rounded-lg border border-line p-1.5 text-muted transition hover:bg-zinc-500/10 hover:text-content lg:flex"
          :class="collapsed && 'lg:ml-0'"
          :title="collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'"
          @click="toggleCollapsed"
        >
          <component :is="collapsed ? ChevronRight : ChevronLeft" class="h-5 w-5" />
        </button>
      </div>

      <nav class="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div v-for="group in navSections" :key="group.title" class="flex flex-col gap-1">
          <p
            class="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-faint"
            :class="collapsed && 'lg:hidden'"
          >
            {{ group.title }}
          </p>
          <RouterLink
            v-for="item in group.items"
            :key="item.name"
            :to="{ name: item.name }"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-zinc-500/10 hover:text-content"
            :class="collapsed && 'lg:justify-center lg:px-0'"
            active-class="!bg-accent !text-accent-fg shadow-card"
            :title="collapsed ? item.label : undefined"
            @click="mobileOpen = false"
          >
            <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" />
            <span :class="collapsed && 'lg:hidden'">{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- Sidebar alt: kullanıcı kimliği -->
      <div class="border-t border-line p-3">
        <div
          class="flex items-center gap-3 rounded-lg px-2 py-2"
          :class="collapsed && 'lg:flex-col lg:gap-2 lg:px-0'"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
            :title="collapsed ? `${auth.displayName} · ${roleLabel}` : undefined"
          >
            {{ userInitial }}
          </div>
          <div class="min-w-0 flex-1" :class="collapsed && 'lg:hidden'">
            <p class="truncate text-sm font-medium text-content">{{ auth.displayName }}</p>
            <p class="truncate text-xs text-faint">{{ roleLabel }}</p>
          </div>
          <button
            class="shrink-0 rounded-md p-2 text-faint transition hover:bg-danger/10 hover:text-danger"
            title="Çıkış yap"
            @click="handleLogout"
          >
            <LogOut class="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Ana içerik -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Üst çubuk -->
      <header
        class="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-line bg-base/80 px-4 backdrop-blur sm:px-6"
      >
        <button
          class="rounded-lg p-2 text-muted transition hover:bg-zinc-500/10 hover:text-content lg:hidden"
          @click="mobileOpen = !mobileOpen"
        >
          <component :is="mobileOpen ? X : Menu" class="h-5 w-5" />
        </button>

        <span class="hidden text-sm text-faint sm:block">{{ userEmail }}</span>

        <div class="ml-auto flex items-center gap-2">
          <button
            class="rounded-lg p-2 text-muted transition hover:bg-zinc-500/10 hover:text-content"
            :title="theme.isDark ? 'Açık temaya geç' : 'Koyu temaya geç'"
            @click="theme.toggle()"
          >
            <component :is="theme.isDark ? Sun : Moon" class="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
