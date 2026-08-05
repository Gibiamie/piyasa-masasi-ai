"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const files = {
  integration: fs.readFileSync("ai-infrastructure-bulletin/market-integration.js", "utf8"),
  workspace: fs.readFileSync("ai-infrastructure-bulletin/market-core-v2.js", "utf8"),
  intraday: fs.readFileSync("ai-infrastructure-bulletin/intraday-core.js", "utf8"),
  live: fs.readFileSync("ai-infrastructure-bulletin/market-live-session.js", "utf8"),
  languagePortfolio: fs.readFileSync("ai-infrastructure-bulletin/language-portfolio-runtime.js", "utf8"),
  research: fs.readFileSync("ai-infrastructure-bulletin/research-core-v2.js", "utf8"),
  sw: fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8"),
  catalog: fs.readFileSync("ai-infrastructure-bulletin/data/equity-catalog.json", "utf8")
};

for (const name of ["integration", "workspace", "intraday", "live", "languagePortfolio", "research", "sw"]) {
  assert.doesNotMatch(files[name], /mountTradingView|s3\.tradingview\.com|pmTvWrap|tradingview-widget-container/, `${name} must not contain embedded widget code`);
}

assert.match(files.integration, /market-core-v2\.js/);
assert.match(files.integration, /intraday-core\.js/);
assert.match(files.integration, /market-live-session\.js/);
assert.match(files.integration, /language-portfolio-runtime\.js/);
assert.match(files.integration, /research-core-v2\.js/);
assert.doesNotMatch(files.integration, /workspace-enhancements|research-intelligence-core|live-market-core|market-live-bridge|chart-fetch-fallback|live-session-control/);

assert.match(files.workspace, /equity-catalog\.json/);
assert.match(files.workspace, /keyOf\(market, symbol\)/);
assert.doesNotMatch(files.workspace, /SUPPLEMENTS/);

assert.match(files.intraday, /AbortController/);
assert.match(files.intraday, /SYMBOL_MISMATCH/);
assert.match(files.intraday, /aggregateSamples/);
assert.match(files.intraday, /sessionFallback/);
assert.match(files.intraday, /Promise\.any/);
assert.match(files.intraday, /PiyasaMarketLive\?\.requestAsset/);

assert.match(files.live, /sessionStorage/);
assert.match(files.live, /requestAsset/);
assert.match(files.live, /refreshPriority/);
assert.match(files.live, /fetchChartQuote/);
assert.match(files.live, /PiyasaResearchIntelligence\?\.getPersonalAssets/);

assert.match(files.languagePortfolio, /applyMarketLanguage/);
assert.match(files.languagePortfolio, /fillTransactionAsset/);
assert.match(files.languagePortfolio, /txCurrentPriceDate/);

assert.match(files.research, /PiyasaMarketWorkspace\?\.getAssets/);
assert.match(files.research, /Tüm hisseler/);
assert.match(files.research, /Listemin kaynakları/);
assert.match(files.research, /Günün fırsatları ve göze çarpanlar/);
assert.match(files.research, /Otomatik sıralama/);
assert.match(files.research, /refreshPersonalNews/);
assert.match(files.research, /renderResearchUniverse/);
assert.match(files.research, /renderSettings/);
assert.match(files.research, /renderSourcesView/);
assert.match(files.research, /renderOverview/);
assert.doesNotMatch(files.research, /REPO_ISSUES_URL|Ekleme talebi oluştur/);

assert.match(files.sw, /piyasa-masasi-workspace-v24/);
assert.match(files.sw, /equity-catalog\.json/);
assert.match(files.sw, /language-portfolio-runtime\.js/);
assert.match(files.sw, /research-core-v2\.js/);
assert.doesNotMatch(files.sw, /workspace-enhancements|research-intelligence-core|client\.navigate|combineMarketIntegration|market-core\.js/);

assert.equal(fs.existsSync("ai-infrastructure-bulletin/workspace-enhancements.js"), false, "obsolete workspace patch must be deleted");
assert.equal(fs.existsSync("ai-infrastructure-bulletin/research-intelligence-core.js"), false, "superseded research prototype must be deleted");

const catalog = JSON.parse(files.catalog);
assert.ok(catalog.counts.BIST >= 600);
assert.ok(catalog.counts.US >= 6000);
assert.equal(catalog.assets.length, catalog.counts.TOTAL);
const keys = new Set(catalog.assets.map(asset => asset.key));
for (const key of ["BIST:BURCE", "BIST:ISATR", "BIST:ISKUR", "BIST:UMPAS", "US:RDW", "US:CBOE", "BIST:LINK", "US:LINK", "BIST:LMKDC"]) {
  assert.ok(keys.has(key), `${key} missing from catalogue`);
}

console.log("market-clean-architecture: canonical research universe, resilient intraday, sources and personal list validated");
