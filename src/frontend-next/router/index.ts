import { createRouter, createWebHashHistory } from 'vue-router'

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
    },
  ],
})

export default router
