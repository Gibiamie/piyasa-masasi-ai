"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class StorageMock {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const refreshButton = { dataset: {}, textContent: "Yenile", className: "button primary", onclick: null };
const freshness = { textContent: "", className: "", insertAdjacentElement() {} };
const freshnessDetail = { textContent: "", className: "freshness-detail" };
const title = { textContent: "AEFES · Anadolu Efes" };
const elements = new Map([
  ["refresh", refreshButton],
  ["freshness", freshness],
  ["freshnessDetail", freshnessDetail],
  ["pmAssetTitle", title]
]);

const intervalCallbacks = [];
const localStorage = new StorageMock();
const sessionStorage = new StorageMock();
let coreStartCount = 0;
let quoteCalls = 0;

const universe = Array.from({ length: 65 }, (_, index) => ({
  symbol: index === 0 ? "AEFES" : `BIST${String(index).padStart(3, "0")}`,
  exchange: "BIST",
  currency: "TRY",
  type: "stock"
}));

const context = {
  console,
  Map,
  Set,
  Date,
  Intl,
  Promise,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  localStorage,
  sessionStorage,
  setTimeout,
  clearTimeout,
  setInterval(callback) { intervalCallbacks.push(callback); return intervalCallbacks.length; },
  clearInterval() {},
  fetch: async url => {
    assert.match(String(url), /mic\/data\/market\.json/);
    return { ok: true, json: async () => ({ assets: universe }) };
  },
  document: {
    documentElement: { lang: "tr" },
    hidden: false,
    getElementById(id) { return elements.get(id) || null; },
    querySelector(selector) {
      if (selector.includes("pm-asset-row.active")) return { dataset: { pmSymbol: "AEFES" } };
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  },
  state: {
    report: {
      watchlist: [{ ticker: "AEFES", provider_symbol: "AEFES.IS", currency: "TRY", price: 1 }],
      company_evaluations: [{ ticker: "AEFES", price_context: { price: 1, currency: "TRY" } }]
    },
    portfolio: { transactions: [] }
  },
  load: async () => {},
  renderWatchlist() {},
  renderFocus() {},
  renderEvaluations() {},
  renderPortfolio() {}
};
context.window = context;
context.window.dispatchEvent = () => {};
context.window.addEventListener = () => {};
context.window.PiyasaLiveBootstrap = {
  async startCore() {
    coreStartCount += 1;
    context.window.PiyasaLiveMarket = {
      runtime: { installed: true, timer: 99, quotes: new Map(), lastRefresh: null },
      async fetchQuotes(symbols) {
        quoteCalls += 1;
        return new Map(symbols.map((symbol, index) => [symbol, {
          symbol,
          price: 100 + index,
          currency: "TRY",
          changePercent: 1.25,
          timestamp: Date.now(),
          source: "runtime-test",
          delayMinutes: 0,
          fromCache: false
        }]));
      }
    };
    return context.window.PiyasaLiveMarket;
  }
};

vm.createContext(context);
const source = fs.readFileSync("ai-infrastructure-bulletin/live-session-control.js", "utf8");
vm.runInContext(source, context, { filename: "live-session-control.js" });

assert.equal(coreStartCount, 0, "live core must not start before the user presses Refresh");
assert.equal(context.window.PiyasaLiveSession.state.active, false);
assert.match(refreshButton.textContent, /Yenile/);

refreshButton.onclick({ preventDefault() {} });
assert.equal(context.window.PiyasaLiveSession.state.active, true, "Refresh must activate the browser session");
assert.equal(sessionStorage.getItem("piyasa-masasi-ai.live-session.active.v1"), "1");

(async () => {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const runtime = context.window.PiyasaLiveMarket?.runtime;
    const session = context.window.PiyasaLiveSession.state;
    if (runtime?.quotes?.size >= 65 && session.updatedSymbols.size >= 65 && !session.fullScanRunning) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  assert.equal(coreStartCount, 1, "live core must start exactly once after Refresh");
  assert.ok(quoteCalls >= 2, "priority and full-universe quote scans must run");
  assert.equal(context.window.PiyasaLiveMarket.runtime.quotes.size, 65);
  assert.equal(context.window.PiyasaLiveSession.state.updatedSymbols.size, 65);
  assert.ok(intervalCallbacks.length >= 2, "session monitoring timers must be scheduled");
  assert.match(freshness.textContent, /Canlı izleme açık/);
  assert.match(refreshButton.textContent, /Şimdi yenile/);
  console.log("live-session-control: all assertions passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
