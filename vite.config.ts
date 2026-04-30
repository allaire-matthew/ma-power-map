import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ma-power-map/',
  plugins: [react(), tailwindcss()],
  build: {
    // Bundle was a single 2 MB chunk; split heavy deps into their own
    // files so the parser can stream them and the browser can cache
    // them independently.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('tldraw')) return 'tldraw'
            if (id.includes('firebase')) return 'firebase'
            if (id.includes('d3-')) return 'd3'
            if (id.includes('react')) return 'react'
            return 'vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
