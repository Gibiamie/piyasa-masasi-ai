"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const files = {
  integration: fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8"),
  workspace: fs.readFileSync("ai-infrastructure-bulletin/market-core.js", "utf8"),
  intraday: fs.readFileSync("ai-infrastructure-bulletin/intraday-core.js", "utf8"),
  live: fs.readFileSync("ai-infrastructure-bulletin/market-live-session.js", "utf8"),
  sw: fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8")
};

for (const [name, source] of Object.entries(files)) {
  assert.doesNotMatch(source, /TradingView|mountTradingView|s3\.tradingview\.com|pmTvWrap/, `${name} must not contain TradingView code`);
}
assert.match(files.integration, /market-core\.js/);
assert.match(files.integration, /intraday-core\.js/);
assert.match(files.integration, /market-live-session\.js/);
assert.doesNotMatch(files.integration, /live-market-core|market-live-bridge|chart-fetch-fallback|live-session-control/);
assert.match(files.workspace, /keyOf\(market, symbol\)/);
assert.match(files.workspace, /ISATR/);
assert.match(files.workspace, /ISKUR/);
assert.match(files.workspace, /UMPAS/);
assert.match(files.workspace, /CBOE/);
assert.match(files.intraday, /AbortController/);
assert.match(files.intraday, /SYMBOL_MISMATCH/);
assert.match(files.live, /sessionStorage/);
assert.match(files.live, /fullScan/);
assert.match(files.sw, /piyasa-masasi-workspace-v20/);
assert.doesNotMatch(files.sw, /client\.navigate|combineMarketIntegration/);

console.log("market-clean-architecture: canonical runtime validated");
// Verification branch trigger for five-second runtime diagnostics.
