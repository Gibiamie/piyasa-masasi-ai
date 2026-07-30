const { test, expect } = require('@playwright/test');

const URL = '/ai-infrastructure-bulletin/';
const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';
const LANGUAGE_KEY = 'ai-infrastructure-bulletin.language';
const EXPERIENCE_KEY = 'piyasa-masasi-ai.experience-level';

async function cleanUserState(page) {
  await page.goto(URL);
  await page.evaluate(({ portfolioKey, languageKey, experienceKey }) => {
    localStorage.removeItem(portfolioKey);
    localStorage.removeItem(languageKey);
    localStorage.removeItem(experienceKey);
  }, { portfolioKey: PORTFOLIO_KEY, languageKey: LANGUAGE_KEY, experienceKey: EXPERIENCE_KEY });
  await page.reload();
  await expect(page.locator('#freshness')).not.toHaveText(/Yükleniyor|Loading/, { timeout: 20000 });
}

test.describe('Piyasa Masası AI professional workspace', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => {
      const message = error.message || '';
      if (!message.includes('sw.js due to access control checks')) errors.push(message);
    });
    page.on('close', () => expect(errors).toEqual([]));
    await cleanUserState(page);
  });

  test('loads as a research product and opens an asset detail', async ({ page }) => {
    await expect(page).toHaveTitle('Piyasa Masası AI');
    await expect(page.locator('.brand-text strong')).toHaveText('Piyasa Masası');
    await expect(page.locator('body')).not.toContainText('AI Altyapısı Piyasa Bülteni');
    await expect(page.locator('.tab')).toHaveCount(5);
    await expect(page.locator('#evaluations .research-card').first()).toBeVisible();
    await page.locator('#evaluations .open-asset').first().click();
    await expect(page.locator('#assetDrawer')).toHaveClass(/open/);
    await expect(page.locator('#drawerContent .drawer-metrics')).toBeVisible();
    await page.locator('#closeDrawer').click();
    await expect(page.locator('#assetDrawer')).not.toHaveClass(/open/);
  });

  test('supports deep links, English and progressive disclosure', async ({ page }) => {
    await page.goto(`${URL}#settings`);
    await expect(page.locator('#settingsView')).toHaveClass(/active/);
    await page.locator('#experienceLevel').selectOption('beginner');
    await page.locator('.tab[data-view="briefing"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-experience', 'beginner');
    await expect(page.locator('.research-context').first()).toBeHidden();
    await page.locator('#languageToggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.tab[data-view="portfolio"]')).toHaveText(/My Portfolio/);
    await expect(page.locator('#viewTitle')).toHaveText('Market overview');
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    test(`mobile navigation and portfolio remain usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(URL);
      await expect(page.locator('.sidebar')).toBeVisible();
      const navBox = await page.locator('.tabs').boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(viewport.height);
      await page.locator('.tab[data-view="portfolio"]').click();
      await expect(page.locator('#transactionForm')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    });
  }
});
