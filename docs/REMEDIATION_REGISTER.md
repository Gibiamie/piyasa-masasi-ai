# Remediation Register — MIC v29 Audit (2026-07-24)

Traceability register for every finding in `docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md`. Status is updated as each item is fixed, tested, and independently reviewed. No item may be marked Closed without a linked commit and test evidence in `docs/TEST_EVIDENCE.md`.

## Tooling/permission blocker (applies to all items' deployment step)

`gh` (GitHub CLI) is not installed in this environment, so `Gibiamie/piyasa-masasi-ai` has not been created yet, and no push/deploy has occurred. Creating a public repository and deploying GitHub Pages are also "publish public content" actions that require the owner's explicit go-ahead per operating policy, independent of tooling. This blocks the deployment/push step of every item below, not the code-fix step — fixes are being implemented and committed to the **local** repository now.

## P0 — Blocker

| ID | Priority | Finding | Affected file | Action taken | Commit | Test evidence | Status |
|---|---|---|---|---|---|---|---|
| MIC-P0-001 | P0 | Concentration weight alone triggers automatic "DENGELE/AZALT" lot-sale instructions | `legacy-import/mic/app-main.js` → `decision()` (the actually-active implementation for this branch — `quality-fixes-v17.js` only overrides the ETF path and delegates back to this function for weight breaches) | Weight breach now returns `KONSANTRASYON UYARISI` / `SATIŞ SİNYALİ DEĞİLDİR` with no lot count. Added opt-in `calculateConcentrationScenario()` + `renderConcentrationScenario()` + a "Senaryo" button, labeled `MATEMATİKSEL SENARYO — TAVSİYE DEĞİLDİR`, shown only when the user explicitly clicks it. | local, uncommitted → will land as `fix: replace automatic lot sale with concentration warning` on `remediation/v30-audit` | `docs/TEST_EVIDENCE.md` §MIC-P0-001/002 logic verification, 11/11 pass, 2026-07-24 | Fix implemented + logic-tested; **not yet Closed** — needs independent review + browser/E2E evidence per authority-matrix.yaml |
| MIC-P0-002 | P0 | Missing price treated as zero value, inflating other weights and enabling bad sell decisions | `legacy-import/mic/price-integrity-v18.js` → `portfolioStats()` (this monkey-patch is the actually-active implementation; loads after `quality-fixes-v17.js` and is never overridden again) | Any missing price now sets `ps.locked`/`ps.totalPartial = true`, every row's `weight` becomes `null` (not silently computed against an undercounted total), `decision()` short-circuits to `PORTFÖY AĞIRLIĞI HESAPLANAMADI` before any weight/concentration logic runs, and the UI notice + total-value display are updated to say so explicitly. | local, uncommitted → will land as `fix: block portfolio decisions when prices are incomplete` on `remediation/v30-audit` | `docs/TEST_EVIDENCE.md` §MIC-P0-001/002 logic verification, 11/11 pass, 2026-07-24 | Fix implemented + logic-tested; **not yet Closed** — needs independent review + browser/E2E evidence per authority-matrix.yaml |
| MIC-P0-003 | P0 | `/mic-desktop/` loses all navigation ≤ ~820px (sidebar hidden, no bottom nav exists) | `legacy-import/mic-desktop/index.html`, `legacy-import/mic-desktop/desktop.css` | Planned: shared route/navigation registry across mobile+desktop; verified at 360/390/412/768/820/1024/1366/1920px | pending | pending | Open |
| MIC-P0-004 | P0 | Technical Methods module assumes `.bottom` exists → uncaught TypeError on desktop | `legacy-import/mic/technical-methods-v27.js` → `boot()` | Planned: replace direct DOM-class lookup with shared `registerRoute()`/`registerNavigationItem()` API, null-safe and idempotent | pending | pending | Open |
| MIC-P0-005 | P0 | Static IPO JSON contains personalized buy/join instructions independent of user profile | `legacy-import/mic/data/ipo-calendar.json`, `legacy-import/mic/ipo-calendar-v26.js` | Planned: strip static file to verified facts only (issuer/ticker/dates/price/allocation/source/verified_at/expiry/status); personalized assessment computed dynamically, showing `KARAR ÜRETİLEMEZ` / `PORTFÖY ETKİSİ HESAPLANAMAZ` / `VERİ DOĞRULAMA GEREKLİ` when profile/portfolio/verification is incomplete | pending | pending | Open |
| MIC-P0-006 | P0 | No current end-to-end regression evidence for v29 (existing CI is syntax-check + grep assertions only, confirmed in `.github-workflows-reference/mic-static-tests.yml`) | test/release process | Planned: Playwright suite covering route transitions, nav, missing-price lock, concentration warning, IPO gate, PWA paths, SW update, storage migration, chart load, module 404, offline, responsive regression | pending | pending | Open |

