# Release Checklist — Piyasa Masası AI

Mirrors the Part I §17 final acceptance gates and Part II §23 Definition of Done. Nothing below may be marked complete without linked evidence in `docs/TEST_EVIDENCE.md`.

## Part I — Safe baseline gate (must pass before any public traffic)

- [x] `Gibiamie/piyasa-masasi-ai` exists as a separate public repository — created 2026-07-25
- [x] `Gibiamie/Gibiamie.github.io` remains intact (read-only bare clone used for inspection; nothing pushed or altered)
- [x] App opens at `https://gibiamie.github.io/piyasa-masasi-ai/` with no `/mic/` suffix required — deployed, `index.html` viewport-redirect confirmed live
- [x] Missing prices lock weight and action decisions (MIC-P0-002) — browser-verified 2026-07-25, Chromium + WebKit, `docs/TEST_EVIDENCE.md`
- [x] Portfolio weight alone never produces an automatic sale quantity (MIC-P0-001) — browser-verified 2026-07-25, Chromium + WebKit, `docs/TEST_EVIDENCE.md`
- [x] Static IPO data contains no personalized buy/join instruction (MIC-P0-005) — browser-verified 2026-07-25, Chromium + WebKit, `docs/TEST_EVIDENCE.md`
- [x] Desktop/tablet navigation works at and below 820px (MIC-P0-003) — browser-verified across full viewport matrix, 2026-07-25, Chromium + WebKit
- [x] Technical Methods loads with zero uncaught errors (MIC-P0-004) — browser-verified 2026-07-25; required fixing three newly-found defects, MIC-P0-007/008/009
- [ ] Mobile navigation needs no hidden horizontal scroll (MIC-P1-005) — still Open (P1, not covered by this pass; note the viewport suite does check zero horizontal *document* overflow on mic-desktop, but MIC-P1-005 is specifically about the 8-item mobile nav bar itself)
- [x] Current Playwright/E2E suite passes (MIC-P0-006) — 82/82 local (Chromium + WebKit), wired into CI (`.github/workflows/e2e-tests.yml`, all 3 engines, runs on every PR and every push to `remediation/v30-audit`)
- [x] Visual regression evidence captured across the required viewport matrix — Chromium + WebKit, 2026-07-25; Firefox covered in CI only (blocked locally by an unrelated OS-level issue on this dev machine, see `docs/TEST_EVIDENCE.md`); real Safari/Samsung Internet still require a real device or BrowserStack-class service
- [x] PWA paths + service worker verified under `/piyasa-masasi-ai/` — `p0-009-pwa-and-screenshots.spec.js`, manifest + SW registration (mic/) / intentional non-registration (mic-desktop/) confirmed
- [ ] No secrets committed (checked: `.env.example` only, `backend/market-gateway/.env.example` carries no real keys) — not re-audited this pass, carried forward as presumed still true
- [x] Remediation register fully updated — 2026-07-25 (status/commit columns corrected, MIC-P0-007/008/009 added)
- [x] GitHub Pages deployment green — deployed via `.github/workflows/pages-deploy.yml`, see final report for the run URL and commit SHA
- [x] Final commit SHA and deployment URL reported — see end-of-session report

**Independent review is not a checkbox on this list because it is not yet done for anything above.** See `docs/INDEPENDENT_REVIEW_HANDOFF.md`. No item above should be read as "signed off" — it means "implemented, self-tested, and evidenced," which is a precondition for review, not a substitute for it.

## Part II — Full Definition of Done (tracked, longer horizon)

- [ ] Clean-environment build
- [ ] Install + open succeeds
- [ ] Critical user journeys pass
- [ ] Auth/authorization validated (once implemented)
- [ ] Watchlists work
- [ ] Portfolio tracking works
- [ ] Financial calculations pass golden datasets (`financial-governance/golden-datasets/`)
- [ ] Market data shows source/timestamp/delay status on every value
- [ ] Missing/stale data handled safely everywhere, not just in portfolio weight
- [ ] Unit / integration / API contract / E2E / accessibility / performance / security tests pass
- [ ] Zero known critical or high-severity security findings
- [ ] Zero known financial-calculation or data-corruption defects
- [ ] Backup restore tested
- [ ] Rollback tested
- [ ] Monitoring + error reporting live
- [ ] Compliance docs complete (`compliance/`)
- [ ] Store packages prepared (if/when a native app ships)
- [ ] Production accounts owned by the project owner, not the assistant
- [ ] Source + docs complete and rebuildable from repo alone
- [ ] Independent final acceptance sign-off recorded

## Known open risks (carried into this release)

1. **Independent review of every P0 fix is outstanding** — see `docs/INDEPENDENT_REVIEW_HANDOFF.md`. This is the primary remaining gate.
2. A GitHub Pages/Fastly CDN edge-cache propagation lag was observed during live testing on 2026-07-25 (one edge POP served stale pre-fix content briefly after a deploy). Not a code defect; needs a live re-verification pass after each deploy until confirmed consistently clear.
3. Firefox is verified in CI (Linux) only, not on the local Windows development machine (unrelated OS-level issue, documented in `docs/TEST_EVIDENCE.md`).
4. 25 P1 and 22 P2 findings from the original audit remain open — this release covers P0 (blocker) severity only.
