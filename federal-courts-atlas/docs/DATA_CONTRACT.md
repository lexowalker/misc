# Data contract

Every pipeline lane and every front-end module follows this document. If you need to change it, say so in
your lane report instead of silently diverging.

## Ground rules (non-negotiable)

1. **Real data only.** Every number comes from a downloaded public file registered with
   `pipeline.common.manifest.register_source` (URL, dataset, publisher, vintage, retrieval date, sha256).
2. **Never invent, estimate, interpolate or fill in.** A value that cannot be sourced is omitted and logged with
   `record_gap`; the UI shows "No data".
3. **Derived values** (per-capita rates, shares computed from counts, ranks, changes) are computed only in the
   `web` lane or clearly marked `derived: true` with a `formula` string.
4. **Districts, not judges.** Statistics stay at district level. The judges lane lists judges' public
   biographical facts only (no photos, no judge-level performance statistics).
5. **No paid services, no LLM API calls, no accounts.** All HTTP goes through `pipeline.common.http.fetch`
   (cached, throttled, backs off). Nominatim ≤ 1 req/s. CourtListener: free tier, cached.
6. **Each lane writes only inside its own folders** (listed below) plus its own `requirements/<lane>.txt`,
   `tests/pipeline/test_<lane>*.py`, `docs/lanes/<lane>.md`, `data/sources/<lane>.json`, `data/gaps/<lane>.json`.
   Do not edit shared files (`pipeline/common/*`, `Makefile`, `requirements.txt`, `package.json`); report needed
   changes instead. Do not `git commit`; the orchestrator commits.

## Layout

```
pipeline/<lane>/build.py      entry point: `python -m pipeline.<lane>.build` (idempotent; cached downloads)
data/raw/                     download cache (git-ignored)
data/processed/<lane>/        lane outputs (parquet + csv, committed; keep each file < 20 MB; a large CSV that only
                              mirrors a committed parquet table may be git-ignored, e.g. fcms/observations*.csv)
data/sources/<lane>.json      source manifest fragment
data/gaps/<lane>.json         data-gap fragment
public/data/                  web-ready JSON (written ONLY by the `web` lane, except geo/ by boundaries)
docs/lanes/<lane>.md          lane report: what was fetched, how it was parsed, coverage, caveats, gaps
```

## District ids

Use `pipeline.common.districts` (94 districts, CourtListener-style ids: `vaed`, `txed`, `dcd`, `prd`, `vid`, `gud`, `nmid`).
Each lane that reads a source with its own district coding (AO/FJC office codes, USSC codes, FCMS names) builds a
crosswalk in its own package and has a unit test asserting all 94 ids map 1:1 (or logs the gap, e.g. a court that
did not exist in a year).

## Observations table (all statistical lanes)

`write_observations(lane, df)` validates and writes `data/processed/<lane>/observations.{parquet,csv}` with columns:

| column | meaning |
|---|---|
| `district_id` | registry id |
| `period` | int year label |
| `period_type` | `FY_SEP30` (12 months ending Sep 30: FCMS, IDB fiscal-year tallies, USSC fiscal year), `CY`, `12M_JUN30`, `12M_MAR31`, `12M_DEC31`, `SNAPSHOT_SEP30`, `JUL1_EST`, `APR1_CENSUS` |
| `variable` | snake_case id |
| `value` | number as published (FCMS medians in months, percents as 0–100) |
| `unit` | `months`, `cases`, `count`, `percent`, `per_judgeship`, `persons`, ... |
| `source_id` | key in `data/sources/<lane>.json` |
| `source_locator` | exact place in the source: file + table/page/sheet + row/column, or the filter used on a case-level file |

Lanes may also write richer detail tables (e.g. `nos_mix.parquet`), each documented in the lane report.

Each lane also writes `data/processed/<lane>/variables.json`: a list of
`{id, label, unit, period_type, description, source_ids, caveats, higher_means}` for every variable it emits.

## Geography (boundaries lane)

* `data/processed/boundaries/county_district.csv`: every county-equivalent in TIGER/Line (50 states, DC, PR,
  GU, VI, MP; plus AS flagged `district_id = ""` with reason) → exactly one `district_id`, with `statute_section`,
  `statute_division` (when the statute names one), `county_name`, `geoid`, `state`. Plus `vintage`.
* Special cases handled explicitly and tested: Virginia independent cities; St. Louis city (MO); Connecticut
  planning regions (2022+) vs legacy counties (whole state is one district either way); Alaska boroughs/census
  areas; Yellowstone NP portions in MT and ID → D. Wyo. (28 U.S.C. § 131); Kalawao County HI; etc.
