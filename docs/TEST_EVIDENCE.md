# Test Evidence — Piyasa Masası AI

## Baseline: what "current test evidence" actually meant in the legacy repo

Inspected `.github-workflows-reference/mic-static-tests.yml` (copied verbatim from the legacy repo). Its actual checks are:

1. `node --check` syntax validation of every `.js` file under `mic/` and `mic-desktop/`.
2. Five `grep -q` string assertions against literal source text (e.g. that `mic/chart-workspace-v13.js` contains the string `data-interval="1H"`).

This is **not** functional, behavioral, or regression testing — it cannot catch MIC-P0-001 through MIC-P0-006, none of the P1 items, and none of the audit's required scenarios. This confirms audit finding MIC-P0-006 exactly: there is no current, credible regression evidence for v29. The "v7 test report" referenced in the audit does not cover v29/v30 either. Both are treated as non-evidence going forward.

## Evidence required before any P0 item can be marked Closed

For each of the following, this file will record: command executed, result, date, commit SHA, and artifact location (screenshots/traces).

- [x] Playwright suite bootstrapped (`quality/automation/e2e/`) — 2026-07-25, 23 tests, all passing
- [x] MIC-P0-001: hard weight breach (100% single-position) → `KONSANTRASYON UYARISI`/`SATIŞ SİNYALİ DEĞİLDİR`, no automatic lot output; explicit "Senaryo" button → lot scenario, clearly labeled non-advice — browser-verified 2026-07-25
- [x] MIC-P0-002: one missing price → all weight/decision output locked, `PORTFÖY AĞIRLIĞI HESAPLANAMADI` shown, total value marked partial — browser-verified 2026-07-25
- [x] MIC-P0-003: all routes reachable at 360/390/412/768/820/1024/1366/1920px on both `mic/` and `mic-desktop/`, zero horizontal overflow — browser-verified 2026-07-25
- [x] MIC-P0-004: zero uncaught JS errors loading Technical Methods on desktop/narrow-desktop/mobile — browser-verified 2026-07-25 (see also the two new defects found and fixed below)
- [x] MIC-P0-005: static IPO JSON contains no personalized buy/join field; profile-gated decision confirmed in a real browser (locked/unlocked/stale-verification paths) — browser-verified 2026-07-25
- [x] MIC-P0-006: Playwright suite itself exists (`quality/automation/e2e/`, `playwright.config.js`), runs locally via `npx playwright test`, HTML report at `quality/automation/e2e/report/` — **not yet wired into CI** (no GitHub Actions job runs it on push); that remains open, see Status below

## Commands executed so far

```text
git clone --bare --depth 1 https://github.com/Gibiamie/Gibiamie.github.io.git   (read-only inspection, 2026-07-24)
git ls-tree / git show / git archive                                            (file inventory + extraction, 2026-07-24)
node --check legacy-import/mic/app-main.js                                      (syntax check, 2026-07-24, PASS)
node --check legacy-import/mic/price-integrity-v18.js                           (syntax check, 2026-07-24, PASS)
node quality/automation/verify_p0-001_p0-002.logic.js                           (logic-level check, 2026-07-25 rerun against served mic/, 11/11 PASS)
node quality/automation/verify_p0-005.logic.js                                  (logic-level check, 2026-07-25 rerun against served mic/, 46/46 PASS)
npx playwright install --with-deps chromium                                     (2026-07-25)
npx playwright test                                                             (2026-07-25, 23/23 PASS after fixes below)
```

Note: `quality/automation/verify_p0-001_p0-002.logic.js` and `verify_p0-005.logic.js` originally pointed at `legacy-import/mic/...` and, in one case, at a hardcoded path from a different machine (`C:\Users\Mert\Desktop\Mert\claude\...`) left over from a prior session — that path did not exist on this machine, so the script could not have produced the "11/11 PASS" result claimed for it without ever actually running here. Repointed both scripts to portable relative paths against the actually-served `mic/` files (byte-identical to `legacy-import/mic/` at the time of the 2026-07-25 rerun, confirmed via `diff`) and reran; results unchanged (11/11, 46/46).

### MIC-P0-001 / MIC-P0-002 logic-level verification (2026-07-24)

`quality/automation/verify_p0-001_p0-002.logic.js` loads the real `app-main.js` and `price-integrity-v18.js` in a stubbed sandbox (no real DOM/browser — a `vm` context standing in for `$`, `state`, `market`, etc.) and calls `portfolioStats()`, `decision()`, and `calculateConcentrationScenario()` directly against two fixtures matching the audit's required scenarios:

1. A TUPRS-style hard concentration breach with a sound price — asserts `decision()` no longer returns `DENGELE / AZALT` with a lot count, returns `KONSANTRASYON UYARISI` / `SATIŞ SİNYALİ DEĞİLDİR` instead, and that the explicit opt-in scenario calculator still produces a lot number only when called directly.
2. A two-position portfolio where one position has no live price — asserts `portfolioStats()` reports `missing`/`locked`/`totalPartial`, that the priced position's `weight` is `null` (not silently computed against an undercounted total), that `decision()` returns `PORTFÖY AĞIRLIĞI HESAPLANAMADI` instead of any weight-based output, and that the scenario calculator also refuses to run.

Result: **11/11 checks passed** on 2026-07-24 (see script for exact assertions).

