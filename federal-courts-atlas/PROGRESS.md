# PROGRESS

_Last updated: 2026-11-27 05:30 UTC (overnight build, checkpoint 1)._

## Done
- Project skeleton: 94-district registry, cached/throttled HTTP fetcher, source + gap manifests,
  data contract (`docs/DATA_CONTRACT.md`), Makefile, SPEND ledger ($0).
- Environment: network allowlist for all free data hosts; CourtListener token stored as a proxy-injected secret.
- Front-end foundation (Vite + TypeScript): design system with light and dark themes, app shell and routes,
  choropleth map with a custom composite projection (insets for AK, HI, PR + USVI, Guam, NMI), zoom controls,
  tooltip, legend, table view, sparkline, year slider, glossary (47 entries), and the Learn primer with diagrams.
  First map paint measured at 0.3-0.5 s (0.9-1.4 s with 4x CPU throttling). See `docs/lanes/frontend.md`.
- Boundaries lane: statute parsed (28 U.S.C. 81-131, 48 U.S.C. territorial courts); every county-equivalent
  assigned to one district; Yellowstone (D. Wyo.) and the Fort Bragg / Butner carve-outs (E.D.N.C.) handled;
  TopoJSON for national and zoomed views. See `docs/lanes/boundaries.md`.

## In progress
- Workflow 1 (data): boundary audit, then judges + population, then courthouses + CourtListener cases;
  in parallel FCMS, then USSC, then IDB, then a statistics audit.

## Blocked / notes
- `data/processed/fcms/` is not tracked yet: its CSV is 41 MB, over the 20 MB limit. One earlier commit on this
  branch contains that file; removing it from history needs a force-push, which was not allowed, so it stays.
