/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
