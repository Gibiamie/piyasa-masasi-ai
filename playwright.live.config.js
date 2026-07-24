// Runs the same spec files as playwright.config.js against the live,
// deployed GitHub Pages URL instead of the local static server. No
// webServer block -- there is nothing local to start. Spec files use
// relative goto() paths (e.g. page.goto('/mic/')), so they are portable
// between the local and live configs without modification.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './quality/automation/e2e',
  fullyParallel: false, // be polite to the live Pages CDN
  workers: 2,
  retries: 1, // live network is less deterministic than the local static server
  reporter: [
    ['list'],
    ['html', { outputFolder: 'quality/automation/e2e/report-live', open: 'never' }],
  ],
  use: {
    baseURL: 'https://gibiamie.github.io/piyasa-masasi-ai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
