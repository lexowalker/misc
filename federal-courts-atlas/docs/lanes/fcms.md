# Lane report: Federal Court Management Statistics (FCMS)

**What it is.** The AO's district-court "Judicial Caseload Profile" for the 12 months ending September 30
(`period_type = FY_SEP30`), every year it is online. Every district and every year from FY1999 to FY2025
(27 years). Core workload and speed measures, published ranks, and the nature-of-suit/offense mix.

**Rebuild:** `PYTHONPATH=. .venv/bin/python -m pipeline.fcms.build` (about 4 minutes; downloads are cached
by `pipeline.common.http.fetch`, and all outputs are rewritten from scratch).
**Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_fcms*.py` (77 tests, including the
statistics-audit regressions in `test_fcms_regressions.py`).

**Audit fixes (2026-11-27).** The statistics audit (`docs/audits/stats_audit.md`, items 5–8) found no wrong
FCMS value. Its four documentation and flagging points are addressed: vacant judgeship months are now in
`reconciliation.csv` (FY2003 source discrepancy noted), implausible-looking source cells carry a `caveat`,
the D.N.M.I. FY2024 juror zeros (no jury selection held) are logged as gaps instead of shown as measured
zeros, by-design empty cells are in the gap log, and `variables.json` points time series of
method-sensitive variables to `observations_current_method` (§6).

## 1. Sources

Publisher: Administrative Office of the U.S. Courts (uscourts.gov). Each file is registered in
`data/sources/fcms.json` with its URL, period page, retrieval date and sha256.

The lane found the files from the FCMS index page,
<https://www.uscourts.gov/data-news/reports/statistical-reports/federal-court-management-statistics>
("Publications dating back to 1997"). It follows each **September** link to its period page and takes the
one district "profiles" PDF linked there (`pipeline/fcms/discover.py`). The September 2023 index link is a
`/node/36420/` alias that redirects to plain `http://` and fails. The code then falls back to the canonical
period-page URL. No xlsx or csv version of the district profiles exists on any period page; the only xlsx
is the "Explanation" document. PDFs are therefore the only source.

| FY | source_id | file | layout | criminal counting |
|---|---|---|---|---|
| 1997 | `fcms_fy1997` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_1997.pdf | scanned (not parsed) | - |
| 1998 | `fcms_fy1998` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_1998.pdf | scanned (not parsed) | - |
| 1999 | `fcms_fy1999` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_1999.pdf | scanned (not parsed) | - |
| 2000 | `fcms_fy2000` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2000.pdf | scanned (not parsed) | - |
| 2001 | `fcms_fy2001` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2001.pdf | scanned (not parsed) | - |
| 2002 | `fcms_fy2002` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2002.pdf | scanned (not parsed) | - |
| 2003 | `fcms_fy2003` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2003.pdf | scanned (not parsed) | - |
| 2004 | `fcms_fy2004` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2004.pdf | mono | cases |
| 2005 | `fcms_fy2005` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2005.pdf | mono | cases |
| 2006 | `fcms_fy2006` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2006.pdf | mono | cases |
| 2007 | `fcms_fy2007` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2007.pdf | mono | cases |
| 2008 | `fcms_fy2008` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2008.pdf | mono | cases |
| 2009 | `fcms_fy2009` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2009.pdf | mono | cases |
| 2010 | `fcms_fy2010` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/District_FCMS_Sep_2010.pdf | words | **defendants** (regenerated file) |
| 2011 | `fcms_fy2011` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/district_fcms_profiles_september_2011.pdf | words (Excel) | cases |
| 2012 | `fcms_fy2012` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/district-fcms-profiles-september-2012.pdf | words | defendants |
| 2013 | `fcms_fy2013` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/district-fcms-profiles-september-2013.pdf | words | defendants |
| 2014 | `fcms_fy2014` | https://www.uscourts.gov/sites/default/files/statistics_import_dir/district-fcms-profiles-september-2014.pdf | words | defendants |
| 2015 | `fcms_fy2015` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_district_profiles_september_2015.pdf | words | defendants |
| 2016 | `fcms_fy2016` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2016.pdf | words | defendants |
| 2017 | `fcms_fy2017` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2017.pdf | words | defendants |
| 2018 | `fcms_fy2018` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2018.pdf | words | defendants |
| 2019 | `fcms_fy2019` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2019.pdf | words | defendants |
| 2020 | `fcms_fy2020` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2020.pdf | words | defendants |
| 2021 | `fcms_fy2021` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2021.pdf | words | defendants |
| 2022 | `fcms_fy2022` | https://www.uscourts.gov/sites/default/files/data_tables/fcms_na_distprofile0930.2022.pdf | words | defendants |
| 2023 | `fcms_fy2023` | https://www.uscourts.gov/sites/default/files/2024-11/fcms_na_disprofile0930.2023.pdf | words | defendants |
| 2024 | `fcms_fy2024` | https://www.uscourts.gov/sites/default/files/document/fcms_na_distprofile0930.2024.pdf | words | defendants |
| 2025 | `fcms_fy2025` | https://www.uscourts.gov/sites/default/files/document/fcms_na_distprofile0930_2025.pdf | words | defendants |

