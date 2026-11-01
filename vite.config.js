import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundling breaks the URL @jsquash/webp uses to load its .wasm file
  optimizeDeps: { exclude: ['@jsquash/webp'] },
})