## P1 — High

| ID | Finding | Affected area | Status |
|---|---|---|---|
| MIC-P1-001 | v12 HTML shell + v17–v29 patch stack, real version unclear | `legacy-import/mic/*` loader chain | Open — planned for Phase 2 architecture refactor |
| MIC-P1-002 | Dynamic script loader has no `onerror`/central status | `mic/mic-version-loader.js` | Open |
| MIC-P1-003 | Service worker install fails atomically on one missing file | `mic/sw.js` | Open |
| MIC-P1-004 | Service worker can cache 404/500 responses as valid | `mic/sw.js` | Open |
| MIC-P1-005 | Mobile nav has 8 items, forces horizontal scroll at 360–412px | `mic/*` nav markup | Open — target ≤5 primary tabs + "Daha Fazla" |
| MIC-P1-006 | No dividend/DRIP/position-purpose data model | data model | Open |
| MIC-P1-007 | No corporate-action handling (bonus issue, split, reverse split, etc.) | data model | Open |
| MIC-P1-008 | Total return excludes dividends | portfolio calc | Open |
| MIC-P1-009 | Virtual portfolio uses current price as cost when price missing | `mic/virtual.js` | Open |
| MIC-P1-010 | Virtual portfolio falls back to stale fixed FX (USDTRY=40, EURTRY=44) | `mic/virtual.js` | Open |
| MIC-P1-011 | Fundamental score formula too simple/uncalibrated across sectors | scoring model | Open |
| MIC-P1-012 | "Data confidence" measures field count, not accuracy | scoring model | Open |
| MIC-P1-013 | No sector/correlation concentration | concentration model | Open |
| MIC-P1-014 | IPO "Yenile" implies live source check but only reloads local JSON | `mic/ipo-calendar-v26.js` | Open — rename or wire real verification |
| MIC-P1-015 | IPO data can go stale with no `verified_at`/`expires_at` | `mic/data/ipo-calendar.json` | Open |
| MIC-P1-016 | IPO source quality inconsistent (news sites vs. official) | data governance | Open |
| MIC-P1-017 | Uncalibrated technical "quality scores" (0–100) read as probability | `mic/technical-methods-v27.js` | Open |
| MIC-P1-018 | Sample opening-range numbers may read as real levels | `mic/technical-methods-v27.js` | Open |
| MIC-P1-019 | Weekly volume profile is not real volume-at-price | `mic/technical-methods-v27.js` | Open |
| MIC-P1-020 | Technical Methods symbol list is fixed to 10, excludes most of portfolio | `mic/technical-methods-v27.js` | Open |
| MIC-P1-021 | Gateway token stored in localStorage (XSS/extension exposure) | `mic/data-governance-v11.js` | Open |
| MIC-P1-022 | localStorage schema stuck at v3, no migration | storage layer | Open |
| MIC-P1-023 | Monolithic localStorage blob risks main-thread blocking + quota errors | storage layer | Open — target IndexedDB |
| MIC-P1-024 | Direct-from-browser Nasdaq calls unreliable (CORS/rate-limit) | `mic/nasdaq-data-v25.js` | Open — route through gateway |
| MIC-P1-025 | Crypto price fetch has 70s wait, no cancel | `mic/crypto-quotes-v22.js` | Open |

## P2 — Usability/accessibility/quality

All 22 P2 items from the audit (`MIC-P2-001` … `MIC-P2-022`) are logged as Open and scheduled for Phase 3 (UX/accessibility) per `docs/RELEASE_CHECKLIST.md`. Full text retained in `docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md` §6.

## Rule

No P0 item may be marked Closed without: a commit reference, a passing targeted test, a passing full regression run, and independent review (author of a fix may not close their own finding). Portfolio-weight-alone must never produce an automatic sale quantity in any test, in any release.
