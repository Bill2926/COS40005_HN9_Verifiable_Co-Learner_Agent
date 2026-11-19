import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['benchmark/benchmark.test.ts'],
    testTimeout: 30_000,
  },
})
