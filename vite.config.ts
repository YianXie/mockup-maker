/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    rollupOptions: {
      input:
        mode === 'development'
          ? { main: resolve(__dirname, 'index.html'), sheet: resolve(__dirname, 'dev/contact-sheet.html') }
          : { main: resolve(__dirname, 'index.html') },
    },
  },
  test: { environment: 'jsdom' },
}))
