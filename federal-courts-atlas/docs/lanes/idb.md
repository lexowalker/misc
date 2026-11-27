# Lane report: FJC Integrated Database (IDB)

**What it is.** Case-level federal court records from the Federal Judicial Center's Integrated Database,
aggregated to district x federal fiscal year (`period_type = FY_SEP30`, Oct 1 - Sep 30):

* **Civil** (one record per case): filings, terminations, patent filings, pro se, prisoner-petition and
  class-action shares, trial rates, nature-of-suit mix and disposition mix. **FY1988-FY2026**, all 94 districts.
* **Criminal** (one record per defendant): defendants filed and terminated, trial / plea / dismissal / acquittal
  shares, offense mix. **FY1996-FY2026**, all 94 districts.

FY2026 is included: the FJC posted files covering cases through September 30, 2026 on November 24, 2026. The AO
has not yet published its FY2026 tables, so FY2026 values have no published cross-check (see Gaps).

**Rebuild:** `PYTHONPATH=. .venv/bin/python -m pipeline.idb.build` (about 5 minutes from cache; the first run
also streams the two zips into Parquet extracts, about 5 more minutes).
**MDL docket table only:** `PYTHONPATH=. .venv/bin/python -m pipeline.idb.mdl` (about 40 seconds; reads the cached civil
extract, downloads nothing new except the GovInfo name records it has not cached yet). The full build runs it as its
last step.
**Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_idb*.py` (182 tests, 10 of them in
`test_idb_mdl.py`). Also `make idb-mdl`.
**Extra dependency:** `zipfile-deflate64` (requirements/idb.txt). The criminal zip uses Deflate64 (zip method 9),
which the standard-library `zipfile` cannot read.

## 1. Sources

Every file is downloaded through `pipeline.common.http.fetch` and registered in `data/sources/idb.json`, with its URL,
retrieval time (2026-11-27) and sha256.

| source_id | what | URL |
|---|---|---|
| `idb_civil_cv88on` | Civil cases filed, terminated and pending, SY1988-present. Cumulative tab-delimited file `cv88on.txt` (2.03 GB; 11,071,506 records). Coverage note on the page: "Cases terminated in SY 1988 through FY 2026 and cases pending as of September 30, 2026". | https://www.fjc.gov/sites/default/files/idb/textfiles/cv88on_0.zip |
| `idb_criminal_cr96on` | Criminal defendants filed, terminated and pending, FY1996-present. Cumulative snapshot file `cr96on.txt` (3.55 GB; 6,345,702 records): "Defendants filed, terminated, and pending in FY 1996 through FY 2026". | https://www.fjc.gov/sites/default/files/idb/textfiles/cr96on_0.zip |
| `idb_civil_codebook` | Civil Codebook 1988 Forward (Oct 2023) | https://www.fjc.gov/sites/default/files/idb/codebooks/Civil%20Codebook%201988%20Forward%2010252023.pdf |
| `idb_criminal_codebook` | Criminal Code Book 1996 Forward (Aug 2016) | https://www.fjc.gov/sites/default/files/idb/codebooks/Criminal%20Code%20Book%201996%20Forward.pdf |
| `idb_research_guide` | The Integrated Database: A Research Guide | https://www.fjc.gov/sites/default/files/IDB-Research-Guide.pdf |
| `idb_criminal_d2_labels` | D2 offense-code labels: the "Nature of Offense" list (284 codes) on the FJC interactive view | https://www.fjc.gov/research/idb/interactive/24/IDB-criminal-since-1996 |
| `ao_js44` | AO civil cover sheet JS 44 (Rev. 03/24): the nature-of-suit category headings | https://www.uscourts.gov/sites/default/files/js_044_-_civil_cover_sheet_1.pdf |
| `ao_nos_descriptions` | AO Civil Nature of Suit Code Descriptions | https://www.uscourts.gov/sites/default/files/document/nos_code_descriptions.pdf |
| `ao_jb_<table>_<FY>` (121 files) | AO *Judicial Business* tables C-1, C-4, D-1, D-4 (FY1997-2025) and D-2 (FY2009, 2014, 2019, 2024, 2025), used only for reconciliation. PDFs through FY2016; xlsx from FY2017. | `https://www.uscourts.gov/data-news/data-tables/<FY>/09/30/judicial-business/<table>` |

| `govinfo_uscourts_<court>_<case>` (26 records) | GovInfo "United States Courts Opinions" (USCOURTS) MODS metadata for the transferee court's MDL case, used only to verify a docket's litigation name and case number (section 4a). | `https://www.govinfo.gov/metadata/pkg/USCOURTS-<court>-<case>/mods.xml` |

