import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const isExternalBaseUrl = !baseURL.includes('127.0.0.1') && !baseURL.includes('localhost');

const userAuthFile = path.join(__dirname, 'tests/e2e/.auth/user.json');
const adminAuthFile = path.join(__dirname, 'tests/e2e/.auth/admin.json');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list'], ['html']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: isExternalBaseUrl
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    // Auth setup — run once before all test projects
    {
      name: 'user setup',
      testMatch: '**/setup/user.setup.ts'
    },
    {
      name: 'admin setup',
      testMatch: '**/setup/admin.setup.ts'
    },

    // Desktop: all tests (no project-level storageState — each spec declares its own)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['user setup', 'admin setup']
    },

    // Mobile: only mobile-specific specs
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/mobile-*.spec.ts',
      dependencies: ['user setup']
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
      testMatch: '**/mobile-*.spec.ts',
      dependencies: ['user setup']
    }
  ]
});
