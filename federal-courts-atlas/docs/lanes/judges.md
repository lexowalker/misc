# Lane report: judges

FJC Biographical Directory of Article III Federal Judges → one row per (judge, district-court appointment)
on the 91 Article III district courts, plus September 30 counts of active and senior judges per district,
1950–2026.

Rebuild: `PYTHONPATH=. .venv/bin/python -m pipeline.judges.build` (idempotent; every download is cached by
`pipeline.common.http.fetch`). Tests: `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_judges.py`
(23 tests, green).

**No photographs** are downloaded, stored or referenced. The lane fetches only the CSV export files and four FJC
text pages. `fjc_biography_url` links to the judge's FJC biography page (text). The web lane decides whether to show it.

## Sources

All are registered in `data/sources/judges.json` with URL, retrieval time and sha256.

| source_id | URL | Use |
|---|---|---|
| `fjc_federal_judicial_service_csv` | https://www.fjc.gov/sites/default/files/history/federal-judicial-service.csv | **Primary.** One row per Article III service record (4,782 rows, 3,523 of them on district courts). Nightly export; file Last-Modified Thu, 26 Nov 2026 06:05:22 GMT. |
| `fjc_demographics_csv` | https://www.fjc.gov/sites/default/files/history/demographics.csv | Name parts only (Last, First, Middle Name, Suffix), joined on `nid`. |
| `fjc_judges_flat_csv` | https://www.fjc.gov/sites/default/files/history/judges.csv | Cross-check only. For every service record, the court name, commission date, recess date, senior status date, termination date and appointing president in the flat file (columns suffixed `(Sequence)`) must equal the relational file. 23,910 checks pass, 0 mismatches. The build stops on any mismatch. |
| `fjc_export_page` | https://www.fjc.gov/history/judges/biographical-directory-article-iii-federal-judges-export | Field definitions: nid, Seat ID, Appointment Title, Reappointing President, and the rule that a termination date "due to appointment to another court" is the oath date for the new court. The build checks that the three CSVs are still linked from it. |
| `fjc_leghist_*` (AK, HI, PR, CA, FL, LA, IL, SC) | e.g. https://www.fjc.gov/history/courts/us-district-courts-districts-south-carolina-legislative-history | FJC "Legislative History" pages for the courts whose current form began after 1950. The build checks that each page states the date in the table below. It also checks that no FJC service record in that district starts earlier. |

## Parsing method

1. **Read** `federal-judicial-service.csv` as text. Strip whitespace. Parse all date columns as ISO
   `YYYY-MM-DD`. The export page says the CSVs use mm/dd/yyyy, but every date in this export is ISO. The parser
   rejects any other format.
2. **Crosswalk** (`pipeline/judges/crosswalk.py`). FJC names every district court
   "U.S. District Court for the <name>".
   - For the 91 Article III districts, `<name>` is exactly the registry `name`, e.g.
     "Eastern District of Virginia". The modern name of every district is found in the export.
   - One variant maps to `dcd`: "U.S. District Court for the District of Columbia (Supreme Court of the District
     of Columbia)" (39 records). The Supreme Court of the District of Columbia was the same court under its
     pre-1936 name. Its justices served on into the renamed court without a new FJC record, some until 1965, so
     they must count toward D.D.C.
   - 31 other district-court names are courts that no longer exist (111 records), e.g. District of Kentucky,
     Eastern District of Illinois (1905–1979), Eastern and Western Districts of South Carolina (1912–1965). Each
     is listed explicitly. They go to `historical_court_service.csv` with no `district_id`.
   - An unknown name stops the build.
   - D.V.I., D. Guam and D.N.M.I. never appear: they are Article IV courts.
3. **Names.** Joined from `demographics.csv` on `nid` (unique; every service nid is present).
4. **Service start** = the earlier of the recess appointment date and the commission date. A recess appointee
   serves from the recess commission. FJC has no oath dates.
5. **Statutory reassignments and assignments.** When Congress moved sitting judges to a new or reorganized
   district, FJC writes a new service record with Appointing President = Party =
   "None (reassignment)" (or "None (assignment)"). Examples: C.D./E.D. Cal. 1966, D.S.C. 1965, C.D./S.D. Ill. 1979.
   - `resolved_appointing_president` and `resolved_appointing_party` take the values from the judge's own prior
     record. For a reassignment, that is the record whose termination is "Reassignment" with a termination date
     equal to the new start. For an assignment, it is the concurrent record that began earlier. Chains are
     followed.
   - `party_resolution` names the FJC `Sequence` of the record used (72 records). The FJC fields themselves are
     kept unchanged in `appointing_president` and `appointing_party`.
6. **Senior status carried across a reassignment.** Four district judges were already senior when reassigned.
   FJC gives them seat ids ending `SR` (e.g. William M. Byrne Sr., `CACDSR`) and no senior status date on the new
   record. Their `effective_senior_status_date` is the reassignment date, with
   `senior_status_basis = senior_before_reassignment`. Every district-court `SR` seat is checked to be covered.
