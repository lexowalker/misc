# Lane report: population

Census county populations (July 1 estimates and decennial counts) mapped to the 94 districts. The lane writes:

- July 1 estimates for every year 2000–2025 (91 districts: the 50 states, D.C. and Puerto Rico).
- April 1 census counts for 2000, 2010 and 2020 (all 94 districts, including the three Island Area courts).
- A county-level tidy table.

**Reconciliation.** For every year, the sum over districts equals the published U.S. total (50 states + D.C.)
plus Puerto Rico, exactly.

Rebuild: `PYTHONPATH=. .venv/bin/python -m pipeline.population.build` (idempotent; downloads cached by
`pipeline.common.http.fetch`; about one minute from cache).

Tests: `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_population.py` (16 tests, green).

Inputs from the boundaries lane (read-only): `data/processed/boundaries/county_district.csv`,
`legacy_geoids.csv` and `split_counties.csv`.

## Sources

140 files, all from www2.census.gov, all registered in `data/sources/population.json` with URL, vintage,
Last-Modified, retrieval time and sha256.

**api.census.gov is not used.** It now returns a "Missing Key" page without an API key, and getting a key needs an
account. The three such responses that landed in the cache were deleted.

### July 1 estimates (`population_estimate`, `JUL1_EST`)

| Years | County file (source_id) | Puerto Rico municipio file | Published totals used for reconciliation |
|---|---|---|---|
| 2000–2009 | [co-est00int-tot.csv](https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/county/co-est00int-tot.csv) (`census_co_est00int_tot`), 2000–2010 intercensal | [prm-est00int-agesex-5yr.csv](https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/puerto-rico/prm-est00int-agesex-5yr.csv), SEX=0 AGEGRP=0 | U.S.: [st-est00int-alldata.csv](https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/state/st-est00int-alldata.csv), United States row. PR: [prc-est00int-agesex.csv](https://www2.census.gov/programs-surveys/popest/datasets/2000-2010/intercensal/puerto-rico/prc-est00int-agesex.csv), AGE=999. States: SUMLEV 040 rows of the county file. |
| 2010–2019 | [cc-est2020int-agesex-all.csv](https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/intercensal/county/asrh/cc-est2020int-agesex-all.csv) (`census_cc_est2020int_agesex_all`), 2010–2020 intercensal. YEAR 2–11 = 7/1/2010–7/1/2019. | [cc-est2020int-agesex-72.csv](https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/intercensal/county/asrh/cc-est2020int-agesex-72.csv), same YEAR codes | U.S.: [nc-est2020int-agesex-res.csv](https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/intercensal/national/asrh/nc-est2020int-agesex-res.csv), SEX=0 AGE=999. PR: the intercensal series publishes no separate commonwealth total, so the municipio sum is used. |
| 2020–2025 | [co-est2025-alldata.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv) (`census_co_est2025_alldata`), Vintage 2025 | [cc-est2025-agesex-72.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-agesex-72.csv). YEAR 2–7 = 7/1/2020–7/1/2025. | U.S. and PR: [NST-EST2025-ALLDATA.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv), SUMLEV 010 and STATE 72. States: SUMLEV 040 rows of both files. |

- YEAR codes and column meanings are taken from the Census file-layout PDFs, each registered as a
  `census_layout_*` source.
- **Vintage 2025 is used rather than the Vintage 2024 file named in the task.** Vintage 2025 is the latest release
  (March 2026). It covers 2020–2025 and supersedes Vintage 2024 for 2020–2024.

### Decennial counts (`population_census`, `APR1_CENSUS`)

| Year | Source | Field |
|---|---|---|
| 2000 | Census 2000 Demographic Profiles: [2khxx.zip](https://www2.census.gov/census_2000/datasets/demographic_profile/0_All_State/2khxx.zip) (all states, D.C.) and [2kh72.zip](https://www2.census.gov/census_2000/datasets/demographic_profile/Puerto_Rico/2kh72.zip) (PR) | V01 Total population. The record layout is from [profile-td.pdf](https://www2.census.gov/programs-surveys/decennial/2000/technical-documentation/complete-tech-docs/profile-td.pdf): RECTYP, SUMLEV, GEOCOMP, STATE, COUNTY, …, NAME, V01. U.S. total from the SUMLEV 010 row of the same file. |
| 2010 | 2010 Demographic Profile Summary File, one zip per state + PR (e.g. [al2010.dp.zip](https://www2.census.gov/census_2010/03-Demographic_Profile/Alabama/al2010.dp.zip)). U.S. total from [us2010.dp.zip](https://www2.census.gov/census_2010/03-Demographic_Profile/National/us2010.dp.zip). | DP0010001, joined to the geo header on LOGRECNO. The geo header's POP100 (cols 319–327, per [dpsf.pdf](https://www2.census.gov/programs-surveys/decennial/2010/technical-documentation/complete-tech-docs/summary-file/dpsf.pdf)) must equal DP0010001 for every record; the build stops otherwise. |
| 2020 | 2020 P.L. 94-171 Redistricting Summary File, one zip per state + PR (e.g. [al2020.pl.zip](https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Alabama/al2020.pl.zip); 52 files, 1.26 GB). U.S. total from [us2020.npl.zip](https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/National/us2020.npl.zip). | P0010001 (segment 1), joined on LOGRECNO. Must equal POP100 in the pipe-delimited geo header, whose 97-field order was taken from Figure 2-4 of the [technical documentation](https://www2.census.gov/programs-surveys/decennial/2020/technical-documentation/complete-tech-docs/summary-file/2020Census_PL94_171Redistricting_StatesTechDoc_English.pdf). |
| Island Areas 2000, 2010 | 2010 Census press tables CB11-CN.178/179/180 ([cb11cn179-guam.xls](https://www2.census.gov/programs-surveys/decennial/tables/2010/island-areas/cb11cn179-guam.xls), cnmi, vi): "Population … 2000 and 2010" | Rows for the territory and each county-equivalent: Guam; CNMI's 4 municipalities; USVI's 3 islands. |
| Island Areas 2020 | 2020 Island Areas Population and Housing Unit Counts, Table 1 ([guam-phc-table01.csv](https://www2.census.gov/programs-surveys/decennial/2020/data/island-areas/guam/population-and-housing-unit-counts/guam-phc-table01.csv), CNMI, USVI) | 2020 column. Its 2010 column must equal the 2010 press table for every unit; it does, for all 8. |

**Why not the 2020 count printed in the estimates files?** The intercensal file's "4/1/2020 Census population"
(YEAR 12) comes from the Modified Age and Race Census file. Nationally it is 331,449,390, not the P.L. 94-171
count of 331,449,281, so the build does not label it a census count.

**Ohio, 2010.** The Census CDN answered every request for
https://www2.census.gov/census_2010/03-Demographic_Profile/Ohio/oh2010.dp.zip with a "Request Rejected" page
(HTTP 200, repeated after a pause).
- The same Demographic Profile tables were read from the "with SF1 geographies" release,
  https://www2.census.gov/census_2010/03-Demographic_Profile_with_SF1geos/Ohio/oh20101.dp.zip. This is recorded in
  that source's notes.
- Ohio's 88 county counts still pass the POP100 = DP0010001 check, the state total check and the cross-check below.
- `sources.get()` now detects such block pages in any download, removes them from the cache and refetches once.

## Parsing method

1. **Read each file with the documented key.** The county row is SUMLEV 050 (GEOCOMP 00 for decennial files).
   PR municipios use STATE 72. Only the total-population column is read: `POPESTIMATE<year>`; or POPESTIMATE at
   a YEAR code (SEX=0, AGEGRP=0 for the 2000s PR file); or V01, DP0010001 or P0010001 for the censuses.
   Values are integers exactly as printed; any non-integer stops the build.
2. **Map GEOID → district** with `county_district.csv`, plus `legacy_geoids.csv` for retired codes.
   - The two files must not share a GEOID.
   - A legacy GEOID whose area overlay spans two districts may not be used (none is).
   - A GEOID that maps to nothing stops the build, as does one with an empty district (American Samoa).
   - So does a duplicate (GEOID, period, period type).
   - **Every county row in every vintage maps to exactly one district.**
3. **Legacy codes actually used:**
   - Connecticut's eight counties, 09001–09015: the 2000–2019 estimates and all three censuses. From 2020 the
     Vintage 2025 file uses the nine planning regions, 09110–09190. The whole state is `ctd` either way.
   - Alaska:
     - 02261 Valdez-Cordova and 02270 Wade Hampton: 2000–2009 estimates and the 2000/2010 censuses.
     - 02201, 02232 and 02280: Census 2000 only.
     - The 2010–2020 intercensal file is already on 2020 geography (02063 Chugach, 02066 Copper River, 02158 Kusilvak).
   - Virginia: 51515 Bedford city (2000–2009 estimates; censuses 2000, 2010) and 51560 Clifton Forge (Census 2000)
     → `vawd`.
   - South Dakota: 46113 Shannon (2000–2009 estimates; censuses 2000, 2010) → `sdd`. 46102 Oglala Lakota from 2010
     on.
   - 12025 Dade and 30113 Yellowstone NP do not occur in any vintage used.
4. **District value** = sum of the county values assigned to it (`derived: true` in `variables.json`). Each
   district-period draws on exactly one source file (enforced), which is its `source_id`. The `source_locator`
   names the file, the number of county cells and the legacy codes used. Every cell is in
   `county_population.parquet`, with its own file / row / column locator.
5. **Reconciliation (fails the build if anything is off by even one person):**
   - Districts (excluding D. Guam, D.V.I., D.N.M.I.) = published U.S. total + published PR total, every year.
   - Counties of the 50 states + D.C. = published U.S. total.
   - PR municipios = published PR total (where one is published).
   - Island Area units = published territory total.
   - Counties of each state = the published state total wherever the same release prints one: 1,275 state-year
     checks (2000s county file, Vintage 2025 county file, NST-EST2025, 2000/2010/2020 census state records).
6. **Cross-check.** The `CENSUS2010POP` printed in the 2000–2010 intercensal county/PR files equals the 2010
   Demographic Profile count for all 3,221 county-equivalents (`cross_checks.csv`).

### Verified by eye against the raw files

- Autauga County AL: 2025 estimate 61,920 (co-est2025 row) and 2020 count 58,805.
- D.C. 2020 PL POP100: 689,545.
- Los Angeles County: POPESTIMATE2000 9,538,191 and 2000 count 9,519,338.
- D.C. POPESTIMATE2009: 592,228.
- Guam 2000/2010/2020: 154,805 / 159,358 / 153,836.
- Published U.S. census totals: 281,421,906 / 308,745,538 / 331,449,281.
- PR census totals: 3,808,610 / 3,725,789 / 3,285,874.
- State census totals match the official figures: Alaska 626,932 / 710,231 / 733,391 and Wyoming 493,782 /
  563,626 / 576,851 (single-district states).

## Outputs (`data/processed/population/`)

| File | Rows | Content |
|---|---|---|
| `observations.parquet` / `.csv` | 2,648 | Contract format; lane `population`. |
| `county_population.parquet` | 93,437 | `geoid, state, state_fips, county_name` (as printed in the source), `district_id, geoid_status` (current/legacy), `split_county, split_districts, period, period_type, value, source_id, source_locator`. |
| `reconciliation.csv` | 29 | One row per year and type: county sums, published U.S. / PR / territory totals with source and locator, district sums, differences (all 0). |
| `state_reconciliation.csv` | 1,275 | County sum vs published state total (all differences 0). |
| `cross_checks.csv` | 4 | Island Areas 2010 (two tables) and 2010 county counts (two products); all match. |
| `carveout_blocks_2020.csv` | 8 | Derived: 2020 Census population in each statutory carve-out (see caveats). |
| `variables.json`, `build_summary.json` | | |

## Variables

| id | period_type | unit | Definition |
|---|---|---|---|
| `population_estimate` | `JUL1_EST` | persons | Sum over the district's counties (PR municipios) of the Census Bureau's July 1 resident population estimate. 2000–2009: 2000–2010 intercensal. 2010–2019: 2010–2020 intercensal. 2020–2025: Vintage 2025. |
| `population_census` | `APR1_CENSUS` | persons | Sum over the district's county-equivalents of the decennial census resident population count on April 1 (2000, 2010, 2020), as first tabulated. |

Both are `derived: true` with formula "sum over counties assigned to the district of the county's published …"
(the Census Bureau does not publish district totals).

### Coverage

| Variable | First | Last | Districts | Note |
|---|---|---|---|---|
| `population_estimate` | 2000 | 2025 | 91 | Every year. No values for gud, vid, nmid (no annual estimates exist). |
| `population_census` | 2000 | 2020 | 94 | 2000, 2010 and 2020 only. |

## Definitional breaks and caveats

- **Series breaks at 2010 and 2020.**
  - 2000–2009 and 2010–2019 are intercensal estimates, revised to be consistent with the censuses at both ends.
  - 2020–2025 are postcensal Vintage 2025 estimates. They are revised every year, and replaced by intercensal
    estimates after 2030.
  - The 7/1/2010 value is taken from the 2010–2020 intercensal series. The 2000–2010 series prints a different
    7/1/2010 value, which is not used.
- **Estimates vs counts.** July 1 estimates are modeled by the Census Bureau and are not counts. Census counts here
  are as first tabulated: they exclude later Count Question Resolution corrections. They therefore differ slightly
  from the "estimates base" in the estimates files. For example, Los Angeles 2000 is 9,519,338 counted and
  9,519,315 as the estimates base.
- **Whole-county districts and the eight carve-outs.** A split county's whole population is counted in the
  district holding the rest of it: Fort Bragg / Camp MacKall and FCI Butner → E.D.N.C.; Yellowstone NP in MT and
  ID → D. Wyo. Census publishes no county-part figures for these areas. The size of the effect at the 2020 Census
  is in `carveout_blocks_2020.csv` (derived):
  - Method: 2020 blocks whose internal point lies in the TIGER/Line 2025 carve-out feature, the same features the
    boundaries lane used.
  - Results:
    - Durham County (FCI Butner): 2,477 of 324,833.
    - Hoke County (Fort Bragg): 8.
    - Gallatin County: 21.
    - Park County: 13.
    - Moore, Richmond, Scotland and Fremont: 0.
  - These sums are exact over blocks but approximate at feature edges. Each county's block sum equals its county
    count (checked).
  - This is a supplementary table, not an observation; no comparable split exists for the estimates or for
    2000/2010.
- **American Samoa** is in no judicial district and is excluded.
- **Puerto Rico 2010–2019.** The intercensal series publishes no commonwealth total. The PR part of the
  reconciliation is therefore the municipio sum, while the U.S. part uses the independently published national total.

## Gaps (`data/gaps/population.json`)

- `island_areas_no_annual_estimates`: gud, vid, nmid have no `population_estimate` for 2000–2025. The Census
  Bureau's estimates program does not cover them; only decennial counts exist.
- `split_county_carveout_population`: carved-out residents are not separated in either variable. The 2020
  magnitudes listed above are recorded in the gap's reason.

## Not checked / limits

- The Census 2000 and 2010 Island Areas counts come from press-release tables, not summary files. They agree with
  each other for 2010.
- The 2020 block-based carve-out figures were not compared with any published county-part count; none exists.
- The 2000 Demographic Profile CSV has no header row. Its field order comes from the technical documentation. It
  was confirmed by the U.S. row (281,421,906) and the reconciliation, not by a second layout source.
