import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./src/frontend-next', import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/frontend-next', import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-next', import.meta.url)),
    emptyOutDir: true
  },
  server: {
    port: 5174
  }
})
