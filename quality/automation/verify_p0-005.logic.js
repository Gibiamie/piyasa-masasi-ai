// Logic-level verification of MIC-P0-005: static IPO calendar data must contain
// no personalized buy/join instruction, and personalized assessment must be
// gated dynamically on profile completeness, portfolio price availability, and
// source verification freshness. See docs/audit/... section on MIC-P0-005.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS: ${name}`);
  else { failures++; console.log(`FAIL: ${name} -- ${detail}`); }
}

// --- Part A: the static data file itself must carry no personal decision fields ---
const DATA_PATH = path.join(__dirname, '../../mic/data/ipo-calendar.json');
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const forbiddenFields = ['mic_view', 'suggested_order', 'max_budget', 'score'];
for (const item of data.items) {
  for (const field of forbiddenFields) {
    check(`P0-5: ${item.ticker} has no "${field}" field in static data`, !(field in item), `found ${field}=${item[field]}`);
  }
  check(`P0-5: ${item.ticker} carries verification metadata`, 'verified_at' in item && 'verification_status' in item, JSON.stringify(item));
}

// --- Part B: ipoAssessment() gating logic (loaded in a stubbed sandbox) ---
function makeStubEl() {
  const handler = {
    get(target, prop) {
      if (prop === 'classList') return { add() {}, remove() {}, toggle() {} };
      if (prop === 'addEventListener') return () => {};
      if (prop === 'closest') return () => null;
      if (prop in target) return target[prop];
      return undefined;
    },
    set() { return true; },
  };
  return new Proxy({}, handler);
}

const IPO_JS = path.join(__dirname, '../../mic/ipo-calendar-v26.js');
const sandbox = (() => {
  const s = {
    console,
    document: {
      getElementById: () => makeStubEl(),
      querySelector: () => null,
      querySelectorAll: () => ({ forEach() {} }),
      addEventListener: () => {},
      createElement: () => makeStubEl(),
      readyState: 'complete',
    },
    esc: (x) => String(x ?? ''),
    fetch: async () => ({ ok: false, status: 0 }),
    profileComplete: () => true,
    portfolioStats: () => ({ locked: false, missing: 0 }),
  };
  s.window = s;
  s.globalThis = s;
  vm.createContext(s);
  return s;
})();
vm.runInContext(fs.readFileSync(IPO_JS, 'utf8'), sandbox, { filename: 'ipo-calendar-v26.js' });

// ipoAssessment is defined inside the file's IIFE closure, not exposed globally.
// Re-extract and eval just that function body against the same stubs to test it directly,
// since the file intentionally does not leak internals onto window (encapsulation is correct
// behavior, not a test obstacle to work around by weakening the source).
const src = fs.readFileSync(IPO_JS, 'utf8');
const fnStart = src.indexOf('const VERIFICATION_MAX_AGE_MS');
const fnEnd = src.indexOf('\n  function scenariosHtml');
const fnSrc = src.slice(fnStart, fnEnd);
const helperStart = src.indexOf('const parseDate=');
const helperEnd = src.indexOf('\n  const dateOnly=');
const helperSrc = src.slice(helperStart, helperEnd);
vm.runInContext(helperSrc + '\n' + fnSrc + '\nglobalThis.__test_ipoAssessment = ipoAssessment;', sandbox);

const verifiedRecent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const verifiedStale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

sandbox.profileComplete = () => false;
{
  const r = sandbox.__test_ipoAssessment({ verified_at: verifiedRecent, verification_status: 'verified' });
  check('P0-5: profile incomplete -> KARAR ÜRETİLEMEZ', r.label === 'KARAR ÜRETİLEMEZ', JSON.stringify(r));
}

sandbox.profileComplete = () => true;
sandbox.portfolioStats = () => ({ locked: true, missing: 1 });
{
  const r = sandbox.__test_ipoAssessment({ verified_at: verifiedRecent, verification_status: 'verified' });
  check('P0-5: portfolio locked -> PORTFÖY ETKİSİ HESAPLANAMAZ', r.label === 'PORTFÖY ETKİSİ HESAPLANAMAZ', JSON.stringify(r));
}

sandbox.portfolioStats = () => ({ locked: false, missing: 0 });
{
  const r = sandbox.__test_ipoAssessment({ verified_at: verifiedStale, verification_status: 'verified' });
  check('P0-5: stale verification -> VERİ DOĞRULAMA GEREKLİ', r.label === 'VERİ DOĞRULAMA GEREKLİ', JSON.stringify(r));
}
{
  const r = sandbox.__test_ipoAssessment({ verified_at: verifiedRecent, verification_status: 'verified' });
  check('P0-5: everything fresh -> neutral, no buy/join wording', r.label === 'BİREYSEL ÖNERİ YOK' && !/KATIL|\bAL\b/i.test(r.label), JSON.stringify(r));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
