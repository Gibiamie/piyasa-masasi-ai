# Independent Review Handoff — Piyasa Masası AI P0 Remediation

**Prepared:** 2026-07-25
**Branch under review:** `remediation/v30-audit`
**Baseline for comparison:** tag `legacy-v29-import` (raw, unmodified MIC v29 import)

## Gate status — explicit

**This document does NOT close the independent-review gate.** Per `docs/REMEDIATION_REGISTER.md`'s own rule — *"No P0 item may be marked Closed without: a commit reference, a passing targeted test, a passing full regression run, and independent review (author of a fix may not close their own finding)"* — every fix below was implemented and tested by the same assistant/session. None of the 9 P0 items are Closed. This package exists so a second, independent reviewer can do that review efficiently; it is a handoff, not a self-certification.

## What changed — exact diff

The application-code remediation is fully contained in these files (diff vs the `legacy-v29-import` baseline tag):

```text
legacy-import/mic-desktop/index.html       |  3 ++
legacy-import/mic/app-main.js              | 37 +++++++++++---
legacy-import/mic/chart-workspace-v13.js   |  2 +-
legacy-import/mic/data/ipo-calendar.json   | 82 +++++++++++++++---------------
legacy-import/mic/ipo-calendar-v26.js      | 41 ++++++++-------
legacy-import/mic/price-integrity-v18.js   | 19 ++++---
legacy-import/mic/technical-methods-v27.js |  2 +-
7 files changed, 114 insertions(+), 72 deletions(-)
```

Reproduce with: `git diff legacy-v29-import..remediation/v30-audit -- legacy-import/`

Identical edits were applied to the actually-served copies at repo root (`mic/`, `mic-desktop/`) — confirmed byte-identical to `legacy-import/mic/` at every point fixes were applied (`diff -q`, re-verified 2026-07-25). Reviewers should treat `mic/` and `mic-desktop/` as the ground truth for "what is live," and `legacy-import/` as the provenance copy showing the same edits against the original import.

Non-application-code additions in this pass (test infrastructure, not app behavior):
- `quality/automation/e2e/` — Playwright suite (7 spec files, 1 fixtures helper, 1 static server)
- `playwright.config.js`, `playwright.live.config.js` — local and live-URL test configs
- `.github/workflows/e2e-tests.yml` — CI wiring
- `package.json`, `package-lock.json` — `@playwright/test` devDependency only; `mic/`/`mic-desktop/` ship with zero runtime dependencies, unaffected
- `quality/automation/verify_p0-001_p0-002.logic.js`, `verify_p0-005.logic.js` — path fixes only (see Known Issues below), no logic changes

## Commits in scope

```text
6909d72  fix: replace automatic lot sale with concentration warning; lock decisions on missing price
e6caacd  fix: desktop nav below 820px, Technical Methods null-ref, static IPO decisions
8cfa0f7  chore: activate top-level deploy paths, root landing page, Pages workflow
06ad84e  docs: correct migration plan path decision and register commit status
edabb32  feat: build MIC-P0-006 Playwright E2E suite, browser-verify P0-001..005, fix two new defects found
<latest> docs/CI/test updates from this session — see `git log` for the final SHA
```

## The 9 P0 findings — one-line acceptance criteria and where to check them

| ID | Acceptance criterion | Where to verify | Test |
|---|---|---|---|
| MIC-P0-001 | Portfolio weight alone must never produce an automatic sale quantity | `mic/app-main.js` `decision()`, line ~33-46 | `quality/automation/e2e/p0-001-concentration-warning.spec.js` |
| MIC-P0-002 | A missing price must lock weight/decision output for the whole portfolio, not silently drop to zero | `mic/price-integrity-v18.js` `portfolioStats()` | `quality/automation/e2e/p0-002-missing-price-lock.spec.js` |
| MIC-P0-003 | All 8 required viewport widths must reach every nav route on both `mic/` and `mic-desktop/` | `mic-desktop/index.html` (added `<nav class="bottom">`) | `quality/automation/e2e/p0-003-viewport-nav.spec.js` |
| MIC-P0-004 | Technical Methods must load with zero uncaught JS errors | `mic/technical-methods-v27.js` `boot()` null-guard | `quality/automation/e2e/p0-004-technical-methods-console.spec.js` |
| MIC-P0-005 | Static IPO data must carry no personalized buy/join field; any assessment must be computed live from profile/portfolio state | `mic/data/ipo-calendar.json`, `mic/ipo-calendar-v26.js` `ipoAssessment()` | `quality/automation/e2e/p0-005-ipo-calendar.spec.js` |
| MIC-P0-006 | A real end-to-end regression suite must exist and run in CI | `quality/automation/e2e/`, `.github/workflows/e2e-tests.yml` | the suite itself |
| MIC-P0-007 | No uncaught exception on first page load for a user with no saved gateway config | `mic/chart-workspace-v13.js` `gateway()` | `p0-004-technical-methods-console.spec.js` (catches uncaught errors) |
| MIC-P0-008 | The "Senaryo" scenario output must actually be visible to the user who clicked it | `mic/app-main.js` portfolio click handler, `data-a==='scenario'` branch | `p0-001-concentration-warning.spec.js` |
| MIC-P0-009 | No failed critical network request on normal page load | `mic/app-main.js` (removed stray `sw.js?v=5` registration) | `p0-009-pwa-and-screenshots.spec.js` |