Supporting documents (also registered):

* `fcms_explanation_district_2011`: <https://www.uscourts.gov/file/document/explanation-judicial-caseload-profiles-district-2011>.
  This is the "Explanation of the Judicial Caseload Profiles" linked from the September 2011 page. It is
  the source of the FY2011 letter legend.
* `fcms_explanation_district_current`: <https://www.uscourts.gov/sites/default/files/2024-12/explanation_of_judicial_caseload_profiles_district.xlsx>.
  It holds the definitions and ranking rules. The identical file is linked from the FY2017–FY2025 pages.
* `fcms_selected_terms_2016`: <https://www.uscourts.gov/file/24306/download> ("Explanation of Selected Terms",
  September 2016). It documents three changes: supervised-release hearings added in FY2002, the March 2012
  criminal-method change, and the case weights approved for use after December 2015.
* `fcms_index_page`: the index page above, used for discovery only.

## 2. Parsing method

Each profile PDF has 95 pages: the national page ("all district courts") and one page per district. Every
page prints six fiscal years (the profile year and the five before it), the "numerical standing" (rank)
within the U.S. and within the circuit for the profile year, and the profile year's filings by
nature of suit / offense under letters A–L. There are four layout generations (`pipeline/fcms/parse.py`):

1. **FY1997–2003: scanned images.** Page 2 of each file is a full-page raster image. Its machine-OCR text
   layer drops decimal points ("67" for 6.7, "444 8" for 444.8) and misreads labels ("Fihings"). These files
   are detected (`is_scanned`) and **not parsed**. Transcribing them would risk wrong numbers.
2. **FY2004–2009: `mono`.** The numbers are a fixed-width line-printer overlay: every glyph is 7.2 pt wide,
   in a font of size 81, on top of a form drawn in other fonts. Columns run newest to oldest. Adjacent
   fields touch, so `pdftotext` prints `363,774349,969…` and the national case-mix row as one run of digits.
   The parser rebuilds each overlay line by character column (glyph x ÷ 7.2) and cuts values out of fixed
   fields: six 7-character year fields, two rank fields, and a 6+12×5 case-mix row. Every non-blank
   character must fall inside a known field. The 26 overlay rows sit at identical y positions on every page
   and in every year (asserted). The district name comes from a size-41 overlay; the years come from the form layer.
3. **FY2010, FY2012–2025: `words`.** These use proportional fonts, oldest to newest. The parser groups
   words into lines and finds the header line with six years. Numbers are right-aligned, so their right
   edges cluster into exactly six column anchors (asserted), and each value goes to the nearest anchor (≤ 8
   pt). Ranks go to the "U.S." or "Circuit" header by x-centre. Rows are matched in order to a fixed
   22-row template, and each row must have its label keyword nearby (e.g. "Weighted", "Jury Selection").
   Two quirks are handled. In FY2017–24 the criminal-median rank sits about 3 pt off its values line, so it
   is attached to the nearest line. In FY2025 the territorial courts' weighted-filings row is printed blank
   with dash ranks, so it becomes a row of empty cells.
