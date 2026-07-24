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
```

No application code has been executed or browser-tested yet in this session. No claim of a working feature is made until it has been.

## Browser/viewport matrix (required, not yet run)

360×800, 390×844, 412×915, 768×1024, 820×1180, 1024×768, 1366×768, 1920×1080 — Chrome, Edge; Safari/Samsung Internet require a real device or BrowserStack-class service and are marked "live verification required" until available.
