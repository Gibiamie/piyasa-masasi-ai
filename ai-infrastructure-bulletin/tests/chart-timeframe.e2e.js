"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const APP_URL = process.env.PM_APP_URL || "http://127.0.0.1:4173/ai-infrastructure-bulletin/#market";
let browser = null;

function syntheticDaily() {
  const history = [];
  const start = Date.UTC(2024, 0, 2, 12, 0, 0);
  for (let index = 0; index < 800; index += 1) {
    const time = start + index * 86400_000;
    const base = 8 + index * 0.008 + Math.sin(index / 17) * 0.55;
    history.push({
      date: new Date(time).toISOString().slice(0, 10),
      open: base - 0.08,
      high: base + 0.32,
      low: base - 0.26,
      close: base + 0.06,
      volume: 1_000_000 + index * 1000
    });
  }
  return { symbol: "RDW", provider: "CI synthetic daily cache", range: "5y", history };
}

function syntheticHourly() {
  const bars = [];
  const start = Date.UTC(2026, 6, 1, 13, 30, 0) / 1000;
  for (let day = 0; day < 38; day += 1) {
    const date = new Date((start + day * 86400) * 1000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    for (let hour = 0; hour < 7; hour += 1) {
      const timestamp = start + day * 86400 + hour * 3600;
      const index = bars.length;
      const base = 10 + index * 0.012 + Math.sin(index / 8) * 0.18;
      bars.push([timestamp, base - 0.03, base + 0.14, base - 0.12, base + 0.05, 120000 + index * 250]);
    }
  }
  return { key: "US:RDW", symbol: "RDW", market: "US", provider: "CI synthetic hourly cache", range: "60d", interval: "1h", bars };
}

(async () => {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  const daily = syntheticDaily();
  const hourly = syntheticHourly();
  await page.route("**/mic/data/history/RDW.json*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(daily) }));
  await page.route("**/mic/data/hourly/US/RDW.json*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hourly) }));

  await page.goto(APP_URL, { waitUntil: "commit", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.PiyasaDailyHistory && document.querySelector("#pmMarketSearch")), null, { timeout: 30000 });

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
  assert.equal(await page.locator("#pmChartMessage").isVisible(), false, "one-hour RDW candles must render from same-origin cache");

  await page.locator('#pmCandleIntervals [data-candle-interval="2h"]').click();
  await page.waitForFunction(() => /2 sa OHLC|2 h OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmCandleIntervals [data-candle-interval="4h"]').click();
  await page.waitForFunction(() => /4 sa OHLC|4 h OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmRangeButtons [data-range="3M"]').click();
  await page.waitForFunction(() => document.querySelector('#pmCandleIntervals [data-candle-interval="1d"]')?.classList.contains("active"));
  for (const interval of ["1h", "2h", "4h"]) {
    assert.equal(await page.locator(`#pmCandleIntervals [data-candle-interval="${interval}"]`).isDisabled(), true, `${interval} must be disabled after the 1-month range because the server cache retains 60 days of hourly bars`);
  }

  await page.locator('#pmRangeButtons [data-range="5Y"]').click();
  await page.waitForFunction(() => /1 G OHLC|1 D OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""), null, { timeout: 30000 });

  await page.locator('#pmRangeButtons [data-range="YTD"]').click();
  await page.waitForFunction(() => /OHLC/.test(document.querySelector("#pmHistoryStatus")?.textContent || ""));

  assert.deepEqual([...new Set(errors)], [], `browser errors: ${[...new Set(errors)].join(" | ")}`);
  console.log("chart-timeframe: same-origin ranges, hourly aggregation, long-range daily fallback and return metrics validated");
})().then(async () => {
  if (browser) await browser.close();
}).catch(async error => {
  console.error(error);
  if (browser) await browser.close().catch(() => null);
  process.exit(1);
});
