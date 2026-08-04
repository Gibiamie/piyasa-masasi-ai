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
let reloadCount = 0;
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(error.message));
page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloadCount += 1; });

async function waitForMarket() {
  await page.waitForSelector('#pmMarketSearch', { state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => Number(document.querySelector('#pmStatusBist')?.textContent || 0) > 0, null, { timeout: 120000 });
}

async function searchSymbol(code) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.evaluate(symbol => {
        const input = document.querySelector('#pmMarketSearch');
        if (!input) throw new Error('SEARCH_INPUT_NOT_FOUND');
        input.value = symbol;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, code);
      await page.waitForTimeout(20);
      return await page.locator('#pmAssetList [data-pm-symbol]').evaluateAll(nodes => nodes.map(node => node.dataset.pmSymbol));
    } catch (error) {
      if (attempt === 2) throw error;
      await waitForMarket();
    }
  }
  return [];
}

await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 120000 });
await waitForMarket();

const missing = [];
const mismatched = [];
for (const [index, row] of official.entries()) {
  const candidates = await searchSymbol(row.code);
  if (!candidates.includes(row.code)) missing.push(row);
  else if (candidates.some(code => code !== row.code)) mismatched.push({ code: row.code, returned: candidates });
  if (index > 0 && index % 100 === 0) await waitForMarket();
}

const burceCandidates = await searchSymbol('BURCE');
const burceVisible = burceCandidates.includes('BURCE');
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
  displayed_bist_count: displayedBistCount,
  displayed_total_count: displayedTotalCount,
  burce_visible: burceVisible,
  missing_from_live_search_count: missing.length,
  missing_from_live_search: missing,
  mismatched_results: mismatched,
  main_frame_navigation_count: reloadCount,
  console_errors: [...new Set(consoleErrors)],
  app_version: appVersion
};

await fs.mkdir('audit-results', { recursive: true });
await fs.writeFile('audit-results/live-bist-search-audit.json', `${JSON.stringify(report, null, 2)}\n`);
await page.screenshot({ path: 'audit-results/live-bist-search.png', fullPage: false });
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (!burceVisible) process.exitCode = 2;
