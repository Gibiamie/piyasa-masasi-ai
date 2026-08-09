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
assert.match(bootstrap, /language-portfolio-runtime\.js/);
assert.match(bootstrap, /research-core-v2\.js/);
assert.match(bootstrap, /syncBrand/);
assert.match(bootstrap, /icon\.svg\?v=brand-20260809/);
assert.match(bootstrap, /2026\.08\.09\.30/);

assert.match(workspace, /equity-catalog\.json/);
assert.match(workspace, /data-source="INTRADAY"/);
assert.match(workspace, /pm-market-asset-change/);
assert.match(intraday, /PiyasaMarketLive/);
assert.match(live, /sessionStorage/);

assert.match(dailyHistory, /RANGE_OPTIONS/);
assert.match(dailyHistory, /\["5Y", "5Y", "5Y"\]/);
assert.match(dailyHistory, /\["YTD", "YTD", "YTD"\]/);
assert.match(dailyHistory, /INTERVAL_OPTIONS/);
assert.match(dailyHistory, /\["1h", "1 sa", "1 h"\]/);
assert.match(dailyHistory, /\["2h", "2 sa", "2 h"\]/);
assert.match(dailyHistory, /\["4h", "4 sa", "4 h"\]/);
assert.match(dailyHistory, /\["1d", "1 G", "1 D"\]/);
assert.match(dailyHistory, /\["1wk", "1 H", "1 W"\]/);
assert.match(dailyHistory, /\["1mo", "1 A", "1 M"\]/);
assert.match(dailyHistory, /HOURLY_BASE = "\.\.\/mic\/data\/hourly"/);
assert.match(dailyHistory, /DAILY_BASE = "\.\.\/mic\/data\/history"/);
assert.match(dailyHistory, /HOURLY_RANGES/);
assert.match(dailyHistory, /pm6m/);
assert.match(dailyHistory, /returnFromRows/);
assert.match(dailyHistory, /returnOneYear/);
assert.doesNotMatch(dailyHistory, /query1\.finance\.yahoo\.com|query2\.finance\.yahoo\.com/);
assert.match(dailyHistory, /RETRY_MS/);
assert.match(dailyHistory, /Portföy grafiği açık kalacak/);
assert.doesNotMatch(dailyHistory, /activateIntradayFallback|setSource\("INTRADAY"/);

assert.match(research, /PiyasaMarketWorkspace/);
assert.match(serviceWorker, /piyasa-masasi-workspace-v30/);
assert.match(serviceWorker, /daily-history-controller\.js/);
assert.match(serviceWorker, /\/mic\/data\/hourly\//);
assert.doesNotMatch(serviceWorker, /chart-controller-v27\.js/);
assert.doesNotMatch(serviceWorker, /combineMarketIntegration|BIST_WIDGET_GUARD|US_NATIVE_INTRADAY/);

console.log("market-core-architecture: v30 same-origin advanced chart and return-metric contract validated");
