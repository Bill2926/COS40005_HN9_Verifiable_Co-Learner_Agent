import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:8765'

export default defineConfig({
  testDir: './ml-e2e',
  outputDir: '../.playwright/ml-results',
  use: { ...devices['Desktop Chrome'], baseURL },
  webServer: {
    command: 'python ../AI/serve-models.py --port 8765',
    url: `${baseURL}/api/models`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