* `public/data/geo/districts-lo.topo.json` (national view) and `public/data/geo/districts-hi.topo.json` (zoomed),
  unprojected lon/lat WGS84 TopoJSON with objects:
  `districts` (id = district_id, props: name, short, state, circuit),
  `states` (id = postal), `counties` (hi only; id = geoid, props: name, district_id, state, and `split_districts`
  such as `ncmd;nced` on the 8 statute-split counties only). Resolve a point to a district against `districts`,
  never against a county's `district_id`.
  The front end projects with a composite AlbersUSA + territories projection.
* `public/data/geo/divisions.json`: statutory divisions per district (from the statute text) with member counties.

## Places of holding court (courthouses lane)

`public/data/geo/courthouses.json`: `[{id, district_id, city, state, name, address, lat, lon, kind:
"place_of_holding_court"|"divisional_office"|"courthouse", statute_section, source_id, geocoder, geocode_match}]`.

## Web data (`web` lane only)

Built by `make web` (`python -m pipeline.web.build`); details and field lists in `docs/lanes/web.md`.

```
public/data/manifest.json            {version, build_date, files: {path: {sha256, bytes}}, ...}
public/data/districts.json           {district_id: registry fields + population (value, year, source, derived,
                                       approximate flag/note) + population_census_2020 + counties [{geoid, name}]
                                       + divisions [{name, ordinal, statute_section, counties: [geoid], places}]
                                       + places_of_holding_court + courthouse_ids + judgeships / judges_active /
                                       judges_senior (latest, with source) + prev / next}
public/data/variables.json           [{id, family: speed|workload|sentencing|casemix, label, short_label, unit, format,
                                       explainer, caveats: [..], source_ids, derived, formula|null, derived_years?,
                                       formula_by_basis?, higher_means, years, period_type, lane, lane_table,
                                       lane_variable | lane_inputs, default_rank_direction, breaks, featured,
                                       preliminary_years?, mdl_caveat?: {text, docket, district_id, cohorts,
                                       years, source_ids}, ...}]
public/data/values/<variable>.json   {variable, period_type, unit, years, values:{district_id:{year:value}},
                                       ranks:{district_id:{year:rank}} (1 = highest, ties share), ranked_of:{year:n},
                                       provenance:{source_id:{dataset, publisher, url, vintage, retrieved_at}},
                                       source_by_year:{year:[ids]}, cell_sources?, cell_notes?, n_basis?,
                                       national?, national_source_by_year?, national_note?, derived, formula?,
                                       derived_years?, derived_cells?, basis_by_year?, formula_by_basis?}
public/data/judges.json              {_meta, district_id: [FJC service records, public fields only]}
public/data/judges/<district>.json   {district_id, source_ids, note, judges: [...]} (same records, one district)
public/data/cases/<district>.json    {district_id, retrieved_at, selection, source_ids, items: [0-5 CourtListener items], note?}
public/data/profiles/<district>.json {distinctive: {paragraph, sentences: [{text, claims}], context, method},
                                       key_stats: [...], case_mix: {civil_nature_of_suit, criminal_offense,
                                       sentencing_composition, civil_disposition?, criminal_disposition?,
                                       sentenced_offense?}, mdl_context?}
                                       Mix blocks (civil_nature_of_suit, criminal_offense, civil_disposition,
                                       criminal_disposition, sentenced_offense): {year, period_type, total,
                                       national_total, groups: [{id, label, count, share, national_count?,
                                       national_share?, derived?, formula?}], source_ids, source, basis, derived,
                                       formula|null, preliminary?, other_years?: [{year, period_type, total,
                                       national_total, groups, source_ids, preliminary, national_note?}],
                                       national_note?: {text, year, cohort, docket, count, total, share,
                                       source_ids}, definitions?, order?: "fixed"} (other_years, definitions and
                                       order on the disposition and sentenced-offense blocks only)
                                       mdl_context: {intro, dockets: [{docket, label, name?, case_number?, court?,
                                       court_short?, name_source_id?, sentences: [{text, year, cohort, count, total,
                                       share, preliminary}], history: [{text, cohort, years, peak_year, peak_count,
                                       peak_total}], latest_year, years, years_text, current, source_ids}], years,
                                       focus_years, threshold_pct, rule, derived, formula, source_ids}
public/data/sources.json             {source_id: {lane, url, dataset, publisher, vintage, retrieved_at, kind?, members?}}
                                       for every id referenced by a public file, plus "series" citation records
public/data/search/                  search index (courthouses lane; see docs/lanes/courthouses.md)
```

Values are copied exactly from the lane observation tables. The web lane computes only per-capita rates (marked
`derived`, formula given), ranks, shares in the profile case mix, and the profile sentences (each with re-verifiable
claims).
