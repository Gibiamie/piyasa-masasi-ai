"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bootstrap = fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8");
const workspace = fs.readFileSync("ai-infrastructure-bulletin/market-core-v2.js", "utf8");
const intraday = fs.readFileSync("ai-infrastructure-bulletin/intraday-core.js", "utf8");
const live = fs.readFileSync("ai-infrastructure-bulletin/market-live-session.js", "utf8");
const dailyHistory = fs.readFileSync("ai-infrastructure-bulletin/daily-history-controller.js", "utf8");
const research = fs.readFileSync("ai-infrastructure-bulletin/research-core-v2.js", "utf8");
const serviceWorker = fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8");

for (const [name, source] of [["bootstrap", bootstrap], ["workspace", workspace], ["intraday", intraday], ["live", live], ["dailyHistory", dailyHistory], ["research", research], ["serviceWorker", serviceWorker]]) {
  assert.doesNotMatch(source, /mountTradingView|s3\.tradingview\.com|pmTvWrap|tradingview-widget-container/, `${name} must not depend on the obsolete embedded TradingView widget`);
}

assert.match(bootstrap, /market-core-v2\.js/);
assert.match(bootstrap, /intraday-core\.js/);
assert.match(bootstrap, /market-live-session\.js/);
assert.match(bootstrap, /daily-history-controller\.js/);
assert.doesNotMatch(bootstrap, /chart-controller-v27\.js/);
assert.match(bootstrap, /language-portfolio-runtime\.js/);
assert.match(bootstrap, /research-core-v2\.js/);
assert.match(bootstrap, /syncBrand/);
assert.match(bootstrap, /icon\.svg\?v=brand-20260809/);
assert.match(bootstrap, /2026\.08\.09\.28/);

assert.match(workspace, /equity-catalog\.json/);
assert.match(workspace, /data-source="INTRADAY"/);
assert.match(workspace, /pm-market-asset-change/);
assert.match(intraday, /PiyasaMarketLive/);
assert.match(live, /sessionStorage/);
assert.match(dailyHistory, /RETRY_MS/);
assert.match(dailyHistory, /Portföy grafiği açık kalacak/);
assert.match(dailyHistory, /api\.select/);
assert.doesNotMatch(dailyHistory, /activateIntradayFallback|setSource\("INTRADAY"/);
assert.match(research, /PiyasaMarketWorkspace/);
assert.match(serviceWorker, /piyasa-masasi-workspace-v28/);
assert.match(serviceWorker, /daily-history-controller\.js/);
assert.doesNotMatch(serviceWorker, /chart-controller-v27\.js/);
assert.doesNotMatch(serviceWorker, /combineMarketIntegration|BIST_WIDGET_GUARD|US_NATIVE_INTRADAY/);

console.log("market-core-architecture: v28 independent daily/intraday chart contract validated");
