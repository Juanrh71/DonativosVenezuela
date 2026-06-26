import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // '/' para Render (una sola URL). GitHub Pages usa VITE_BASE_PATH=/DonativosVenezuela/
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
