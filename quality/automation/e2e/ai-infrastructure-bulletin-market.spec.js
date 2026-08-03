const { test, expect } = require('@playwright/test');

const APP_URL = '/ai-infrastructure-bulletin/#market';
const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key }) => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      transactions: [{
        id: 'ttrak-buy', createdAt: '2026-01-01T08:00:00Z', date: '2026-01-01',
        assetType: 'STOCK', symbol: 'TTRAK.IS', name: 'Türk Traktör', currency: 'TRY',
        unit: 'lot', side: 'BUY', quantity: 127, unitPrice: 245.25, fee: 0, notes: ''
      }],
      manualPrices: {}
    }));
  }, { key: PORTFOLIO_KEY });
});

test('loads BIST and Nasdaq quotes with a working portfolio chart on the first visit', async ({ page }) => {
  await page.goto(APP_URL);

  await expect(page.locator('.tab[data-view="market"]')).toBeVisible();
  await expect(page.locator('#marketView')).toHaveClass(/active/);
  await expect(page.locator('#pmAssetTitle')).toContainText('TTRAK', { timeout: 25000 });
  await expect(page.locator('#pmAssetPrice')).not.toHaveText('—');
  await expect(page.locator('#pmDataStatus')).toContainText('15 dk');
  await expect.poll(async () => Number(await page.locator('#pmStatusUs').textContent())).toBeGreaterThan(4000);
  await expect(page.locator('#pmPositionQty')).toContainText('127');
  await expect(page.locator('#pmPositionAvg')).toContainText(/245[,.]25/);
  await expect(page.locator('#pmChartStats')).not.toHaveText('—');
  const ttrakMarketPrice = await page.locator('#pmAssetPrice').textContent();

  const canvas = page.locator('#pmChartCanvas');
  await expect(canvas).toBeVisible();
  const dimensions = await canvas.evaluate(element => ({ width: element.width, height: element.height }));
  expect(dimensions.width).toBeGreaterThan(500);
  expect(dimensions.height).toBeGreaterThan(250);

  await page.locator('.tab[data-view="watchlist"]').click();
  await expect(page.locator('#watchlistBody tr[data-ticker="TTRAK"] td').nth(2)).toHaveText(ttrakMarketPrice);
  await page.locator('.tab[data-view="market"]').click();

  await page.locator('#pmMarketSearch').fill('NVDA');
  const nvda = page.locator('[data-pm-symbol="NVDA"]');
  await expect(nvda).toBeVisible();
  await nvda.click();
  await expect(page.locator('#pmAssetTitle')).toContainText('NVDA');
  await expect(page.locator('#pmAssetPrice')).not.toHaveText('—');
  await expect(page.locator('#pmDataStatus')).toContainText('15 dk');
});

test('refresh re-fetches the price feeds and TradingView mounts for the selected equity', async ({ page }) => {
  const requested = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/mic/data/market.json') || pathname.endsWith('/mic/data/nasdaq-quotes.json') || pathname.endsWith('/ai-infrastructure-bulletin/data/report.json')) requested.push(pathname);
  });

  await page.goto(APP_URL);
  await expect(page.locator('#pmAssetTitle')).toContainText('TTRAK', { timeout: 25000 });
  requested.length = 0;
  await page.locator('#pmReloadMarket').click();
  await expect.poll(() => new Set(requested).size).toBe(3);

  await page.locator('[data-source="TV"]').click();
  const widget = page.locator('#pmTvWrap script');
  await expect(widget).toHaveCount(1);
  await expect(widget).toContainText('BIST:TTRAK');
});
