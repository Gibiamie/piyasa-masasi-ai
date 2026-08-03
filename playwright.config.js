const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './quality/automation/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'quality/automation/e2e/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4321/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node quality/automation/e2e/static-server.js',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
