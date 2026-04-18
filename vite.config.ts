import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/__tests__/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/kernel/lib/']
    }
  },
})
