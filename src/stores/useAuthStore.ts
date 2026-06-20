import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppRole, Profile, UserRole } from '@/types'

/**
 * Oturum + profil + rol durumunu Supabase Auth ile senkron tutan store.
 * `init()` uygulama açılışında bir kez çağrılır: mevcut oturumu yükler,
 * profil/rol bilgisini çeker ve sonraki auth değişimlerine abone olur.
 */
export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const role = ref<AppRole | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => session.value !== null)
  const isSuperadmin = computed(() => role.value === 'superadmin')
  const isAdmin = computed(() => role.value === 'superadmin' || role.value === 'admin')
  const displayName = computed(
    () => profile.value?.full_name ?? user.value?.email ?? 'kullanıcı',
  )

  function hasRole(roles: AppRole[]): boolean {
    return role.value !== null && roles.includes(role.value)
  }

  /** Giriş yapan kullanıcının profil ve rolünü DB'den çeker (RLS korumalı). */
  async function fetchProfileAndRole(): Promise<void> {
    const uid = user.value?.id
    if (!uid) {
      profile.value = null
      role.value = null
      return
    }

    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', uid).maybeSingle(),
    ])

    if (profileRes.error) throw profileRes.error
    if (roleRes.error) throw roleRes.error

    profile.value = profileRes.data
    role.value = roleRes.data?.role ?? null
  }

  function applySession(next: Session | null): void {
    session.value = next
    user.value = next?.user ?? null
    if (next === null) {
      profile.value = null
      role.value = null
    }
  }

  async function init(): Promise<void> {
    if (ready.value) return
    const { data } = await supabase.auth.getSession()
    applySession(data.session)
    if (session.value) {
      await fetchProfileAndRole()
    }

    supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next)
      if (next) {
        // Arka planda profil/rol tazele; hatayı yut, oturumu bozma.
        void fetchProfileAndRole().catch(() => {
          profile.value = null
          role.value = null
        })
      }
    })

    ready.value = true
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    applySession(data.session)
    // Atomik giriş: profil/rol alınamazsa oturumu geri al, yarı-giriş bırakma.
    try {
      await fetchProfileAndRole()
    } catch {
      await supabase.auth.signOut()
      applySession(null)
      throw new Error('Profil/rol bilgisi alınamadı. Lütfen bir yönetici ile iletişime geçin.')
    }
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    applySession(null)
  }

  return {
    session,
    user,
    profile,
    role,
    ready,
    isAuthenticated,
    isAdmin,
    isSuperadmin,
    displayName,
    hasRole,
    init,
    signIn,
    signOut,
    fetchProfileAndRole,
  }
})
