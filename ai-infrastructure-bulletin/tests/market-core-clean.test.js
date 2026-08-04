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
vm.runInContext(fs.readFileSync("ai-infrastructure-bulletin/market-core.js", "utf8"), context);

const api = context.PiyasaMarketWorkspace;
assert.ok(api, "workspace API must be exported");
const { mergeFeeds, filteredAssets } = api._test;

mergeFeeds(
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

const keys = new Set(api.getAssets().map(asset => asset.key));
assert.ok(keys.has("BIST:LINK"));
assert.ok(keys.has("US:LINK"));
assert.ok(keys.has("BIST:BURCE"));
assert.ok(keys.has("US:RDW"));
assert.ok(keys.has("BIST:ISATR"));
assert.ok(keys.has("BIST:ISKUR"));
assert.ok(keys.has("BIST:UMPAS"));
assert.ok(keys.has("US:CBOE"));

api.state.filter = "BIST";
api.state.query = "RDW";
assert.equal(filteredAssets()[0]?.key, "US:RDW", "search must ignore the active market filter");

api.state.query = "LINK";
assert.deepEqual(new Set(filteredAssets().map(asset => asset.key)), new Set(["BIST:LINK", "US:LINK"]));

console.log("market-core-clean: composite universe and global search validated");
