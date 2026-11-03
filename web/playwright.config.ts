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
  // When port 3000 is free, this starts the app in fake-model mode.
  // An app already there is reused and must already be in fake mode, the default.
  webServer: {
    command: 'pnpm dev --port 3000 --strictPort --no-tui',
    url: `${baseURL}/sign-in`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NUXT_MODEL_MODE: 'fake',
    },
  },
})
