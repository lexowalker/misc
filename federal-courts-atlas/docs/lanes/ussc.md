# Lane report: U.S. Sentencing Commission (USSC)

**What it is.** Federal sentencing statistics for each of the 94 district courts, by USSC fiscal year
(Oct 1 to Sep 30, `period_type = FY_SEP30`). It covers how many individuals were sentenced, sentences
relative to the guideline range (within, above, government-sponsored below, non-government-sponsored below,
§5K1.1, §5K3.1, departures and variances), the prison rate, sentence length and the offense mix.
Coverage: FY2002–FY2025 from the USSC's case-level Individual Offender datafiles, and FY1995–FY2001 from the
USSC's published district packets for the variables they print. That is 31 years for the core series.

**Rebuild:** `PYTHONPATH=. .venv/bin/python -m pipeline.ussc.build`. A cold build downloads about 900 files
(~770 MB of datafile zips plus 829 packet PDFs; all cached by `pipeline.common.http.fetch`). A warm rebuild
(everything cached) takes about 1 minute. All outputs and the `data/sources/ussc.json` and `data/gaps/ussc.json`
fragments are rewritten from scratch on every run.
**Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_ussc*.py` (230 tests, including the
statistics-audit regressions in `test_ussc_regressions.py`).

**Audit fixes (2026-11-27).** The statistics audit (`docs/audits/stats_audit.md`) found two real errors, both
now fixed: FY2002–FY2017 sentence length counted a missing `SENSPLT0` as 469.99 months (§3), and the FY1998
W.D. La. offense mix was M.D. La.'s (§2). Lane-computed rows are now flagged `derived` per row (§3), and the
FY1995–FY1999 packet sums are written out and logged (§2, §7).

**Validation in one line:** the lane compared **60,030** published USSC numbers against its own
computations from the datafiles. They include every district's row in the two all-district packet tables
for every FY2002–FY2025 year, plus district-level tables for 174 district-years. **All 60,030 match** within
published rounding. See §5.

---

## 1. Sources

Publisher of everything: U.S. Sentencing Commission (www.ussc.gov). Every file is registered in
`data/sources/ussc.json` (892 entries) with its URL, vintage, retrieval date and sha256.

| source_id | what | URL |
|---|---|---|
| `ussc_datafiles_index` | Commission datafiles page (discovery only) | https://www.ussc.gov/research/datafiles/commission-datafiles |
| `ussc_opafy2002` … `ussc_opafy2025` | Individual Offender datafile, one zip per FY (fixed-width `.dat` + SAS/SPSS input programs) | `https://www.ussc.gov/sites/default/files/zip/opafy{YY}nid.zip` (FY2016/17: `opafy16-nid.zip`, `opafy17-nid.zip`) |
| `ussc_codebook_fy99_fy25` | Codebook FY1999–FY2025 (rev. Apr 7 2026): variable definitions; DISTRICT codes in Appendix A | https://www.ussc.gov/sites/default/files/pdf/research-and-publications/datafiles/USSC_Public_Release_Codebook_FY99_FY25.pdf |
| `ussc_sup_fy2014` … `ussc_sup_fy2017` | Supplemental datafiles: FY2018-methodology variables (SENTRNGE, OFFGUIDE, SENSPCAP) for FY2014–FY2017, keyed by USSCIDN | `https://www.ussc.gov/sites/default/files/zip/ussc_sup_fy{YY}.zip` |
| `ussc_sup_codebook_fy14_fy17` | Supplemental codebook (rev. Oct 21 2019) | https://www.ussc.gov/sites/default/files/zip/USSC_Supplemental_Codebook_FY14_FY17.pdf |
| `ussc_geography_page_fy{FY}` | "Federal Sentencing Statistics by State, District & Circuit" page per FY (discovery only) | `https://www.ussc.gov/research/data-reports/geography/{FY}-federal-sentencing-statistics` |
| `ussc_packet_fy{FY}_{code}` | Statistical Information Packet (PDF) for one district and FY, e.g. `ussc_packet_fy2025_vae` | `https://www.ussc.gov/sites/default/files/pdf/research-and-publications/federal-sentencing-statistics/state-district-circuit/{FY}/{code}{YY}.pdf` |
| `ussc_sourcebook_fy2025_figure09` | 2025 Sourcebook Figure 9, used to validate FY2016–FY2017 supplemental values | https://www.ussc.gov/sites/default/files/pdf/research-and-publications/annual-reports-and-sourcebooks/2025/Figure09.pdf |

