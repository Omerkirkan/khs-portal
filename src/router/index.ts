import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import type { AppRole } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /** Tanımlıysa, yalnızca bu rollerdeki kullanıcılar erişebilir. */
    allowedRoles?: AppRole[]
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'members',
          name: 'members',
          component: () => import('@/views/MembersView.vue'),
          meta: { allowedRoles: ['superadmin', 'admin', 'keyholder'] },
        },
        {
          path: 'dues',
          name: 'dues',
          component: () => import('@/views/DuesView.vue'),
          meta: { allowedRoles: ['superadmin', 'admin'] },
        },
        {
          path: 'donations',
          name: 'donations',
          component: () => import('@/views/DonationsView.vue'),
          meta: { allowedRoles: ['superadmin', 'admin'] },
        },
        {
          path: 'import',
          name: 'import',
          component: () => import('@/views/ImportView.vue'),
          meta: { allowedRoles: ['superadmin', 'admin'] },
        },
        {
          path: 'uye-aktar',
          name: 'member-import',
          component: () => import('@/views/MemberImportView.vue'),
          meta: { allowedRoles: ['superadmin', 'admin'] },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/views/ForbiddenView.vue'),
        },
      ],
    },
    {
      path: '/login',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/views/auth/LoginView.vue'),
          meta: { requiresAuth: false },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Oturum/rol durumu hazır değilse bekle (sayfa yenilemede yarış önlenir).
  if (!auth.ready) {
    await auth.init()
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Rol bazlı yetki kontrolü
  const allowed = to.meta.allowedRoles
  if (allowed && allowed.length > 0 && !auth.hasRole(allowed)) {
    return { name: 'forbidden' }
  }

  return true
})

export default router
