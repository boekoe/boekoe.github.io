import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/kondre-sr/',
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
})