7. **Counts.**
   - For each Sep 30 from 1950 to the latest Sep 30 before the export date (2026), the build takes the records
     mapped to each district (for `scd`, only records starting on or after the 1965 reorganization).
   - It counts **distinct judges (`nid`)**, not records, so the four pre-1950 D.C. promotions that overlap by a
     few days cannot double count.

## Output files (`data/processed/judges/`)

| File | Rows | Content |
|---|---|---|
| `district_judges.csv` / `.parquet` | 3,412 records, 3,263 judges | One row per FJC service record on a current Article III district court, 1789-09-26 to 2026-11-23. |
| `historical_court_service.csv` | 111 | Same columns for district courts that no longer exist (`district_id` empty). |
| `court_crosswalk.csv` | 123 | Every FJC district-court name, with `district_id`, `status` (`current` / `current_variant` / `historical`), number of records, first and last service start, last termination, open records, note. |
| `observations.parquet` / `.csv` | 27,428 | Sep 30 counts (contract format). |
| `variables.json` | 4 | One entry per observation variable. |
| `build_summary.json` | | Counts, series start years, and results of the legislative-history checks. |

### `district_judges` columns

| Column | Definition |
|---|---|
| `fjc_nid` | FJC Node ID (unique judge id; biography at `https://www.fjc.gov/node/<nid>`). |
| `fjc_sequence` | FJC `Sequence`: order of this record among the judge's Article III service records. |
| `judge_name` | FJC "Judge Name" ("Last, First Middle"). |
| `last_name`, `first_name`, `middle_name`, `suffix` | From demographics.csv. |
| `district_id`, `district_short` | Registry id and short name. |
| `fjc_court_name`, `court_name_status` | Court name as in FJC; `current` or `current_variant` (D.C. Supreme Court name). |
| `before_current_incarnation` | True for the 10 D.S.C. records from before the court's 1965 re-creation (1789–1912 District of South Carolina). They are kept for timelines and excluded from counts. |
| `appointment_title` | FJC "Appointment Title" (Judge; Associate Justice / Chief Justice for the D.C. Supreme Court). |
| `appointing_president`, `appointing_party` | As given by FJC, unchanged. |
| `reappointing_president`, `reappointing_party` | As given by FJC (recess appointee later confirmed under another president; 4 records). |
| `appointment_kind` | Derived: `nomination`, `recess_appointment` (has a recess appointment date), `statutory_reassignment`, `statutory_assignment`. |
| `resolved_appointing_president`, `resolved_appointing_party`, `party_resolution` | See step 5. Equal to the FJC fields unless `party_resolution` starts with `from_prior_record_seq_`. |
| `seat_id` | FJC Seat ID (court + seat number + order of succession), e.g. `VAED0702`. |
| `statute_authorizing_new_seat` | FJC field. |
| `recess_appointment` | True if FJC gives a recess appointment date. |
| `recess_appointment_date`, `nomination_date`, `confirmation_date`, `commission_date` | FJC dates (ISO). |
| `service_start_date` | Derived: min(recess appointment date, commission date). Empty for one confirmed but not yet commissioned judge (Courtney Leigh Coker, N.D. Tex., confirmed 2026-11-20). |
| `chief_judge_begin_year` … `chief_judge_2_end_year` | FJC years of service as chief judge. |
| `senior_status_date` | FJC "Senior Status Date". |
| `effective_senior_status_date`, `senior_status_basis` | See step 6; otherwise equal to `senior_status_date`. |
| `termination_reason`, `termination_date` | FJC "Termination" and "Termination Date". Appointment to another court ends on the oath date for the new court (FJC convention). |
| `active_service_end_date` | Derived: earliest of `effective_senior_status_date` and `termination_date`. |
| `duty_station` | Always empty: not in the FJC export (gap). |
| `fjc_biography_url` | Link to the FJC text biography. |

## Variables (observations, lane `judges`, `period_type = SNAPSHOT_SEP30`, unit `count`)

All four are **derived** from public FJC dates (`derived: true`; the formula is in `variables.json`). The
"date" is September 30 of `period`. The counting convention is end of day: a record counts if
`service_start_date ≤ date` and (`termination_date` is empty or `> date`).

| id | Exact definition |
|---|---|
| `judges_active` | Distinct `nid` in service on the date whose `effective_senior_status_date` is empty or later than the date. |
| `judges_senior` | Distinct `nid` in service on the date whose `effective_senior_status_date` is on or before it (and not active under another record in the same district). |
| `judges_active_appointed_dem` | `judges_active` with `resolved_appointing_party == "Democratic"`. |
| `judges_active_appointed_rep` | `judges_active` with `resolved_appointing_party == "Republican"`. Dem + Rep = active for every district-year (checked; no other party occurs among active judges after 1950). |

`source_locator` names the file, the FJC court name(s), the snapshot date and the counting rule.

### Coverage

| Variable | First year | Last year | Districts |
|---|---|---|---|
| `judges_active` | 1950 | 2026 | 91 |
| `judges_senior` | 1950 | 2026 | 91 |
| `judges_active_appointed_dem` | 1950 | 2026 | 91 |
| `judges_active_appointed_rep` | 1950 | 2026 | 91 |