Full finding text, root-cause explanation, and exact fix diff for each: `docs/REMEDIATION_REGISTER.md`.

## Test evidence summary

- Logic-level (sandboxed, no browser): `verify_p0-001_p0-002.logic.js` 11/11, `verify_p0-005.logic.js` 46/46.
- Local, real browser: **82/82 passing** on Chromium + WebKit (`npx playwright test --project=chromium --project=webkit`).
- Firefox: could not be launched on this local Windows development machine (OS-level DLL/side-by-side fault, confirmed unrelated to the app — see `docs/TEST_EVIDENCE.md`). Wired into CI, which runs on Linux where this does not apply.
- CI: `.github/workflows/e2e-tests.yml` runs on every PR and every push to `remediation/v30-audit`, all 3 browser engines, uploads the HTML report and screenshots as artifacts on failure.
- Live deployment (`https://gibiamie.github.io/piyasa-masasi-ai/`): tested via `playwright.live.config.js`. See `docs/TEST_EVIDENCE.md` for the CDN edge-cache propagation issue observed during this pass and the plan to re-verify after the next deploy.

Full detail, commands, and dates: `docs/TEST_EVIDENCE.md`.

## Unresolved risks a reviewer should specifically weigh

1. **Self-review only, so far.** Every fix in this document was implemented and tested by the same assistant session. This is the primary open gate.
2. **GitHub Pages/Fastly CDN edge-cache propagation lag observed during live testing** (2026-07-25) — one edge POP served a stale, pre-fix `app-main.js` (verified via response body diff: 16894 bytes / old `DENGELE / AZALT` text vs the correct 19545 bytes / `KONSANTRASYON UYARISI`) while the origin and other request paths already served the fixed version. Not an application defect. Needs a fresh live re-verification pass after the next deploy to confirm it has cleared; if it recurs, it needs tracking as an infrastructure issue, not a code fix.
3. **Firefox is untested on the actual development machine.** CI should be the authoritative Firefox result once it runs; a reviewer should check that CI run's outcome directly rather than assume parity with the Chromium/WebKit local results.
4. **`quality/automation/verify_p0-001_p0-002.logic.js` previously referenced a hardcoded path from a different machine** (`C:\Users\Mert\Desktop\Mert\claude\...`) and could not have produced its previously-recorded "11/11 PASS" result on this machine. This was corrected (repointed to a portable relative path against the served `mic/` files) and rerun with an unchanged result, but it is a concrete example of unverified evidence having been recorded as verified in an earlier pass — worth the reviewer independently re-running rather than trusting the register's history at face value.
5. **25 P1 and 22 P2 findings from the original audit remain fully open** — this pass covered P0 (blocker) severity only, plus the 3 additional defects (MIC-P0-007/008/009) the new E2E suite surfaced as a side effect of actually running the app in a browser for the first time.
6. **`main` branch does not exist.** Nothing here has been through the PR-based review process `docs/MIGRATION_PLAN.md`'s own rollback plan describes as the intended path to `main`. This branch (`remediation/v30-audit`) is itself the artifact under review.
7. **No golden-dataset financial-calculation validation, no accessibility scan, no security review** — all out of scope for this P0-focused pass; tracked in `docs/RELEASE_CHECKLIST.md` Part II.

## How to review

1. Read `docs/REMEDIATION_REGISTER.md` P0 section top to bottom — each row has the finding, the fix, the commit, and the specific test.
2. `git diff legacy-v29-import..remediation/v30-audit -- legacy-import/` for the exact application-code change set (114 lines changed across 7 files, see above).
3. `npm install && npx playwright install --with-deps && npx playwright test` — reproduce the 82-test local pass yourself.
4. Check the CI run for this branch/PR directly on GitHub Actions — do not take this document's word for the Firefox result.
5. Visit `https://gibiamie.github.io/piyasa-masasi-ai/` directly and manually exercise: adding a concentrated position, a missing-price position, Technical Methods on desktop, the IPO calendar.
6. Do not mark any MIC-P0-* item Closed in `docs/REMEDIATION_REGISTER.md` without doing 1-5 yourself first.
