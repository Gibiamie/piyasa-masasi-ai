// MIC-P0-002: a missing price used to be silently treated as zero, inflating
// every other position's weight and enabling bad sell decisions. Verifies, in
// a real browser against the actually-served mic/price-integrity-v18.js, that
// one missing-price position locks weight/decision output for the whole
// portfolio and the UI says so explicitly (not just internally).
const { test, expect } = require('@playwright/test');
const { seedState, COMPLETE_PROFILE } = require('./fixtures');

test('a position with no resolvable price locks portfolio weight and decisions', async ({ page }) => {
  await seedState(page, {
    profile: COMPLETE_PROFILE,
    portfolio: [
      // Symbol intentionally absent from mic/data/market.json and carries no
      // currentPrice, so price-integrity-v18.js's assetPriceMeta() must
      // resolve it as MISSING rather than falling back to avgCost.
      { symbol: 'ZZZNOPRICE', name: 'Fiyatsiz Test Varligi', type: 'stock', exchange: 'BIST', currency: 'TRY', quantity: 100, avgCost: 50 },
    ],
  });
  await page.goto('/mic/');
  await page.locator('[data-view="portfolio"]').click();

  // Wait for price-integrity-v18.js (loaded dynamically) to take over rendering.
  await expect(page.locator('#portfolioPriceNoticeV18')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#portfolioPriceNoticeV18')).toContainText('PORTFÖY AĞIRLIĞI HESAPLANAMADI');

  // Total value must be marked partial, not silently shown as a clean number.
  const totalValue = await page.locator('#totalValue').innerText();
  expect(totalValue.startsWith('~'), `totalValue "${totalValue}" should start with ~ (partial marker)`).toBe(true);
  expect(totalValue).toContain('kısmi');

  const item = page.locator('.portfolioItem').filter({ hasText: 'ZZZNOPRICE' });
  await expect(item).toBeVisible();
  await expect(item.locator('.badge')).toHaveText('HESAPLANAMADI');
  await expect(item.locator('.hint')).toContainText('PORTFÖY AĞIRLIĞI HESAPLANAMADI');

  // The scenario calculator must also refuse to run while locked.
  await item.locator('[data-a="scenario"]').click();
  await expect(page.locator('#analysisPanel')).toContainText('SENARYO HESAPLANAMADI');
});
