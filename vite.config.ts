import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Ensure compatibility with Node.js modules in the browser
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@google/generative-ai']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          ai: ['@google/generative-ai']
        }
      }
    }
  }
})