82 districts run 1950–2026. Nine start later: the first Sep 30 on or after the district's first Article III
service record, checked against FJC's own legislative history pages.

| District | FJC legislative history (date checked on page) | First FJC service record | First snapshot |
|---|---|---|---|
| akd | Statehood act effective Jan. 3, 1959 | 1960-02-19 | 1960 |
| hid | Statehood act effective Aug. 21, 1959 | 1960-10-13 | 1961 |
| flmd | M.D. Fla. established by the act of July 30, 1962 | 1962-10-29 | 1963 |
| scd | Reorganized as one district by the act of Oct. 7, 1965 | 1965-11-01 | 1966 |
| cacd, caed | Established by the act of Mar. 18, 1966 | 1966-09-18 | 1966 |
| prd | Life tenure for future appointments, Sept. 12, 1966 | 1967-06-12 | 1967 |
| lamd | Established effective Apr. 16, 1972 | 1972-04-16 | 1972 |
| ilcd | Reorganization effective Mar. 31, 1979 | 1979-03-31 | 1979 |

Years before these are omitted rather than shown as zero, and recorded as gaps. Zeros inside a series are real.
D.V.I., D. Guam and D.N.M.I. have no values at all.

### Verification done

- **By eye, against the CSV.** I opened the raw rows and compared every field with the processed output for six
  judges: Sotomayor (S.D.N.Y. 1992–98), K. B. Jackson (D.D.C. 2013–21), C. B. Motley (S.D.N.Y. 1966, senior 1986,
  d. 2005), F. M. Johnson Jr. (M.D. Ala., recess appointment 1955-10-22), Learned Hand (S.D.N.Y. 1909–24) and
  L. Brinkema (E.D. Va. 1993–). The tests check them against both the raw CSV and the output.
- **Reassignment cases.** Checked by hand: W. M. Byrne Sr. (senior in S.D. Cal., reassigned to C.D. Cal. as
  senior) and R. W. Hemphill (E.D.S.C./W.D.S.C. → D.S.C., party resolved to Democratic).
- **Independent recount.** The tests recount `judges_active` and `judges_senior` for 156 district-years from the
  raw CSV with a separate implementation; all match.
- **Cross-lane sanity check (read-only).** I compared `judges_active` with FCMS `fcms_judgeships` for 2,457
  district-years, 1999–2025. Active judges are never more than one above authorized judgeships. The +1 cases are
  mostly the Missouri E.D./W.D. roving judgeship (FJC records the judge in both districts) and short overlaps.
  The median gap is 0, and the mean is −0.6 (vacancies).

## Definitional breaks and caveats

- These are **derived counts**, not an official AO series. They measure judges in office, not authorized
  judgeships, and are not "vacancies".
- **Roving judges** appointed to two or more districts have one FJC record per district and are counted in each.
  The FJC data has 63 overlapping pairs of district records in service after 1950. Most are E.D./W.D. Mo. (10),
  E.D./W.D. Ark. (8) and the three Oklahoma districts (24), then E.D./W.D. Wash., E.D./W.D. Ky. and N.D./S.D.
  W. Va. District counts therefore do not add up to a national head count.
- **Start date.** Service starts at commission or recess appointment. A judge confirmed but not yet commissioned is
  listed but not counted.
- **Party.** Appointing party is FJC's field. For statutory reassignments it is taken from the judge's prior
  record (72 records, flagged). The counts say nothing about any judge's views. They are the party of the president
  who made the appointment.
- **The FJC data is revised.** The export is regenerated nightly. In December 2023 FJC changed 98
  appointment-related termination dates (export page). Rebuilding with a newer export can shift a few counts.
- **D.D.C. before 1948.** The D.C. Supreme Court justices are counted as D.D.C. judges, so the 1950s D.D.C. counts
  include long-serving justices commissioned under the old court name.
- **Pre-1950 records** are complete in `district_judges.csv`, for the timeline. For D.S.C., the 1789–1912 records
  (`before_current_incarnation = True`) belong to an earlier court of the same name.

## Gaps (`data/gaps/judges.json`)

- `duty_station_not_in_fjc_export`: duty station is not a field in any of the three CSVs (every column checked).
- `territorial_courts_not_in_article3_directory`: D.V.I., D. Guam, D.N.M.I. (Article IV) have no judge records or
  counts.
- `judge_counts_before_first_article3_judge_<id>` (9 districts): years 1950 to the series start in the table
  above.
- `judge_counts_before_1950`: snapshot counts are not produced before 1950. Earlier court reorganizations (e.g.
  Virginia 1864–1871, Louisiana 1866–1881, California 1866–1886) would need curating. The service records
  themselves go back to 1789.

## Not checked

- Notes on the 27 historical courts other than E.D. Ill., E.D./W.D. S.C. and D. Cal. were not verified one by one.
  They are labels only and are never used as data.
- Historical court names map by exact string. If FJC renames a court in a future export, the build stops instead of
  guessing.
