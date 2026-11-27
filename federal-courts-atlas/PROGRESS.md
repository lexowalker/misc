# PROGRESS

_Last updated: 2026-11-27 17:06 UTC. Pipeline, website and verification done; last small fixes running._

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
- `SOURCES.md` (1,550 source files) and `DATA_GAPS.md` generated from the lane fragments.

- **Website** (workflow 2, finished 12:00 UTC). Reports in `docs/lanes/`:
  - web data: `public/data/` with 41 map variables in four families (all 12+ years), 94 district files, judges,
    cases, profiles with fact-checked "distinctive" paragraphs (each sentence carries re-verifiable claims).
  - home (variable switcher with thumbnails, place search), district profiles, compare (2-4 districts), search,
    5 scrollytelling stories (Rocket Docket, Patent Capital, Border Districts, After Booker, Where Trials Went),
    three.js courtroom, sources page grouped by dataset.
  - integration: 279 e2e passed (9 skipped by design), 861 pipeline tests pass, first map paint 0.26-0.41 s
    (0.89 s at 4x CPU throttle); no em-dash in `src/` or `public/data/`.

- **Verification** (workflow 3, finished 14:45 UTC). See `VERIFICATION.md` and `docs/audits/`:
  - data audit: 70 displayed numbers traced to raw files by two independent auditors; 67 matched, 3 carried the
    wrong label (a USSC printed rounding vs our exact ratio) and are now marked derived. No value changed.
  - copy audit: about 1,400 sentences; 57 findings (5 strike, 34 fix, 18 nit), all resolved.
  - UI audit: 181 screenshots at 1280, 768 and 375 px in both themes; axe-core scan with 0 serious or critical
    violations; tap-to-open formulas for iOS; table view now shows cell notes and derived tags.
  - Now 43 map variables (two juror measures added for the courtroom jury box).
  - Tests: 1,228 pipeline, 321 e2e passed (9 skipped by design), typecheck clean, first map paint 0.40 s.

- **Gap closing** (workflow 4, finished 15:35 UTC): profiles now show "how cases end" (IDB dispositions) and
  "offenses of people sentenced" (USSC); mass-tort MDL context notes for 8 districts (docket names verified from
  GovInfo); IDB FY 2026 labeled preliminary on profiles; glossary tooltips on measure labels (53 terms); dated
  time-machine events; vertical map controls; README test instructions; 16 visual regression baselines.
  45 map variables. Recheck traced 31 new numbers to raw files (all match). Tests: 1,248 pipeline, 357 e2e passed
  (11 skipped by design) in 3 full runs; first map paint 0.28 s (0.91 s at 4x CPU).
- **Polish** (workflow 5, finished 17:04 UTC): MDL notes now cover every year from FY 2010 (the first year the FJC
  records carry a docket number) for 22 districts, with 26 docket names verified from GovInfo; a neutral MDL 2885
  caveat on the 11 national measures it distorts; compare year menu reads "FY 2026 (preliminary for IDB measures)";
  glossary entry for multidistrict litigation (54 terms); data contract and Makefile `idb-mdl` target. Recheck
  recounted all 150 MDL docket-years from the raw FJC file with its own code (all match) and fixed a clipped menu
  label. Tests: 1,252 pipeline, 361 e2e passed (11 skipped by design) in 4 of 5 full runs; one run had a single
  a11y scan timeout that did not recur in 10 isolated reruns. First map paint 0.29 s (0.80 s at 4x CPU).

## In progress
- Last small fixes (workflow 6): a stale gap note from the stories lane, plainer wording for the earlier-years MDL
  line, glossary popovers stay open when clicked after hover, another try at naming 13 MDL dockets from GovInfo,
  the social preview image title, and a fail-fast guard in the a11y scan helper. An independent recheck follows.

## Next
- Retry CourtListener for the 7 districts with no cases after the daily quota resets, then run `make data` end to end
  and record it in `VERIFICATION.md` (scheduled for 04:25 UTC Nov 28).

## Blocked / notes
- **CourtListener quota**: the free tier returned HTTP 429 with a daily Retry-After after about 124 requests.
  wied, wiwd, wyd, prd, vid, gud and nmid have no recent cases yet (logged in `DATA_GAPS.md`).
- **uscourts.gov court finder** pages return HTTP 403, so courthouses have no street addresses (logged).
- **Repository size**: FCMS CSV mirrors of the parquet tables are git-ignored (`make fcms` regenerates them). One
  earlier commit on this branch contains a 41 MB CSV; removing it from history needs a force-push, which was not
  allowed, so it stays.