Dataset pages used for discovery:
https://www.fjc.gov/research/idb/civil-cases-filed-terminated-and-pending-sy-1988-present and
https://www.fjc.gov/research/idb/criminal-defendants-filed-terminated-and-pending-fy-1996-present.
The FCMS lane's `data/processed/fcms/observations.csv` is read for district-level reconciliation.

## 2. Parsing method

### 2.1 Extraction (`pipeline/idb/extract.py`)

Each zip member is read as a stream, 500,000 lines at a time. Only the needed columns are kept and written to a
Parquet extract in `data/raw/idb_extract/` (git-ignored). The extract is keyed by the zip's sha256, so a rebuild
re-parses only when the FJC file changes. Codes become integers, and `MM/DD/YYYY` dates become dates. The criminal
file uses `01/01/1900` to mean missing, and those dates become null. Values that are not numeric and dates that
cannot be parsed are counted in a report next to the extract. In this vintage there were none.

* **Civil.** 638 civil lines have 47 or 48 fields instead of 46, because a quoted party name (PLT or DEF, fields
  22-23) contains a tab. Party names are not used. So every line is split on tabs, and the first 21 fields are
  taken from the left and the last 23 from the right. This is exact for every line; a line with fewer than 46
  fields would stop the build. The party-name columns are never extracted.
* **Criminal.** All 6,345,702 lines have exactly 144 fields. They are read with pandas, using only the needed
  columns, `dtype=str`, and no quote processing.

### 2.2 Civil file structure and cohorts (`pipeline/idb/civil.py`)

The cumulative civil file is the AO's termination extract for every statistical year from SY1988 to FY2026.
`TAPEYEAR` holds the year of termination. The file also holds the cases still pending on September 30, 2026
(`TAPEYEAR = 2099`, `STATUSCD = S`). The tape-year counts equal the AO's published terminations: for example,
FY2024 has 396,635 records and Table C-1 prints 396,635.

* **Termination cohort.** Every record with `TAPEYEAR != 2099` goes to the fiscal year of `TDATEUSE`, the
  codebook's "termination date used by AO". No records are removed: the AO counts a case that closed twice as two
  terminations. For FY1993 on, the `TDATEUSE` fiscal year equals `TAPEYEAR` on every record (0 mismatches,
  tested). FY1988 is the first complete fiscal year, because SY1988 begins July 1, 1987.
* **Filing cohort, de-duplicated.** Each case goes to the fiscal year of `FDATEUSE`, the codebook's "filing date
  used by AO". The codebook says cohorts built on this date match published tables. Key:
  `DISTRICT + OFFICE + DOCKET + ORIGIN + FILEDATE`.
  * The IDB guide says district, office and docket identify a case. ORIGIN and FILEDATE are added to the key
    because a reopened, remanded or returned case keeps its docket number but is a new filing, and the AO counts
    it again. Such a case has ORIGIN 3, 4 or 8-12, and the reopen record gets a new `FDATEUSE`.
  * 35,666 records (0.32%) repeat an earlier record's key with a different termination date. Most of them are
    in tape years 2016-2019.
  * The record with the latest `TAPEYEAR` is kept. Pending (2099) counts as the latest, and ties go to file order.
  * Result: 11,035,840 cases, of which 10,736,967 were filed in FY1988-FY2026.
  * Dropping the duplicates brings the FY2024 national count to 290,805, against 290,896 in C-1. Without
    de-duplication the count would be 291,005.
  * FY1988 is the first complete filing year. Every case filed on or after October 1, 1987 closed in SY1988 or
    later or is still pending.

### 2.3 Criminal file structure (`pipeline/idb/criminal.py`)

The criminal file is a stack of fiscal-year **snapshots**, `FISCALYR` 1996 to 2026. Each snapshot holds one record
for every defendant filed, terminated or pending during that year, so a long-running defendant appears in several
snapshots. The AO count flags apply within a snapshot. The FJC computed them back to FY1996, and they are present
on every record. Counts never cross snapshots: "filed in FY X" means `FISCALYR = X` and `CTFIL = 1`. This is the
codebook's own instruction for matching published tables. A filing or termination that also shows up in a
different snapshot is therefore never counted twice. Within a snapshot, 31,948 records share a defendant key, and
only one record of each pair carries the flag.

* `CTFIL = 1`: defendants whose proceedings began in the year, excluding inter-district (Rule 20/21) transfers.
  Within the snapshot, `CTFILTRN - CTFIL = 1` only for PROCCD 8, and for PROCCD 13 before FY2012.
