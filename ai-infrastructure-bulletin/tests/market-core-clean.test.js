"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class StorageMock {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const context = {
  console,
  Map,
  Set,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  Promise,
  CustomEvent: class CustomEvent {},
  sessionStorage: new StorageMock(),
  localStorage: new StorageMock(),
  document: { documentElement: { lang: "tr" } },
  window: null,
  __PM_TEST__: true
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("ai-infrastructure-bulletin/market-core-v2.js", "utf8"), context);

const api = context.PiyasaMarketWorkspace;
assert.ok(api, "workspace API must be exported");
const catalog = JSON.parse(fs.readFileSync("ai-infrastructure-bulletin/data/equity-catalog.json", "utf8"));
const { buildUniverse, filteredAssets } = api._test;

buildUniverse(
  catalog,
  {
    updated_at: "2026-08-04T12:00:00Z",
    assets: [
      { symbol: "LINK", name: "Link Bilgisayar", exchange: "BIST", currency: "TRY", type: "stock", price: 100 },
      { symbol: "BURCE", name: "Burçelik", exchange: "BIST", currency: "TRY", type: "stock", price: 36.3 }
    ]
  },
  {
    updated_at: "2026-08-04T12:00:00Z",
    quotes: {
      LINK: { name: "Interlink Electronics", exchange: "NASDAQ", currency: "USD", price: 8 },
      RDW: { name: "Redwire Corporation", exchange: "NYSE", currency: "USD", price: 9.64 }
    }
  },
  { watchlist: [] }
);

assert.equal(api.getAssets().length, catalog.assets.length, "feed overlays must not change the official universe size");
const keys = new Set(api.getAssets().map(asset => asset.key));
for (const key of ["BIST:LINK", "US:LINK", "BIST:BURCE", "US:RDW", "BIST:ISATR", "BIST:ISKUR", "BIST:UMPAS", "US:CBOE"]) {
  assert.ok(keys.has(key), `${key} must exist in the official catalogue`);
}

api.state.filter = "BIST";
api.state.query = "RDW";
assert.equal(filteredAssets()[0]?.key, "US:RDW", "search must ignore the active market filter");

api.state.query = "LINK";
assert.deepEqual(new Set(filteredAssets().map(asset => asset.key)), new Set(["BIST:LINK", "US:LINK"]));

assert.doesNotMatch(api._test.cleanSource("TradingView feed"), /TradingView/i);
console.log("market-core-clean: official catalogue, symbol collisions and global search validated");
