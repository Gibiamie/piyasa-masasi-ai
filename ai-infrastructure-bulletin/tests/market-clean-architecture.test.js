"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const files = {
  integration: fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8"),
  workspace: fs.readFileSync("ai-infrastructure-bulletin/market-core-v2.js", "utf8"),
  intraday: fs.readFileSync("ai-infrastructure-bulletin/intraday-core.js", "utf8"),
  live: fs.readFileSync("ai-infrastructure-bulletin/market-live-session.js", "utf8"),
  sw: fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8"),
  catalog: fs.readFileSync("ai-infrastructure-bulletin/data/equity-catalog.json", "utf8")
};

for (const name of ["integration", "workspace", "intraday", "live", "sw"]) {
  assert.doesNotMatch(files[name], /mountTradingView|s3\.tradingview\.com|pmTvWrap|tradingview-widget-container/, `${name} must not contain embedded widget code`);
}
assert.match(files.integration, /market-core-v2\.js/);
assert.doesNotMatch(files.integration, /market-core\.js["']/);
assert.match(files.integration, /intraday-core\.js/);
assert.match(files.integration, /market-live-session\.js/);
assert.doesNotMatch(files.integration, /live-market-core|market-live-bridge|chart-fetch-fallback|live-session-control/);
assert.match(files.workspace, /equity-catalog\.json/);
assert.match(files.workspace, /keyOf\(market, symbol\)/);
assert.doesNotMatch(files.workspace, /SUPPLEMENTS/);
assert.match(files.intraday, /AbortController/);
assert.match(files.intraday, /SYMBOL_MISMATCH/);
assert.match(files.live, /sessionStorage/);
assert.match(files.live, /fullScan/);
assert.match(files.sw, /piyasa-masasi-workspace-v21/);
assert.match(files.sw, /equity-catalog\.json/);
assert.doesNotMatch(files.sw, /client\.navigate|combineMarketIntegration|market-core\.js/);

const catalog = JSON.parse(files.catalog);
assert.ok(catalog.counts.BIST >= 600);
assert.ok(catalog.counts.US >= 6000);
assert.equal(catalog.assets.length, catalog.counts.TOTAL);
const keys = new Set(catalog.assets.map(asset => asset.key));
for (const key of ["BIST:BURCE", "BIST:ISATR", "BIST:ISKUR", "BIST:UMPAS", "US:RDW", "US:CBOE", "BIST:LINK", "US:LINK"]) {
  assert.ok(keys.has(key), `${key} missing from catalogue`);
}

console.log("market-clean-architecture: official catalogue runtime validated");