* `CTTR = 1`: defendants whose cases closed in the year, excluding transfers out. `CTTRTRN - CTTR = 1` only for
  DISP1 = 0.
* The offense is `D2FOFFCD1`, the D2 code of the most serious filing charge. The disposition is `DISP1`.

These selections reproduce the AO's tables exactly; see section 6.

### 2.4 District crosswalk (`pipeline/idb/crosswalk.py`)

The two-character `DISTRICT` codes come from the codebooks' DISTRICT table: `00` = Maine ... `3A` = M.D. Fla.,
`7-` = Alaska ... `94` = N. Mariana Islands. Codes 21, 59 and 92 are unused. All 94 registry ids map 1:1. Tests
check each "code - label" pair against the text of both codebook PDFs and the registry's district names. Every
`DISTRICT` value in both files is in the crosswalk; an unknown code would stop the build. Written to
`district_crosswalk.csv`.

### 2.5 AO tables (`pipeline/idb/jb.py`)

PDF tables are converted with `pdftotext -layout`, and each line becomes a label plus trailing numbers. xlsx tables
are read cell by cell, and a `-` is read as 0. The layouts changed over the years, so columns are found by
structure rather than by position:

* **C-1.** The TOTAL row has 12 numbers through FY2016 (pending, commenced, terminated, pending, times 3) and 9
  from FY2017 (filed, terminated, pending, times 3). Every district row must have the same width, and every table
  must have 94 districts plus the total.
* **D-1.** "Total commenced" is the first index *i* where row[i] = row[i+1] + reopens + transfers and
  row[i+1] = felony + misdemeanor + other. "Total terminated" is the next such index. Through FY2016 the PDFs
  continue the columns on a second page that repeats the row labels, so the numbers from all occurrences of a
  label are joined in order. A footnote digit printed after a label ("NY,S 4") is removed.
* **D-4.** The TOTAL row must satisfy total = not convicted + convicted, not convicted = dismissed + acquitted by
  the court + acquitted by a jury, and convicted = guilty plea [+ nolo contendere, a separate column before
  FY2005] + court + jury.
* **D-2.** Each table prints five fiscal years. The category totals must add up to the table total. Where tables
  overlap, the latest table's value is used.
* **C-4.** On the "Total" row, "during or after trial" = non-jury + jury.

## 3. Variable definitions

All percents are 0-100 and are derived from counts, so `derived: true`. Each observation row carries
`numerator` and `denominator` columns alongside the contract's 8 columns. "Filing cohort" and "termination cohort"
are defined in section 2.

| id | unit | definition |
|---|---|---|
| `idb_civil_filed` | cases | Civil cases filed: filing cohort, all origins (original, removed, transferred in, MDL in, remanded, reopened). |
| `idb_civil_terminated` | cases | Civil termination records: termination cohort. |
| `idb_patent_filed` | cases | Filing cohort, NOS = 830 (Patent). |
| `idb_patent_incl_anda_filed` | cases | Filing cohort, NOS in {830, 835}. 835 = Patent - Abbreviated New Drug Application; the first filing is dated June 2017 (FY2017). |
| `idb_patent_share_of_national` | percent | 100 x district NOS 830 filings / national NOS 830 filings in the same FY. |
| `idb_civil_pct_pro_se` | percent | 100 x filed cases with PROSE in {1, 2, 3} / filed cases with PROSE in {0, 1, 2, 3}. PROSE 1 = one or more pro se plaintiffs only, 2 = one or more pro se defendants only, 3 = both. So this is "at least one self-represented party on either side". FY1999+. A district-year is omitted when fewer than 95% of its filings have a PROSE code. |
| `idb_civil_pct_pro_se_plaintiff` | percent | Same, with PROSE in {1, 3}: one or more pro se plaintiffs. |
| `idb_civil_pct_prisoner_petitions` | percent | 100 x filed cases with NOS in {510, 530, 535, 540, 550, 555, 560} / all filed cases. This is the codebook's "Prisoner Petitions" 510-560 block. |
| `idb_civil_pct_class_action` | percent | 100 x filed cases with CLASSACT = 1 (a Rule 23 class allegation in the complaint) / all filed cases. |
| `idb_civil_trial_rate` | percent | 100 x terminations with DISP in {7 jury verdict, 8 directed verdict, 9 court trial} / all terminations. DISP is never missing in this file. |
| `idb_civil_pct_reached_trial` | percent | 100 x terminations with PROCPROG in {6 during court trial, 7 during jury trial, 8 after court trial, 9 after jury trial} / all terminations. This is the AO's "percent reaching trial" (Table C-4). |
| `idb_crim_defendants_filed` | defendants | `CTFIL = 1` in the FY snapshot. All offense levels; excludes inter-district transfers. Equals AO Table D-2 total. |
| `idb_crim_felony_defendants_filed` | defendants | Same, with FOFFLVL1 = 4 (felony). Equals FCMS "Total Criminal" in the years FCMS counts defendants. |
| `idb_crim_defendants_terminated` | defendants | `CTTR = 1` in the FY snapshot. Equals AO Table D-4 "total defendants". |
| `idb_crim_trial_rate` | percent | 100 x terminated defendants with DISP1 in {2, 3, 8, 9, 16, 17, 18, 19} (acquitted or convicted after a bench or jury trial, including insanity verdicts) / terminated defendants. |
| `idb_crim_pct_guilty_plea` | percent | DISP1 in {4 guilty plea, 5 nolo contendere}. This equals D-4 "plea of guilty". |
| `idb_crim_pct_dismissed` | percent | DISP1 in {1, 10, 11, 12, 13, 14, 15, 20, 21}: dismissed with or without prejudice, NARA, nolle prosequi, pretrial diversion, mistrial, statistically closed, dismissal superseded, reassigned. This equals D-4 "dismissed". |
| `idb_crim_pct_acquitted` | percent | DISP1 in {2, 3, 16, 18}: acquitted by the court or a jury, or not guilty by reason of insanity. |
| `idb_crim_pct_{immigration, drugs, firearms_explosives, fraud, violent, sex}` | percent | 100 x defendants filed whose D2FOFFCD1 falls in the category / all defendants filed. |