The packets used are as follows. Every district packet for FY1995–FY2001 is a data source (655 packets;
the USSC posts none for D.N. Mar. I. in FY1995–FY1997). For validation, every E.D. Va. packet for
FY2002–FY2025 is used, because each holds the two all-district tables. Packets for 10 more districts in 15
sample years are also used for validation: D. Ariz., C.D. Cal., S.D. Fla., D. Guam, N.D. Ill., D. Mont.,
S.D.N.Y., D.P.R., W.D. Tex. and D. Alaska.

Not available: the USSC datafiles page offers Individual Offender files from FY2002 only. The codebook
covers FY1999 onward, but the FY1999–FY2001 files are not posted. Older data distributed elsewhere (e.g.
ICPSR) is outside this project's allowed hosts. No district statistics before FY1995 exist on ussc.gov.

## 2. Parsing method

**Datafiles** (`pipeline/ussc/datafile.py`). Each zip holds a fixed-width `.dat` of 18–59 KB per record
and 10k–30k variables (up to 2.3 GB uncompressed), plus a `.sas` program. The lane parses the SAS `INPUT`
statement (`NAME [$] start-end`) for column positions. It then streams the `.dat` member straight out of
the zip, slicing only the 25 columns it needs, and never extracts it to disk. The extract is cached as
parquet in `data/raw/ussc_extract/` (git-ignored), keyed by the zip's sha256 and the column list. Missing
values are blank or `.`, and are read as NaN. Columns read: DISTRICT, OFFTYPE2, OFFTYPSB, OFFGUIDE,
BOOKERCD, BOOKER2, SENTRNGE, DEPART, DEPART_A, DEPART_S, DEPART_D, BOOKPOST, BLAKPOST, SENTIMP, PRISDUM,
SENTTOT, SENTTOT0, SENSPLT, SENSPLT0, SENTTCAP, SENSPCAP, TOTPRISN, DISPOSIT, NOCOMP, CIRCDIST. For each year,
only the columns present in that year's layout are read. Records per year: FY2002 64,366 … FY2011 86,201 …
FY2025 66,662. These equal the national totals printed in the packets.

**Supplemental files (FY2014–FY2017).** These hold USSCIDN, OFFGUIDE, SENTRNGE and SENSPCAP. They are joined
one-to-one on USSCIDN to the same year's main file to get DISTRICT. Every record matched (tested).

**District codes** (`pipeline/ussc/crosswalk.py`). The datafile code `DISTRICT` (00–96; 21, 59 and 92
unused) is mapped to registry ids by a hand-typed table. Tests check it three ways:
(a) it is 1:1 over all 94 ids;
(b) each codebook label ("Penn. East", "Illinois Cent", "Louisiana Middle" = 96 …) resolves to the same id
through an independent label parser;
(c) the table equals the DISTRICT appendix parsed out of the cached codebook PDF.
Every FY2002–FY2025 file contains all 94 codes, with no unmapped values. The territorial courts appear
every year with small counts: D. Guam, D.N. Mar. I. (e.g. 16 cases in FY2001) and D.V.I.

**Packets** (`pipeline/ussc/packets.py`). Text comes from `pdftotext -layout`. Tables are cut at the
centred "Table N" heading lines. A "(cont.)" page keeps its section, and the FY2004/FY2005 "Pre-/Post-
Blakely" and "Pre-/Post-Booker" sections are tagged from the subtitle. In the all-district tables, a state
header line ("New York") is followed by indented direction rows ("Eastern 604 …"). Single-district rows
resolve directly, circuit rows are skipped, and the `TOTAL` row is national. pdftotext breaks some words
after an "l" glyph ("Rhode Isl and", "Pennsyl vania"), so labels are compared on letters only. In district
tables, a footnote digit is sometimes printed apart from its label ("Non-Government Variance 7"), with the
numbers wrapped to the next line; both cases are handled. FY2006–FY2017 range tables are printed in two
halves (above-range columns, then below-range columns); the halves are told apart by their width.

