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
  await page.waitForTimeout(10000);

  const diagnostics = await page.evaluate(async () => {
    const catalog = await fetch("./data/equity-catalog.json", { cache: "no-store" }).then(response => response.json());
    return {
      readyState: document.readyState,
      marketSearchPresent: Boolean(document.querySelector("#pmMarketSearch")),
      total: window.PiyasaMarketWorkspace?.getAssets?.().length || 0,
      displayedTotal: Number(document.querySelector("#pmStatusTotal")?.textContent || 0),
      displayedBist: Number(document.querySelector("#pmStatusBist")?.textContent || 0),
      displayedUs: Number(document.querySelector("#pmStatusUs")?.textContent || 0),
      catalogCounts: catalog.counts,
      freshness: document.querySelector("#freshness")?.textContent || "",
      scripts: [...document.scripts].map(script => script.src).filter(Boolean),
      modules: {
        integration: Boolean(window.__PM_MARKET_INTEGRATION_BOOTSTRAP__),
        workspace: Boolean(window.__PM_MARKET_CORE_V2__),
        intraday: Boolean(window.__PM_NATIVE_INTRADAY_CORE__),
        live: Boolean(window.__PM_MARKET_LIVE_SESSION__)
      }
    };
  });
  console.log("market diagnostics", JSON.stringify({ ...diagnostics, errors: [...new Set(errors)] }));

  assert.equal(diagnostics.marketSearchPresent, true, "market search UI must be mounted");
  assert.equal(diagnostics.total, diagnostics.catalogCounts.TOTAL, "runtime universe must equal the official catalogue");
  assert.equal(diagnostics.displayedTotal, diagnostics.catalogCounts.TOTAL);
  assert.equal(diagnostics.displayedBist, diagnostics.catalogCounts.BIST);
  assert.equal(diagnostics.displayedUs, diagnostics.catalogCounts.US);
  assert.ok(diagnostics.catalogCounts.BIST >= 600);
  assert.ok(diagnostics.catalogCounts.US >= 6000);
  assert.deepEqual(diagnostics.modules, { integration: true, workspace: true, intraday: true, live: true });

  async function search(symbol) {
    await page.locator("#pmMarketSearch").fill(symbol);
    await page.waitForTimeout(80);
    return page.locator(`#pmAssetList [data-pm-symbol="${symbol}"]`).count();
  }

  for (const symbol of ["RDW", "BURCE", "CBOE", "ISATR", "ISKUR", "UMPAS"]) {
    assert.ok(await search(symbol) >= 1, `${symbol} must be searchable`);
  }

  await page.locator('#pmMarketFilters [data-filter="BIST"]').click();
  assert.ok(await search("RDW") >= 1, "RDW search must work after selecting the BIST filter");
  assert.ok(await search("LINK") >= 2, "BIST:LINK and US:LINK must both remain searchable");

  assert.equal(await page.locator("#marketView iframe").count(), 0, "market workspace must not contain an iframe");
  assert.equal(await page.locator("#marketView").getByText(/TradingView/i).count(), 0, "market workspace must not expose TradingView UI");
  assert.deepEqual([...new Set(errors)], [], `browser errors: ${[...new Set(errors)].join(" | ")}`);

  console.log("running-market-search: all assertions passed");
})().then(async () => {
  if (browser) await browser.close();
}).catch(async error => {
  console.error(error);
  if (browser) await browser.close().catch(() => null);
  process.exit(1);
});
