import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // Relative asset URLs so the build works from any sub-path (e.g. GitHub Pages /vocab-party/).
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [],
  server: { host: '0.0.0.0', port: 8000 },
  clearScreen: false,
  build: {
    // Phaser alone is ~1.3 MB; it gets its own long-cached chunk so game updates stay small.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
})
