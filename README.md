# Piyasa Masası AI

**Public product name:** Piyasa Masası AI
**Legacy origin:** MIC v29, migrated from the multi-project `Gibiamie/Gibiamie.github.io` GitHub Pages repository.
**Canonical repository (planned):** `https://github.com/Gibiamie/piyasa-masasi-ai`
**Canonical Pages URL (planned):** `https://gibiamie.github.io/piyasa-masasi-ai/`

## Status: pre-publish remediation baseline

This repository currently exists **locally only**. The legacy MIC v29 source has been inspected, migrated in from a read-only clone of the old repository, and is being remediated against a full financial-safety and technical audit before anything is pushed publicly. See `docs/RELEASE_CHECKLIST.md` for exactly what is done vs. blocked.

## Financial-safety disclaimer

Piyasa Masası AI is a market-research, portfolio-tracking, and financial-literacy tool. It does **not** provide personalized investment advice, does not issue buy/sell instructions, does not guarantee returns, and does not execute trades. Portfolio concentration warnings are informational, not sell signals — see `docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md` for the finding (MIC-P0-001) this rule directly responds to.

## Repository structure

```text
legacy-import/        Raw MIC v29 source as migrated from the legacy repo (provenance baseline)
docs/                  Audit report, migration plan, remediation register, test evidence, release checklist
organization/          Governance charter, authority matrix, approval gates, escalation & cost policy
product/               PRD, research, user journeys, acceptance criteria, design system
architecture/          Diagrams, ADRs, API/database contracts, threat model
applications/          mobile / web / admin / backend — the v30 rebuilt application (in progress)
financial-governance/  Data sources, licensing, methodologies, golden datasets, evidence register
compliance/             Regulatory register, privacy, terms, risk disclosures, third-party register
quality/                Test strategy, test cases, automation, regression, performance, security
infrastructure/         Local/dev/staging/prod config, monitoring, disaster recovery
operations/             Runbooks, incident log, releases, rollback, cost reports
handover/               Installation, administration, maintenance, recovery, final acceptance docs
```

## Local setup

No build step exists yet for the v30 application — `legacy-import/mic/` and `legacy-import/mic-desktop/` are static HTML/CSS/JS and can be served with any static file server for inspection:

```bash
npx serve legacy-import/mic
```

The market data gateway:

```bash
cd legacy-import/backend/market-gateway
cp .env.example .env   # fill in real provider keys, never commit .env
npm install
npm start
```

## Test commands

Not yet established for the new repository — tracked in `docs/RELEASE_CHECKLIST.md` (Playwright suite, golden-dataset financial validation, accessibility scan). The legacy CI (`legacy-import/.github-workflows-reference/mic-static-tests.yml`) only performs syntax checks and literal-string assertions and is **not** treated as regression evidence (audit finding MIC-P0-006).

## Data sources

- US equities/ETFs/crypto: via `backend/market-gateway` (Alpaca + CCXT), server-side only — no provider secrets reach the browser.
- BIST: requires a licensed provider; the gateway returns `BIST_LICENSED_PROVIDER_REQUIRED` until one is configured. No unlicensed BIST scraping is used.
- Historical/daily data: refreshed by scheduled GitHub Actions (`scripts/update_mic_data.py`, `update_mic_history.py`, `update_nasdaq_history_batch.py`, `update_supplemental_history.py`).

## Known limitations (current)

- No new public repository exists yet — blocked on GitHub CLI authentication and explicit owner approval to publish (see `docs/REMEDIATION_REGISTER.md`).
- P0 financial-safety fixes (automatic sell instructions, missing-price handling) are in progress on top of the imported legacy code, not yet complete or tested end-to-end.
- Desktop/tablet navigation defect (≤820px) and the Technical Methods null-reference crash are not yet fixed.
- No current automated regression suite exists yet.

## Deployment process (planned)

1. Create `Gibiamie/piyasa-masasi-ai` (owner-approved, after `gh auth login` or equivalent).
2. Push the `legacy-v29-import` tagged baseline, then the `remediation/v30-audit` branch as a PR.
3. Merge only after every P0 acceptance gate in `docs/RELEASE_CHECKLIST.md` passes with linked evidence in `docs/TEST_EVIDENCE.md`.
4. Deploy via GitHub Actions to GitHub Pages, verify `https://gibiamie.github.io/piyasa-masasi-ai/` directly (HTTP status, console errors, manifest, service worker, navigation, both layouts).
