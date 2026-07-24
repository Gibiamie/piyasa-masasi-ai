// MIC-P0-001: portfolio weight alone used to trigger an automatic
// "DENGELE / AZALT" lot-sale instruction. Verifies, in a real browser against
// the actually-served mic/app-main.js, that a hard concentration breach
// renders a neutral warning with no lot count, and that the lot-count math is
// reachable only via the explicit opt-in "Senaryo" button, and that the
// resulting scenario is actually visible to the user (not rendered into an
// inactive view).
const { test, expect } = require('@playwright/test');
const { seedState, COMPLETE_PROFILE } = require('./fixtures');

test('single-position portfolio at 100% weight shows KONSANTRASYON UYARISI, never an automatic sale', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await seedState(page, {
    profile: COMPLETE_PROFILE, // maxPosition:5, rebalanceBand:1 -> cap+band = 6%
    portfolio: [
      { symbol: 'TUPRS', name: 'Tüpraş', type: 'stock', exchange: 'BIST', currency: 'TRY', quantity: 2000, avgCost: 63.32 },
    ],
  });
  await page.goto('/mic/');
  await page.locator('[data-view="portfolio"]').click();

  const item = page.locator('.portfolioItem').filter({ hasText: 'TUPRS' });
  await expect(item).toBeVisible();
  await expect(item.locator('.hint')).toContainText('KONSANTRASYON UYARISI');
  await expect(item.locator('.hint')).toContainText('SATIŞ SİNYALİ DEĞİLDİR');

  // The historical bug produced this exact action string with an automatic lot count.
  await expect(item.locator('.hint')).not.toContainText('DENGELE / AZALT');
  const hintText = await item.locator('.hint').innerText();
  expect(hintText, 'no lot/adet sale quantity may appear in the automatic decision text').not.toMatch(/\d+\s*(adet|lot)\s*(sat|azalt)/i);

  // Explicit opt-in scenario button: must actually become visible to the user,
  // not just update a DOM node inside an inactive view.
  await item.locator('[data-a="scenario"]').click();
  const panel = page.locator('#analysisPanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('MATEMATİKSEL SENARYO — TAVSİYE DEĞİLDİR');
  await expect(page.locator('#search')).toHaveClass(/active/);

  expect(pageErrors, `uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});
