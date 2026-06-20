import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'khs-theme'

/**
 * Tema (light/dark) durumunu yönetir.
 * `<html>` üzerinde `dark`/`light` sınıfını ayarlar, tercihi localStorage'a yazar.
 * İlk açılışta FOUC'u önlemek için sınıf, index.html içindeki satır-içi script ile
 * zaten ayarlanmış olur; `init()` yalnızca store state'ini onunla senkronlar.
 */
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('dark')
  const isDark = computed(() => theme.value === 'dark')

  function apply(next: Theme): void {
    theme.value = next
    const root = document.documentElement
    root.classList.toggle('dark', next === 'dark')
    root.classList.toggle('light', next === 'light')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage erişilemezse sessizce geç (gizli mod vb.)
    }
  }

  function resolveInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'light') return stored
    } catch {
      // yok say
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }

  function init(): void {
    apply(resolveInitial())
  }

  function toggle(): void {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, isDark, init, toggle, apply }
})
