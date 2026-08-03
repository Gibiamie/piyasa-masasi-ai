const { test, expect } = require('@playwright/test');

const APP_URL = '/ai-infrastructure-bulletin/#market';
const PORTFOLIO_KEY = 'ai-infrastructure-bulletin.portfolio.v1';

test.setTimeout(90_000);

function chartPayload(symbol, range) {
  const now = Math.floor(Date.now() / 1000);
  const intraday = range === '1d';
  const step = intraday ? 300 : 86400;
  const count = intraday ? 60 : 45;
  const base = symbol.endsWith('.IS') ? 480 : 18;
  const timestamp = Array.from({ length: count }, (_, index) => now - (count - 1 - index) * step);
  const close = timestamp.map((_, index) => base + index * (symbol.endsWith('.IS') ? .35 : .05));
  return {
    chart: {
      result: [{
        meta: {
          symbol,
          currency: symbol.endsWith('.IS') ? 'TRY' : 'USD',
          regularMarketPrice: symbol === 'TTRAK.IS' ? 500 : symbol === 'LUNR' ? 20 : close.at(-1),
          chartPreviousClose: symbol === 'TTRAK.IS' ? 490 : symbol === 'LUNR' ? 19 : close[0],
          regularMarketTime: now,
          marketState: 'REGULAR',
          exchangeDataDelayedBy: symbol.endsWith('.IS') ? 15 : 0,
          fullExchangeName: symbol.endsWith('.IS') ? 'Borsa Istanbul' : 'Nasdaq'
        },
        timestamp,
        indicators: {
          quote: [{
            open: close.map(value => value - .08),
            high: close.map(value => value + .2),
            low: close.map(value => value - .2),
            close,
            volume: close.map((_, index) => 100000 + index * 1500)
          }]
        }
      }],
      error: null
    }
  };
}

test.describe('Live quotes and chart workspace', () => {
  test('reprices research and portfolio and renders interactive charts', async ({ page }) => {
    let liveLunrPrice = 20;

    await page.route('**/v7/finance/quote?**', async route => {
      const requestUrl = new globalThis.URL(route.request().url());
      const symbols = decodeURIComponent(requestUrl.searchParams.get('symbols') || '').split(',').filter(Boolean);
      const now = Math.floor(Date.now() / 1000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          quoteResponse: {
            result: symbols.map(symbol => {
              const price = symbol === 'LUNR' ? liveLunrPrice : symbol === 'TTRAK.IS' ? 500 : symbol.endsWith('.IS') ? 100 : 50;
              const previous = symbol === 'LUNR' ? 19 : symbol === 'TTRAK.IS' ? 490 : price - 1;
              return {
                symbol,
                regularMarketPrice: price,
                regularMarketPreviousClose: previous,
                regularMarketChange: price - previous,
                regularMarketChangePercent: (price / previous - 1) * 100,
                regularMarketTime: now,
                currency: symbol.endsWith('.IS') ? 'TRY' : 'USD',
                marketState: 'REGULAR',
                exchangeDataDelayedBy: symbol.endsWith('.IS') ? 15 : 0,
                fullExchangeName: symbol.endsWith('.IS') ? 'Borsa Istanbul' : 'Nasdaq'
              };
            }),
            error: null
          }
        })
      });
    });

    await page.route('**/v8/finance/chart/**', async route => {
      const requestUrl = new globalThis.URL(route.request().url());
      const symbol = decodeURIComponent(requestUrl.pathname.split('/').pop());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(chartPayload(symbol, requestUrl.searchParams.get('range'))) });
    });

    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 1,
        transactions: [{
          id: 'live-lunr-buy',
          createdAt: '2026-07-01T10:00:00.000Z',
          date: '2026-07-01',
          assetType: 'STOCK',
          symbol: 'LUNR',
          name: 'Intuitive Machines',
          currency: 'USD',
          unit: 'share',
          side: 'BUY',
          quantity: 10,
          unitPrice: 10,
          fee: 0,
          notes: 'Live market integration test'
        }],
        manualPrices: {}
      }));
    }, { key: PORTFOLIO_KEY });

    await page.goto(APP_URL);
    await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => window.PiyasaLiveMarket, null, { timeout: 30_000 });
    await page.waitForFunction(() => window.PiyasaLiveMarket?.runtime?.quotes?.size > 0, null, { timeout: 45_000 });

    await expect(page.locator('.tab[data-view="market"]')).toBeVisible();
    await page.locator('.tab[data-view="market"]').click();
    await expect(page.locator('#marketView')).toHaveClass(/active/);
    await expect(page.locator('.pm-market-list-meta')).toContainText(/30 sn|30-sec/, { timeout: 10_000 });

    await page.locator('#pmMarketSearch').fill('TTRAK');
    await expect(page.locator('[data-pm-symbol="TTRAK"]')).toBeVisible();
    await page.locator('[data-pm-symbol="TTRAK"]').click();
    await expect(page.locator('#pmAssetPrice')).toContainText(/500/);
    await expect(page.locator('#pmAssetChange')).toContainText(/gecikmeli|delayed/);

    await page.evaluate(() => openAssetDrawer('LUNR'));
    await expect(page.locator('#assetLiveChart')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#assetLiveChart [data-chart-price]')).toContainText(/20/);
    await expect(page.locator('#assetLiveChart [data-chart-range="1D"]')).toBeVisible();
    await expect(page.locator('#assetLiveChart [data-chart-range="2Y"]')).toBeVisible();
    await expect(page.locator('#assetLiveChart .chart-svg')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#assetLiveChart .chart-cost-label')).toContainText(/maliyet|cost/i);
    await expect(page.locator('#assetLiveChart .chart-marker-buy')).toHaveCount(1);

    await page.locator('#assetLiveChart [data-chart-type="candle"]').click();
    await expect(page.locator('#assetLiveChart .chart-candle-up, #assetLiveChart .chart-candle-down').first()).toBeVisible();
    await page.locator('#assetLiveChart [data-chart-range="1D"]').click();
    await expect(page.locator('#assetLiveChart .chart-svg')).toBeVisible();

    const overlay = page.locator('#assetLiveChart [data-chart-overlay]');
    const box = await overlay.boundingBox();
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .4);
    await expect(page.locator('#assetLiveChart .chart-tooltip')).not.toHaveClass(/hidden/);
    await expect(page.locator('#assetLiveChart .chart-tooltip')).toContainText(/Open|Açılış/);

    await page.locator('#closeDrawer').click();
    await page.locator('.tab[data-view="portfolio"]').click();
    await expect(page.locator('#portfolioMarketTotals')).toContainText(/200/);
    await expect(page.locator('#portfolioUnrealizedTotals')).toContainText(/100/);
    await expect(page.locator('#portfolioHoldingsBody')).toContainText(/Canlı|Live/);

    liveLunrPrice = 21;
    await page.locator('#refresh').click();
    await expect(page.locator('#portfolioMarketTotals')).toContainText(/210/, { timeout: 30_000 });
    await expect(page.locator('#portfolioUnrealizedTotals')).toContainText(/110/);

    await page.locator('#languageToggle').click();
    await expect(page.locator('#freshness')).toContainText(/30-sec|delayed|Cached/);
  });
});
