import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const APP_URL = 'https://gibiamie.github.io/piyasa-masasi-ai/ai-infrastructure-bulletin/#market';
const NASDAQ_URL = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

async function fetchNasdaq() {
  const response = await fetch(NASDAQ_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://www.nasdaq.com',
      referer: 'https://www.nasdaq.com/'
    }
  });
  if (!response.ok) throw new Error(`Nasdaq HTTP ${response.status}`);
  const payload = await response.json();
  const rows = payload?.data?.rows || payload?.data?.table?.rows;
  if (!Array.isArray(rows) || rows.length < 6000) throw new Error(`Unexpected Nasdaq rows: ${rows?.length}`);
  const bySymbol = new Map();
  for (const row of rows) {
    const symbol = normalize(row.symbol);
    if (!symbol) continue;
    bySymbol.set(symbol, {
      symbol,
      name: row.name || '',
      marketCap: row.marketCap || '',
      country: row.country || '',
      sector: row.sector || '',
      industry: row.industry || ''
    });
  }
  return bySymbol;
}

const official = await fetchNasdaq();
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));

await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#pmMarketSearch', { state: 'attached', timeout: 120000 });
await page.waitForFunction(() => Number(document.querySelector('#pmStatusUs')?.textContent || 0) > 0, null, { timeout: 120000 });

const appSnapshot = await page.evaluate(() => {
  const assets = window.PiyasaMarketWorkspace?.getAssets?.() || [];
  const normalized = assets.map(asset => ({
    symbol: String(asset.symbol || '').trim().toUpperCase(),
    name: asset.name || '',
    exchange: String(asset.exchange || '').trim().toUpperCase(),
    currency: String(asset.currency || '').trim().toUpperCase(),
    price: asset.price ?? null
  })).filter(asset => asset.symbol);
  const nonBist = normalized.filter(asset => asset.exchange !== 'BIST');
  const search = document.querySelector('#pmMarketSearch');
  const list = document.querySelector('#pmAssetList');
  const checks = {};
  for (const code of ['RDW', 'LUNR', 'AAPL', 'NVDA', 'RKLB']) {
    search.value = code;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const returned = [...list.querySelectorAll('[data-pm-symbol]')].map(node => node.dataset.pmSymbol);
    checks[code] = { found: returned.includes(code), returned };
  }
  return {
    totalAssets: normalized.length,
    nonBistAssets: nonBist,
    displayedTotal: document.querySelector('#pmStatusTotal')?.textContent || '',
    displayedBist: document.querySelector('#pmStatusBist')?.textContent || '',
    displayedUs: document.querySelector('#pmStatusUs')?.textContent || '',
    checks
  };
});

const appMap = new Map(appSnapshot.nonBistAssets.map(row => [row.symbol, row]));
const missing = [...official.values()].filter(row => !appMap.has(row.symbol));
const appOnly = [...appMap.values()].filter(row => !official.has(row.symbol));

const likelyEquities = missing.filter(row => !/(WARRANT|RIGHT|UNIT|PREFERRED|PREFERENCE|NOTE|BOND|FUND|ETF|DEPOSITARY SHARES EACH REPRESENTING 1\/\d+TH INTEREST|DEPOSITARY SHARES EACH REPRESENTING A 1\/\d+TH INTEREST)/i.test(row.name));

const report = {
  generated_at: new Date().toISOString(),
  app_url: APP_URL,
  official_source: NASDAQ_URL,
  counts: {
    nasdaq_symbols: official.size,
    application_total_assets: appSnapshot.totalAssets,
    application_non_bist_assets: appMap.size,
    displayed_total: appSnapshot.displayedTotal,
    displayed_bist: appSnapshot.displayedBist,
    displayed_us: appSnapshot.displayedUs,
    missing_all_instruments: missing.length,
    missing_likely_equities: likelyEquities.length,
    application_only: appOnly.length
  },
  rdw: {
    official: official.get('RDW') || null,
    application: appMap.get('RDW') || null,
    search: appSnapshot.checks.RDW || null
  },
  search_checks: appSnapshot.checks,
  missing_likely_equities: likelyEquities,
  missing_all_instruments: missing,
  application_only: appOnly,
  console_errors: [...new Set(consoleErrors)]
};

await fs.mkdir('audit-results', { recursive: true });
await fs.writeFile('audit-results/live-us-search-audit.json', `${JSON.stringify(report, null, 2)}\n`);
await page.screenshot({ path: 'audit-results/live-us-search.png', fullPage: false });
console.log(JSON.stringify(report, null, 2));
await browser.close();