**FY1995–FY2001 fallback** (`pipeline/ussc/fallback.py`). Within-range and §5K1.1 shares, plus their
denominator, come from Table 8 ("Guideline departure rate by circuit and district") in the E.D. Va. packet.
The table lists every district. Cases total, Table 1 offense rows and the Table 7 TOTAL row come from each
district's own packet.

These old packets contain copy-and-paste slips; for example, the FY1995 N.D. Ala. packet's Table 7 note
describes "the District of Alaska", and the whole FY1998 W.D. La. packet (`LAW98.pdf`) is M.D. La.'s packet: its
cover says "Louisiana, West" but every table's district column is headed "Middle Louisiana". The lane therefore
applies these checks:
- A table is used only if its district column header ("National | <district>") names this district
  (`fallback.header_problem`, `crosswalk.district_from_header`). The header labels the column the values come
  from, so it is authoritative. Across all 2,626 FY1995–FY2001 packet tables with such a header, only these name another
  court or only a state: FY1995 N.D. Ala. T6–7 ("Alaska"), E.D. Cal. T6–7 ("California, Central"), D. Colo. T6–7
  ("Connecticut"), D.S.C. T3; FY1996 E.D. Ark. T3 ("Arkansas"); FY1997 C.D. Cal. T3 ("State of California");
  FY1998 M.D. Ga. T7 ("Georgia"); FY1998 W.D. La. T1, T3, T6, T7 ("Middle Louisiana"). Of the tables the lane
  reads (1 and 7), this check newly rejects only W.D. La. FY1998 Table 1. Before the audit that table was kept,
  because its note names no district, and W.D. La. FY1998 carried M.D. La.'s 11 offense-mix values.
- A table whose notes name a *different* district is not used for that district.
- The cases total is taken only from notes naming the district itself, and only if all such notes agree.
- A Table 7 TOTAL row that is broken in the text layer is skipped.
- Counts may not exceed the cases total.

Everything skipped is logged as a gap with its reason: 13 items in 10 district-years. A test asserts that no
two districts share an identical offense-mix vector in any year (the W.D. La./M.D. La. FY1998 copy was the only
one).

**Packet sums vs national (`packet_reconciliation.csv`).** For FY2000–FY2001 the district values sum exactly to
the national totals, and the range denominators (one all-district table) sum to the national figure in every
fallback year (tested). FY1995–FY1999 do not always add up. With all 94 districts present, the only mismatch
is FY1999 `ussc_cases_prison_term`: districts 45,436 vs national 45,379 (+57), a source inconsistency (the
audit's independent re-read reproduces every district value; the N-weighted mean of district means equals the
national mean, 56.9). In 29 other FY1995–FY1999 variable-years a shortfall remains where district-years are
missing; it cannot be told apart from the missing districts' own counts and is **not** used to fill them.
(The audit's FY1998 drug-trafficking example, 19,533 vs 19,615, included W.D. La.'s wrong value 32; with that
cell removed, the FY1998 shortfalls in the offense counts sum exactly to the shortfall in offense-known cases,
289.) Do not present FY1995–FY1999 district counts as summing to the nation; the count variables carry this
caveat in `variables.json`, and the gap log has `ussc_fy1995_1999_packets_do_not_sum_to_national`.

## 3. Variable definitions

All values are as the USSC computes them. Percentages run 0–100 and are rounded to 1 decimal, the USSC's
own precision. Means and medians are in months, rounded to 1 decimal; from FY2011 the USSC prints them as
integers. The observations table carries four extra columns: `basis`, `derived`, `numerator` and `n_basis` (the
denominator, or the N behind a mean or median), so that small denominators can be flagged.

`basis` values:
- `reproduces_published`: a USSC-published district statistic for that FY, reproduced from the datafile.
- `published_packet`: taken from a packet table (FY1995–FY2001).
- `derived_from_published_counts`: "other" offense = packet TOTAL minus the four named rows (FY1995–FY2001).
- `pooled_published_halves`: FY2004/FY2005 range shares; the USSC published only the two half-years, and
  each half was validated.
- `computed_ussc_definition`: a USSC definition applied in a year when the USSC did not print that exact
  statistic.
