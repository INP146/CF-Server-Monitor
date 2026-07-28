import { createRouter, createWebHashHistory } from 'vue-router'
import { isAdminLoggedIn } from '../utils/api'

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

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAdminLoggedIn()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
