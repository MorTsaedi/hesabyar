import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    // jspdf/html2canvas/xlsx are large but lazily loaded via code-splitting;
    // 900 kB threshold avoids noise for these legitimately heavy libs.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
