"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const APP_URL = process.env.PM_APP_URL || "http://127.0.0.1:4173/ai-infrastructure-bulletin/#market";
let browser = null;

(async () => {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(APP_URL, { waitUntil: "commit", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.PiyasaMarketWorkspace && document.querySelector("#pmMarketSearch")), null, { timeout: 30000 });
  await page.waitForTimeout(2500);

  const diagnostics = await page.evaluate(async () => {
    const catalog = await fetch("./data/equity-catalog.json", { cache: "no-store" }).then(response => response.json());
    return {
      total: window.PiyasaMarketWorkspace?.getAssets?.().length || 0,
      displayedTotal: Number(document.querySelector("#pmStatusTotal")?.textContent || 0),
      displayedBist: Number(document.querySelector("#pmStatusBist")?.textContent || 0),
      displayedUs: Number(document.querySelector("#pmStatusUs")?.textContent || 0),
      catalogCounts: catalog.counts,
      scripts: [...document.scripts].map(script => script.src).filter(Boolean),
      modules: {
        integration: Boolean(window.__PM_MARKET_INTEGRATION_BOOTSTRAP__),
        workspace: Boolean(window.__PM_MARKET_CORE_V2__),
        intraday: Boolean(window.__PM_NATIVE_INTRADAY_CORE__),
        live: Boolean(window.__PM_MARKET_LIVE_SESSION__),
        dailyHistory: Boolean(window.__PM_DAILY_HISTORY_CONTROLLER__),
        languagePortfolio: Boolean(window.__PM_LANGUAGE_PORTFOLIO_RUNTIME__),
        research: Boolean(window.__PM_RESEARCH_CORE_V2__)
      }
    };
  });

  assert.equal(diagnostics.total, diagnostics.catalogCounts.TOTAL, "runtime universe must equal official catalogue");
  assert.equal(diagnostics.displayedTotal, diagnostics.catalogCounts.TOTAL);
  assert.equal(diagnostics.displayedBist, diagnostics.catalogCounts.BIST);
  assert.equal(diagnostics.displayedUs, diagnostics.catalogCounts.US);
  assert.ok(diagnostics.catalogCounts.BIST >= 600);
  assert.ok(diagnostics.catalogCounts.US >= 6000);
  assert.deepEqual(diagnostics.modules, {
    integration: true,
    workspace: true,
    intraday: true,
    live: true,
    dailyHistory: true,
    languagePortfolio: true,
    research: true
  });
  assert.ok(diagnostics.scripts.some(src => src.includes("2026.08.09.29")), "v29 runtime modules must be loaded");

  async function search(symbol) {
    await page.locator("#pmMarketSearch").fill(symbol);
    await page.waitForTimeout(150);
    return page.locator(`#pmAssetList [data-pm-symbol="${symbol}"]`).count();
  }

  for (const symbol of ["RDW", "ASTOR", "BURCE", "CBOE", "ISATR", "ISKUR", "UMPAS", "LMKDC"]) {
    assert.ok(await search(symbol) >= 1, `${symbol} must be searchable`);
  }

  await page.locator('#pmMarketFilters [data-filter="BIST"]').click();
  assert.ok(await search("RDW") >= 1, "RDW search must work independently of selected market filter");
  assert.ok(await search("LINK") >= 2, "BIST:LINK and US:LINK must both remain searchable");

  await page.locator("#pmMarketSearch").fill("LMKDC");
  await page.locator('#pmAssetList [data-pm-key="BIST:LMKDC"]').click();
  await page.waitForFunction(() => document.querySelector("#pmAssetTitle")?.textContent?.startsWith("LMKDC"));
  await page.locator('#pmSourceTabs [data-source="INTRADAY"]').click();
  await page.waitForFunction(() => Boolean(window.PiyasaIntraday?.getRows?.().length), null, { timeout: 20000 });
  assert.ok(await page.evaluate(() => window.PiyasaIntraday.getRows().length) >= 1, "LMKDC intraday session must contain a price sample");

  await page.locator('.tab[data-view="market"]').click();
  if (await page.locator("html").getAttribute("lang") !== "tr") {
    await page.evaluate(() => { localStorage.setItem("ai-infrastructure-bulletin.language", "tr"); location.reload(); });
    await page.waitForFunction(() => Boolean(window.PiyasaMarketWorkspace && document.querySelector("#pmMarketSearch")), null, { timeout: 30000 });
  }
  await page.locator("#languageToggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await page.locator("#viewTitle").textContent(), "Market and chart");
  assert.equal(await page.locator('#pmSourceTabs [data-source="INTRADAY"]').textContent(), "MIC intraday");

  await page.locator('.tab[data-view="portfolio"]').click();
  await page.waitForFunction(() => document.querySelector("#portfolioView")?.classList.contains("active"));
  await page.locator("#txSymbol").fill("GARAN");
  await page.locator("#txSymbol").blur();
  await page.waitForFunction(() => {
    const name = document.querySelector("#txName")?.value || "";
    const price = Number(document.querySelector("#txCurrentPrice")?.value);
    const date = document.querySelector("#txCurrentPriceDate")?.value || "";
    return name.length > 2 && Number.isFinite(price) && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  });
  const transaction = await page.evaluate(() => ({
    name: document.querySelector("#txName")?.value,
    currency: document.querySelector("#txCurrency")?.value,
    unit: document.querySelector("#txUnit")?.value,
    price: document.querySelector("#txCurrentPrice")?.value,
    date: document.querySelector("#txCurrentPriceDate")?.value
  }));
  assert.match(transaction.name, /GARANT|GARAN/i);
  assert.equal(transaction.currency, "TRY");
  assert.equal(transaction.unit, "lot");
  assert.ok(Number(transaction.price) > 0);
  assert.match(transaction.date, /^\d{4}-\d{2}-\d{2}$/);

  assert.equal(await page.locator("#marketView iframe").count(), 0, "market workspace must not contain an iframe");
  assert.equal(await page.locator("#marketView").getByText(/TradingView/i).count(), 0, "market workspace must not expose TradingView UI");
  assert.deepEqual([...new Set(errors)], [], `browser errors: ${[...new Set(errors)].join(" | ")}`);

  console.log("running-market-search: v29 catalogue, intraday, language and portfolio assertions passed");
})().then(async () => {
  if (browser) await browser.close();
}).catch(async error => {
  console.error(error);
  if (browser) await browser.close().catch(() => null);
  process.exit(1);
});
