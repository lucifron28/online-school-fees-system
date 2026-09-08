import { defineConfig, devices } from '@playwright/test';

const recordingViewport = { width: 1280, height: 720 };
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e/recordings',
  timeout: 180_000,
  expect: {
    timeout: 45_000,
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/recordings',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: recordingViewport,
    video: {
      mode: 'on',
      size: recordingViewport,
    },
    trace: 'off',
    screenshot: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'recording-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: recordingViewport,
      },
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      ENABLE_MOCK_PAYMENT_HARNESS: 'false',
    },
  },
});