4. **FY2011: `words`, Excel-generated variant.** It uses a 23-row template: the percent change splits into
   "Over Last Year" and "Over Earlier Years" rows, as in mono, and some numbers sit on a line apart from
   their label. Order plus label-window matching handles it.

The national page in FY2010 and FY2012–25 prints the case-mix table as a labelled list ("A-Social Security
15,641"). That list is the legend for the year. Lines are taken in printed order A..L, and any printed
letter prefix is asserted to match. The FY2021–22 national pages print "Intellectual Property Rights"
without its "I-" prefix (a typo in the source), so that line is identified by its position between H and J.

Tokens: soft hyphen (U+00AD, FY2010–15) and U+2010 (FY2011) are minus signs or dashes. `.0` = 0. In the main
table, `-`, `**` and blank mean "not published" and are omitted, with a gap logged. In the **case-mix
table**, `-` is read as 0. That reading is not an assumption: each profile uses either `-` or `0` for
empty categories (never both), and in all 2,090 district/national rows the letters sum exactly to the
printed total only when `-` counts as 0. The locator says `('-' = 0: letters sum to Total)`.

**Primary value rule.** Each value comes from the profile for its own year. FY1999–2003 come from the
back-columns of the FY2004 profile, the earliest machine-readable one, and their locators say
`[back-column of FY2004 profile]`. Percent changes, ranks and case-mix are printed only for a profile's
own year.

**District crosswalk** (`pipeline/fcms/crosswalk.py`): FCMS headings take three forms:
`<STATE> <DIVISION>` ("VIRGINIA EASTERN"), the bare state, or "DISTRICT OF COLUMBIA", "PUERTO RICO",
"VIRGIN ISLANDS", "GUAM" and "NORTHERN MARIANAS". The crosswalk also normalises "NO. CAROLINA …" and
"W. VIRGINIA …". All 94 registry ids map 1:1, and every parsed year has exactly 94 district pages plus the
national page (tested). The territorial courts (D.V.I., D. Guam, D.N.M.I.) are in every year.

## 3. Outputs (`data/processed/fcms/`)

| file | content |
|---|---|
| `observations.{parquet,csv}` | contract table, core variables (filings … jurors, case-mix totals, % changes) |
| `observations_ranks.{parquet,csv}` | contract table, published ranks `fcms_rank_{us,circuit}_*` |
| `observations_casemix.{parquet,csv}` | contract table, `fcms_civil_type_*` / `fcms_criminal_type_*` |
| `observations_current_method.{parquet,csv}` | contract table, method-sensitive variables re-read on the current method (§5) |
| `national.{parquet,csv}`, `national_current_method.csv` | same variables for "all district courts" (no ranks) |
| `variables.json` | one entry per variable (81), with `table`, `first_period`, `last_period`, `n_districts`, `method_values`, `method_sensitive`, `time_series_table`, `current_method_first_period`, `n_cell_caveats` |
| `nos_letters.csv` | every case-mix cell by letter, FY2004–2025, raw and value, with label where a legend exists |
| `nos_legend.csv` | letter → printed label per profile year, with the legend's source |
| `vintages.parquet` | every cell of every parsed profile, all six columns (279,870 cells) |
| `revisions.csv`, `revisions_summary.csv` | cells whose value differs between profile vintages |
| `reconciliation.csv` | national total vs sum of the 94 districts (and of the 91 Article III districts), per year, with `rounding_bound`, `within_rounding` and, for a year outside rounding, a `note` comparing every vintage that prints it |
| `cell_caveats.csv` | source cells that are transcribed faithfully but would mislead on a map: code, caveat text, action (kept and flagged, or omitted and logged) |
| `validation.csv` | arithmetic identities that did not hold (5 cells, all in the source; §6) |
| `profiles.csv` | one row per September profile found online (29) |

The observations tables carry the contract's eight columns plus `method` and `caveat`. The `method` codes are
`crim_cases`, `crim_defendants`, `weights_old`, `weights_2015`, or empty for variables unaffected by a method
change. `caveat` is empty except on the flagged cells listed in `cell_caveats.csv` (§6).
The case-mix and ranks tables are split from `observations` only to keep each CSV under 20 MB; they are
the same format.

## 4. Variable definitions

Wording follows the AO "Explanation of the Judicial Caseload Profiles" (xlsx) and "Explanation of Selected
Terms". Values are kept exactly as printed: medians in months, percents 0–100, per-judgeship values as
whole numbers.

| id | definition |
|---|---|
| `fcms_filings_total` | Civil + criminal felony cases (incl. transfers) filed, plus supervised release hearings (from FY2002). Unit `count`. |
| `fcms_terminations_total` | Same scope, terminated. |
| `fcms_pending_total` | Civil + criminal felony cases (incl. transfers) pending on September 30. |
| `fcms_pct_change_filings_{1..5}yr` | % change in total filings, profile year over the year k earlier, as printed. These come from the row "Current Year Over Earlier Year": the value under column *Y−k* is the change *Y* over *Y−k*. |
| `fcms_judgeships` | Authorized judgeships (not senior judges). Includes the 4 territorial judgeships; the national 677 = 673 Article III + 4. |
| `fcms_vacant_judgeship_months` | Months during the year that authorized judgeships were unfilled (summed). |
| `fcms_filings_per_judgeship_{total,civil,criminal_felony,supervised_release_hearings}` | Filings of each kind ÷ authorized judgeships. Criminal includes transfers. |
| `fcms_pending_per_judgeship`, `fcms_terminations_per_judgeship` | ÷ authorized judgeships. |
| `fcms_weighted_filings_per_judgeship` | Filings weighted by FJC case weights (average case ≈ 1.0) ÷ judgeships. |
| `fcms_trials_completed_per_judgeship` | Trials completed by district judges (incl. evidentiary hearings on TROs and preliminary injunctions) ÷ judgeships. |
| `fcms_median_months_criminal_felony_filing_to_disposition` | Median months from filing to disposition for felony defendants terminated (excl. transfers). Since March 2012 it is measured from the proceeding date; not computed below 10 terminations. |
| `fcms_median_months_civil_filing_to_disposition` | Median months filing to disposition, civil. Excludes land condemnation, prisoner petitions, recovery of overpayments, enforcement of judgments, and deportation reviews. |
| `fcms_median_months_civil_filing_to_trial` | Median months filing to start of trial, civil cases tried by a district judge; not computed below 10 trials. |
| `fcms_civil_over_3yrs_count` / `_pct` | Civil cases pending more than 3 years at Sept. 30, and their % of pending civil cases. |
| `fcms_avg_felony_defendants_per_case` | Felony defendants per felony case filed. |
| `fcms_jurors_avg_present` | Average petit jurors present for jury selection (FY2004–09 print two decimals). |
| `fcms_jurors_pct_not_selected` | % of petit jurors neither selected nor challenged. |
| `fcms_filings_civil` | "Total Civil" of the case-mix table = civil filings. |
| `fcms_filings_criminal_felony` | "Total Criminal" of the case-mix table = felony filings **excluding transfers**: defendants in FY2010 and FY2012+, cases in FY2004–09 and FY2011. |
| `fcms_civil_type_<slug>` (13) | Civil filings in the category printed for letters A–L. The slugs are `social_security`, `personal_injury_product_liability`, `prisoner_petitions`, `forfeitures_penalties`, `real_property`, `labor`, `contracts`, `torts_other`, `copyright_patent_trademark` (letter I to FY2020), `intellectual_property_rights` (letter I from FY2021), `civil_rights`, `antitrust` and `all_other_civil`. |
| `fcms_criminal_type_<slug>` (12) | Felony filings, excluding transfers, in the category printed for letters A–L. The slugs are `marijuana`, `other_drugs`, `immigration`, `firearms_explosives`, `fraud`, `violent_offenses`, `sex_offenses`, `forgery_counterfeiting`, `larceny_theft`, `justice_system_offenses`, `regulatory_offenses` and `all_other_criminal`. |
| `fcms_rank_us_<var>` / `fcms_rank_circuit_<var>` | **Published** "numerical standing" printed in the margin, never computed here. Caseload measures are ranked descending (largest = 1); times and old-case shares ascending (lowest = 1). Ties share a rank. |

Two rank meanings were verified against the printed values. The single % change standing (FY2010, FY2012+)
and the "Over Last Year" standing (FY2004–09, FY2011) rank the **1-year** change: they match a
descending ranking of the printed 1-year change for 94/94 districts in FY2006, 2011, 2015 and 2020. The
"Over Earlier Years" standing ranks the **5-year** change (94/94 in FY2006 and FY2011), so it is emitted
as `fcms_rank_*_pct_change_filings_5yr`.

## 5. Coverage

District observations: 156,379 rows. Core table 66,777; ranks 53,506; case-mix 36,096. National: 1,102 rows.
"districts" counts the districts with at least one value.

| variable | table | unit | first FY | last FY | years | districts | rows |
|---|---|---|---|---|---|---|---|
| `fcms_avg_felony_defendants_per_case` | obs | defendants_per_case | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_civil_over_3yrs_count` | obs | cases | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_civil_over_3yrs_pct` | obs | percent | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_civil_type_all_other_civil` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_antitrust` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_civil_rights` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_contracts` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_copyright_patent_trademark` | obs_casemix | cases | 2010 | 2020 | 11 | 94 | 1034 |
| `fcms_civil_type_forfeitures_penalties` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_intellectual_property_rights` | obs_casemix | cases | 2021 | 2025 | 5 | 94 | 470 |
| `fcms_civil_type_labor` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_personal_injury_product_liability` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_prisoner_petitions` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_real_property` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_social_security` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_civil_type_torts_other` | obs_casemix | cases | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_all_other_criminal` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_firearms_explosives` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_forgery_counterfeiting` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_fraud` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_immigration` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_justice_system_offenses` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_larceny_theft` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_marijuana` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_other_drugs` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_regulatory_offenses` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_sex_offenses` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_criminal_type_violent_offenses` | obs_casemix | cases/defendants | 2010 | 2025 | 16 | 94 | 1504 |
| `fcms_filings_civil` | obs | cases | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_filings_criminal_felony` | obs | cases/defendants | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_filings_per_judgeship_civil` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_filings_per_judgeship_criminal_felony` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_filings_per_judgeship_supervised_release_hearings` | obs | per_judgeship | 2002 | 2025 | 24 | 94 | 2256 |
| `fcms_filings_per_judgeship_total` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_filings_total` | obs | count | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_judgeships` | obs | count | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_jurors_avg_present` | obs | persons | 1999 | 2025 | 27 | 94 | 2537 |
| `fcms_jurors_pct_not_selected` | obs | percent | 1999 | 2025 | 27 | 94 | 2537 |
| `fcms_median_months_civil_filing_to_disposition` | obs | months | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_median_months_civil_filing_to_trial` | obs | months | 1999 | 2025 | 27 | 92 | 1931 |
| `fcms_median_months_criminal_felony_filing_to_disposition` | obs | months | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_pct_change_filings_1yr` | obs | percent | 2004 | 2025 | 22 | 94 | 2062 |
| `fcms_pct_change_filings_2yr` | obs | percent | 2004 | 2025 | 22 | 94 | 2064 |
| `fcms_pct_change_filings_3yr` | obs | percent | 2004 | 2025 | 22 | 94 | 2062 |
| `fcms_pct_change_filings_4yr` | obs | percent | 2004 | 2025 | 22 | 94 | 2061 |
| `fcms_pct_change_filings_5yr` | obs | percent | 2004 | 2025 | 22 | 94 | 2065 |
| `fcms_pending_per_judgeship` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_pending_total` | obs | count | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_rank_circuit_civil_over_3yrs_pct` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_filings_per_judgeship_civil` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_filings_per_judgeship_criminal_felony` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_filings_per_judgeship_supervised_release_hearings` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2038 |
| `fcms_rank_circuit_filings_per_judgeship_total` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_median_months_civil_filing_to_disposition` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_median_months_civil_filing_to_trial` | obs_ranks | rank | 2004 | 2025 | 22 | 90 | 1480 |
| `fcms_rank_circuit_median_months_criminal_felony_filing_to_disposition` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_pct_change_filings_1yr` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_pct_change_filings_5yr` | obs_ranks | rank | 2004 | 2011 | 7 | 93 | 651 |
| `fcms_rank_circuit_pending_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_terminations_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2046 |
| `fcms_rank_circuit_trials_completed_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 93 | 2045 |
| `fcms_rank_circuit_weighted_filings_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 90 | 1980 |
| `fcms_rank_us_civil_over_3yrs_pct` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_filings_per_judgeship_civil` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_filings_per_judgeship_criminal_felony` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_filings_per_judgeship_supervised_release_hearings` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2060 |
| `fcms_rank_us_filings_per_judgeship_total` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_median_months_civil_filing_to_disposition` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_median_months_civil_filing_to_trial` | obs_ranks | rank | 2004 | 2025 | 22 | 91 | 1499 |
| `fcms_rank_us_median_months_criminal_felony_filing_to_disposition` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_pct_change_filings_1yr` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_pct_change_filings_5yr` | obs_ranks | rank | 2004 | 2011 | 7 | 94 | 658 |
| `fcms_rank_us_pending_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_terminations_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2068 |
| `fcms_rank_us_trials_completed_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 94 | 2067 |
| `fcms_rank_us_weighted_filings_per_judgeship` | obs_ranks | rank | 2004 | 2025 | 22 | 91 | 2002 |
| `fcms_terminations_per_judgeship` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_terminations_total` | obs | count | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_trials_completed_per_judgeship` | obs | per_judgeship | 1999 | 2025 | 27 | 94 | 2537 |
| `fcms_vacant_judgeship_months` | obs | months | 1999 | 2025 | 27 | 94 | 2538 |
| `fcms_weighted_filings_per_judgeship` | obs | per_judgeship | 1999 | 2025 | 27 | 91 | 2457 |

Weighted filings cover 91 districts: the territorial courts print `-` in every year. The civil trial
median covers 92, because D. Guam and the D.N.M.I. print `-` in all 264 of their cells, across every year
and vintage. Under the AO's rule, the median is not computed below 10 civil trials. In FY2016–2025 every
district has every core variable except AO-suppressed medians, territorial weighted filings, one blank
D.N.M.I. FY2024 trials cell, and the D.N.M.I. FY2024 juror cells (printed 0 with no jury selection held; §6)
(tested).

## 6. Definitional breaks, revisions, caveats

* **Criminal counting method (the big one).** "Beginning in March 2012, criminal data in this profile count
  defendants rather than cases", and the criminal median is measured from the proceeding date instead of
  the filing date: "not comparable to data for previous periods". The **FY2004–09 and FY2011** files use
  the old method. The **FY2010 file posted online was regenerated on the new method**: its footnote says it
  counts defendants, and its FY2007–10 columns match the FY2012 file exactly (380/380 filings cells).
  So the own-year primary series zig-zags: FY2009 cases → FY2010 defendants → FY2011 cases → FY2012+
  defendants. Affected variables: total filings, terminations and pending; per-judgeship total, criminal,
  pending and terminations; % changes; criminal median; defendants per case; criminal case-mix and total.
  Every row carries `method` = `crim_cases` / `crim_defendants`.
  **`observations_current_method`** gives a consistent series on the current method for FY2005–2025. Each
  year is read from the earliest profile that prints it on that method: FY2005–2010 from the FY2010 file,
  FY2011 from the FY2012 file, FY2012+ own-year. **Recommendation for the web lane: use that table for
  time series of these variables**, or mark the break. National total filings show why: the default table
  gives FY2009–2012 as 363,774 (cases) / 394,345 (defendants) / 378,604 (cases) / 386,664 (defendants); the
  current-method table gives 384,902 / 394,345 / 402,885 / 386,664. The default table stays the own-year
  published figure (it is the only source for FY1999–2004, and swapping it would mix sources again), but
  `variables.json` now says so machine-readably for every variable: `method_sensitive`, `time_series_table`
  (`observations_current_method` for the 10 variables it carries) and `current_method_first_period` (FY2005
  criminal-method; FY2010 weighted filings).
* **Case weights.** The FY2015+ profiles print revised weighted filings for every year they show
  (458/460 FY2010–14 cells differ from the FY2014 profile). The FY2016 Explanation of Selected Terms says
  the current weights were "approved for use after December 2015" and prior years were revised.
  `method` = `weights_old` / `weights_2015`. `observations_current_method` carries FY2010–2025 on the
  current weights, with FY2010–14 from the FY2015 profile.
* **Supervised release hearings** were added to the profiles with FY2002. FY1999–2001 totals (filings,
  terminations, weighted, per-judgeship totals) exclude them, and the SRH row is `-` (logged).
* **Case-mix categories.** Letter I was relabelled in FY2021, from "Copyright, Patent, and Trademark" to
  "Intellectual Property Rights". It is kept as two variables because the AO did not say the categories are
  identical. The FY2004–09 profiles print letters without a legend (it is on a fold-out page not in the
  PDF), so those counts stay unlabelled in `nos_letters.csv`. Their totals are emitted. The FY2003 scan's
  legend (an old scheme: criminal A = Immigration, B = Embezzlement, C = Weapons and Firearms, D = Escape,
  E = Burglary and Larceny, F = Drugs, G = not in use, H = Forgery and Counterfeiting, I = Fraud, J =
  Homicide and Assault, K = Robbery, L = all other) is consistent with FY2004's printed values. One sign is
  G printed as `**`. This is **unverified** and was not used.
* **Revisions** (`revisions_summary.csv`). Across 9,975 overlapping cells per core variable, values differ
  between vintages only because of the two method changes above, plus small ordinary revisions: 41 cells of
  civil cases over 3 years, 15 of its percent, 24 of defendants per case, 35 of vacant judgeship months,
  338 of jurors not selected, and 1,314 of jurors present. Most of the jurors-present cells come from
  FY2004–09 printing two decimals and the regenerated FY2010 file printing one. Judgeships, civil filings
  per judgeship, civil medians, trial medians, trials and SRH have **zero** revisions across all vintages.
* **Percent-change rounding.** Printed percent changes differ from the change implied by the same page's
  printed filings by at most 0.060 points (170 of 10,314 cells exceed 0.05). A blank percent-change cell
  always corresponds to a change that rounds to 0.0%, verified per cell. It is logged, not filled.
* **Reconciliation** (`reconciliation.csv`, tested). In every year FY1999–2025, the national page equals
  the sum of all **94** districts, territorial courts included, exactly. That holds for filings,
  terminations, pending, judgeships, civil cases over 3 years, and the case-mix totals. The one exception
  is the FY2011 file: it prints 40,435 civil cases over 3 years nationally, while its districts sum to
  40,434 (source text confirmed). The FY2012 file revises both to 40,439. (The row's `note` also shows the
  FY2015–16 vintages summing to 40,300: they revise D. Alaska FY2011 from 170 to 31, an ordinary revision
  already counted in `revisions.csv`; checked on the FY2015 page text.)
  **Vacant judgeship months** (added after the statistics audit) are printed to one decimal per district, so
  the 94-district sum may differ from the national figure by rounding, at most 94 × 0.05 = 4.7. It differs in
  20 of 27 years: by 0.1–0.5 in 19 of them, and by 9.0 in **FY2003**, where the districts sum to 453.8 but the national page
  prints 444.8 (+9.0), identically in all five profiles that print FY2003 (FY2004–FY2008). This is a source
  inconsistency, not a parse error (the audit's own pdftotext sum reproduces it); both are kept as published.
* **Identities** (`validation.csv`, tested). On every page, per-judgeship = total ÷ judgeships holds
  exactly (±0.5) in the defendant-method files, and within ±1.5 in the case-method files. Civil + criminal
  + SRH per judgeship ≈ total per judgeship (±2) everywhere, and the case-mix letters sum to their totals.
  The only exceptions are S.D. W. Va. FY2000–01 pending per judgeship (243 and 265 printed, vs 1,204/5
  and 1,295/5). They are printed identically in three profiles, so they are kept as published.
* The FY2004 profile prints civil cases over 3 years = 34,067 nationally for both FY2003 and FY2002, with
  different percentages. It is kept as published.
* The FCMS national judgeship count includes the territorial courts' 4 judgeships.
* **Cell-level caveats** (`cell_caveats.csv`, column `caveat`; added after the statistics audit). Values are
  never changed. Two rules, applied to every year:
  * A disposition or trial median printed as 0.0, or below one eighth of that year's U.S. median, is kept and
    flagged, and so are its published ranks: S.D. Fla. FY2023 civil 0.0 months (U.S. 8.7; ranked 1st in the
    U.S. and circuit), E.D. Pa. FY2004–06 civil 1.0 (U.S. 8.3–9.5), D.V.I. FY2002 criminal 0.7 (U.S. 6.8).
    The caveat says only that the value is printed that way; the profiles give no explanation.
  * Jurors "Avg. Present for Jury Selection" printed as 0 means no jury selection was held (an average over
    selections that took place cannot be 0), and "Percent Not Selected or Challenged" is then 0 of 0. Neither is
    a measurement, so both are left out of the observations and logged as gaps, with the printed value kept in
    `cell_caveats.csv`. This applies only to D.N.M.I. FY2024 (printed "0" in the FY2024 and FY2025 profiles;
    the same page leaves Trials Completed blank). A real 0% not selected with jurors present (D.N.M.I.
    FY2017) is kept.
* Statistics are district-level only. They describe caseload patterns, not reasons.

## 7. Verification against the PDFs

* **By eye on rendered page images** (`pdftoppm`), compared value by value with the parsed output:
  FY2004 national (including back-columns and the run-together case-mix row), FY2009 D.D.C., FY2011
  D.D.C., FY2006 S.D. Tex., FY2013 N.D. Ill., FY2021 N.D. Fla. On the last three, 8 randomly sampled
  observations per page were checked, 24 in all, and every one matched. The `pdftotext -layout` text
  was checked for FY2025 D.D.C., Arizona, E.D. Cal. and D.V.I., FY2015 D.D.C., and FY2009 S.D. Ga.
* **Encoded as fixtures** (`tests/pipeline/test_fcms_outputs.py::HAND_CHECKED`): 18 district values,
  each with its district, FY, variable, value and page, across all layout generations, plus 3 national
  values. Each asserts the value, the page in the locator, and the source id.
  `tests/pipeline/test_fcms_parse.py` re-parses five real pages from the cache.

## 8. Gaps (`data/gaps/fcms.json`, 41 records)

* `scanned_profiles`: FY1992–1998 have no machine-readable source, and FY1997–2003 own-year files are scans.
* `own_year_only_items_fy1999_2003`: ranks, % changes and case-mix are unavailable for FY1999–2003.
* `nos_legend_not_printed`: named case-mix categories are unavailable for FY2004–2009.
* `srh_count_not_published`: there is no absolute count of supervised release hearings. Only the
  per-judgeship figure is printed, so `fcms_filings_supervised_release_hearings` is not emitted, by design.
* `cells:*` records, one per variable × reason, list every district-year omitted:
  * AO-suppressed civil-trial medians (fewer than 10 trials)
  * territorial weighted filings
  * SRH before FY2002
  * blank percent-change cells (all rounding to 0.0%)
  * D.N.M.I. FY2024 trials (blank)
  * ranks printed `-`
  * D.D.C. within-circuit ranks: not applicable, since the D.C. Circuit has one district.
  * D.N.M.I. FY2024 trials ranks (U.S. and circuit): no standing printed because the value cell is blank
  * D.N.M.I. FY2024 jurors present / not selected: printed 0 with no jury selection held (§6)
* By-design empty cells (added after the statistics audit, which counted 4,326 cells missing from the log):
  * `casemix_letter_i_relabel:*`: `fcms_civil_type_copyright_patent_trademark` FY2021–25 and
    `fcms_civil_type_intellectual_property_rights` FY2010–20 (letter I relabelled in FY2021);
  * `rank_5yr_change_not_printed:{us,circuit}`: the 5-year % change standing, printed only in the FY2004–09 and
    FY2011 layouts, so absent FY2010 and FY2012–25 (checked on the FY2010 and FY2012 page text).
* The build now also sweeps every variable for district-years missing in a year the variable is published and
  logs any it finds, so the gap log covers every empty cell in FY1999–2025 (tested with the audit's own
  coverage check: 0 uncovered).

No source was blocked. Every file came from www.uscourts.gov.
