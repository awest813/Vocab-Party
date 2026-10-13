import { defineConfig } from 'vite'

export default defineConfig({
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
