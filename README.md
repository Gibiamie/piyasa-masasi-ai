# Piyasa Masası AI

**Public product name:** Piyasa Masası AI
**Legacy origin:** MIC v29, migrated from the multi-project `Gibiamie/Gibiamie.github.io` GitHub Pages repository.
**Repository:** [`https://github.com/Gibiamie/piyasa-masasi-ai`](https://github.com/Gibiamie/piyasa-masasi-ai) — public
**Live:** [`https://gibiamie.github.io/piyasa-masasi-ai/`](https://gibiamie.github.io/piyasa-masasi-ai/) — deployed via GitHub Actions
**Default branch:** `remediation/v30-audit` (all P0/P1 remediation work; `main` is reserved for reviewed, merged PRs per the rollback plan in `docs/MIGRATION_PLAN.md` and does not yet exist)

## Status: public, deployed, pending independent review

The repository is public and the app is live at the URL above. All 5 P0 findings from the original audit (`docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md`) have code fixes implemented, committed, and verified by an automated Playwright E2E suite running against real browsers — both locally and against the live deployment. Two additional real defects were found by that suite (not in the original audit) and have also been fixed. See `docs/RELEASE_CHECKLIST.md` for the exact gate-by-gate status and `docs/TEST_EVIDENCE.md` for full test results.

**What "verified" does and does not mean here:** every fix has automated test evidence (logic-level and real-browser). No P0 item is marked *Closed* in `docs/REMEDIATION_REGISTER.md` — per that document's own rule, the author of a fix may not close their own finding, so **independent review is still required and outstanding** before any item is considered fully resolved. Do not treat this repository as production-ready financial software until that review has happened.

## Financial-safety disclaimer

Piyasa Masası AI is a market-research, portfolio-tracking, and financial-literacy tool. It does **not** provide personalized investment advice, does not issue buy/sell instructions, does not guarantee returns, and does not execute trades. Portfolio concentration warnings are informational, not sell signals — see `docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md` for the finding (MIC-P0-001) this rule directly responds to.

## Repository structure

```text
mic/                   Served mobile application (actual production code, deployed at /mic/)
mic-desktop/            Served desktop application (deployed at /mic-desktop/)
backend/market-gateway/ Server-side market data gateway (Alpaca + CCXT)
scripts/                 Data-refresh scripts invoked by scheduled GitHub Actions workflows
legacy-import/           Raw MIC v29 source as migrated from the legacy repo (provenance baseline, kept in sync with fixes applied to mic/ and mic-desktop/)
quality/automation/e2e/  Playwright E2E suite (MIC-P0-006) -- see Test commands below
docs/                    Audit report, migration plan, remediation register, test evidence, release checklist
organization/            Governance charter, authority matrix, approval gates, escalation & cost policy
product/                 PRD, research, user journeys, acceptance criteria, design system
architecture/            Diagrams, ADRs, API/database contracts, threat model
financial-governance/    Data sources, licensing, methodologies, golden datasets, evidence register
compliance/              Regulatory register, privacy, terms, risk disclosures, third-party register
infrastructure/          Local/dev/staging/prod config, monitoring, disaster recovery
operations/              Runbooks, incident log, releases, rollback, cost reports
handover/                Installation, administration, maintenance, recovery, final acceptance docs
```

## Local setup

`mic/` and `mic-desktop/` are static HTML/CSS/JS with no build step. Serve the repo root so both paths resolve correctly:

```bash
npx serve .
```

The market data gateway:

```bash
cd backend/market-gateway
cp .env.example .env   # fill in real provider keys, never commit .env
npm install
npm start
```

## Test commands

```bash
npm install
npx playwright install --with-deps   # first time only; chromium, firefox, webkit
npx playwright test                  # local: starts a static server, runs the full suite
npx playwright test --config=playwright.live.config.js   # runs the same suite against the live Pages URL
```

`quality/automation/e2e/` (MIC-P0-006) covers: the required viewport matrix on both `mic/` and `mic-desktop/`, Technical Methods loading with zero uncaught JS errors, the concentration-warning flow (MIC-P0-001), the missing-price lock flow (MIC-P0-002), IPO calendar gating (MIC-P0-005), and PWA integrity (manifest, service worker, screenshots across all required viewports). Logic-level tests also exist at `quality/automation/verify_p0-001_p0-002.logic.js` and `verify_p0-005.logic.js`. Full results and dates in `docs/TEST_EVIDENCE.md`.

CI runs this suite automatically on every pull request and every push to `remediation/v30-audit` — see `.github/workflows/e2e-tests.yml`. The legacy CI (`.github-workflows-reference/mic-static-tests.yml`, kept for reference only) only performs syntax checks and literal-string assertions and is **not** treated as regression evidence — that was the original MIC-P0-006 finding this suite exists to close.

## Data sources

- US equities/ETFs/crypto: via `backend/market-gateway` (Alpaca + CCXT), server-side only — no provider secrets reach the browser.
- BIST: requires a licensed provider; the gateway returns `BIST_LICENSED_PROVIDER_REQUIRED` until one is configured. No unlicensed BIST scraping is used.
- Historical/daily data: refreshed by scheduled GitHub Actions (`scripts/update_mic_data.py`, `update_mic_history.py`, `update_nasdaq_history_batch.py`, `update_supplemental_history.py`).

## Known limitations (current)

- **Independent review of every P0 fix is outstanding** — this is the main gate before anything here can be called "done." See `docs/INDEPENDENT_REVIEW_HANDOFF.md`.
- CI (`.github/workflows/e2e-tests.yml`) runs Chromium, Firefox, and WebKit on GitHub's Linux runners. Firefox could not be verified from this particular local Windows development machine (a pre-existing OS-level DLL/side-by-side configuration issue unrelated to the application, documented in `docs/TEST_EVIDENCE.md`) — Chromium and WebKit were both run locally and pass.
- 25 P1 findings and 22 P2 findings from the original audit remain open (see `docs/REMEDIATION_REGISTER.md`) — this pass covered P0 (blocker-severity) items only, plus two additional defects the new E2E suite surfaced.
- `main` branch does not exist yet; nothing has gone through the PR-review process described in `docs/MIGRATION_PLAN.md`'s rollback plan.
- `Gibiamie/Gibiamie.github.io` (the legacy repository) remains the untouched, unaffected fallback deployment.

## Deployment process

Automatic: `.github/workflows/pages-deploy.yml` deploys the repository root to GitHub Pages on every push to `main` or `remediation/v30-audit`, or via manual `workflow_dispatch`. Pages is configured with `build_type: workflow` (Actions-based deploy, not a legacy branch/folder source).
