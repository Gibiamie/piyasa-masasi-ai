"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bootstrap = fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8");
const workspace = fs.readFileSync("ai-infrastructure-bulletin/market-core-v2.js", "utf8");
const intraday = fs.readFileSync("ai-infrastructure-bulletin/intraday-core.js", "utf8");
const live = fs.readFileSync("ai-infrastructure-bulletin/market-live-session.js", "utf8");
const research = fs.readFileSync("ai-infrastructure-bulletin/research-core-v2.js", "utf8");
const serviceWorker = fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8");

for (const [name, source] of [["bootstrap", bootstrap], ["workspace", workspace], ["intraday", intraday], ["live", live], ["research", research], ["serviceWorker", serviceWorker]]) {
  assert.doesNotMatch(source, /mountTradingView|s3\.tradingview\.com|pmTvWrap|tradingview-widget-container/, `${name} must not depend on the obsolete embedded TradingView widget`);
}

assert.match(bootstrap, /market-core-v2\.js/);
assert.match(bootstrap, /intraday-core\.js/);
assert.match(bootstrap, /market-live-session\.js/);
assert.match(bootstrap, /language-portfolio-runtime\.js/);
assert.match(bootstrap, /research-core-v2\.js/);
assert.match(bootstrap, /syncBrand/);
assert.match(bootstrap, /icon\.svg\?v=brand-20260809/);
assert.match(bootstrap, /Piyasa Masası AI/);
assert.match(bootstrap, /Market Intelligence/);

assert.match(workspace, /equity-catalog\.json/);
assert.match(workspace, /data-source="INTRADAY"/);
assert.match(workspace, /pm-market-asset-change/);
assert.match(intraday, /PiyasaMarketLive/);
assert.match(live, /sessionStorage/);
assert.match(research, /PiyasaMarketWorkspace/);
assert.match(serviceWorker, /piyasa-masasi-workspace-v26/);
assert.doesNotMatch(serviceWorker, /combineMarketIntegration|BIST_WIDGET_GUARD|US_NATIVE_INTRADAY/);

console.log("market-core-architecture: v26 canonical workspace, brand and market engines validated");
