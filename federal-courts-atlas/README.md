# The Federal Courts Atlas

An interactive atlas of the 94 U.S. federal district courts: how fast they move, how much work they carry, how
they sentence, and what kinds of cases they hear. Every number comes from a cited public source.

## Run it

```bash
make setup        # Python venv + npm install
make data         # rebuild every dataset from public sources (cached under data/raw/)
make test         # pipeline unit tests
npm run dev       # open the atlas
npm run build     # static site in dist/
```

## Where things are

- `pipeline/` — Python data pipeline, one package per source lane. See `docs/DATA_CONTRACT.md`.
- `data/processed/` — tidy outputs (committed). `data/raw/` — download cache (not committed).
- `public/data/` — web-ready JSON consumed by the site.
- `src/` — the Vite + TypeScript site.
- `SOURCES.md`, `DATA_GAPS.md`, `VERIFICATION.md`, `PROGRESS.md`, `SPEND.md` — provenance and status.
