import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // This is a public, read-only CDN address.  Keeping the same prefix as the
  // desktop process means web and desktop builds use one resource setting.
  envPrefix: ['VITE_', 'MAIN_VITE_'],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: { outDir: 'dist' },
})
