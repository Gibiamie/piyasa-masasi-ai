const { test, expect } = require('@playwright/test');

const URL = '/ai-infrastructure-bulletin/#portfolio';
const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';

const CSV = [
  'Rapor Tarihi;05/07/2026',
  'Kod;Varlık Adı;Adet;Maliyet;Fiyat;Tutar;Para Birimi',
  'ALFA;Alpha Test;100;10,50;12,00;1.200,00;TRY',
  'BETA;Beta Test;25;20,00;18,00;450,00;TRY'
].join('\n');

test.describe('Broker portfolio import center', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(key => localStorage.removeItem(key), PORTFOLIO_KEY);
    await page.goto(URL);
    await expect(page.locator('#freshness')).not.toHaveText(/Yükleniyor|Loading/, { timeout: 25000 });
    await expect(page.locator('#brokerImportOpen')).toBeVisible({ timeout: 10000 });
  });

  test('imports a broker CSV locally, previews it and persists the positions', async ({ page }) => {
    await page.locator('#brokerImportOpen').click();
    await expect(page.locator('#brokerImportModal')).toHaveClass(/open/);
    await page.locator('#brokerPortfolioFile').setInputFiles({
      name: 'synthetic-broker-portfolio.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV, 'utf8')
    });

    await expect(page.locator('#brokerImportReview')).toBeVisible();
    await expect(page.locator('#brokerPreviewBody tr')).toHaveCount(2);
    await expect(page.locator('#brokerPreviewBody')).toContainText('ALFA');
    await expect(page.locator('#brokerPreviewBody')).toContainText('BETA');
    await expect(page.locator('#selectedPositionCount')).toHaveText('2');

    await page.locator('#confirmBrokerImport').click();
    await expect(page.locator('#brokerImportModal')).not.toHaveClass(/open/);
    await expect(page.locator('#portfolioHoldingsBody')).toContainText('ALFA');
    await expect(page.locator('#portfolioHoldingsBody')).toContainText('BETA');
    await expect(page.locator('#portfolioCostTotals')).toContainText(/1[.,]550/);
    await expect(page.locator('#portfolioMarketTotals')).toContainText(/1[.,]650/);
    await expect(page.locator('#portfolioUnrealizedTotals')).toContainText(/100/);

    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PORTFOLIO_KEY);
    expect(stored.transactions).toHaveLength(2);
    expect(stored.manualPrices).toBeTruthy();

    await page.reload();
    await expect(page.locator('#freshness')).not.toHaveText(/Yükleniyor|Loading/, { timeout: 25000 });
    await page.locator('.tab[data-view="portfolio"]').click();
    await expect(page.locator('#portfolioHoldingsBody')).toContainText('ALFA');
    await expect(page.locator('#portfolioHoldingsBody')).toContainText('BETA');
  });

  test('imports a Piyasa Masası JSON backup through the same preview flow', async ({ page }) => {
    const backup = {
      version: 1,
      costMethod: 'WEIGHTED_AVERAGE',
      source: { broker: 'Synthetic Broker', statementDate: '2026-07-05' },
      transactions: [{
        id: 'json-opening-gamma',
        createdAt: '2026-07-05T12:00:00.000Z',
        date: '2026-07-05',
        assetType: 'STOCK',
        symbol: 'GAMMA',
        name: 'Gamma Test',
        currency: 'TRY',
        unit: 'lot',
        side: 'BUY',
        quantity: 10,
        unitPrice: 30,
        fee: 0,
        notes: 'Synthetic test'
      }],
      manualPrices: {
        'STOCK|GAMMA|TRY|lot': { price: 35, date: '2026-07-05', source: 'manual' }
      }
    };

    await page.locator('#brokerImportOpen').click();
    await page.locator('#brokerPortfolioFile').setInputFiles({
      name: 'portfolio.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup), 'utf8')
    });
    await expect(page.locator('#brokerImportReview')).toBeVisible();
    await expect(page.locator('#brokerPreviewBody')).toContainText('GAMMA');
    await page.locator('#confirmBrokerImport').click();
    await expect(page.locator('#portfolioHoldingsBody')).toContainText('GAMMA');
    await expect(page.locator('#portfolioMarketTotals')).toContainText(/350/);
  });

  test('keeps import controls bilingual and states local processing', async ({ page }) => {
    await expect(page.locator('#brokerImportPanel')).toContainText('Portföy');
    await expect(page.locator('#brokerImportPanel')).toContainText('cihazınızdan çıkmaz');
    await page.locator('#languageToggle').click();
    await expect(page.locator('#brokerImportOpen')).toHaveText('Choose file');
    await expect(page.locator('#brokerImportPanel')).toContainText('never leaves your device');
  });
});
