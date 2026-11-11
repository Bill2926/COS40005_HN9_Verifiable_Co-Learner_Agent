import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  outputDir: '../.playwright/test-results',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Always starts its own app with the fake model forced, and never reuses one
  // already on the port. A developer with a real model key configured serves a
  // live model from `pnpm dev`, and a choice saved on /admin overrides the
  // environment. These tests assert on the exact scripted sentences, so a
  // reused server or a saved record would test the wrong thing.
  webServer: {
    command: 'pnpm dev --port 3000 --strictPort --no-tui',
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NUXT_MODEL: 'fake',
    },
  },
})
