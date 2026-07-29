const { test, expect } = require('@playwright/test');

const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';
const LANGUAGE_KEY = 'ai-infrastructure-bulletin.language';

async function fillTransaction(page, values) {
  await page.locator('#txAssetType').selectOption(values.assetType || 'STOCK');
  await page.locator('#txSymbol').fill(values.symbol);
  await page.locator('#txName').fill(values.name || values.symbol);
  await page.locator('#txCurrency').fill(values.currency);
  await page.locator('#txUnit').fill(values.unit);
  await page.locator('#txSide').selectOption(values.side);
  await page.locator('#txQuantity').fill(String(values.quantity));
  await page.locator('#txUnitPrice').fill(String(values.unitPrice));
  await page.locator('#txFee').fill(String(values.fee || 0));
  await page.locator('#txDate').fill(values.date);
  if (values.currentPrice !== undefined) {
    await page.locator('#txCurrentPrice').fill(String(values.currentPrice));
    await page.locator('#txCurrentPriceDate').fill(values.currentPriceDate || values.date);
  }
  await page.locator('#transactionForm button[type="submit"]').click();
}

test('personal portfolio calculates purchases and sales and persists in English', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/ai-infrastructure-bulletin/');
  await page.evaluate(({ portfolioKey, languageKey }) => {
    localStorage.removeItem(portfolioKey);
    localStorage.removeItem(languageKey);
  }, { portfolioKey: PORTFOLIO_KEY, languageKey: LANGUAGE_KEY });
  await page.reload();

  await expect(page.locator('#freshness')).not.toHaveText(/Yükleniyor|Loading/, { timeout: 20000 });
  await page.locator('.tab[data-view="portfolio"]').click();
  await expect(page.locator('#portfolioView')).toHaveClass(/active/);

  await fillTransaction(page, {
    symbol: 'TTRAK.IS', name: 'Türk Traktör', currency: 'TRY', unit: 'lot',
    side: 'BUY', quantity: 10, unitPrice: 400, fee: 10, date: '2026-01-01', currentPrice: 420,
  });
  await expect(page.locator('#txFormStatus')).toHaveText('İşlem kaydedildi.');

  await fillTransaction(page, {
    symbol: 'TTRAK.IS', name: 'Türk Traktör', currency: 'TRY', unit: 'lot',
    side: 'BUY', quantity: 5, unitPrice: 500, fee: 5, date: '2026-01-02', currentPrice: 420,
  });

  await fillTransaction(page, {
    symbol: 'TTRAK.IS', name: 'Türk Traktör', currency: 'TRY', unit: 'lot',
    side: 'SELL', quantity: 4, unitPrice: 450, fee: 4, date: '2026-01-03', currentPrice: 420,
  });

  const accounting = await page.evaluate(portfolioKey => {
    const stored = JSON.parse(localStorage.getItem(portfolioKey));
    const result = PortfolioEngine.calculate(stored.transactions, stored.manualPrices);
    const holding = result.openHoldings[0];
    return {
      transactionCount: stored.transactions.length,
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      realizedPnl: holding.realizedPnl,
      costMethod: result.costMethod,
      valid: result.isValid,
    };
  }, PORTFOLIO_KEY);

  expect(accounting.valid).toBe(true);
  expect(accounting.transactionCount).toBe(3);
  expect(accounting.quantity).toBeCloseTo(11, 8);
  expect(accounting.averageCost).toBeCloseTo((4010 + 2505) / 15, 8);
  expect(accounting.realizedPnl).toBeCloseTo((4 * 450 - 4) - 4 * ((4010 + 2505) / 15), 8);
  expect(accounting.costMethod).toBe('WEIGHTED_AVERAGE');
  await expect(page.locator('#portfolioHoldingsBody')).toContainText('TTRAK.IS');

  await fillTransaction(page, {
    symbol: 'TTRAK.IS', name: 'Türk Traktör', currency: 'TRY', unit: 'lot',
    side: 'SELL', quantity: 12, unitPrice: 430, fee: 0, date: '2026-01-04',
  });
  await expect(page.locator('#txFormStatus')).toContainText('11');
  const countAfterRejectedSale = await page.evaluate(portfolioKey => JSON.parse(localStorage.getItem(portfolioKey)).transactions.length, PORTFOLIO_KEY);
  expect(countAfterRejectedSale).toBe(3);

  await page.locator('#languageToggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.tab[data-view="portfolio"]')).toHaveText('My Portfolio');
  await expect(page.locator('#portfolioView h2').first()).toHaveText('My basket and transaction ledger');
  await expect(page.locator('#summaryTitle')).toHaveText('Daily company assessment of the tracking universe');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.tab[data-view="portfolio"]').click();
  await expect(page.locator('#portfolioHoldingsBody')).toContainText('TTRAK.IS');
  const persistedCount = await page.evaluate(portfolioKey => JSON.parse(localStorage.getItem(portfolioKey)).transactions.length, PORTFOLIO_KEY);
  expect(persistedCount).toBe(3);
  expect(pageErrors).toEqual([]);
});
