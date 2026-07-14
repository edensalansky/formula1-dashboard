import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites at username.github.io/REPO_NAME/ —
  // this must match your repo's name exactly, or assets will 404
  base: '/formula1-dashboard/',
})
