"use strict";

const assert = require("node:assert/strict");
const engine = require("../portfolio-engine.js");

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const transactions = [
  {id:"1",createdAt:"1",date:"2026-01-01",assetType:"STOCK",symbol:"ABC",name:"ABC",currency:"USD",unit:"share",side:"BUY",quantity:10,unitPrice:100,fee:10},
  {id:"2",createdAt:"2",date:"2026-01-02",assetType:"STOCK",symbol:"ABC",name:"ABC",currency:"USD",unit:"share",side:"BUY",quantity:5,unitPrice:120,fee:5},
  {id:"3",createdAt:"3",date:"2026-01-03",assetType:"STOCK",symbol:"ABC",name:"ABC",currency:"USD",unit:"share",side:"SELL",quantity:6,unitPrice:130,fee:6},
];

const result = engine.calculate(transactions, {ABC:{price:140,date:"2026-01-04",source:"test"}});
assert.equal(result.isValid, true);
assert.equal(result.openHoldings.length, 1);
const holding = result.openHoldings[0];
close(holding.quantity, 9);
close(holding.averageCost, 1615 / 15);
close(holding.remainingCost, 9 * (1615 / 15));
close(holding.realizedPnl, 780 - 6 - 6 * (1615 / 15));
close(holding.marketValue, 1260);
close(holding.unrealizedPnl, 1260 - 9 * (1615 / 15));
assert.equal(result.costMethod, "WEIGHTED_AVERAGE");

const oversell = engine.calculate([
  {id:"b",createdAt:"1",date:"2026-01-01",assetType:"CRYPTO",symbol:"BTC-USD",currency:"USD",unit:"coin",side:"BUY",quantity:0.2,unitPrice:50000,fee:5},
  {id:"s",createdAt:"2",date:"2026-01-02",assetType:"CRYPTO",symbol:"BTC-USD",currency:"USD",unit:"coin",side:"SELL",quantity:0.3,unitPrice:55000,fee:5},
]);
assert.equal(oversell.isValid, false);
assert.equal(oversell.errors[0].codes[0], "SELL_EXCEEDS_HOLDING");
close(oversell.openHoldings[0].quantity, 0.2);

const multiCurrency = engine.calculate([
  {id:"tr",createdAt:"1",date:"2026-01-01",assetType:"STOCK",symbol:"TTRAK.IS",currency:"TRY",unit:"lot",side:"BUY",quantity:10,unitPrice:400,fee:2},
  {id:"us",createdAt:"2",date:"2026-01-01",assetType:"STOCK",symbol:"LUNR",currency:"USD",unit:"share",side:"BUY",quantity:4,unitPrice:12,fee:1},
], {
  "TTRAK.IS": {price:420},
  LUNR: {price:13},
});
assert.deepEqual(Object.keys(multiCurrency.totalsByCurrency).sort(), ["TRY", "USD"]);
close(multiCurrency.totalsByCurrency.TRY.marketValue, 4200);
close(multiCurrency.totalsByCurrency.USD.marketValue, 52);

const historical = engine.calculate([
  {id:"later",createdAt:"2",date:"2026-02-02",assetType:"COMMODITY",symbol:"XAU",currency:"USD",unit:"gram",side:"SELL",quantity:2,unitPrice:70,fee:0},
  {id:"earlier",createdAt:"1",date:"2026-02-01",assetType:"COMMODITY",symbol:"XAU",currency:"USD",unit:"gram",side:"BUY",quantity:3,unitPrice:60,fee:0},
]);
assert.equal(historical.isValid, true);
close(historical.openHoldings[0].quantity, 1);

console.log("portfolio-engine: all tests passed");
