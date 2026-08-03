"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bist = fs.readFileSync("ai-infrastructure-bulletin/bist-widget-guard.js", "utf8");
const us = fs.readFileSync("ai-infrastructure-bulletin/us-native-intraday.js", "utf8");
const sw = fs.readFileSync("ai-infrastructure-bulletin/sw.js", "utf8");

assert.match(bist, /\$\{symbol\}\.IS/);
assert.match(us, /\["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "US"\]/);
assert.match(us, /const symbol = selectedSymbol\(\)/);
assert.match(us, /querySelector\("iframe, \.tradingview-widget-container"\)/);
assert.doesNotMatch(us, /embed-widget-advanced-chart|s3\.tradingview\.com/);
assert.match(sw, /us-native-intraday\.js/);
assert.match(sw, /piyasa-masasi-workspace-v18/);

console.log("native-intraday-routing: BIST and US routes validated");
