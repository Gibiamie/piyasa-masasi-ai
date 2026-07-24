# Test Evidence — Piyasa Masası AI

## Baseline: what "current test evidence" actually meant in the legacy repo

Inspected `.github-workflows-reference/mic-static-tests.yml` (copied verbatim from the legacy repo). Its actual checks are:

1. `node --check` syntax validation of every `.js` file under `mic/` and `mic-desktop/`.
2. Five `grep -q` string assertions against literal source text (e.g. that `mic/chart-workspace-v13.js` contains the string `data-interval="1H"`).

This is **not** functional, behavioral, or regression testing — it cannot catch MIC-P0-001 through MIC-P0-006, none of the P1 items, and none of the audit's required scenarios. This confirms audit finding MIC-P0-006 exactly: there is no current, credible regression evidence for v29. The "v7 test report" referenced in the audit does not cover v29/v30 either. Both are treated as non-evidence going forward.

## Evidence required before any P0 item can be marked Closed

For each of the following, this file will record: command executed, result, date, commit SHA, and artifact location (screenshots/traces).

- [ ] Playwright suite bootstrapped (`quality/automation/`)
- [ ] MIC-P0-001: weight breach at cap+0.01% → no sell output; hard breach with sound thesis → scenario only, no order
- [ ] MIC-P0-002: one missing price → all weight/decision output locked, `PORTFÖY AĞIRLIĞI HESAPLANAMADI` shown
- [ ] MIC-P0-003: all routes reachable at 360/390/412/768/820/1024/1366/1920px
- [ ] MIC-P0-004: zero uncaught console errors loading Technical Methods on desktop/tablet/mobile
- [ ] MIC-P0-005: static IPO JSON contains no personalized buy/join field; profile-gated decision confirmed
- [ ] MIC-P0-006: this suite itself, running in CI on every push, with report + screenshot artifacts

## Commands executed so far

```text
git clone --bare --depth 1 https://github.com/Gibiamie/Gibiamie.github.io.git   (read-only inspection, 2026-07-24)
git ls-tree / git show / git archive                                            (file inventory + extraction, 2026-07-24)
node --check legacy-import/mic/app-main.js                                      (syntax check, 2026-07-24, PASS)
node --check legacy-import/mic/price-integrity-v18.js                           (syntax check, 2026-07-24, PASS)
node quality/automation/verify_p0-001_p0-002.logic.js                           (logic-level check, 2026-07-24, 11/11 PASS)
```

### MIC-P0-001 / MIC-P0-002 logic-level verification (2026-07-24)

`quality/automation/verify_p0-001_p0-002.logic.js` loads the real `app-main.js` and `price-integrity-v18.js` in a stubbed sandbox (no real DOM/browser — a `vm` context standing in for `$`, `state`, `market`, etc.) and calls `portfolioStats()`, `decision()`, and `calculateConcentrationScenario()` directly against two fixtures matching the audit's required scenarios:

1. A TUPRS-style hard concentration breach with a sound price — asserts `decision()` no longer returns `DENGELE / AZALT` with a lot count, returns `KONSANTRASYON UYARISI` / `SATIŞ SİNYALİ DEĞİLDİR` instead, and that the explicit opt-in scenario calculator still produces a lot number only when called directly.
2. A two-position portfolio where one position has no live price — asserts `portfolioStats()` reports `missing`/`locked`/`totalPartial`, that the priced position's `weight` is `null` (not silently computed against an undercounted total), that `decision()` returns `PORTFÖY AĞIRLIĞI HESAPLANAMADI` instead of any weight-based output, and that the scenario calculator also refuses to run.

Result: **11/11 checks passed** on 2026-07-24 (see script for exact assertions).

**What this evidence does and does not cover:** this confirms the pure calculation/decision logic behaves per the audit's acceptance criteria. It does **not** cover the actual browser UI (the new "Senaryo" button, DOM rendering, the price-notice banner), real market data files, service worker behavior, or cross-viewport layout — those remain open per `docs/RELEASE_CHECKLIST.md` and require the full Playwright suite (MIC-P0-006), which has not been built yet. This fix was implemented and logic-tested in the same pass by the same assistant; per `organization/authority-matrix.yaml` it must still receive an independent review pass before `docs/REMEDIATION_REGISTER.md` marks MIC-P0-001/MIC-P0-002 as fully Closed.

### MIC-P0-005 logic-level verification (2026-07-24)

`quality/automation/verify_p0-005.logic.js` checks two things: (1) every item in `legacy-import/mic/data/ipo-calendar.json` carries no `mic_view`/`suggested_order`/`max_budget`/`score` field and does carry `verified_at`/`verification_status`; (2) `ipoAssessment()` in `ipo-calendar-v26.js`, loaded in a stubbed sandbox, returns `KARAR ÜRETİLEMEZ` when profile incomplete, `PORTFÖY ETKİSİ HESAPLANAMAZ` when the portfolio is price-locked, `VERİ DOĞRULAMA GEREKLİ` when verification is stale, and otherwise a neutral label containing no "KATIL"/"AL" wording. Result: **46/46 checks passed** on 2026-07-24.

### MIC-P0-003 / MIC-P0-004 verification status (2026-07-24)

`node --check` passes on both edited files. The `<nav class="bottom">` markup added to `mic-desktop/index.html` was traced by hand against the existing `desktop.css` media queries (`.sidebar{display:none}` / `.bottom{display:grid!important}` at ≤820px) rather than run in a real browser — **no screenshot or live viewport evidence exists yet for either fix.** This is the honest gap: closing MIC-P0-003/MIC-P0-004 for real requires the Playwright suite (MIC-P0-006), which is still open. Do not treat the code-level fix as equivalent to verified UI behavior.

No other application code has been executed or browser-tested yet in this session. No claim of a working feature is made until it has been.

## Browser/viewport matrix (required, not yet run)

360×800, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1366×768, 1920×1080 — Chrome, Edge; Safari/Samsung Internet require a real device or BrowserStack-class service and are marked "live verification required" until available.
