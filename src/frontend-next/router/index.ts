import { createRouter, createWebHashHistory, type RouteLocationNormalized } from 'vue-router'
import type { SiteConfigResponse } from '../types/dashboard'
import {
  AUTH_EXPIRED_EVENT,
  clearAuthToken,
  isAdminLoggedIn,
  normalizeApiIndex,
} from '../utils/auth'
import { getApiBases } from '../utils/config'
import { http } from '../utils/http'
import { getPostLoginTarget } from '../utils/routing'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/admin',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/admin/panel',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/server/:id',
      name: 'server-detail',
      component: () => import('../views/ServerDetailView.vue'),
    },
  ],
})

async function hasValidAdminSession(apiIndex: number): Promise<boolean> {
  if (!isAdminLoggedIn(apiIndex)) return false
  const result = await http.getByIndex<SiteConfigResponse>('/api/config', apiIndex, {
    includeAuth: true,
    includeTurnstile: false,
    includeTurnstileVerified: false,
    autoRedirect: false,
  })
  const valid = !result.error && result.data?.authorization === true
  if (!valid) clearAuthToken(apiIndex)
  return valid
}

function loginLocation(to: RouteLocationNormalized, apiIndex: number) {
  return {
    name: 'login',
    query: { api: String(apiIndex), redirect: to.fullPath },
  }
}

function authenticatedTarget(to: RouteLocationNormalized, apiIndex: number) {
  return getPostLoginTarget(to.query.redirect, apiIndex)
}

router.beforeEach(async (to) => {
  const apiIndex = normalizeApiIndex(to.query.api ?? to.query.apiIndex)
  if (to.meta.requiresAuth) {
    return await hasValidAdminSession(apiIndex) ? true : loginLocation(to, apiIndex)
  }
  if (to.name === 'login' && isAdminLoggedIn(apiIndex) && await hasValidAdminSession(apiIndex)) {
    return authenticatedTarget(to, apiIndex)
  }
  return true
})

window.addEventListener(AUTH_EXPIRED_EVENT, (event) => {
  const current = router.currentRoute.value
  if (current.name === 'login') return
  const baseUrl = (event as CustomEvent<{ baseUrl?: string }>).detail?.baseUrl
  const index = Math.max(0, getApiBases().indexOf(String(baseUrl || '')))
  void router.replace(loginLocation(current, index))
})

export default router