- `sum_of_published_components`: FY2018+ four-way grouping.
- `computed_ussc_supplemental`: FY2014–FY2017 values from the supplemental files.

**`derived` (per row; DATA_CONTRACT rule 3).** `derived = true` for every basis except `reproduces_published`
and `published_packet`, i.e. whenever the value is this lane's computation rather than a figure the USSC
printed. A variable can be published in some years and derived in others, so `variables.json` adds
`derived_years` (the years with derived rows) and `derived_formula_by_basis` (the formula to show on hover for
each derived basis). The variable-level `derived` flag stays true only where every row is derived (the three
`*_2018scheme` ids). Derived years: `ussc_pct_prison` and the probation-as-zero sentence measures FY2002–FY2017;
`ussc_mean/median_prison_months` and `ussc_cases_prison_term` FY2004–FY2005 and FY2018–FY2025; the range shares
and their denominator FY2004–FY2005 (pooled halves); offense "other" FY1995–FY2001; the SENTRNGE components
FY2014–FY2017. `national.csv` carries the same column.

**Guideline range.** The denominator is `ussc_cases_range_known`: cases whose sentence the USSC could compare
with the range. Each scheme below lists its datafile variable and codes.

| scheme | years | variable and codes |
|---|---|---|
| departure (pre-PROTECT) | FY2002 | `DEPART`: 0 within; 1 upward; 3,5,7,9 §5K1.1; 2,4,6 other downward; 8 excluded |
| departure | FY2003 | `DEPART_S` 0 within, 1 upward; `DEPART_S`=2 split by `DEPART_D`: 0 §5K1.1, 1 government initiated, 2 other downward |
| departure | FY2004 (BLAKPOST halves), FY2005 pre-Booker (BOOKPOST=0) | `DEPART_A`: 0 within, 1 upward, 2 §5K1.1, 3 §5K3.1 + 4 other gov't = "government initiated", 5 other downward |
| Booker (BOOKERCD) | FY2005 post-Booker, FY2006–FY2017 | 0 within; 1–4 above range; 5 §5K1.1, 6 §5K3.1, 7 other gov't-sponsored (= government-sponsored below range); 8–11 non-government-sponsored below range |
| SENTRNGE | FY2018–FY2025 (and FY2014–FY2017 supplemental) | 0 within; 1 upward departure; 2 §5K1.1; 3 §5K3.1; 4 other government-motion departure; 5 non-government departure; 6 upward variance; 7 government-motion variance; 8 non-government variance |

The range variables are defined as follows:
- `ussc_pct_within_range` (FY1995–FY2025) = within / denominator.
- `ussc_pct_substantial_assistance_5k1` (FY1995–FY2025) = §5K1.1 / denominator.
- `ussc_pct_early_disposition_5k3` (FY2006–FY2025) = §5K3.1 / denominator.
- `ussc_pct_above_range`, `ussc_pct_govt_sponsored_below_range` and `ussc_pct_non_govt_sponsored_below_range`
  cover FY2006–FY2017 only. These are the BOOKERCD groups exactly as the USSC printed them in packet Table 8.
- `*_2018scheme` (FY2014–FY2025, `derived: true`) are the same four-way partition rebuilt from SENTRNGE:
  - above = 1 + 6;
  - government-sponsored = 2 + 3 + 4 + 7;
  - non-government = 5 + 8.
- The SENTRNGE components (FY2014–FY2025) are `ussc_pct_upward_departure`,
  `ussc_pct_other_govt_motion_departure`, `ussc_pct_non_govt_downward_departure`, `ussc_pct_upward_variance`,
  `ussc_pct_govt_motion_downward_variance`, `ussc_pct_non_govt_downward_variance` and `ussc_pct_variance`
  (6 + 7 + 8; packet Table 9 "Variance").

**Prison.** `ussc_pct_prison` (FY2002–FY2025) is the share with `SENTIMP` ∈ {1 prison only,
2 prison + alternatives/split}. The denominator is all cases with SENTIMP, including 0 = fine only. This is
the FY2018+ packet Table 5 convention, applied to every year.

