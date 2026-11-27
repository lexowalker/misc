# PROGRESS

_Last updated: 2026-11-27 09:35 UTC (overnight build). Data pipeline complete; website build running._

## Done
- **Skeleton**: 94-district registry, cached/throttled HTTP fetcher, source and gap manifests, data contract
  (`docs/DATA_CONTRACT.md`), Makefile, SPEND ledger ($0).
- **Environment**: network allowlist for the free data hosts; CourtListener token stored as a proxy-injected secret.
- **Front-end foundation** (Vite + TypeScript): design tokens with light and dark themes, app shell and routes,
  choropleth with a composite projection and insets, zoom controls, tooltip, legend, table view, sparkline, year
  slider, glossary, Learn primer. First map paint 0.3-0.5 s. See `docs/lanes/frontend.md`.
- **Data lanes** (workflow 1, finished 08:57 UTC). Reports in `docs/lanes/`:
  - boundaries: statute-based county assignment for all 94 districts, carve-outs, TopoJSON (106 tests).
  - FCMS FY1999-2025, USSC FY1995-2025, IDB FY1988-2026, FJC judges 1789-2026, Census population 2000-2025.
  - courthouses: 455 places of holding court and 331 historic courthouses geocoded at city level; search index for
    cities, counties, ZIPs (ZCTAs) and courthouses.
  - CourtListener recent cases: 87 of 94 districts have 3-5 items.
- **Audits**: `docs/audits/boundary_audit.md` (passed, 5 minor issues fixed or documented) and
  `docs/audits/stats_audit.md` (51 of 51 sampled cells matched; 1 blocker, 1 major and 6 minor issues, all fixed or
  documented, then rechecked against the raw sources). 678 pipeline tests pass.
- `SOURCES.md` (1,547 source files) and `DATA_GAPS.md` generated from the lane fragments.

## In progress
- Workflow 2 (website): the web data lane has published `public/data/` (41 map variables in four families, all with
  10+ years; see `docs/lanes/web.md`). Story research, then the home, district profile, stories, compare and
  courtroom pages, then an integration pass.

## Next
- Workflow 3: verification lanes (data audit of 50+ numbers into `VERIFICATION.md`, copy audit, UI audit with
  screenshots at desktop and mobile), then fixes.
- Retry CourtListener for the 7 districts with no cases after the daily quota resets (about 04:15 UTC Nov 28).

## Blocked / notes
- **CourtListener quota**: the free tier returned HTTP 429 with a daily Retry-After after about 124 requests.
  wied, wiwd, wyd, prd, vid, gud and nmid have no recent cases yet (logged in `DATA_GAPS.md`).
- **uscourts.gov court finder** pages return HTTP 403, so courthouses have no street addresses (logged).
- **Repository size**: FCMS CSV mirrors of the parquet tables are git-ignored (`make fcms` regenerates them). One
  earlier commit on this branch contains a 41 MB CSV; removing it from history needs a force-push, which was not
  allowed, so it stays.