For terminated defendants, trial + plea + dismissed = 100% (tested). Acquittals are a subset of trials.

**Offense categories (`pipeline/idb/codes.py`).** The categories follow AO Table D-2's top-level headings: violent,
property, drugs, firearms and explosives, sex, justice system, immigration, general, regulatory and traffic.
Property is split into **fraud** and **property_other**.

* D2 codes are assigned by numeric block of the FJC code list, for example 8700-8799 immigration and
  6500-6999 drugs.
* 45 codes are assigned explicitly (`_D2_EXPLICIT`), each with its reason. Several of these were placed so that the **FY2024 D-2
  sub-category totals are reproduced exactly**. For example, 1700 "Racketeering, Violent Crime" equals D-2
  "Violent: Racketeering" (397), and 7471 equals "General: Racketeering" (23). Code 9760 "Curfew, Restricted
  Areas" was placed by the FY2007-2025 general/regulatory residuals.
* This is **this lane's mapping, not an AO crosswalk**. `offense_mapping_check.csv` compares it with D-2 for every
  year FY2005-2025:
  * immigration, firearms, sex and traffic match exactly in all 21 years;
  * drugs, violent, other property, justice system and fraud are within 0.6%;
  * general and regulatory are within 2.6% (within 0.7% since FY2012).
* The full list, with labels and defendant counts, is in `d2_offense_codes.csv`.

**Civil NOS groups.** These are the 14 category headings of JS 44 section IV (`nos_groups.csv`). Under the current
JS 44, "Prisoner petitions" includes NOS 463 (alien-detainee habeas). Codes that appear in the data but are not
printed on the current JS 44 go to `unlisted_code`. The main ones are 620, 730, 444, 610, 990, 660 and 650, 16,857
cases from FY1988 on, or 0.16% of filings.

## 4. Outputs (`data/processed/idb/`)

| file | content |
|---|---|
| `observations.{parquet,csv}` | Contract table (24 variables, 76,138 district rows) plus `numerator` and `denominator`. |
| `national.{parquet,csv}` | The same variables for all districts combined (`district_id = "_national"`). |
| `variables.json` | One entry per variable: contract fields plus `derived`, `formula`, `cohort`, coverage. |
| `civil_nos_mix.{parquet,csv}` | district, FY filed, JS 44 NOS group, count, share of the district's filings, total. Includes `_national` rows. |
| `civil_nos_codes.parquet` | The same at individual NOS code level. |
| `civil_disposition_mix.{parquet,csv}` | district, FY terminated, DISP code, label, group, count, share. |
| `criminal_offense_mix.{parquet,csv}` | district, FY filed, offense category, count, share, felony-only count. |
| `criminal_disposition_mix.{parquet,csv}` | district, FY terminated, DISP1 code, label, D-4 group, count, share. |
| `patent_quarterly.csv` | All 94 districts plus `_national`, calendar quarters 1987Q4-2026Q3 (by `FDATEUSE` month). Columns: NOS 830, NOS 835 and 830+835, with fiscal year and fiscal quarter. Covers txed, txwd, ded, cacd, njd, ilnd and the nation, as required. |
| `reconciliation.csv`, `reconciliation_summary.csv`, `offense_mapping_check.csv` | Section 6. |
| `district_crosswalk.csv`, `nos_groups.csv`, `d2_offense_codes.csv` | Code tables. |
| `build_meta.json` | De-duplication counts, structural checks, unlisted NOS codes. |
| `civil_mdl_dockets.{parquet,csv}` | Civil cases by multidistrict litigation (MDL) docket: district, FY, cohort (`filed` or `terminated`), 4-digit MDLDOCK, count, the district's civil total for that cohort and year, share, source locator. Section 4a. |
| `civil_mdl_docket_names.csv` | Verified litigation names for the dockets the site names: docket, transferee district, case number, title as GovInfo prints it, display title, GovInfo source id. |
| `civil_mdl_coverage.csv`, `civil_mdl_meta.json` | Civil termination records per termination FY and how many carry a 4-digit MDL docket number (`coded` when at least 1,000 do); the meta file gives `first_coded_fy` (2010). Section 4a. |

