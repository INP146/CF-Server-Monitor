import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'https://localhost:8787'

const createWorkerProxy = () => ({
  target: devProxyTarget,
  changeOrigin: true,
  secure: false,
  ws: true
})

export default defineConfig({
  root: fileURLToPath(new URL('./src/frontend-next', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      '@next': fileURLToPath(new URL('./src/frontend-next', import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-next', import.meta.url)),
    emptyOutDir: true
  },
  server: {
    port: 5174,
    proxy: {
      '/api': createWorkerProxy(),
      '/admin/api': createWorkerProxy(),
      '/update': createWorkerProxy(),
      '/updateDatabase': createWorkerProxy(),
      '/clearHistory': createWorkerProxy(),
      '/__do': createWorkerProxy()
    }
  }
})
