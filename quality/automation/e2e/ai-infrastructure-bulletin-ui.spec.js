const { test, expect } = require('@playwright/test');

const URL = '/ai-infrastructure-bulletin/';

async function dismissServiceWorker(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
  });
}

test.describe('calm professional market workspace', () => {
  test.beforeEach(async ({ page }) => {
    await dismissServiceWorker(page);
  });

  test('desktop uses a left command rail and keeps the portfolio functional', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(URL);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.brand-mark')).toBeVisible();
    const navBox = await page.locator('.tabs').boundingBox();
    const mainBox = await page.locator('main').boundingBox();
    expect(navBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(navBox.x).toBeLessThan(mainBox.x);
    await page.locator('.tab[data-view="portfolio"]').click();
    await expect(page.locator('#transactionForm')).toBeVisible();
    await expect(page.locator('#portfolioView .table-wrap').first()).toBeVisible();
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    test(`mobile navigation remains reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(URL);
      const nav = page.locator('.tabs');
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box).not.toBeNull();
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.locator('.tab[data-view="portfolio"]').click();
      await expect(page.locator('#portfolioView')).toHaveClass(/active/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    });
  }

  test('English mode preserves the workspace and portfolio labels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL);
    await page.locator('#languageToggle').click();
    await expect(page.locator('.tab[data-view="portfolio"]')).toContainText('My Portfolio');
    await page.locator('.tab[data-view="portfolio"]').click();
    await expect(page.getByText('My basket and transaction ledger')).toBeVisible();
  });
});