### 4a. Civil cases by MDL docket (`pipeline/idb/mdl.py`)

* **Field.** MDLDOCK, "MULTIDISTRICT LITIGATION DOCKET NUMBER (MDLDOCK): A 4-digit multi district litigation docket
  number" (civil codebook). Only 4-digit values other than `0000` count (982,985 records in this vintage); `-8`
  (missing, 10.1 million records), `0000` (2 records) and 1,191 other one- to three-character values (for example
  `300`, `E`, `__`) are left out.
* **Cohorts.** Exactly the lane's civil cohorts: `filed` is the de-duplicated filing cohort (the docket comes from the
  record kept for the case, its latest), `terminated` is the termination cohort. So `total` equals
  `idb_civil_filed` / `idb_civil_terminated` for every district-year in the table (tested).
* **Rows kept.** A district x FY x cohort x docket row is kept when the docket holds at least 100 cases and at least
  5% of the district's civil cases in that cohort and year: 940 rows, 82 dockets, 37 districts, plus `_national`
  rows for the same docket, year and cohort (all districts combined).
* **N.D. Fla.** MDL 2885 holds 202,693 of the 204,990 civil cases filed in FY2020 (98.9%), more than 90% of filings
  in every year FY2020-2024, and 147,231 of the 149,260 civil cases closed in FY2025. Nationally it is 36.1% of all
  civil cases closed in FY2025 (147,231 of 407,539) and 43.1% of those filed in FY2020. MDL 3140 holds 1,275 of
  3,251 filings in FY2025 and 5,256 of 7,237 in FY2026.
* **Other districts above 25% in FY2025 or FY2026:** D. Ariz. (3081), D.N.J. (2738), D. Minn. (2666), D.S.C. (2873),
  N.D. Ohio (3092) for filings; E.D. La. (2740) and D.N.H. (2753) for terminations.
* **Names.** A docket is named only when a GovInfo USCOURTS record for the transferee court verifies it: the MODS
  case number must end in `md-0NNNN` (or `mn-0NNNN`) for the docket and the record's author must be that district
  court. The package ids tried are typed in `NAME_CANDIDATES`; each is checked, never trusted. Verified: 2885
  (In re: 3M Combat Arms Earplug Products Liability Litigation, 3:19-md-02885, N.D. Fla.), 3140 (Depo-Provera,
  3:25-md-03140, N.D. Fla.), 3081 (Bard Implanted Port Catheter, D. Ariz.), 2738 (Johnson & Johnson Talcum Powder,
  D.N.J.), 2666 (Bair Hugger, D. Minn.), 3092 (Suboxone Film, N.D. Ohio), 2740 (Taxotere, E.D. La.). Not verified,
  so shown by number only: 2873 (D.S.C.) and 2753 (D.N.H.); the guessed GovInfo pages returned "Page Not Found"
  (gap `civil_mdl_docket_names_unverified`). Display titles turn all-capital titles into title case and normalise
  the "In re:" prefix; the title as printed is kept beside it.
* **Independent recount** (`test_idb_mdl.py`): N.D. Fla. (IDB code 29) FY2021 filings and FY2025 terminations by
  docket, re-counted from the civil extract with code that does not use `pipeline.idb.mdl`.
* **Coverage (polish pass, Nov 27).** MDLDOCK is almost never filled in before FY2010: 223 of the 5,420,719 civil
  termination records for FY1988-2009 carry a 4-digit docket (no year more than 99), against 2,336 to 163,348 a year
  from FY2010 (`civil_mdl_coverage.csv`). Filing-cohort counts for FY2005-2009 in `civil_mdl_dockets` therefore miss
  the cases that closed before FY2010. The web lane's district notes start in FY2010 (`civil_mdl_meta.json`,
  `first_coded_fy`; gap `civil_mdl_docket_not_coded_early_years`).
