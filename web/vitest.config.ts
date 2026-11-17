import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Each migration test replays every migration in PGlite; run side by side
    // they outlast the 5 s default.
    testTimeout: 30_000,
    // Type-level tests (*.test-d.ts) are checked by tsc, not run.
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tsconfig.type-tests.json',
    },
  },
})
