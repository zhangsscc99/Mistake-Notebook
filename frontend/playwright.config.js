const { defineConfig, devices } = require('@playwright/test')

const FRONTEND = process.env.E2E_BASE_URL || 'http://127.0.0.1:3060'
const BACKEND = process.env.E2E_API || 'http://127.0.0.1:8080/api'

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./e2e/global-setup.js'),
  use: {
    baseURL: FRONTEND,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    extraHTTPHeaders: { Accept: 'application/json' }
  },
  projects: [
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.js/,
      use: { baseURL: BACKEND }
    },
    {
      name: 'chromium',
      testMatch: /ui\/.*\.spec\.js/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 13'].userAgent
      }
    }
  ],
  webServer: {
    command: 'npm run serve',
    url: FRONTEND,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
})
