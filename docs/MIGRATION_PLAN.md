# Migration Plan — MIC v29 → Piyasa Masası AI

## Source

- Legacy repository: `https://github.com/Gibiamie/Gibiamie.github.io` (branch `main`)
- Inspected via a bare, read-only clone (`git clone --bare --depth 1`) on 2026-07-24. The legacy repository was **not** modified.
- Legacy repo is a multi-project GitHub Pages user site. It must remain intact and unchanged; no redirect or decommissioning without the owner's explicit written approval.

## Files imported (`legacy-import/`, raw, original paths, for provenance)

| Path | Reason |
|---|---|
| `mic/**` (excluding `mic/data/history/`) | Mobile application — active v29 codebase, audited. |
| `mic-desktop/**` | Desktop application — active codebase, audited (contains the P0-003 navigation defect). |
| `backend/market-gateway/**` | Current server-side market data gateway. Confirmed active by CI: `.github/workflows/mic-market-gateway-check.yml` watches `backend/market-gateway/**`. ESM, `ccxt ^4.5.0`, includes CORS allowlist, rate limiting, and a `BIST_LICENSED_PROVIDER_REQUIRED` guard. |
| `scripts/*.py` | Data-refresh scripts invoked by the Actions workflows (`update_mic_data.py`, `update_mic_history.py`, `update_nasdaq_history_batch.py`, `update_supplemental_history.py`). |
| `.github-workflows-reference/mic-*.yml` (5 files) | Reference copies of the MIC-specific workflows (history, market-data, gateway-check, static-tests, supplemental-history). Kept out of `.github/workflows/` until paths are rewritten for the new repo (see below) — copying them in unmodified would immediately start scheduled jobs against the wrong paths/remote. |
| `docs/audit/MIC_v29_Acimasiz_Profesyonel_Denetim_Raporu_2026-07-24.md` | Controlling audit report, retained verbatim. |

## Files excluded

| Path | Reason |
|---|---|
| `mic/data/history/*.json` | Regenerated on a schedule by `mic-history.yml` / `mic-market-data.yml`; not needed for code migration. Also contains files that collide with Windows reserved device names (e.g. `PRN.json`, ticker "PRN"), which cannot be checked out to a working tree on Windows without disabling `core.protectNTFS` — avoided entirely by excluding the directory from the import. |
| `mic-gateway/` (root-level, Render-based) | Superseded prototype. Uses CommonJS, `express`+`cors`+`ccxt`, `render.yaml` Blueprint deploy, Alpaca-only. Not referenced by any active CI workflow. `backend/market-gateway/` is the gateway actually checked by CI and described as current in its own README. Kept **out** of the import; flagged for the owner/CTO-agent to confirm formal deprecation before deletion from the legacy repo (which we do not touch). |
| `css/`, `js/`, `fonts/`, `images/`, `firststep/`, `about.html`, `contact.html`, `process.html`, `why.html`, root `index.html` | Unrelated personal-site content, not part of MIC. |

## Old → new path map (planned, applied on `remediation/v30-audit`)

| Old (GitHub Pages path) | New (project root) |
|---|---|
| `/mic/...` | `/legacy-mobile/...` (compatibility route) and shared modules under a new single entry point |
| `/mic-desktop/...` | `/desktop/...` (compatibility route) sharing the same modules |
| (new) | `/` → single responsive `index.html` entry point, so the app opens directly at `https://gibiamie.github.io/piyasa-masasi-ai/` with no `/mic/` suffix |
| `backend/market-gateway/` | unchanged path, `.env.example`/CORS/allowlist updated for the new origin |
| `.github/workflows/mic-*.yml` | rewritten to reference the new repo's paths and to output into the new Pages workflow |

All asset/manifest/service-worker/fetch paths must be re-verified as project-relative (not root-absolute) once the responsive entry point exists, per the audit's PWA findings (P2-017) and the master instruction's path-sensitivity checklist.

## Rollback plan

- The legacy-v29-import baseline is tagged `legacy-v29-import` before any remediation edits, so the raw imported state can always be restored with `git checkout legacy-v29-import -- legacy-import/`.
- All P0/P1 fixes happen on `remediation/v30-audit`; `main` only advances via reviewed, tested pull requests.
- The legacy repository `Gibiamie/Gibiamie.github.io` remains the untouched fallback deployment (`https://gibiamie.github.io/mic/`, `https://gibiamie.github.io/mic-desktop/`) until the new deployment passes every P0 acceptance gate and the owner explicitly approves any redirect.

## Old repository preservation statement

`Gibiamie/Gibiamie.github.io` was cloned read-only (bare clone, no working tree checkout) purely for inspection and file extraction. No branch, file, tag, setting, or workflow in that repository was created, modified, or deleted. It continues to serve its existing unrelated projects and the current `/mic/` and `/mic-desktop/` deployments without interruption.

## Status

- [x] Legacy repository inspected (read-only).
- [x] Migration inventory built and documented above.
- [x] Verified MIC-related source imported into `legacy-import/` in this working tree.
- [ ] New public repository `Gibiamie/piyasa-masasi-ai` created — **blocked**, see `docs/REMEDIATION_REGISTER.md` note on tooling/permission gate.
- [ ] Legacy-v29-import commit pushed and tagged on the remote.
- [ ] `remediation/v30-audit` branch opened as a pull request.
