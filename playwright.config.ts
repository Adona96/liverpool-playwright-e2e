import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: process.env.CI ? 'never' : 'always' }],
    ['list'],
  ],
  use: {
    headless: process.env.HEADLESS !== 'false',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'on',
    trace: 'on',
    permissions: []
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});