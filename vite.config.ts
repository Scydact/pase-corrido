import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [vue()],
  preview: { port: 5173, strictPort: true },
  test: { exclude: ['**/node_modules/**', '.opencv-build/**'] },
})
