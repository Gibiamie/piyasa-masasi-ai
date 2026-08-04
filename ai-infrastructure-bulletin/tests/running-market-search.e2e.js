"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const APP_URL = process.env.PM_APP_URL || "http://127.0.0.1:4173/ai-infrastructure-bulletin/#market";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("#pmMarketSearch", { timeout: 120000 });
  await page.waitForFunction(() => (window.PiyasaMarketWorkspace?.getAssets?.().length || 0) > 0, null, { timeout: 120000 });

  const diagnostics = await page.evaluate(() => ({
    total: window.PiyasaMarketWorkspace?.getAssets?.().length || 0,
    displayedTotal: document.querySelector("#pmStatusTotal")?.textContent || "",
    displayedBist: document.querySelector("#pmStatusBist")?.textContent || "",
    displayedUs: document.querySelector("#pmStatusUs")?.textContent || "",
    modules: {
      integration: Boolean(window.__PM_MARKET_INTEGRATION_BOOTSTRAP__),
      workspace: Boolean(window.__PM_MARKET_WORKSPACE_CORE__),
      intraday: Boolean(window.__PM_NATIVE_INTRADAY_CORE__),
      live: Boolean(window.__PM_MARKET_LIVE_SESSION__)
    }
  }));
  console.log("market diagnostics", JSON.stringify(diagnostics));
  assert.ok(diagnostics.total > 7000, `expected more than 7000 equities, received ${diagnostics.total}`);

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

  assert.equal(await page.locator("iframe").count(), 0, "market workspace must not contain an iframe");
  assert.equal(await page.getByText(/TradingView/i).count(), 0, "market workspace must not expose TradingView UI");
  assert.deepEqual([...new Set(errors)], [], `browser errors: ${[...new Set(errors)].join(" | ")}`);

  await browser.close();
  console.log("running-market-search: all assertions passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