**Sentence length** uses two conventions, each consistent across all years:
- `ussc_mean_sentence_months` / `ussc_median_sentence_months` (FY2002–FY2025) follow the FY2018+ packet
  Table 7 "Sentence length" convention. The quantity is months of imprisonment plus months of alternative
  confinement, with probation-only and fine-only cases counted as **0**. Terms over 470 months count as
  469.99 and life as 470; the packets say "470 months or greater (including life) … as 470 months". The
  variable is `SENSPCAP` for FY2018+. For earlier years the same rule is applied to `SENSPLT0`
  (`s.mask(s > 470, 469.99)`). A missing value stays missing and is left out of the mean, the median and N
  (`n_basis` = cases with a non-missing value), as the USSC leaves out a missing SENSPCAP. In FY2018, FY2021 and
  FY2025 the rule applied to SENSPLT0 equals SENSPCAP record-for-record, missing values included (tested; the
  one FY2021 record with SENSPCAP missing has SENSPLT0 missing too).

  **Corrected 2026-11-27 (statistics audit, blocker 1).** The code used `s.where(s <= 470, 469.99)`, which also
  replaced every missing SENSPLT0 with 469.99 months, because `NaN <= 470` is False. That inflated FY2002–FY2017
  means and medians and counted the missing records in N: 2,457 records (746 in FY2002, falling to 2 in FY2017).
  The rebuild changed 414 mean and 116 median district cells and 416 district-year Ns. Examples (before → after):
  E.D. La. FY2002 mean 91.3 → 51.3, median 37.0 → 33.0, N 408 → 369; D.P.R. FY2004 mean 96.3 → 62.1; C.D. Cal.
  FY2007 mean 64.8 → 45.9; national FY2002/2003/2004 mean 51.5/50.2/50.9 → 46.6/47.2/48.4. FY2018+ was not
  affected. Each value now matches the audit's independent recompute (pinned in `test_ussc_regressions.py`).
- `ussc_mean_prison_months` / `ussc_median_prison_months` (FY1995–FY2025) follow the packet Table 7
  "(Average) length of imprisonment" convention used FY1995–FY2017. The variable is `SENTTOT`
  (imprisonment only; alternative confinement excluded) for cases with a term > 0 and a known primary
  offense. Terms are **not capped**: life is coded 470, and longer terms count at face value. This was
  established by matching the packets: capping at 470 does not reproduce them. `ussc_cases_prison_term` is
  its N.

**Offense mix.** The denominator is `ussc_cases_offense_known` (primary offense not missing). The variable
is the one the USSC used in that year's own publications:
- OFFTYPE2, FY1995–FY2009 (statute of conviction with the highest statutory maximum);
- OFFTYPSB, FY2010–FY2017 (same basis);
- OFFGUIDE, FY2018+ (primary sentencing guideline applied).

| category | OFFTYPE2 / OFFTYPSB code | OFFGUIDE code |
|---|---|---|
| `drug_trafficking` | 10 "Drugs – trafficking, manufacturing, importing" | 10 "Drug Trafficking" |
| `immigration` | 27 | 17 |
| `firearms` | 13 | 13 |
| `fraud` (to FY2017 only) | 18 "Fraud" | — |
| `fraud_theft_embezzlement` (FY2018+ only) | — | 16 "Fraud/Theft/Embezzlement" |
| `child_pornography` (FY2010+) | OFFTYPSB 28 (OFFTYPE2 has no separate code) | 7 |
| `other` | all remaining codes | all remaining codes |

Each category has `ussc_pct_offense_*` (share) and `ussc_count_offense_*` (count). Drug communication-facility
and simple-possession cases are in "other" before FY2018 ("Drug Possession" is in "other" after).

**Counts.** `ussc_cases_total` is the number of individual offenders sentenced and reported to the USSC (the
datafile record count; organizations, resentencings and appeals are excluded). The other counts are
`ussc_cases_range_known`, `ussc_cases_offense_known` and `ussc_cases_prison_term`.

## 4. Coverage (variable × first/last FY × districts per year)

"Years with all 94" counts fiscal years in which every district has a value.

