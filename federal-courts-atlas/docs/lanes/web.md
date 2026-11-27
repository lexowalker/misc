# Lane report: web data (`public/data/`)

The web lane turns the processed lane tables into the small, static JSON files the site reads at runtime. It
reads only `data/processed/*` and `data/sources/*.json` (plus, read-only, the boundaries and courthouses lanes'
`public/data/geo/divisions.json` and `geo/courthouses.json`). It never fetches anything and never calls a model.

- **Rebuild:** `make web` (= `PYTHONPATH=. .venv/bin/python -m pipeline.web.build`, about 6 seconds).
- **Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_web.py` (145 tests) and
  `tests/pipeline/test_data_audit_fixes.py` (16 tests, data audit of 2026-11-27). The whole pipeline suite passes
  (1,228 tests on 2026-11-27). Front end: `npm run typecheck`; e2e `tests/e2e/web-data.spec.ts` (10 tests)
  plus the existing suite (50 passed, 4 skipped by design).
- **Deterministic:** two runs on the same inputs give byte-identical files (tested by hashing every file before and
  after a rebuild). Dictionaries are written with sorted keys; `manifest.json` uses the newest source retrieval date
  as its build date rather than the clock.
- **Dependencies:** none beyond `requirements.txt` (pandas, pyarrow). No npm packages added.

## What each file holds

| file | content | size |
|---|---|---|
| `variables.json` | The catalog: 43 map variables in four families, with copy, caveats, years and citations (below). | 78 KB |
| `values/<variable>.json` | `{variable, period_type, unit, years, values: {district: {year: value}}, ranks, ranked_of, rank_method, provenance, source_by_year, cell_sources?, cell_notes?, n_basis?, national?, national_source_by_year?, national_note?, national_derived_years?, derived, formula?, derived_years?, derived_cells?, basis_by_year?, formula_by_basis?}` | 38 to 390 KB each |
| `districts.json` | Keyed by id: registry fields, latest population (value, year, source, derived, formula; `population_approximate` and a note for mtd, idd, wyd, ncmd, nced; No data for the territories) and the 2020 Census count, counties `{geoid, name}`, statutory divisions `{name, ordinal, statute_section, counties: [geoid], places}`, places of holding court, statute sections, partial (carve-out) counties, courthouse ids, latest authorized judgeships, latest active and senior judges, `prev` / `next` (registry order, wrapping). | 306 KB |
| `judges.json` | `{_meta, <district>: [records]}`: every FJC service record on a current district court, oldest first. Public fields only: name, sort name, initials, appointing president and party exactly as FJC gives them, `party_of_appointing_president` (resolved for statutory reassignments, with `reassignment: true`, `party_note` and `president_of_record`), appointment kind, commission, recess appointment and service start dates, senior status date (and the effective date when it differs), service end date and reason, active service end, seat id. No photos, no performance statistics. Biography link template `https://www.fjc.gov/node/{nid}` in `_meta`. | 1.5 MB |
| `judges/<district>.json` | The same records for one district (up to 77 KB; under 1 KB for the territories), so a profile page does not load all 3,412. | |
| `cases/<district>.json` | The cases lane's items, normalized: `{district_id, district_name, retrieved_at, selection, source_ids, publisher, items: [{id, kind: docket or opinion, item_type, case_name, url, date_filed, date_terminated, docket_number, docket_type, nature_of_suit, cause, court_id, opinion_status, source_id}], note?}`. | 1 to 5 KB |
| `profiles/<district>.json` | `distinctive` (paragraph, sentences with claims, the size-and-circuit context sentence, method), `key_stats` (one row per catalog variable: latest year, value, rank, ranked_of, national, full series, derived flag, sources, note), `case_mix` (civil nature-of-suit mix and criminal offense mix for the latest IDB year with national shares, and the USSC four-way sentencing composition by year). | 31 to 37 KB |
| `sources.json` | Every source id referenced by any public file (values, profiles, districts, judges, cases, and the geo files' `source_id`/`source_ids`), keyed by id: `lane, url, dataset, publisher, vintage, retrieved_at`. No local paths or hashes. Plus three citation "series" records (below). 910 entries. | 381 KB |
| `manifest.json` | `version` (first 10 hex of a hash over all file hashes), `build_date`, counts, and `files: {path: {sha256, bytes}}` for every file under `public/data/` (including geo/ and search/). | 44 KB |

**First paint.** The home page needs `variables.json` (78 KB) and the default variable's values file
(`civil_disposition_months`, 67 KB), plus the boundaries lane's topology. Tested under 250 KB for the two web files.
`sources.json` loads after the map, for the source chip.

### Citation series records

The source chip on the map lists a variable's `source_ids`. Listing 22 FCMS PDFs (or 682 USSC files) there would be
unreadable, so `variables.json` cites three series records, written to `data/sources/web.json` and copied into
`sources.json`: `web_series_fcms`, `web_series_ussc`, `web_series_census_popest`. Each has `kind: "series"` and a
`members` list of the per-file sources it groups; it is a citation record, not a download. Every individual value
still names its own file: `source_by_year[year]` gives the default source list for a year and `cell_sources` lists
any cell that differs (for example each district's own USSC packet in FY 1995 to 2001, or Puerto Rico's population
file). IDB and FJC variables cite their single file directly. A test checks that every provenance id of every
values file is a member of the variable's cited series.

## Variable choices and why

Values are copied exactly as they appear in the lane observation tables (no rounding, no filling). Missing cells are
simply absent, so the UI shows No data. Every variable has at least 12 years.

| id | family | label | source (lane variable) | years | districts in latest year | derived |
|---|---|---|---|---|---|---|
| `civil_disposition_months` | speed | Median time to resolve a civil case | fcms `fcms_median_months_civil_filing_to_disposition` | 1999 to 2025 (27) | 94 | no |
| `criminal_disposition_months` | speed | Median time to resolve a felony case | fcms `fcms_median_months_criminal_felony_filing_to_disposition` (current method) | 2005 to 2025 (21) | 94 | no |
| `civil_trial_months` | speed | Median time from filing to civil trial | fcms `fcms_median_months_civil_filing_to_trial` | 1999 to 2025 (27) | 51 | no |
| `civil_over_3yrs_pct` | speed | Civil cases pending more than three years | fcms `fcms_civil_over_3yrs_pct` | 1999 to 2025 (27) | 94 | no |
| `weighted_filings_per_judgeship` | workload | Weighted filings per judgeship | fcms `fcms_weighted_filings_per_judgeship` (current weights) | 2010 to 2025 (16) | 91 | no |
| `filings_per_judgeship` | workload | Total filings per judgeship | fcms `fcms_filings_per_judgeship_total` (current method) | 2005 to 2025 (21) | 94 | no |
| `civil_filings_per_judgeship` | workload | Civil filings per judgeship | fcms `fcms_filings_per_judgeship_civil` | 1999 to 2025 (27) | 94 | no |
| `pending_per_judgeship` | workload | Pending cases per judgeship | fcms `fcms_pending_per_judgeship` (current method) | 2005 to 2025 (21) | 94 | no |
| `terminations_per_judgeship` | workload | Cases closed per judgeship | fcms `fcms_terminations_per_judgeship` (current method) | 2005 to 2025 (21) | 94 | no |
| `trials_per_judgeship` | workload | Trials completed per judgeship | fcms `fcms_trials_completed_per_judgeship` | 1999 to 2025 (27) | 94 | no |
| `vacant_judgeship_months` | workload | Vacant judgeship months | fcms `fcms_vacant_judgeship_months` | 1999 to 2025 (27) | 94 | no |
| `judgeships` | workload | Authorized judgeships | fcms `fcms_judgeships` | 1999 to 2025 (27) | 94 | no |
| `civil_filings_per_100k` | workload | Civil filings per 100,000 residents | web: `fcms_filings_civil` and `population_estimate` | 2004 to 2025 (22) | 91 | yes |
| `felony_defendants_per_100k` | workload | Felony defendants charged per 100,000 residents | web: `idb_crim_felony_defendants_filed` and `population_estimate` | 2000 to 2025 (26) | 91 | yes |
| `active_judges` | workload | Active judges in office | judges `judges_active` | 1950 to 2026 (77) | 91 | yes (judges lane) |
| `senior_judges` | workload | Senior judges in office | judges `judges_senior` | 1950 to 2026 (77) | 91 | yes (judges lane) |
| `jurors_avg_present` | workload | Average jurors present for jury selection | fcms `fcms_jurors_avg_present` | 1999 to 2025 (27) | 94 (93 in FY 2024) | no |
| `jurors_pct_not_selected` | workload | Jurors not selected or challenged | fcms `fcms_jurors_pct_not_selected` | 1999 to 2025 (27) | 94 (93 in FY 2024) | no |
| `within_range_pct` | sentencing | Sentenced within the guideline range | ussc `ussc_pct_within_range` | 1995 to 2025 (31) | 94 | FY 2004 to 2005 |
| `above_range_pct` | sentencing | Sentenced above the guideline range | ussc `ussc_pct_above_range_2018scheme` | 2014 to 2025 (12) | 94 | yes |
| `govt_below_range_pct` | sentencing | Below range, sponsored by the government | ussc `ussc_pct_govt_sponsored_below_range_2018scheme` | 2014 to 2025 (12) | 94 | yes |
| `nongovt_below_range_pct` | sentencing | Below range, not sponsored by the government | ussc `ussc_pct_non_govt_sponsored_below_range_2018scheme` | 2014 to 2025 (12) | 94 | yes |
| `above_range_pct_2006` | sentencing | Above range (FY 2006 to 2017 method) | ussc `ussc_pct_above_range` | 2006 to 2017 (12) | 94 | FY 2006 to 2009 |
| `govt_below_range_pct_2006` | sentencing | Below range, government (FY 2006 to 2017 method) | ussc `ussc_pct_govt_sponsored_below_range` | 2006 to 2017 (12) | 94 | FY 2006 to 2009 |
| `nongovt_below_range_pct_2006` | sentencing | Below range, other (FY 2006 to 2017 method) | ussc `ussc_pct_non_govt_sponsored_below_range` | 2006 to 2017 (12) | 94 | FY 2006 to 2009 |
| `substantial_assistance_pct` | sentencing | Substantial-assistance departures (§5K1.1) | ussc `ussc_pct_substantial_assistance_5k1` | 1995 to 2025 (31) | 94 | FY 2004 to 2005 |
| `early_disposition_pct` | sentencing | Early-disposition (fast-track) departures (§5K3.1) | ussc `ussc_pct_early_disposition_5k3` | 2006 to 2025 (20) | 94 | no |
| `mean_sentence_months` | sentencing | Average sentence | ussc `ussc_mean_sentence_months` | 2002 to 2025 (24) | 94 | yes (every year) |
| `median_sentence_months` | sentencing | Median sentence | ussc `ussc_median_sentence_months` | 2002 to 2025 (24) | 94 | yes (every year) |
| `prison_pct` | sentencing | Sentenced to prison | ussc `ussc_pct_prison` | 2002 to 2025 (24) | 94 | FY 2002 to 2017 |
| `patent_filings` | casemix | Patent cases filed | idb `idb_patent_filed` | 1988 to 2026 (39) | 94 | no |
| `patent_share_pct` | casemix | Share of the nation's patent cases | idb `idb_patent_share_of_national` | 1988 to 2026 (39) | 94 | yes |
| `pro_se_pct` | casemix | Civil cases with a self-represented party | idb `idb_civil_pct_pro_se` | 1999 to 2026 (28) | 94 | yes |
| `prisoner_petitions_pct` | casemix | Prisoner petitions, share of civil cases | idb `idb_civil_pct_prisoner_petitions` | 1988 to 2026 (39) | 94 | yes |
| `civil_trial_rate_pct` | casemix | Civil cases decided by trial | idb `idb_civil_trial_rate` | 1988 to 2026 (39) | 94 | yes |
| `criminal_trial_rate_pct` | casemix | Criminal defendants whose cases went to trial | idb `idb_crim_trial_rate` | 1996 to 2026 (31) | 94 | yes |
| `guilty_plea_pct` | casemix | Criminal defendants who pleaded guilty | idb `idb_crim_pct_guilty_plea` | 1996 to 2026 (31) | 94 | yes |
| `crim_immigration_pct` | casemix | Immigration charges, share of new defendants | idb `idb_crim_pct_immigration` | 1996 to 2026 (31) | 94 | yes |
| `crim_drugs_pct` | casemix | Drug charges, share of new defendants | idb `idb_crim_pct_drugs` | 1996 to 2026 (31) | 94 | yes |
| `crim_firearms_pct` | casemix | Firearms charges, share of new defendants | idb `idb_crim_pct_firearms_explosives` | 1996 to 2026 (31) | 94 | yes |
| `sentenced_drug_trafficking_pct` | casemix | Drug trafficking, share of people sentenced | ussc `ussc_pct_offense_drug_trafficking` | 1995 to 2025 (31) | 94 | no |
| `sentenced_immigration_pct` | casemix | Immigration, share of people sentenced | ussc `ussc_pct_offense_immigration` | 1995 to 2025 (31) | 94 | no |
| `sentenced_firearms_pct` | casemix | Firearms, share of people sentenced | ussc `ussc_pct_offense_firearms` | 1995 to 2025 (31) | 94 | no |

Choices, in brief:

- **Order and default.** `variables.json` is in family order (speed, workload, sentencing, casemix); the home page
  shows the first, the civil median. `featured: true` marks 15 variables for the profile's main stats block and the
  compare page's summary. Every catalog variable, featured or not, appears on the home variable switcher.
- **FCMS method breaks.** For the 10 variables the FCMS lane marks `method_sensitive` with `time_series_table =
  observations_current_method`, the web series read that table: FY 2005 to 2025 on the current (defendant) method,
  FY 2010 to 2025 for weighted filings on the revised case weights. The own-year FY 1999 to 2004 values on the old
  method are not spliced in (gap logged). Variables the FCMS lane marks as not method-sensitive use the default
  table from FY 1999.
- **Felony rate numerator.** FCMS felony filings switch between cases and defendants before FY 2012 and are not in the
  current-method table. The IDB count of felony defendants filed equals FCMS exactly in every defendant-method year
  (IDB lane, 1,504 of 1,504 cells), so it gives one consistent series from FY 2000 (first population year).
- **Civil rate numerator.** FCMS civil filings (FY 2004 on) as specified; the July 1 estimate of the same calendar
  year falls inside the fiscal year. Rates are rounded to one decimal; the formula is in the catalog and values file.
- **USSC four-way grouping.** The USSC printed within / above / government-sponsored below / non-government-sponsored
  below for FY 2006 to 2017 (BOOKERCD) and stopped with its FY 2018 method. The headline variables use the grouping
  rebuilt from the FY 2018 components for FY 2014 to 2025 (12 years, latest data, all derived). The printed FY 2006
  to 2017 series is kept as three separate `_2006` variables for the Booker-era story. They are never spliced; the
  USSC lane found them identical in the FY 2014 to 2017 overlap, which a profile test re-checks for every district.
  Within-range and §5K1.1 are one series from FY 1995, as the USSC lane publishes them; the Booker break is in
  `breaks` and caveats.
- **Offense mix.** IDB shares (most serious filing charge, FY 1996 to 2026, one coding scheme) are the main criminal
  case-mix variables. The three USSC offense shares are included as the brief asks, with the FY 2018 classification
  break in `breaks` and caveats; they are excluded from profile facts.
- **Not chosen.** USSC prison-only sentence length (a second convention, easy to confuse with the average sentence),
  IDB class-action share and acquittal share, and FCMS percent changes. All remain in the lane tables. (The two FCMS
  juror measures were added on 2026-11-27; see below.)
- **National figures** are copied from the lanes' national tables: FCMS "all district courts" pages, USSC national
  rows (with `national_derived_years` where the USSC lane computed them), IDB all-district totals (computed by the IDB
  lane from the same file; the values file says so). None is shown for per-capita rates, judge counts or the patent
  share (always 100).
- **Ranks** are computed here (1 = highest value, competition ranking, ties share the lowest number) over districts
  with data that year; `ranked_of` gives the count. Values are compared as the site displays them (the variable's
  `format`, rounded half away from zero like `Intl.NumberFormat`), so districts that show the same number share a
  rank. Until 2026-11-27 IDB shares were ranked at full precision, which gave districts showing the same share
  different ranks (4,143 district-year groups). Every variable's caveats say ranks are derived. The AO's
  published FCMS standings use the opposite direction for times and are not copied.

## Data audit fixes (2026-11-27)

Two independent data audits traced 70 displayed numbers to the raw files. Fixes made here and in the USSC lane:

- **USSC FY 2006 to 2009 range groups** (`above_range_pct_2006`, `govt_below_range_pct_2006`,
  `nongovt_below_range_pct_2006`). The atlas shows the exact share from the counts (S.D. Fla. FY 2008: 217 / 2,162 =
  10.0%); the USSC's packets for those years print the sum of the rounded sub-category percentages (10.1%). Those
  four years are now `derived_years` with basis `exact_share_of_published_counts` and a formula that says so, and the
  caveat no longer calls the series "the grouping the USSC printed". FY 2010 to 2017 packets print the exact share,
  so those years stay published. Values did not change.
- **USSC average and median sentence.** From FY 2011 the USSC prints whole months; the atlas computes one decimal
  from the datafiles (C.D. Cal. FY 2025 median 29.5, printed 30). FY 2018 to 2025 now carry basis
  `unrounded_published_statistic`, so both variables are derived in every year, with a catalog `formula`. National
  figures follow (`national_derived_years`). Values did not change.
- **Formula text** for `sum_of_published_components` now says the share is computed from the published counts and
  that adding the USSC's rounded component percentages can differ by 0.1.
- **Ranks at display precision** (above), and the profile engine judges ties and positions the same way. Six profile
  paragraphs changed as a result (ded, ncmd, nysd, nywd, vaed, wawd: a "tied for" added, or a fact that is a 3-way tie
  on the displayed value dropped). `key_stats` rows carry `rank_ties` (districts sharing the rank) so the profile can
  say "Tied for".
- **`preliminary_years`** on IDB catalog entries (FY 2026), so pages can label those years "(preliminary)".
- **Juror measures** `jurors_avg_present` and `jurors_pct_not_selected` (FCMS, workload family, not featured; values
  copied exactly; ranks; FCMS provenance). They show on the home switcher like every catalog variable and in the
  courtroom's jury box. The D.N.M.I. FY 2024 printed zeros (no jury selection held) stay absent, so that cell reads
  No data; the FCMS lane logs the gap (`data/gaps/fcms.json`) and a caveat explains it. FY 1999 to 2009 jurors-present
  values carry the AO's two decimals; the site shows one.

## Notes on cells

`cell_notes[district][year]` carries:

- FCMS cell caveats kept by that lane (`cell_caveats.csv`, `kept, flagged`): S.D. Fla. FY 2023 civil median printed
  as 0.0 months and E.D. Pa. FY 2004 to 2006 printed 1.0. Matched on variable, district, year and value.
- Small bases: shares and medians resting on fewer than 30 people (USSC `n_basis`) or cases (IDB `denominator`).
  `n_basis` itself is published for those variables.
- Approximate population for per-capita rates in mtd, idd, wyd, ncmd and nced.

## The "distinctive" paragraph (profiles)

A fixed template engine (`pipeline/web/profiles.py`), no language model:

1. For each catalog variable with a fact template, take the district's value in the variable's latest year.
2. Skip it if the cell has any note, rests on fewer than 50 cases or people, is zero, or is shared by more than two
   districts.
3. Keep it if the district is in the top or bottom three of all districts with data (position counted from the
   top or bottom, so ties read "tied for"). Otherwise keep it if it is the single highest or lowest in a circuit with
   at least three districts with data.
4. Pick up to three national facts (best position first, at most one per family on the first pass, two on the
   second). If fewer than two, top up with circuit facts from other families.
5. Each sentence reads "In FY 2025, the median civil case took 4.9 months from filing to disposition, the shortest
   of 94 districts." Consecutive sentences for the same year open "That year," then "Also in FY 2025,". Every
   sentence stores its claims `{variable, year, value, rank, ranked_of, source_ids, derived, formula, direction,
   position, scope, tied, circuit?}`.
6. A district with no qualifying fact gets the size-and-circuit sentence ("The U.S. District Court for the ... is
   one of 9 district courts in the Fourth Circuit. In FY 2025, it had 11 authorized judgeships."), also always
   available as `distinctive.context`.

Result: 91 districts have outlier sentences (66 with two, 17 with three, 8 with one), 3 use the size sentence.
`test_every_profile_claim_reverifies` re-checks every claim against the values files (value, rank, ranked_of,
position from top or bottom, tie flag, circuit extreme, sources, formula for derived cells), that the formatted
number appears in the sentence, and that no paragraph contains a judge's name or evaluative words.

Case mix in profiles uses the IDB mix tables for the latest IDB year (FY 2026 for all districts) and labels the
source and basis. Shares are recomputed as count / total, rounded to one decimal, and marked derived. The sentencing
composition gives both USSC series separately with a note.

## Caveats

- **FY 2026 (IDB only).** IDB values for FY 2026 have no AO cross-check yet (IDB lane). The IDB variables and profile
  case mix use FY 2026 as their latest year; FCMS and USSC end at FY 2025.
- **IDB precision.** IDB shares are published with full floating-point precision, exactly as the IDB lane stores
  them; the UI rounds via `format`.
- **Speed ranks run high = slow.** Rank 1 is always the highest value, so for times rank 1 is the slowest court.
  `default_rank_direction: "asc"` on the speed variables tells pages to sort shortest first.
- **Cases** are copied as the cases lane left them (87 districts with 3 to 5 items; 7 with none and a note). A later
  run of the cases lane followed by `make web` fills them.
- **Judges** include pre-1950 records and the 10 pre-1965 D.S.C. records flagged `before_current_incarnation`.

## Gaps (`data/gaps/web.json`)

- `per_capita_territories_no_population`: per-capita rates are No data for gud, nmid and vid.
- `per_capita_population_approximate`: the five carve-out districts, shown with a note.
- `per_capita_no_national_rate`: no national per-capita figure (territories in the numerator, not the denominator).
- `fcms_method_sensitive_years_before_current_method`: FY 1999 to 2004 old-method values not spliced in.
- `ussc_four_way_grouping_scheme_split`: no four-way grouping before FY 2006; two separate series after.
- `judges_counts_national_not_summed`: no national judge count (judges serving two districts).
- `cases_none_published`: the seven districts with no CourtListener items yet.
- `no_value_latest_year:<variable>`: for each variable, the districts with No data in its latest year (civil trial
  median: 43 districts below the AO's 10-trial threshold; weighted filings: the territories; per-capita and judge
  counts: the territories).

## What was not checked

- The front-end pages other than home, table and sources do not read these files yet (district profile, compare,
  stories and courtroom belong to other lanes). The profile, judges and cases files are tested for shape and content
  in Python only.
- Values were compared with the lane tables, not re-read from the PDFs or datafiles; the lanes' own tests and the
  statistics audit cover that step.
- The explainers and caveats were written from the lane reports; the copy audit should read them once.
