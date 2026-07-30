const { test, expect } = require('@playwright/test');

const URL = '/ai-infrastructure-bulletin/#portfolio';
const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';

// Synthetic fixtures only: no user portfolio data is committed to the repository.
const CSV = [
  'Rapor Tarihi;05/07/2026',
  'Kod;Varlık Adı;Adet;Maliyet;Fiyat;Tutar;Para Birimi',
  'ALFA;Alpha Test;100;10,50;12,00;1.200,00;TRY',
  'BETA;Beta Test;25;20,00;18,00;450,00;TRY'
].join('\n');

function syntheticPortfolioPdf() {
  const lines = [
    'BT /F1 10 Tf 1 0 0 1 390 790 Tm (Osmanli Yatirim) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 15 760 Tm (Hisse Portfoyum / Hisse) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 360 730 Tm (Duzenleme Tarihi) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 520 730 Tm (05/07/2026) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 21 700 Tm (Kod) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 85 700 Tm (Adet) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 117 700 Tm (Maliyet) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 222 700 Tm (Fiyat) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 21 660 Tm (ALFA) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 80 660 Tm (100) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 125 660 Tm (10,50) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 220 660 Tm (12,00) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 540 660 Tm (1.200,00) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 21 640 Tm (BETA) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 80 640 Tm (25) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 125 640 Tm (20,00) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 220 640 Tm (18,00) Tj ET',
    'BT /F1 10 Tf 1 0 0 1 540 640 Tm (450,00) Tj ET'
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(lines, 'ascii')} >>\nstream\n${lines}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

test.describe('Broker portfolio import center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(key => localStorage.removeItem(key), PORTFOLIO_KEY);
    await page.reload();
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
    const symbols = page.locator('#brokerPreviewBody [data-field="symbol"]');
    await expect(symbols.nth(0)).toHaveValue('ALFA');
    await expect(symbols.nth(1)).toHaveValue('BETA');
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

  test('reads a text-based broker PDF with the vendored PDF engine', async ({ page }) => {
    await page.locator('#brokerImportOpen').click();
    await page.locator('#brokerPortfolioFile').setInputFiles({
      name: 'synthetic-osmanli-portfolio.pdf',
      mimeType: 'application/pdf',
      buffer: syntheticPortfolioPdf()
    });

    await expect(page.locator('#brokerImportReview')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#brokerPreviewBody tr')).toHaveCount(2);
    const symbols = page.locator('#brokerPreviewBody [data-field="symbol"]');
    await expect(symbols.nth(0)).toHaveValue('ALFA');
    await expect(symbols.nth(1)).toHaveValue('BETA');
    await expect(page.locator('#brokerImportStatus')).not.toHaveClass(/error/);
    await page.locator('#confirmBrokerImport').click();
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
    await expect(page.locator('#brokerPreviewBody [data-field="symbol"]')).toHaveValue('GAMMA');
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
