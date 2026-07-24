# Release Checklist — Piyasa Masası AI

Mirrors the Part I §17 final acceptance gates and Part II §23 Definition of Done. Nothing below may be marked complete without linked evidence in `docs/TEST_EVIDENCE.md`.

## Part I — Safe baseline gate (must pass before any public traffic)

- [ ] `Gibiamie/piyasa-masasi-ai` exists as a separate public repository — **blocked on `gh` CLI auth / owner go-ahead**
- [x] `Gibiamie/Gibiamie.github.io` remains intact (read-only bare clone used for inspection; nothing pushed or altered)
- [ ] App opens at `https://gibiamie.github.io/piyasa-masasi-ai/` with no `/mic/` suffix required
- [ ] Missing prices lock weight and action decisions (MIC-P0-002)
- [ ] Portfolio weight alone never produces an automatic sale quantity (MIC-P0-001)
- [ ] Static IPO data contains no personalized buy/join instruction (MIC-P0-005)
- [ ] Desktop/tablet navigation works at and below 820px (MIC-P0-003)
- [ ] Technical Methods loads with zero uncaught errors (MIC-P0-004)
- [ ] Mobile navigation needs no hidden horizontal scroll (MIC-P1-005)
- [ ] Current Playwright/E2E suite passes (MIC-P0-006)
- [ ] Visual regression evidence captured across the required viewport matrix
- [ ] PWA paths + service worker verified under `/piyasa-masasi-ai/`
- [ ] No secrets committed (checked: `.env.example` only, `backend/market-gateway/.env.example` carries no real keys)
- [ ] Remediation register fully updated
- [ ] GitHub Pages deployment green
- [ ] Final commit SHA and deployment URL reported

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

## Current blocking dependency

Repository creation / push / Pages deployment cannot proceed until:
1. GitHub CLI is installed and authenticated as a user with create-repo rights under `Gibiamie`, **or** an equivalent path (PAT + `git remote`/API) is provided, **and**
2. The owner explicitly confirms creating the public repo and deploying it — this is a publish action taken under the owner's real GitHub identity and is not something that proceeds on inference from this document alone.
