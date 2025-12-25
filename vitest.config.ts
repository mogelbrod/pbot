import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  esbuild: {
    target: 'es2023',
  },
})
