"use strict";

const assert = require("node:assert/strict");
const Live = require("../live-market.js");

assert.equal(Live.providerSymbol({ symbol: "AKBNK", currency: "TRY", assetType: "STOCK" }), "AKBNK.IS");
assert.equal(Live.providerSymbol({ ticker: "LUNR", currency: "USD", assetType: "STOCK" }), "LUNR");
assert.equal(Live.providerSymbol({ symbol: "BTC", currency: "USD", assetType: "CRYPTO" }), "BTC-USD");
assert.deepEqual(Live.symbolAliases({ ticker: "TTRAK", provider_symbol: "TTRAK.IS" }), ["TTRAK", "TTRAK.IS"]);

const quote = Live.parseQuoteResult({
  symbol: "TTRAK.IS",
  regularMarketPrice: 500,
  regularMarketPreviousClose: 490,
  regularMarketChange: 10,
  regularMarketChangePercent: 2.0408,
  regularMarketTime: 1_800_000_000,
  currency: "TRY",
  marketState: "REGULAR",
  exchangeDataDelayedBy: 15
});
assert.equal(quote.price, 500);
assert.equal(quote.currency, "TRY");
assert.equal(quote.delayMinutes, 15);
assert.equal(Live.quoteFreshness(quote, 1_800_000_010_000).code, "delayed");
assert.equal(Live.quoteFreshness({ ...quote, delayMinutes: 0 }, 1_800_000_010_000).code, "live");
assert.equal(Live.quoteFreshness({ ...quote, fromCache: true }, 1_800_000_010_000).code, "cache");

const chart = Live.parseChartPayload({
  chart: {
    result: [{
      meta: { symbol: "LUNR", currency: "USD", regularMarketPrice: 20, chartPreviousClose: 19, regularMarketTime: 1_800_000_000 },
      timestamp: [1_799_999_000, 1_800_000_000],
      indicators: { quote: [{ open: [18.5, 19.5], high: [19.5, 20.5], low: [18, 19], close: [19, 20], volume: [100, 200] }] }
    }],
    error: null
  }
});
assert.equal(chart.rows.length, 2);
assert.equal(chart.rows[1].close, 20);
assert.equal(chart.rows[1].volume, 200);
const chartQuote = Live.quoteFromChart(chart);
assert.equal(chartQuote.price, 20);
assert.ok(Math.abs(chartQuote.changePercent - 5.2631578947) < 1e-6);

console.log("Live market core tests passed.");
