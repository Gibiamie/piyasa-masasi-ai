// Deployment-integrity checks that aren't specific to any single P0 finding:
// manifest loads and parses, the service worker registers where it's supposed
// to, no *critical* asset (html/css/js/manifest/sw) fails to load, and a
// screenshot is captured at every required viewport for visual review. Runs
// against whichever baseURL the active Playwright config points at (local
// static server or the live GitHub Pages URL) -- see playwright.config.js vs
// playwright.live.config.js.
//
// The known, deliberate exception: mic/data/history/*.json is excluded from
// this migration (docs/MIGRATION_PLAN.md) and 404s until the scheduled
// GitHub Actions history workflows populate it post-deploy. That specific
// path is allow-listed below rather than silently ignored.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function isExpectedMiss(url) {
  return /\/mic\/data\/history\/[^/]+\.json(\?|$)/.test(url);
}

test.describe('deployment integrity', () => {
  test('manifest.webmanifest loads and parses with expected fields', async ({ page, baseURL }) => {
    const res = await page.request.get(new URL('mic/manifest.webmanifest', baseURL).toString());
    expect(res.status(), 'manifest.webmanifest must return 200').toBe(200);
    const manifest = await res.json();
    expect(manifest.name || manifest.short_name, 'manifest must declare a name').toBeTruthy();
    expect(Array.isArray(manifest.icons) || manifest.start_url !== undefined, 'manifest must declare icons or start_url').toBeTruthy();
  });

  test('service worker registers on mic/ (mobile) and is intentionally skipped on mic-desktop/', async ({ page }) => {
    const failedCritical = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && !isExpectedMiss(res.url())) failedCritical.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('mic/');
    await page.waitForFunction(() => 'serviceWorker' in navigator, null, { timeout: 5000 }).catch(() => {});
    const supported = await page.evaluate(() => 'serviceWorker' in navigator);
    const mobileReg = supported
      ? (await page
          .waitForFunction(
            async () => {
              const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
              return !!reg;
            },
            null,
            { timeout: 10000, polling: 250 }
          )
          .then(() => 'registered')
          .catch(() => 'not-registered'))
      : 'unsupported';
    expect(['registered', 'unsupported'], `mic/ service worker state: ${mobileReg}`).toContain(mobileReg);

    await page.goto('mic-desktop/');
    await page.waitForTimeout(1500); // give any (unexpected) registration attempt time to settle
    const desktopReg = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      return reg ? 'registered' : 'not-registered';
    });
    // chart-workspace-v10.js explicitly skips SW registration when
    // location.pathname.includes('mic-desktop') -- this is intentional, not a defect.
    expect(desktopReg, 'mic-desktop/ is not expected to register a service worker').not.toBe('registered');

    expect(failedCritical, `unexpected failed critical requests: ${JSON.stringify(failedCritical)}`).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`screenshot: mic/ at ${vp.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('mic/');
      // Not networkidle: MIC-P1-025 (crypto-quotes-v22.js) has a documented
      // ~70s uncancelable poll that keeps the network "busy" indefinitely,
      // so networkidle is the wrong readiness signal. The home hero card is
      // present on initial load regardless of viewport width or which nav
      // (bottom vs sidebar) is visible at that width.
      await page.locator('.card.hero').waitFor({ state: 'visible', timeout: 15000 });
      const file = path.join(SCREENSHOT_DIR, `mic-${vp.name}-${testInfo.project.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      await testInfo.attach(`mic-${vp.name}`, { path: file, contentType: 'image/png' });
    });

    test(`screenshot: mic-desktop/ at ${vp.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('mic-desktop/');
      await page.locator('.card.hero').waitFor({ state: 'visible', timeout: 15000 });
      const file = path.join(SCREENSHOT_DIR, `mic-desktop-${vp.name}-${testInfo.project.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      await testInfo.attach(`mic-desktop-${vp.name}`, { path: file, contentType: 'image/png' });
    });
  }
});
