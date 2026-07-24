// Lightweight logic-only verification of MIC-P0-001 / MIC-P0-002 fixes.
// Loads app-main.js and price-integrity-v18.js in a stubbed sandbox (no real DOM),
// then calls decision()/portfolioStats()/calculateConcentrationScenario() directly
// against fixture data matching the audit's required scenarios. This is NOT the
// full Playwright/E2E suite (tracked separately in docs/RELEASE_CHECKLIST.md) —
// it only checks the pure calculation logic actually changed by this fix.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeStubEl() {
  const handler = {
    get(target, prop) {
      if (prop === 'classList') return { add() {}, remove() {}, toggle() {} };
      if (prop === 'addEventListener') return () => {};
      if (prop === 'closest') return () => null;
      if (prop === 'value') return '';
      if (prop === 'textContent' || prop === 'innerHTML') return '';
      if (prop in target) return target[prop];
      return undefined;
    },
    set() { return true; },
  };
  return new Proxy({}, handler);
}

const APP_MAIN = path.join(__dirname, '../../mic/app-main.js');
const PRICE_INTEGRITY = path.join(__dirname, '../../mic/price-integrity-v18.js');

const sandbox = (() => {
  const s = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById: () => makeStubEl(),
      querySelectorAll: () => ({ forEach() {} }),
      querySelector: () => null,
      addEventListener: () => {},
    },
    navigator: {},
    location: { pathname: '/mic/' },
    fetch: async () => ({ ok: false, status: 0 }),
    setTimeout: () => 0,
    save: () => {},
    renderHome: () => {},
    renderSelected: () => {},
    loadMarket: async () => {},
    nav: () => {},
    openChart: () => {},
    $: () => makeStubEl(),
    esc: (x) => String(x ?? ''),
    num: (n, d = 2) => Number(n || 0).toFixed(d),
    money: (n) => String(n || 0),
    toast: () => {},
    riskLabel: (r) => r,
    state: { profile: null, portfolio: [], lastDecision: null, lastAsset: null, settings: { historyCache: {} } },
    market: { updated_at: null, assets: [], fx: { USDTRY: 40, EURTRY: 44 } },
  };
  s.profileComplete = () => {
    const p = s.state.profile;
    return !!(p && p.objective && p.horizon && p.liquidity && p.lossReaction && p.experience && p.incomeStability && p.risk && p.maxPosition && p.rebalanceBand);
  };
  s.window = s;
  s.globalThis = s;
  vm.createContext(s);
  return s;
})();

vm.runInContext(fs.readFileSync(APP_MAIN, 'utf8'), sandbox, { filename: 'app-main.js' });
vm.runInContext(fs.readFileSync(PRICE_INTEGRITY, 'utf8'), sandbox, { filename: 'price-integrity-v18.js' });

function setState(profile, portfolio) {
  sandbox.state = { profile, portfolio, lastDecision: null, lastAsset: null, settings: { historyCache: {} } };
}
function setMarket(assets) {
  sandbox.market = { updated_at: new Date().toISOString(), assets, fx: { USDTRY: 40, EURTRY: 44 } };
}

const profile = {
  objective: 'balanced', horizon: '10', liquidity: 'long', lossReaction: 'hold',
  experience: 'advanced', incomeStability: 'high', maxDrawdown: 20,
  maxPosition: 10, rebalanceBand: 2, monthlyContribution: 0, risk: 'medium', riskScore: 8,
};

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`PASS: ${name}`); }
  else { failures++; console.log(`FAIL: ${name} -- ${detail}`); }
}

// --- Scenario 1: TUPRS-style hard concentration breach (audit example: %14.11 weight) ---
setMarket([{ symbol: 'TUPRS', type: 'stock', currency: 'TRY', price: 63.32, roe: 12, pe: 8 }]);
setState(profile, [{ symbol: 'TUPRS', name: 'Tupras', type: 'stock', currency: 'TRY', quantity: 1000, avgCost: 60 }]);
{
  const ps = sandbox.portfolioStats();
  const held = ps.rows[0];
  const s = sandbox.scoreAsset(held);
  const d = sandbox.decision(held, s);
  check('P0-1: weight breach does not return DENGELE/AZALT action', d.action !== 'DENGELE / AZALT', `action=${d.action}`);
  check('P0-1: weight breach action is neutral concentration warning', d.action === 'KONSANTRASYON UYARISI', `action=${d.action}`);
  check('P0-1: summary explicitly says not a sell signal', d.summary === 'SATIŞ SİNYALİ DEĞİLDİR', `summary=${d.summary}`);
  check('P0-1: no lot quantity anywhere in details', !d.details.some(x => /\d+\s*(adet|lot)\s*(sat|azalt)/i.test(x)), JSON.stringify(d.details));

  const scenario = sandbox.calculateConcentrationScenario(held);
  check('P0-1: explicit scenario calculator still works and returns a lot number', !scenario.error && scenario.scenarioQty >= 0, JSON.stringify(scenario));
}

// --- Scenario 2: one position with missing price must lock the whole portfolio's decisions ---
setMarket([
  { symbol: 'AAA', type: 'stock', currency: 'TRY', price: 100, roe: 10, pe: 10 },
  // BBB intentionally has no price and no currentPrice/avgCost fallback usable as live price
]);
setState(profile, [
  { symbol: 'AAA', name: 'A Sirketi', type: 'stock', currency: 'TRY', quantity: 1000, avgCost: 90 },
  { symbol: 'BBB', name: 'B Sirketi', type: 'stock', currency: 'TRY', quantity: 500, avgCost: 200 },
]);
{
  const ps = sandbox.portfolioStats();
  check('P0-2: missing count detected', ps.missing === 1, `missing=${ps.missing}`);
  check('P0-2: portfolio marked as locked/partial', ps.locked === true && ps.totalPartial === true, `locked=${ps.locked} totalPartial=${ps.totalPartial}`);
  check('P0-2: available-priced row weight is null while locked (not silently computed)', ps.rows.find(r => r.symbol === 'AAA').weight === null, `weight=${ps.rows.find(r => r.symbol === 'AAA').weight}`);

  const heldAAA = ps.rows.find(r => r.symbol === 'AAA');
  const s = sandbox.scoreAsset(heldAAA);
  const d = sandbox.decision(heldAAA, s);
  check('P0-2: decision() locks and returns PORTFÖY AĞIRLIĞI HESAPLANAMADI', d.action === 'PORTFÖY AĞIRLIĞI HESAPLANAMADI', `action=${d.action}`);
  check('P0-2: locked decision produces no sell/lot output', !d.details.some(x => /\d+\s*(adet|lot)/i.test(x)), JSON.stringify(d.details));

  const scenario = sandbox.calculateConcentrationScenario(heldAAA);
  check('P0-2: scenario calculator also refuses while locked', !!scenario.error, JSON.stringify(scenario));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
