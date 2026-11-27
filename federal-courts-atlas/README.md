# The Federal Courts Atlas

An interactive atlas of the 94 U.S. federal district courts: how fast they move, how much work they carry, how
they sentence, and what kinds of cases they hear. Every number comes from a cited public source. Where a value
could not be sourced, the site says "No data" and the gap is logged in `DATA_GAPS.md`.

The site has a national map with 40-plus measures in four families (the list is `public/data/variables.json`), a
time machine, a profile for every district, compare mode, five guided stories, a three.js courtroom, a Learn page
with a glossary, and place search.

## Run it

```bash
make setup        # Python venv (.venv) + npm install
npm run dev       # open the atlas (Vite dev server)
npm run build     # static site in dist/ (relative paths, hash routing: works from any subfolder)
npm run preview   # serve dist/ on :4173
```

## Data

```bash
make data         # every lane, in order: boundaries population fcms ussc idb judges courthouses cases stories web docs
make web          # just rebuild public/data/ from data/processed/ (run make stories first; web hashes every file)
make docs         # regenerate SOURCES.md and DATA_GAPS.md
```

- Order matters where a lane reads another's output: population and courthouses need boundaries, `web` needs all
  the others, and `stories` must run before `web` because `public/data/manifest.json` hashes every file.
- `data/raw/` is the download cache (about 3.4 GB, git-ignored). Nothing in it is fetched twice. Delete it only to
  force a true from-scratch download.
- `make cases` calls the CourtListener API. It needs a token, either in the environment variable
  `COURTLISTENER_API_TOKEN` or injected as a header by a proxy. It reuses every cached response, makes at most 45
  new requests per run by default (`CASES_RUN_BUDGET`), and stops when the free tier answers HTTP 429 instead of
  retrying. Run it again after the quota resets to fill the districts still missing cases.
- No paid services, no accounts, no model APIs. Spending is tracked in `SPEND.md` ($0).

## Tests

```bash
make test                # pipeline unit tests (pytest, tests/pipeline)
npm run typecheck        # TypeScript, strict
npm run test:e2e         # Playwright: builds the site, serves it with vite preview, runs desktop (1280) and mobile (375)
CI=1 E2E_PORT=4502 npx playwright test --trace off              # same, on your own port (one build folder per port)
CI=1 E2E_PORT=4502 npx playwright test tests/e2e/visual.spec.ts --update-snapshots   # refresh visual baselines
npm run check:palette    # color-blind and contrast check of the map color ramps
```

- Playwright is pinned to exactly **1.63.0** to match the Chromium build in `/opt/pw-browsers`. **Never run
  `playwright install`**; it would download a different browser and break the pin.
- `tests/e2e/visual.spec.ts` compares screenshots against baselines in `tests/e2e/visual.spec.ts-snapshots/`.
  They are specific to headless Chromium on Linux; see `docs/lanes/frontend.md` (Testing) before updating them.
- Other specs save review captures to `tests/e2e/__screenshots__/` (git-ignored, about 160 MB).

## Where things are

- `pipeline/`: Python data pipeline, one package per source. The rules every package follows are in
  `docs/DATA_CONTRACT.md`; each has a report in `docs/lanes/`.
- `data/processed/`: tidy outputs (committed). `data/sources/` and `data/gaps/`: per-source manifests.
- `public/data/`: web-ready JSON read by the site.
- `src/`: the Vite + TypeScript site. Design system, map and page notes: `docs/lanes/frontend.md`.
- `SOURCES.md` (every source file, with URL and retrieval date), `DATA_GAPS.md` (what is missing and why, starting
  with `docs/DATA_GAPS_NOTES.md`), `PROGRESS.md` and `SPEND.md`.
- Verification: `VERIFICATION.md` summarizes the data, boundary, statistics, copy and UI audits; the details are in
  `docs/audits/` (`data_audit.md`, `boundary_audit.md`, `stats_audit.md`, `copy_audit.md`, `ui_audit.md`).
