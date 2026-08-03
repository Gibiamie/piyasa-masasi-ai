"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bootstrap = fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8");
const workspace = fs.readFileSync("ai-infrastructure-bulletin/market-workspace-core.js", "utf8");
const intraday = fs.readFileSync("ai-infrastructure-bulletin/native-intraday-core.js", "utf8");
const serviceWorker = fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8");

for (const [name, source] of [["bootstrap", bootstrap], ["workspace", workspace], ["intraday", intraday], ["serviceWorker", serviceWorker]]) {
  assert.doesNotMatch(source, /TradingView|mountTradingView|s3\.tradingview\.com|pmTvWrap/, `${name} must not depend on TradingView`);
}

assert.match(bootstrap, /market-workspace-core\.js/);
assert.match(bootstrap, /native-intraday-core\.js/);
assert.match(workspace, /data-source="INTRADAY"/);
assert.match(workspace, /pm-market-asset-change/);
assert.match(workspace, /selectionVersion/);
assert.match(intraday, /AbortController/);
assert.match(intraday, /abortPreviousRequest/);
assert.match(intraday, /SYMBOL_MISMATCH/);
assert.match(intraday, /exchangeGroup\(asset\) === "BIST"/);
assert.match(intraday, /pm-market-source-change/);
assert.match(serviceWorker, /piyasa-masasi-workspace-v19/);
assert.doesNotMatch(serviceWorker, /combineMarketIntegration|BIST_WIDGET_GUARD|US_NATIVE_INTRADAY/);

console.log("market-core-architecture: canonical workspace and unified intraday engine validated");