| variable | first FY | last FY | districts per year (min–max) | years | years with all 94 |
|---|---|---|---|---|---|
| `ussc_cases_total` | 1995 | 2025 | 91–94 | 31 | 26 |
| `ussc_cases_range_known` | 1995 | 2025 | 94–94 | 31 | 31 |
| `ussc_cases_offense_known` | 1995 | 2025 | 93–94 | 31 | 27 |
| `ussc_cases_prison_term` | 1995 | 2025 | 90–94 | 31 | 27 |
| `ussc_pct_within_range` | 1995 | 2025 | 94–94 | 31 | 31 |
| `ussc_pct_substantial_assistance_5k1` | 1995 | 2025 | 94–94 | 31 | 31 |
| `ussc_pct_early_disposition_5k3` | 2006 | 2025 | 94–94 | 20 | 20 |
| `ussc_pct_above_range` | 2006 | 2017 | 94–94 | 12 | 12 |
| `ussc_pct_govt_sponsored_below_range` | 2006 | 2017 | 94–94 | 12 | 12 |
| `ussc_pct_non_govt_sponsored_below_range` | 2006 | 2017 | 94–94 | 12 | 12 |
| `ussc_pct_above_range_2018scheme` (derived) | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_govt_sponsored_below_range_2018scheme` (derived) | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_non_govt_sponsored_below_range_2018scheme` (derived) | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_upward_departure` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_other_govt_motion_departure` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_non_govt_downward_departure` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_upward_variance` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_govt_motion_downward_variance` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_non_govt_downward_variance` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_variance` | 2014 | 2025 | 94–94 | 12 | 12 |
| `ussc_pct_prison` | 2002 | 2025 | 94–94 | 24 | 24 |
| `ussc_mean_sentence_months` | 2002 | 2025 | 94–94 | 24 | 24 |
| `ussc_median_sentence_months` | 2002 | 2025 | 94–94 | 24 | 24 |
| `ussc_mean_prison_months` | 1995 | 2025 | 90–94 | 31 | 27 |
| `ussc_median_prison_months` | 1995 | 2025 | 90–94 | 31 | 27 |
| `ussc_pct_offense_drug_trafficking` / `ussc_count_…` | 1995 | 2025 | 93–94 | 31 | 27 |
| `ussc_pct_offense_immigration` / `ussc_count_…` | 1995 | 2025 | 93–94 | 31 | 27 |
| `ussc_pct_offense_firearms` / `ussc_count_…` | 1995 | 2025 | 93–94 | 31 | 27 |
| `ussc_pct_offense_fraud` / `ussc_count_…` | 1995 | 2017 | 93–94 | 23 | 19 |
| `ussc_pct_offense_fraud_theft_embezzlement` / `ussc_count_…` | 2018 | 2025 | 94–94 | 8 | 8 |
| `ussc_pct_offense_child_pornography` / `ussc_count_…` | 2010 | 2025 | 94–94 | 16 | 16 |
| `ussc_pct_offense_other` / `ussc_count_…` | 1995 | 2025 | 93–94 | 31 | 27 |

Every FY2002–FY2025 cell is filled for all 94 districts. All missing cells are in FY1995–FY1999 (packet
fallback; listed in `data/gaps/ussc.json`). The offense-mix rows lost one full year (FY1998) when W.D. La.'s
copied values were removed.

## 5. Validation against published USSC tables

`data/processed/ussc/validation.csv` has one row per comparison, with these columns: fy, district_id,
source_id (the packet), table, period, measure, published, computed, abs_diff, match and note.
`validation_summary.json` gives the counts per table. Tolerances are 0 for counts, ±0.05 for one-decimal
percents and means, and ±0.5 for integer means and medians (FY2011+).

| packet table | comparisons | mismatches |
|---|---|---|
| Table 9 / Table 8 "… by circuit and district" (all 94 districts, every FY2002–FY2025; FY2004/05 per half-year) | 38,380 + 7,410 | 0 |
| Table 2 "Guilty pleas and trials by circuit and district", TOTAL (all districts, all years: checks crosswalk and record counts) | 2,470 | 0 |
| Table 1 offense mix (counts and %) | 3,556 | 0 |
| Table 4 / Table 5 sentence type | 3,644 | 0 |
| Table 7 sentence length (mean, median, N) | 1,176 | 0 |
| Table 8 sentence relative to the guideline range (district + national) | 3,036 | 0 |
| Case totals in Table 1 / Figure A notes | 348 | 0 |
| Sourcebook FY2025 Figure 9, FY2016–FY2017 national (FY2018 methodology, supplemental files) | 10 | 0 |

District-level tables were checked for 174 district-years spanning every era: E.D. Va. in all 24 years, and
10 other districts in FY2002–FY2005, 2006, 2008, 2010, 2012, 2015, 2017, 2018, 2019, 2021, 2023 and 2025.
National figures (`national.csv`, district_id `US`) were checked against every year's packet. Examples:
66,662 individuals in FY2025; 51.5% within range (33,979 of 66,036); mean sentence 47 months and median 18.

Matching established four facts about USSC conventions, now encoded in the code:
1. Packet Table 2 counts DISPOSIT codes 1–4 in FY2002–FY2004, and also code 5 ("plea and trial") from FY2005.
2. Pre-FY2018 Table 7 uses SENTTOT without a cap.
3. Pre-FY2010 Table 1, 5 and 7 totals exclude cases with a missing primary offense.
4. FY2006–FY2009 packets print a range group's percentage as the sum of its rounded sub-category percentages.
   For example, the national non-government share 12.0 = 2.7 + 2.0 + 6.0 + 1.3, while 8,507 / 70,187 = 12.1%.
   The counts match exactly. These 46 comparisons are accepted with a note, and the emitted value is the
   exact count/denominator.

Hand-checked fixtures in `tests/pipeline/test_ussc_outputs.py` cover 58 values in 23 district-years, from
FY1995 to FY2025. Each was read off the packet PDFs, and several were checked against rendered page images:
FY1995 Table 8, FY2006 Table 8 and FY2025 Table 7.

## 6. Definitional breaks and caveats

Each break below is also recorded in `variables.json` (`caveats`, `breaks`, `basis_by_year`) and in the gap log.

1. **Booker (Jan 12, 2005).** Before Booker the categories are departures only. The USSC did not publish
   the within/above/government-sponsored/non-government grouping as a full-fiscal-year figure before FY2006:
   FY2005 is split, and only its post-Booker part (Jan 12–Sep 30) uses the Booker categories. Those three
   shares are therefore omitted for FY1995–FY2005; within-range and §5K1.1 continue.
2. **Blakely (June 24, 2004).** The USSC split FY2004 into pre- and post-Blakely tables. FY2004 range shares
   are pooled from both halves; the categories are identical in each.
3. **PROTECT Act / fast track.** §5K3.1 is printed separately only from FY2006. FY2003–FY2005 fold it into
   "government initiated departure"; the program dates from April 2003.
4. **USSC FY2018 methodology (SENTRNGE).** The packets switched from the BOOKERCD groups to departures vs
   variances with government/non-government attribution. The USSC stopped printing the four-way grouping, so
   the old ids stop at FY2017. `*_2018scheme` ids carry the same partition rebuilt from SENTRNGE for
   FY2014–FY2025: FY2014–FY2017 from the USSC supplemental files, FY2018+ from the published components.
   They are marked `derived`, because the USSC prints the components but not the sums.

   **Finding:** in the FY2014–FY2017 overlap, the four-way shares are identical under BOOKERCD and SENTRNGE
   for every district and year (tested). So are within-range, §5K1.1, §5K3.1 and the denominator. The
   methodology change re-labels departures versus variances without moving any case between the four groups,
   at least as the USSC back-coded FY2014–FY2017. The two id families are kept apart only to respect what the
   USSC itself printed. The web lane can present them as one series, with a note at FY2018.

5. **Offense classification.**
   - FY2010: child pornography becomes a separate category; before that it is inside "Pornography/
     Prostitution", so it is omitted.
   - FY2018: classification moves from the statute of conviction to the primary guideline. All categories
     break, though the USSC keeps the names for drug trafficking, immigration, firearms and child
     pornography.
   - "Fraud" (to FY2017) and "Fraud/Theft/Embezzlement" (FY2018+) are different categories and have
     separate ids.
   - The composition of "other" changes at each break.
6. **Prison rate convention.** FY2002–FY2017 packets left fine-only cases out of the sentence-type
   denominator. `ussc_pct_prison` keeps them in every year so the series is consistent. Its numerators match
   the packets exactly, but its pre-FY2018 percentages are a little lower than the printed ones where
   fine-only cases are common (e.g. 9.6% of E.D. Va. cases in FY2018 were fine-only).
7. **Two sentence-length conventions.** `ussc_mean/median_sentence_months` counts probation as 0. It
   reproduces the packets from FY2018 and is computed with the same rule for FY2002–FY2017 (missing values
   excluded; see §3 for the 2026-11-27 correction).
   `ussc_mean/median_prison_months` covers prison cases only. It reproduces the packets for FY1995–FY2017
   and is computed for FY2018+. Do not mix the two.
8. **Small denominators.** D.N. Mar. I., D. Guam and D.V.I. sentence tens of people a year; a few small
   districts have only dozens of guideline-range cases. Use `ussc_cases_total` / `n_basis` to flag them.
   Medians of small groups can be 0.
9. **Statistics are district-level patterns.** Range categories reflect the reasons recorded on Statement of
   Reasons forms and USSC coding. They describe outcomes, not why courts or prosecutors acted.

## 7. Gaps (`data/gaps/ussc.json`)

- Before FY1995: nothing on ussc.gov.
- FY1995–FY2001: the datafiles are not posted. So there are no values for `ussc_pct_prison`, the
  probation-as-zero sentence measures, §5K3.1, the four-way grouping or child pornography.
- Four-way grouping (old ids) omitted for FY1995–FY2005 and FY2018–FY2025 (breaks 1 and 4).
- §5K3.1 before FY2006; child pornography before FY2010; "Fraud" after FY2017 and "Fraud/Theft/Embezzlement"
  before FY2018; SENTRNGE components before FY2014.
- D.N. Mar. I. FY1995–FY1997: no district packet posted. Range shares exist from the all-district table, but
  there are no totals, offense mix or imprisonment length.
- 13 packet items in 10 FY1995–FY1999 district-years where a packet failed a safety check, each with its
  reason:
  - a table's district column header names another court or only a state: Table 7 of N.D. Ala. ("Alaska"),
    E.D. Cal. ("California, Central") and D. Colo. ("Connecticut") FY1995, M.D. Ga. FY1998 ("Georgia"; its N
    also exceeds the district's cases total); Tables 1 and 7 of W.D. La. FY1998 ("Middle Louisiana"), so W.D.
    La. FY1998 has no offense mix;
  - notes disagree on the cases total: D. Mass. FY1996 (416 vs 461); S.D. Cal. FY1997 (1,130 vs 3,130);
    N.D. Miss. FY1999 (163 vs 164);
  - the text layer is broken or missing: N.D. Cal. FY1996 Table 7; M.D.N.C. FY1996 Table 7;
  - no note names the district's total: M.D.N.C. FY1996, W.D. La. FY1998.
- `ussc_fy1995_1999_packets_do_not_sum_to_national`: not missing data but a source caveat (§2): FY1995–FY1999
  district counts do not always add up to the national packet figures.

## 8. Outputs (`data/processed/ussc/`)

| file | content |
|---|---|
| `observations.parquet/.csv` | district × FY × variable (contract columns + `basis`, `derived`, `numerator`, `n_basis`); 39 variables, 78,690 rows |
| `national.csv` | the same variables for the nation (district_id `US`) |
| `variables.json` | one entry per variable: contract fields + `formula`, `derived`, `breaks`, `first_period`, `last_period`, `n_districts_by_year`, `basis_by_year`, `derived_years`, `derived_formula_by_basis` |
| `packet_reconciliation.csv` | FY1995–FY2001: sum of district packet values vs the national packet figure, per count variable (§2) |
| `components.parquet` | every count behind every value: fy, district_id (+US), period (full or half-year), scheme, component, value. Includes the 12 BOOKERCD categories, 9 SENTRNGE categories, sentence-type counts, means/medians under both conventions, Table 2 totals and supplemental join counts. Use it to audit or to build other groupings. |
| `validation.csv`, `validation_summary.json` | every published-vs-computed comparison (§5) |

Notes for other lanes: the column-extract cache lives in `data/raw/ussc_extract/` (git-ignored). No
change to the shared files is needed.
