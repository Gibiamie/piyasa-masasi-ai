import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const APP_URL = 'https://gibiamie.github.io/piyasa-masasi-ai/ai-infrastructure-bulletin/#market';
const KAP_URL = 'https://www.kap.org.tr/en/Pazarlar';

function parseKapEquities(html) {
  const normalized = html.replace(/\\"/g, '"');
  const start = normalized.indexOf('"title":"EQUITY MARKET"');
  if (start < 0) throw new Error('KAP embedded EQUITY MARKET payload not found');
  const segment = normalized.slice(start);
  const tokenPattern = /"marketName":"([^"]+)"|"stockCode":"([A-Z0-9]{3,8})","title":"([^"]*)"/g;
  const allowed = new Set(['BIST STAR', 'BIST MAIN', 'SUBMARKET', 'WATCHLIST MARKET', 'PRE-MARKET TRADING PLATFORM']);
  const rows = new Map();
  let market = null;
  let match;
  while ((match = tokenPattern.exec(segment)) !== null) {
    if (match[1]) {
      const candidate = match[1].toUpperCase();
      market = allowed.has(candidate) ? candidate : null;
    } else if (market && match[2]) {
      rows.set(match[2], { code: match[2], company: match[3], market });
    }
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
}

const kapResponse = await fetch(KAP_URL, { headers: { 'user-agent': 'Mozilla/5.0 Piyasa-Masasi-Live-Search-Audit/1.0' } });
if (!kapResponse.ok) throw new Error(`KAP HTTP ${kapResponse.status}`);
const official = parseKapEquities(await kapResponse.text());
if (official.length < 600) throw new Error(`Unexpected KAP count ${official.length}`);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
let navigationCount = 0;
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigationCount += 1; });

await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#pmMarketSearch', { state: 'attached', timeout: 120000 });
await page.waitForFunction(() => Number(document.querySelector('#pmStatusBist')?.textContent || 0) > 0, null, { timeout: 120000 });

const appAssets = await page.evaluate(() => window.PiyasaMarketWorkspace?.getAssets?.() || []);
const appBistCodes = new Set(appAssets.filter(asset => String(asset.exchange || '').toUpperCase() === 'BIST').map(asset => String(asset.symbol || '').toUpperCase()));
const missingFromApplication = official.filter(row => !appBistCodes.has(row.code));

const searchChecks = await page.evaluate(codes => {
  const input = document.querySelector('#pmMarketSearch');
  const list = document.querySelector('#pmAssetList');
  if (!input || !list) throw new Error('MARKET_SEARCH_UI_NOT_FOUND');
  const result = {};
  for (const code of codes) {
    input.value = code;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const returned = [...list.querySelectorAll('[data-pm-symbol]')].map(node => node.dataset.pmSymbol);
    result[code] = { found: returned.includes(code), returned };
  }
  return result;
}, ['BURCE', 'ISCTR', 'AEFES', 'THYAO', 'ISATR', 'ISKUR', 'UMPAS']);

const displayedBistCount = await page.locator('#pmStatusBist').textContent();
const displayedTotalCount = await page.locator('#pmStatusTotal').textContent();
const appVersion = await page.evaluate(() => ({
  integration: window.__PM_MARKET_INTEGRATION_BOOTSTRAP__ || window.__PM_MARKET_INTEGRATION__ || false,
  workspace: window.__PM_MARKET_WORKSPACE_CORE__ || false,
  selected: window.PiyasaMarketWorkspace?.getSelected?.()?.symbol || null,
  serviceWorkerController: navigator.serviceWorker?.controller?.scriptURL || null
}));

const report = {
  generated_at: new Date().toISOString(),
  app_url: APP_URL,
  official_symbols_tested: official.length,
  application_bist_assets: appBistCodes.size,
  displayed_bist_count: displayedBistCount,
  displayed_total_count: displayedTotalCount,
  missing_from_application_count: missingFromApplication.length,
  missing_from_application: missingFromApplication,
  search_checks: searchChecks,
  burce_visible: searchChecks.BURCE?.found === true,
  main_frame_navigation_count: navigationCount,
  console_errors: [...new Set(consoleErrors)],
  app_version: appVersion
};

await fs.mkdir('audit-results', { recursive: true });
await fs.writeFile('audit-results/live-bist-search-audit.json', `${JSON.stringify(report, null, 2)}\n`);
await page.screenshot({ path: 'audit-results/live-bist-search.png', fullPage: false });
console.log(JSON.stringify(report, null, 2));
await browser.close();