**What this evidence does and does not cover:** this confirms the pure calculation/decision logic behaves per the audit's acceptance criteria. It does **not** cover the actual browser UI (the new "Senaryo" button, DOM rendering, the price-notice banner), real market data files, service worker behavior, or cross-viewport layout — those remain open per `docs/RELEASE_CHECKLIST.md` and require the full Playwright suite (MIC-P0-006), which has not been built yet. This fix was implemented and logic-tested in the same pass by the same assistant; per `organization/authority-matrix.yaml` it must still receive an independent review pass before `docs/REMEDIATION_REGISTER.md` marks MIC-P0-001/MIC-P0-002 as fully Closed.

### MIC-P0-005 logic-level verification (2026-07-24)

`quality/automation/verify_p0-005.logic.js` checks two things: (1) every item in `legacy-import/mic/data/ipo-calendar.json` carries no `mic_view`/`suggested_order`/`max_budget`/`score` field and does carry `verified_at`/`verification_status`; (2) `ipoAssessment()` in `ipo-calendar-v26.js`, loaded in a stubbed sandbox, returns `KARAR ÜRETİLEMEZ` when profile incomplete, `PORTFÖY ETKİSİ HESAPLANAMAZ` when the portfolio is price-locked, `VERİ DOĞRULAMA GEREKLİ` when verification is stale, and otherwise a neutral label containing no "KATIL"/"AL" wording. Result: **46/46 checks passed** on 2026-07-24.

### MIC-P0-003 / MIC-P0-004 browser verification (2026-07-25)

`quality/automation/e2e/p0-003-viewport-nav.spec.js` loads both `mic/` and `mic-desktop/` in a real Chromium instance (Playwright, installed 2026-07-25) at all 8 required viewport widths, asserts the relevant nav (bottom nav below 820px, sidebar above) is visible and clickable, and asserts zero horizontal overflow. All 17 checks pass.

`quality/automation/e2e/p0-004-technical-methods-console.spec.js` loads Technical Methods at desktop/narrow-desktop/mobile widths and asserts zero `pageerror` events (uncaught exceptions) — the literal acceptance-gate wording in `docs/RELEASE_CHECKLIST.md`. All 3 checks now pass, but this required two real app-code fixes (see below); the suite failed on first run.

### Two new defects found by the Playwright suite and fixed (2026-07-25)

Neither of these was in the original audit or the P0-001–005 register entries. Both were only reachable by running actual browser JavaScript, which is exactly the gap MIC-P0-006 was meant to close — the prior "logic-level" and "hand-traced" evidence could not have caught either one.

1. **Uncaught `TypeError` on virtually every page load for any user who has never configured the intraday market gateway.** `mic/chart-workspace-v13.js`'s `gateway()` returns `state.settings.marketGateway`, which is `undefined` by default (nothing sets it until a user visits Settings and saves a gateway address). `addGatewayCard()` then reads `gateway().url` unconditionally while building the Settings card — `undefined.url` throws, aborting the rest of `setup()` (`paintControls()` never runs) and surfacing as an uncaught exception on every page load. Fix: `function gateway(){return state.settings.marketGateway||{}}` in both `mic/chart-workspace-v13.js` and `legacy-import/mic/chart-workspace-v13.js`.
2. **The "Senaryo" (concentration scenario) button updated a DOM node the user could not see.** `#analysisPanel` lives inside the `#search` view/section (`mic/index.html`), which only renders when that view is active. The portfolio list's scenario click handler called `renderConcentrationScenario(p)` directly without first calling `nav('search')`, so from the Portfolio tab the button appeared to do nothing — the correct, non-advice-labeled scenario text was written into the DOM but stayed invisible because its ancestor view was inactive. Fix: `else if(b.dataset.a==='scenario'){nav('search');renderConcentrationScenario(p);}` in both `mic/app-main.js` and `legacy-import/mic/app-main.js`.

Both fixes verified: `quality/automation/e2e/p0-001-concentration-warning.spec.js` and `p0-004-technical-methods-console.spec.js` pass; `quality/automation/verify_p0-001_p0-002.logic.js` rerun and still 11/11 (these fixes don't touch the logic paths that script exercises).

### Full suite result (2026-07-25)

```text
npx playwright test
23 passed (12.3s)
```

Covers: `p0-001-concentration-warning.spec.js` (1), `p0-002-missing-price-lock.spec.js` (1), `p0-003-viewport-nav.spec.js` (17, full viewport matrix × mic/ + mic-desktop/), `p0-004-technical-methods-console.spec.js` (3), `p0-005-ipo-calendar.spec.js` (2). HTML report: `quality/automation/e2e/report/index.html` (gitignored, local artifact — regenerate with `npx playwright test`).

**What this evidence does and does not cover:** real Chromium, real DOM, real CSS, real dynamically-loaded patch-script chain, seeded `localStorage` state (no manual form-filling required, so fixtures are deterministic). It does **not** cover: Firefox/Safari/Samsung Internet (Chromium only so far), the service worker's cache/offline behavior, a live GitHub Pages deployment (still local-server-only, see `quality/automation/e2e/static-server.js`), or the `data/history/*.json` deep-dive (that directory is deliberately excluded from this migration per `docs/MIGRATION_PLAN.md`, so history-dependent panels correctly show "veri bulunamadı" in this environment — expected, not a defect). CI wiring (running this suite automatically on every push) is still open.

## Browser/viewport matrix

360×800, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1366×768, 1920×1080 — **Chrome (Chromium): done, 2026-07-25, see above.** Edge, Safari, Samsung Internet require a real device or BrowserStack-class service and are marked "live verification required" until available.
