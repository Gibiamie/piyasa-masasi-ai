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
  await page.waitForFunction(() => Boolean(window.PiyasaDailyHistory && document.querySelector("#pmMarketSearch")), null, { timeout: 30000 });

  const corsCheck = await page.evaluate(async () => {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/RDW?range=1mo&interval=1h&events=div%2Csplits&includePrePost=false";
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
      const payload = response.ok ? await response.json() : null;
      return {
        ok: response.ok,
        status: response.status,
        bars: payload?.chart?.result?.[0]?.timestamp?.length || 0,
        error: payload?.chart?.error || null
      };
    } catch (error) {
      return { ok: false, status: 0, bars: 0, error: String(error) };
    }
  });
  console.log("yahoo browser chart check", JSON.stringify(corsCheck));
  assert.equal(corsCheck.ok, true, `browser must be able to read Yahoo chart feed: ${JSON.stringify(corsCheck)}`);
  assert.ok(corsCheck.bars > 10, "RDW one-hour feed must contain multiple bars");

  await page.locator("#pmMarketSearch").fill("RDW");
  await page.waitForFunction(() => Boolean(document.querySelector('#pmAssetList [data-pm-key="US:RDW"]')));
  await page.locator('#pmAssetList [data-pm-key="US:RDW"]').click();
  await page.waitForFunction(() => document.querySelector("#pmAssetTitle")?.textContent?.startsWith("RDW"));

  const ranges = await page.locator("#pmRangeButtons [data-range]").evaluateAll(nodes => nodes.map(node => node.dataset.range));
  assert.deepEqual(ranges, ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "YTD"]);

  const intervals = await page.locator("#pmCandleIntervals [data-candle-interval]").evaluateAll(nodes => nodes.map(node => node.dataset.candleInterval));
  assert.deepEqual(intervals, ["1h", "2h", "4h", "1d", "1wk", "1mo"]);

  await page.waitForFunction(() => ["pm1m", "pm3m", "pm6m", "pm1y"].every(id => {
    const value = document.getElementById(id)?.textContent?.trim();
    return value && value !== "—";
  }), null, { timeout: 30000 });

  const returns = await page.evaluate(() => Object.fromEntries(["pm1m", "pm3m", "pm6m", "pm1y"].map(id => [id, document.getElementById(id)?.textContent?.trim()])));
  console.log("RDW returns", JSON.stringify(returns));
  for (const [id, value] of Object.entries(returns)) assert.match(value, /^[+-]?\d/, `${id} must display a signed numeric return`);

  await page.locator('#pmRangeButtons [data-range="1M"]').click();
  await page.locator('#pmCandleIntervals [data-candle-interval="1h"]').click();
  await page.waitForFunction(() => /1 sa OHLC|1 h OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });
  assert.equal(await page.locator("#pmChartMessage").isVisible(), false, "one-hour RDW candles must render");

  await page.locator('#pmCandleIntervals [data-candle-interval="2h"]').click();
  await page.waitForFunction(() => /2 sa OHLC|2 h OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmCandleIntervals [data-candle-interval="4h"]').click();
  await page.waitForFunction(() => /4 sa OHLC|4 h OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmRangeButtons [data-range="5Y"]').click();
  await page.waitForFunction(() => document.querySelector('#pmCandleIntervals [data-candle-interval="1d"]')?.classList.contains("active"));
  for (const interval of ["1h", "2h", "4h"]) {
    assert.equal(await page.locator(`#pmCandleIntervals [data-candle-interval="${interval}"]`).isDisabled(), true, `${interval} must be disabled for 5Y because the hourly provider does not retain five years`);
  }
  await page.waitForFunction(() => /1 G OHLC|1 D OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmRangeButtons [data-range="YTD"]').click();
  await page.waitForFunction(() => /OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""));

  assert.deepEqual([...new Set(errors)], [], `browser errors: ${[...new Set(errors)].join(" | ")}`);
  console.log("chart-timeframe: range, interval, five-year fallback and return metrics validated");
})().then(async () => {
  if (browser) await browser.close();
}).catch(async error => {
  console.error(error);
  if (browser) await browser.close().catch(() => null);
  process.exit(1);
});
