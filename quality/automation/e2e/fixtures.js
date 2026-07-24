// Shared fixtures for the P0 acceptance-gate Playwright suite.
// STORE key must match `const STORE=` in mic/app-core.js exactly.
const STORE = 'mic_mobile_github_v3';

const COMPLETE_PROFILE = {
  objective: 'balanced',
  horizon: '10',
  liquidity: 'long',
  lossReaction: 'hold',
  experience: 'advanced',
  incomeStability: 'high',
  maxDrawdown: 20,
  maxPosition: 5,
  rebalanceBand: 1,
  monthlyContribution: 0,
  risk: 'medium',
  riskScore: 8,
};

// Seeds localStorage before any app script runs, via an init script so it is
// present the instant app-core.js reads STORE on load (see app-core.js line 8).
async function seedState(page, { profile = null, portfolio = [] } = {}) {
  const state = {
    profile,
    portfolio,
    lastDecision: null,
    lastAsset: null,
    settings: { historyCache: {} },
  };
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STORE, JSON.stringify(state)]
  );
}

module.exports = { STORE, COMPLETE_PROFILE, seedState };
