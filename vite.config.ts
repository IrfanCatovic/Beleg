import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@beleg/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8082', changeOrigin: true },
      '/login': { target: 'http://localhost:8082', changeOrigin: true },
    },
  },
})
