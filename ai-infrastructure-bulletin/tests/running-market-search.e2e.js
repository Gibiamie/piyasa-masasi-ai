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
      globalSearchPresent: Boolean(document.querySelector("#globalSearch")),
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
        live: Boolean(window.__PM_MARKET_LIVE_SESSION__),
        languagePortfolio: Boolean(window.__PM_LANGUAGE_PORTFOLIO_RUNTIME__)
      }
    };
  });
  console.log("market diagnostics", JSON.stringify({ ...diagnostics, errors: [...new Set(errors)] }));

  assert.equal(diagnostics.marketSearchPresent, true, "market search UI must be mounted");
  assert.equal(diagnostics.globalSearchPresent, true, "top search UI must be mounted");
  assert.equal(diagnostics.total, diagnostics.catalogCounts.TOTAL, "runtime universe must equal the official catalogue");
  assert.equal(diagnostics.displayedTotal, diagnostics.catalogCounts.TOTAL);
  assert.equal(diagnostics.displayedBist, diagnostics.catalogCounts.BIST);
  assert.equal(diagnostics.displayedUs, diagnostics.catalogCounts.US);
  assert.ok(diagnostics.catalogCounts.BIST >= 600);
  assert.ok(diagnostics.catalogCounts.US >= 6000);
  assert.deepEqual(diagnostics.modules, { integration: true, workspace: true, intraday: true, live: true, languagePortfolio: true });

  await page.locator("#globalSearch").fill("ASTOR");
  await page.waitForFunction(() => Boolean(document.querySelector('#globalSearchResults [data-key="BIST:ASTOR"]')));
  assert.equal(await page.locator('#globalSearchResults [data-key="BIST:ASTOR"]').count(), 1, "top search must find ASTOR in the official catalogue");
  assert.equal(await page.locator("#globalSearchResults").getByText(/Eşleşen varlık bulunamadı|No matching asset found/i).count(), 0, "legacy research-universe empty state must not appear");
  await page.locator('#globalSearchResults [data-key="BIST:ASTOR"]').click();
  await page.waitForFunction(() => document.querySelector("#pmAssetTitle")?.textContent?.startsWith("ASTOR"));
  assert.equal(new URL(page.url()).hash, "#market", "top-search selection must open the market view");

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

  // Turkish -> English must translate the complete dynamic market workspace.
  if (await page.locator("html").getAttribute("lang") !== "tr") {
    await page.evaluate(() => { localStorage.setItem("ai-infrastructure-bulletin.language", "tr"); location.reload(); });
    await page.waitForTimeout(7000);
  }
  await page.locator("#languageToggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#viewTitle").textContent(), "Market and chart");
  assert.equal(await page.locator("#globalSearch").getAttribute("placeholder"), "Search ticker or company name");
  assert.equal(await page.locator("#marketView .pm-status-card").first().locator("span").textContent(), "Total equities");
  assert.equal(await page.locator('#pmMarketFilters [data-filter="ALL"]').textContent(), "All");
  assert.equal(await page.locator('#pmSourceTabs [data-source="INTRADAY"]').textContent(), "MIC intraday");
  assert.equal(await page.locator("#pmAddTransaction").textContent(), "Add transaction for this equity");
  assert.equal(await page.locator("#pmOpenPortfolio").textContent(), "Open portfolio");
  assert.equal(await page.locator("#marketView").getByText("SİSTEM DURUMU", { exact: true }).count(), 0);
  assert.equal(await page.locator("#marketView").getByText("Bu hisse için işlem ekle", { exact: true }).count(), 0);

  // The portfolio transaction form must resolve symbols from the same official catalogue.
  await page.locator('.tab[data-view="portfolio"]').click();
  await page.waitForFunction(() => document.querySelector("#portfolioView")?.classList.contains("active"));
  assert.equal(await page.locator("#transactionFormTitle").textContent(), "Record a purchase or sale");
  await page.locator("#txSymbol").fill("GARAN");
  await page.locator("#txSymbol").blur();
  await page.waitForFunction(() => {
    const name = document.querySelector("#txName")?.value || "";
    const price = Number(document.querySelector("#txCurrentPrice")?.value);
    const date = document.querySelector("#txCurrentPriceDate")?.value || "";
    return name.length > 2 && Number.isFinite(price) && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  });
  const transactionAutofill = await page.evaluate(() => ({
    name: document.querySelector("#txName")?.value,
    currency: document.querySelector("#txCurrency")?.value,
    unit: document.querySelector("#txUnit")?.value,
    price: document.querySelector("#txCurrentPrice")?.value,
    priceDate: document.querySelector("#txCurrentPriceDate")?.value,
    assetType: document.querySelector("#txAssetType")?.value
  }));
  assert.match(transactionAutofill.name, /GARANT|GARAN/i);
  assert.equal(transactionAutofill.currency, "TRY");
  assert.equal(transactionAutofill.unit, "lot");
  assert.ok(Number(transactionAutofill.price) > 0);
  assert.match(transactionAutofill.priceDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(transactionAutofill.assetType, "STOCK");

  // English -> Turkish must update the active portfolio page without reloading.
  await page.locator("#languageToggle").click();
  await page.waitForFunction(() => document.documentElement.lang === "tr");
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#transactionFormTitle").textContent(), "Alış veya satış kaydet");
  assert.equal(await page.locator('label:has(#txSymbol) span').textContent(), "Sembol");
  assert.equal(await page.locator('label:has(#txCurrentPrice) span').textContent(), "Güncel fiyat (opsiyonel)");
  assert.equal(await page.locator('label:has(#txCurrentPriceDate) span').textContent(), "Güncel fiyat tarihi");

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
