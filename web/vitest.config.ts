import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// These files sign in to the shared Supabase project and do not skip when
// the keys are missing. GitHub's Check sets CHECK_SKIP_LIVE_SUPABASE so a
// pull request can pass without those keys. A local `pnpm test` still runs them.
const liveSupabaseFiles = [
  'tests/**/*boundary*.test.ts',
  'tests/conversation-storage.test.ts',
]

export default defineConfig({
  resolve: {
    // The alias Nuxt gives app and server code; tests that import app files need it too.
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.CHECK_SKIP_LIVE_SUPABASE === '1' ? liveSupabaseFiles : []),
    ],
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
