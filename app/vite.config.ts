import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// envDir '..': one .env.local at the repo root; Vite only exposes VITE_* to the browser.
// @shared: the same engine code the edge functions run (formatting, labels, hashes).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '..',
  base: './', // relative asset paths so the same build works in Capacitor and on Vercel
  resolve: { alias: { '@shared': new URL('../supabase/functions/_shared', import.meta.url).pathname } },
  server: { fs: { allow: ['..'] } },
})
