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

## Old → new path map — actual decision taken on `remediation/v30-audit`

Originally planned to rename `mic/` → `legacy-mobile/` and `mic-desktop/` → `desktop/`. **Changed after inspecting the code**: `chart-workspace-v10.js`, `ipo-calendar-v26.js`, `quality-fixes-v17.js`, and `mic-version-loader.js` all hard-detect the literal string `"mic-desktop"` in `location.pathname` to decide the relative asset base path (`const desktop=location.pathname.includes('mic-desktop');const base=desktop?'../mic/':'';`). Renaming the folders would silently break that detection in multiple minified files with no browser test yet in place to catch it. Decision: **keep `mic/` and `mic-desktop/` as-is** at the repository root (identical relative structure to the legacy repo, so the copied workflows needed zero path edits), and add a root `index.html` instead:

| Old (GitHub Pages path) | New (project root) |
|---|---|
| `/mic/...` | unchanged, now also served at repo root as `mic/...` |
| `/mic-desktop/...` | unchanged, now also served at repo root as `mic-desktop/...` |
| (new) | `/index.html` — interim static landing page, viewport-based redirect (`matchMedia('(max-width:820px)')`) to `mic/` or `mic-desktop/`, with manual fallback links and a visible "beta" label. This satisfies the "no `/mic/` suffix required" gate without touching the fragile path-detection logic. It is explicitly **not** the final single responsive entry point described in Part I §6 — that remains Phase 2 architecture work (tracked under MIC-P1-001), so this is a knowingly interim, lower-risk substitute, not a claim that the responsive rebuild is done. |
| `backend/market-gateway/` | unchanged path |
| `.github/workflows/mic-*.yml` | copied unmodified — repo-root-relative paths inside them (`mic/data/...`, `scripts/...`, `backend/market-gateway/**`) already match the new repo's structure exactly |
| (new) | `.github/workflows/pages-deploy.yml` — official `actions/configure-pages` + `upload-pages-artifact` + `deploy-pages`, deploying the whole repo root as a static site |

Manifest/service-worker/fetch paths were **not** re-audited for correctness under the new project path in this pass — they were already relative in the legacy code (`fetch('data/market.json')`, `sw.js` registered without a leading slash) and should behave the same whether served from `Gibiamie.github.io/mic/` or `piyasa-masasi-ai/mic/`, but this has not been confirmed with an actual deployed-page browser check yet. Flagged as an open verification item, not assumed correct.

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