* **Names for every year (polish pass).** Name lookups now cover every docket above 25% of a district's civil cases
  filed or closed in any year from FY2010 (39 dockets), not only the latest two years. 26 verify. The case type may
  also be `ml` (S.D. Ind. uses `1:14-ml-02570`). `display_title` keeps Roman numerals and a few acronyms (ABG, AFFF,
  AG, IVC) in capitals, treats a title as all-capital when at least 90% of its letters are, and drops a docketing note
  in double asterisks ("**COUNSEL: DO NOT ADD PARTIES.**" on the D. Kan. record); the title as printed is kept beside
  it. By number only (no verified record; gap `civil_mdl_docket_names_unverified`): 1507 (E.D. Ark.; its GovInfo
  record has a civil case number, 4:03-cv-01507), 2197, 2299, 2325, 2326, 2327, 2391, 2502, 2545 and 3060 (N.D. Ill.
  records with civil case numbers), 2753, 2782, 2873. MDL 875 (the FJC's "0875", above 25% of N.D. Ohio's FY2015
  filings) is named from its E.D. Pa. transferee record.

## 5. Coverage

All district rows (excluding `_national`).

| variable | unit | cohort | first FY | last FY | years | districts | rows |
|---|---|---|---|---|---|---|---|
| `idb_civil_filed` | cases | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_civil_terminated` | cases | termination | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_patent_filed` | cases | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_patent_incl_anda_filed` | cases | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_patent_share_of_national` | percent | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_civil_pct_pro_se` | percent | filing | 1999 | 2026 | 28 | 94 | 2631 |
| `idb_civil_pct_pro_se_plaintiff` | percent | filing | 1999 | 2026 | 28 | 94 | 2631 |
| `idb_civil_pct_prisoner_petitions` | percent | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_civil_pct_class_action` | percent | filing | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_civil_trial_rate` | percent | termination | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_civil_pct_reached_trial` | percent | termination | 1988 | 2026 | 39 | 94 | 3666 |
| `idb_crim_defendants_filed` | defendants | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_felony_defendants_filed` | defendants | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_defendants_terminated` | defendants | termination | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_trial_rate` | percent | termination | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_guilty_plea` | percent | termination | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_dismissed` | percent | termination | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_acquitted` | percent | termination | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_immigration` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_drugs` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_firearms_explosives` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_fraud` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_violent` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |
| `idb_crim_pct_sex` | percent | filing | 1996 | 2026 | 31 | 94 | 2914 |

The only cell omitted for coverage reasons: pro se, D. Nev. FY1999, where fewer than 95% of filings have a PROSE code.

## 6. Reconciliation with published totals

`reconciliation.csv` has one row per comparison: check, level, district, FY, IDB value, published value,
difference, % difference and the published source id. `reconciliation_summary.csv` aggregates it. Each check below
is also encoded as a tolerance test in `tests/pipeline/test_idb_outputs.py`.

| check | level | n | FYs | exact | median abs % diff | max abs % diff | r | test tolerance |
|---|---|---|---|---|---|---|---|---|
| civil filed vs AO C-1 | national | 29 | 1997-2025 | 0 | 0.25 | 1.60 | 0.999 | within 2% every year; within 0.5% from FY2011 |
| civil filed vs AO C-1 | district | 2,726 | 1997-2025 | 394 | 0.21 | 51.0 | 1.000 | r > 0.995, median < 0.5%, > 95% of cells within 5% |
| civil filed vs FCMS "Total Civil" | district | 2,068 | 2004-2025 | 328 | 0.18 | 51.0 | 1.000 | same as above |
| civil terminated vs AO C-1 | national | 29 | 1997-2025 | 27 | 0.00 | 0.035 | 1.000 | within 0.1% |
| civil terminated vs AO C-1 | district | 2,726 | 1997-2025 | 2,722 | 0.00 | 6.5 | 1.000 | > 99% exact |
| civil reached trial vs AO C-4 | national | 29 | 1997-2025 | 0 | 0.53 | 9.4 | 0.999 | within 10%; within 1.5% from FY2011 |
| criminal filed incl. transfers vs AO D-1 | national | 29 | 1997-2025 | 24 | 0.00 | 0.054 | 1.000 | within 0.1% |
| criminal filed incl. transfers vs AO D-1 | district | 2,726 | 1997-2025 | 2,680 | 0.00 | 3.5 | 1.000 | > 95% exact |
| criminal terminated incl. transfers vs AO D-1 | national + district | 2,755 | 1997-2025 | all | 0 | 0 | 1.000 | within 0.1% national; > 95% exact |
| criminal filed (excl. transfers) vs AO D-2 | national | 21 | 2005-2025 | 20 | 0.00 | 0.001 | 1.000 | within 0.01% |
| D-4 dispositions (7 columns) | national | 203 | 1997-2025 | 147 | 0.00 | 11.9 | - | exact for FY2005-2025; FY1997-2004 terminated within 0-3% |
| felony defendants filed vs FCMS | district | 1,504 | 2010, 2012-2025 | **1,504** | 0 | 0 | 1.000 | all exact |

**Why the numbers differ where they do:**

* **Civil filings vs C-1.** The AO counts filings from each year's filing extract at the time it is made. The IDB
  count is rebuilt from the records that are in the cumulative file today: closed cases plus pending cases.
  * A case whose termination record never reached a published tape is missing from the rebuild. The FJC guide
    warns that records changed after the reporting period "will not appear".
  * Re-docketed and severed cases can carry a different `FDATEUSE`.
  * National differences are -1.6% to +0.9% through FY2010 and within ±0.4% since FY2011.
  * District outliers are few. The largest are M.D. Fla. FY2008 (+51%), N.D. Ohio FY2000-04 (-23% to -37%),
    W.D. Mo. FY2000 (+36%) and E.D. La. FY2010 (-21%). These are differences between IDB and AO counting, not
    parsing errors: the same cells disagree with FCMS by the same amounts.
* **Civil terminations vs C-1** match exactly in 2,722 of 2,726 district-years. The four exceptions are FY2011
  E.D. Ky. (-104), FY1997 N.D. Cal. (-2), FY1997 E.D.N.Y. (-1) and FY2011 E.D.N.Y. (-1). They suggest that a few
  records were revised after publication.
* **C-4.** Table C-4's total omits a few hundred terminations that C-1 counts (FY2024: 396,486 against 396,635). So
  "reaching trial" runs slightly above C-4's count. FY2001-2010 differ by 0.7-4.5%, except FY2004 (+370,
  +9.4%). Since FY2011 the difference is within 0.8%.
* **D-4 before FY2005.** In FY1997-2004 the IDB has 1,159-1,578 more terminated defendants (1.4-2.4%) than D-4. The
  excess falls mostly on dismissals and pleas. D-1 terminations, by contrast, match exactly in those same years.
  The pre-2005 D-4 therefore had a narrower scope than "D-1 minus transfers". Its title adds "(Excluding
  Transfers)" only from FY2005, and the AO changed its offense classification that year. The reason is not
  documented in the sources. From FY2005 every D-4 column matches exactly.
* **Felony filings vs FCMS.** FCMS counts felony **cases** in FY2004-09 and FY2011. Those years are written as
  check `crim_felony_filed_vs_fcms_case_years`, where the IDB defendant count runs 32-38% higher nationally. They show
  the size of the unit difference and are not a test. In defendant years the match is exact.
* **IDB criminal filed vs D-1 commenced.** The IDB is 1-50 defendants short nationally in FY2007-2011. All 46
  district cells that are not exact fall in those years. Every other year matches exactly.

## 7. Definitional breaks and caveats

* **Fiscal years.** Every value uses the federal fiscal year (Oct 1 - Sep 30), including FY1988-1992, when the AO
  still published by statistical year (July - June). IDB values for FY1988-1992 therefore do not match AO tables
  of that period by design.
* **Patent NOS 835 break (FY2017).** ANDA (Hatch-Waxman) patent cases moved from NOS 830 to the new NOS 835. The
  first 835 filing is dated June 2017. Since then NOS 835 has had 137-337 filings a year: 2,656 in FY2017-2026,
  of which 1,438 were in D. Del. and 1,040 in D.N.J. `idb_patent_filed` excludes them. Use `idb_patent_incl_anda_filed` for a continuous series.
  The share-of-national variable uses 830 only, as specified.
* **Patent pattern (data only).** E.D. Tex. NOS 830 filings were 2,184 in FY2015 and 393 in FY2019, then 1,015 in
  FY2024 and 1,262 in FY2025. W.D. Tex. rose from 50 (FY2017) to 914 (FY2021). The quarterly file shows the
  timing around the May 2017 *TC Heartland* decision.
* **Filing reconstruction.** See section 6. FY2026 filings include 80,415 NOS 463 (alien detainee habeas) petitions,
  up from 2,315 in FY2025. They account for most of the rise in civil filings, from 303,632 to 387,996.
* **Mass-tort MDLs.** N.D. Fla. FY2020-24 holds hundreds of thousands of NOS 365 cases under MDL docket 2885:
  204,990 filings in FY2020, 202,838 of them NOS 365. These dominate N.D. Fla.'s values and the national NOS mix
  in those years. Many of these MDL cases carry pro se codes: 110,916 of 204,990 in FY2020 and 23,884 of 25,251
  in FY2024, almost all in MDL 2885. That lifts the national pro se share to 38.7% (FY2020) and 34.8%
  (FY2024). The MDL docket counts by district and year are in `civil_mdl_dockets` (section 4a); the site
  shows them as a context note on the profiles of the districts concerned.
* **Civil trial-verdict spike, FY2007.** M.D. La. recorded 6,350 of its 7,365 FY2007 terminations as jury
  verdicts, 6,305 of them NOS 360 and almost all dated May 2007. That lifts the national trial rate to 3.85% in
  FY2007, against 1.10% in FY2006 and 1.36% in FY2008.
* **PROSE and CLASSACT** are taken from a case's latest record and have no AO quality control (IDB Research
  Guide). PROSE is blank in tape years 1988-1995 and 1998, hence the FY1999 start. CLASSACT has only "1" or
  missing, so "no allegation" cannot be told from "not reported". The low class-action shares before about
  FY2001 (0.2-0.7%) may partly reflect reporting.
* **Prisoner petitions** use the 510-560 block. NOS 463 alien-detainee habeas is not included, although the current
  JS 44 prints it under "Prisoner Petitions" and the NOS-mix group follows JS 44 by including it. In FY2026 this
  difference is large; see above.
* **Criminal "filed"** covers all offense levels and excludes inter-district transfers. It is not comparable with
  FCMS felony filings before FY2012 (FY2010 excepted), when FCMS counted cases. **Offense** is the most serious
  *filing* charge. D2 codes were created in FY2005 and back-filled by the FJC for FY1996-2004. Offense shares
  before FY2005 therefore use back-filled codes and could not be checked against a D-2 table, because the AO
  then used the older AO codes. **Disposition** is DISP1, the disposition on the most serious count at
  termination.
* **Regulatory offenses FY2025.** D-2 reports 3,893 defendants, up from 1,202 in FY2024. The IDB matches within one
  defendant. This is a pattern only; the cause is not stated in the sources.
* **Small districts.** Shares for D.N. Mar. I., D. Guam, D.V.I. and other low-volume districts rest on small
  denominators. Every row has `denominator`; the web lane should show it or flag small bases.
* **Records are as of the latest snapshot.** Superseding charges and later changes overwrite earlier values (IDB
  Research Guide).

## 8. Verification done in this lane

* **By eye against the AO PDFs and xlsx files.**
  * C-1 FY2005 TX,E row "2,533 3,004 3,037 2,500 ..." parses to filed 3,004 and terminated 3,037. C-1 FY2012
    VA,E parses to 3,319 / 3,277.
  * D-1 FY2015 AZ, two half-rows: commenced 6,680 and terminated 6,471, with transfers 5 and 2. D-1 FY1998 TX,S:
    4,070 / 3,563.
  * D-4 FY1997 TOTAL "63,148 7,500 6,607 400 493 55,648 51,647 271 499 3,231" parses to plea 51,918, which is
    51,647 + 271 nolo.
  * FY2024 D-4 columns against IDB DISP1 counts: dismissed 5,059 = 4,135 + 31 + 157 + 38 + 698, and so on, all
    exact.
* **Independent recount from the raw text with awk**, bypassing the Python extract:
  * E.D. Tex. NOS 830, FY2015 = 2,184 and FY2019 = 393, de-duplicated on the same key.
  * S.D. Tex. FY2024: CTFIL = 6,044 and CTTR = 6,442.
  * D. Ariz. FY2024: 10,825 and 10,269.
  * All equal the observations and are pinned in `test_spot_values`.
* **Codebook text.** Every crosswalk "code - label" pair is found in both codebook PDFs, and every NOS code in the
  civil codebook list has a JS 44 group (tests).

## 9. Gaps (`data/gaps/idb.json`)

* Civil before FY1988 and criminal before FY1996 are not produced. The FJC's 1970-1987 civil and 1970-FY1995
  criminal files use older codes and were not processed.
* Pro se FY1988-1998: PROSE is blank in the source. D. Nev. FY1999 pro se is below the 95% coverage threshold.
* The AO FY2026 tables (C-1, C-4, D-1, D-2, D-4) are not online yet, so FY2026 IDB values are published without an
  AO cross-check.
* No allowlist blocks were hit. No paid or authenticated source was needed.
