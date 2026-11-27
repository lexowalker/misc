# Statistics audit: FCMS, USSC, IDB lanes

Auditor: adversarial statistics verification lane. Date: 2026-11-27.
Scope: `pipeline/{fcms,ussc,idb}`, `data/processed/{fcms,ussc,idb}`, `data/gaps/{fcms,ussc,idb}.json`, the three lane
reports, `docs/BRIEF.md` and `docs/DATA_CONTRACT.md`. No lane code or output was modified.

## Verdict: FAIL (1 blocker, 1 major, 6 minor)

| # | severity | lane | finding |
|---|---|---|---|
| 1 | **blocker** | USSC | `ussc_mean_sentence_months` / `ussc_median_sentence_months` FY2002-FY2017 are corrupted: every record with a missing `SENSPLT0` is counted as **469.99 months** (39 years). 406 mean and 113 median district cells are wrong, by up to **+40.0 months** (E.D. La. FY2002: 91.3 published vs 51.3 correct). The national series is inflated too (FY2002 51.5 vs 46.6). |
| 2 | **major** | USSC | W.D. La. FY1998: all 11 offense-mix values (`ussc_cases_offense_known`, 5 counts, 5 shares) are **M.D. La.'s numbers**. The source packet `law98.pdf` contains M.D. La.'s data in every district column ("Middle Louisiana"; "Of the 117 guideline cases from the Middle District of Louisiana"). The lane dropped only Table 7 and kept Table 1. |
| 3 | minor | USSC | Lane-computed years (prison rate and sentence length FY2002-17, prison length FY2018+, "other" offense FY1995-2001) are emitted with `derived: false`. Only the per-row `basis` column says they are not published figures (DATA_CONTRACT rule 3). |
| 4 | minor | USSC | FY1995-FY1999 district packet values do not add up to the national packet totals, even where all 94 districts are present (FY1998 drug trafficking -82; FY1999 prison-term N **+57 above the nation**). The source causes this (independent re-read of all 94 packets reproduces the lane exactly), but it is not documented. |
| 5 | minor | FCMS | Vacant judgeship months: district sums do not equal the national page in 20 of 27 years. Most gaps are rounding (0.1-0.5), but FY2003 is off by **9.0** (453.8 vs 444.8). The source causes it (same in all five vintages FY2004-08, confirmed by my own pdftotext sum). Not documented; the report lists every other reconciled variable. |
| 6 | minor | FCMS | Faithfully transcribed but implausible source cells carry no caveat: S.D. Fla. FY2023 civil median **0.0 months** (rank 1 in the U.S.), and D.N.M.I. FY2024 jurors present **0** / not selected **0%** (no jury selections, not a measured zero). Also E.D. Pa. FY2004-06 civil median 1.0. |
| 7 | minor | FCMS | Gap log incomplete for by-design holes: the letter-I relabel (copyright/patent/trademark ends FY2020; intellectual property rights starts FY2021, only 5 years); the 5-year % change standing, not printed after FY2011; and the D.N.M.I. FY2024 trials **rank** cells. The lane report documents them, but `data/gaps/fcms.json` does not. |
| 8 | minor | FCMS | The default `observations` table zig-zags between counting units for criminal-sensitive variables: FY2009 cases, FY2010 defendants, FY2011 cases, FY2012+ defendants. National total filings go 394,345, then 378,604, then 386,664. This is documented and flagged per row (`method`), and `observations_current_method` is correct (verified), but the inconsistent table is the default. |

Everything else checked holds. 51 of 51 sampled cells match the sources. My independent recompute of the
case-level files reproduces 66,409 of 66,928 USSC cells; every miss is item 1. It also reproduces 28,663 of 28,663 IDB
criminal cells, and 3,666 of 3,666 cells for each IDB civil terminations, trial-rate and filings variable. FCMS national
equals the sum of the 94 districts for filings, terminations, pending, judgeships and case-mix totals in every year. No
crosswalk swaps, no off-by-one fiscal years and no unit (0-1 vs 0-100) errors were found. All three test suites pass.

---

## 1. Trace-back sample (51 rows)

**Sampling.** Deterministic. Each lane's `observations.parquet` was sorted by
`sha256(district_id|variable|period|"audit2026")`, and every k-th row was taken (k = n // 17), giving 17 rows per lane.
The sample spans 49 district ids. It covers every FCMS layout generation (FY1999 and FY2003 back-columns, mono FY2004-09,
Excel FY2011, words FY2012-25), the USSC FY1995 packet fallback, the FY2002-25 datafiles and the FY2014/16 supplemental
files, and IDB FY1990-2026, civil and criminal.

**Method, independent of lane code.**

* **FCMS:** `pdftotext -layout -f p -l p` on the cached PDF named in `data/sources/fcms.json`. Values were read by row
  label and year column.
* **USSC datafiles:** my own reader parses each zip's `.sas` `INPUT` block for column positions and streams the `.dat`.
  Districts come from my own parse of codebook Appendix A (`USSC_Public_Release_Codebook_FY99_FY25.pdf`, DISTRICT
  00-96), and every statistic was recomputed from the codebook definitions (BOOKERCD, SENTRNGE, DEPART*, OFFTYPE2/OFFTYPSB/
  OFFGUIDE, SENTIMP, SENTTOT, SENSPLT0, SENSPCAP).
* **IDB:** `unzip -p` streaming of `cv88on_0.zip` / `cr96on_0.zip` (11,071,506 and 6,345,702 records, 0 malformed),
  with columns located from the file header and districts from my own parse of the civil codebook's DISTRICT table.
  Filed = fiscal year of FDATEUSE; terminated = fiscal year of TDATEUSE with TAPEYEAR != 2099; criminal = FISCALYR
  snapshot with CTFIL/CTTR. Drugs = D2 6500-6999 and firearms/explosives = D2 {7800, 7820, 7830, 7831, 9994}, both
  read off the FJC's D2 label list.

Rounding tolerance: USSC is compared at its published precision (1 decimal; integers for FY2011+ means and medians). IDB
and FCMS must match exactly.

| # | lane | district | FY | variable | table | auditor | source + locator | result |
|---|---|---|---|---|---|---|---|---|
| 1 | FCMS | mnd | 2011 | `fcms_filings_criminal_felony` | 309 | 309 | district_fcms_profiles_september_2011.pdf p.58, NOS table row "Criminal*", Total | MATCH |
| 2 | FCMS | mad | 2025 | `fcms_jurors_avg_present` | 67.1 | 67.1 | fcms_na_distprofile0930_2025.pdf p.4, "Avg. Present for Jury Selection", 2025 | MATCH |
| 3 | FCMS | nced | 2012 | `fcms_median_months_civil_filing_to_disposition` | 8.9 | 8.9 | district-fcms-profiles-september-2012.pdf p.21, Median Time Civil, 2012 | MATCH |
| 4 | FCMS | njd | 2021 | `fcms_pending_per_judgeship` | 3694 | 3694 | fcms_na_distprofile0930.2021.pdf p.15, Pending Cases per judgeship, 2021 | MATCH |
| 5 | FCMS | nynd | 2013 | `fcms_judgeships` | 5 | 5 | district-fcms-profiles-september-2013.pdf p.9, Number of Judgeships, 2013 | MATCH |
| 6 | FCMS | dcd | 2013 | `fcms_civil_over_3yrs_pct` | 17.2 | 17.2 | district-fcms-profiles-september-2013.pdf p.2, Over 3 Years Old %, 2013 | MATCH |
| 7 | FCMS | oknd | 2021 | `fcms_terminations_per_judgeship` | 320 | 320 | fcms_na_distprofile0930.2021.pdf p.82, Terminations per judgeship, 2021 | MATCH |
| 8 | FCMS | ilcd | 2003 | `fcms_filings_per_judgeship_civil` | 284 | 284 | District_FCMS_Sep_2004.pdf p.48, Civil per judgeship, 2003 column | MATCH |
| 9 | FCMS | sdd | 2021 | `fcms_pct_change_filings_5yr` | -20.9 | -20.9 | fcms_na_distprofile0930.2021.pdf p.63, % change row under 2016 (1,240 vs 1,567 = -20.87%) | MATCH |
| 10 | FCMS | flsd | 2009 | `fcms_pending_per_judgeship` | 317 | 317 | District_FCMS_Sep_2009.pdf p.92, Pending Cases per judgeship, 2009 | MATCH |
| 11 | FCMS | ncwd | 2007 | `fcms_vacant_judgeship_months` | 11.3 | 11.3 | District_FCMS_Sep_2007.pdf p.23, Vacant Judgeship Months, 2007 | MATCH |
| 12 | FCMS | dcd | 2023 | `fcms_vacant_judgeship_months` | 17.0 | 17.0 | fcms_na_disprofile0930.2023.pdf p.2, Vacant Judgeship Months, 2023 | MATCH |
| 13 | FCMS | ared | 2009 | `fcms_weighted_filings_per_judgeship` | 394 | 394 | District_FCMS_Sep_2009.pdf p.54, Weighted Filings, 2009 | MATCH |
| 14 | FCMS | mnd | 2021 | `fcms_judgeships` | 7 | 7 | fcms_na_distprofile0930.2021.pdf p.58, Number of Judgeships, 2021 | MATCH |
| 15 | FCMS | nvd | 2004 | `fcms_avg_felony_defendants_per_case` | 1.4 | 1.4 | District_FCMS_Sep_2004.pdf p.73, Avg Felony Defendants per Case, 2004 | MATCH |
| 16 | FCMS | wvnd | 1999 | `fcms_trials_completed_per_judgeship` | 28 | 28 | District_FCMS_Sep_2004.pdf p.27, Trials Completed, 1999 column | MATCH |
| 17 | FCMS | cacd | 2009 | `fcms_filings_total` | 16170 | 16170 | District_FCMS_Sep_2009.pdf p.68, Filings*, 2009 | MATCH |
| 18 | USSC | azd | 2023 | `ussc_pct_offense_firearms` | 3.6 | 3.574 | opafy23nid.dat: DISTRICT 70, OFFGUIDE=13 / OFFGUIDE non-missing | MATCH |
| 19 | USSC | laed | 2005 | `ussc_count_offense_other` | 104 | 104 | opafy05nid.dat: DISTRICT 35, OFFTYPE2 known and not in {10,27,13,18} | MATCH |
| 20 | USSC | casd | 2002 | `ussc_pct_prison` | 95.0 | 95.02 | opafy02nid.dat: DISTRICT 74, SENTIMP in {1,2} / SENTIMP non-missing | MATCH |
| 21 | USSC | njd | 2016 | `ussc_pct_govt_sponsored_below_range` | 35.7 | 35.68 | opafy16nid.dat: DISTRICT 12, BOOKERCD 5-7 / BOOKERCD 0-11 | MATCH |
| 22 | USSC | idd | 2022 | `ussc_count_offense_fraud_theft_embezzlement` | 33 | 33 | opafy22nid.dat: DISTRICT 76, OFFGUIDE=16 | MATCH |
| 23 | USSC | moed | 2014 | `ussc_pct_upward_departure` | 0.4 | 0.430 | ussc_sup_fy14.dat joined on USSCIDN to opafy14nid.dat: DISTRICT 65, SENTRNGE=1 | MATCH |
| 24 | USSC | moed | 2016 | `ussc_pct_upward_variance` | 2.2 | 2.162 | ussc_sup_fy16.dat joined to opafy16nid.dat: DISTRICT 65, SENTRNGE=6 | MATCH |
| 25 | USSC | wawd | 1995 | `ussc_cases_prison_term` | 305 | 305 | WAW95.pdf Table 7, row TOTAL, district "Number" | MATCH |
| 26 | USSC | wawd | 2019 | `ussc_count_offense_other` | 144 | 144 | opafy19nid.dat: DISTRICT 81, OFFGUIDE known and not in {10,17,13,16,7} | MATCH |
| 27 | USSC | dcd | 2022 | `ussc_count_offense_drug_trafficking` | 53 | 53 | opafy22nid.dat: DISTRICT 90, OFFGUIDE=10 | MATCH |
| 28 | USSC | tned | 2014 | `ussc_count_offense_drug_trafficking` | 435 | 435 | opafy14nid.dat: DISTRICT 49, OFFTYPSB=10 | MATCH |
| 29 | USSC | txwd | 2013 | `ussc_pct_offense_immigration` | 61.3 | 61.27 | opafy13nid.dat: DISTRICT 42, OFFTYPSB=27 | MATCH |
| 30 | USSC | mied | 2013 | `ussc_pct_offense_immigration` | 15.7 | 15.73 | opafy13nid.dat: DISTRICT 45, OFFTYPSB=27 | MATCH |
| 31 | USSC | dcd | 2015 | `ussc_mean_prison_months` | 61.2 | 61.24 | opafy15nid.dat: DISTRICT 90, mean SENTTOT where >0 and OFFTYPSB known | MATCH |
| 32 | USSC | gasd | 2013 | `ussc_pct_offense_child_pornography` | 2.2 | 2.155 | opafy13nid.dat: DISTRICT 34, OFFTYPSB=28 | MATCH |
| 33 | USSC | cand | 2007 | `ussc_median_prison_months` | 33 | 33 | opafy07nid.dat: DISTRICT 71, median SENTTOT where >0 and OFFTYPE2 known | MATCH |
| 34 | USSC | ned | 2025 | `ussc_pct_non_govt_downward_variance` | 22.7 | 22.69 | opafy25nid.dat: DISTRICT 67, SENTRNGE=8 / SENTRNGE 0-8 | MATCH |
| 35 | IDB | mssd | 1993 | `idb_civil_pct_class_action` | 0.6623 | 0.6623 | cv88on.txt: DISTRICT 38, FY(FDATEUSE)=1993, CLASSACT=1 | MATCH |
| 36 | IDB | ctd | 2006 | `idb_crim_defendants_terminated` | 426 | 426 | cr96on.txt: FISCALYR 2006, DISTRICT 05, CTTR=1 | MATCH |
| 37 | IDB | laed | 2017 | `idb_crim_trial_rate` | 4.7059 | 4.7059 | cr96on.txt: FISCALYR 2017, DISTRICT 3L, CTTR=1, DISP1 in {2,3,8,9,16-19} | MATCH |
| 38 | IDB | nyed | 2018 | `idb_crim_pct_drugs` | 29.0932 | 29.0932 | cr96on.txt: FISCALYR 2018, DISTRICT 07, CTFIL=1, D2FOFFCD1 6500-6999 | MATCH |
| 39 | IDB | nywd | 2007 | `idb_crim_pct_firearms_explosives` | 13.5294 | 13.5294 | cr96on.txt: FISCALYR 2007, DISTRICT 09, CTFIL=1, D2 78xx/9994 | MATCH |
| 40 | IDB | wvsd | 2026 | `idb_civil_pct_prisoner_petitions` | 31.9226 | 31.9226 | cv88on.txt: DISTRICT 25, FY(FDATEUSE)=2026, NOS 510-560 block | MATCH |
| 41 | IDB | cod | 2017 | `idb_crim_defendants_terminated` | 461 | 461 | cr96on.txt: FISCALYR 2017, DISTRICT 82, CTTR=1 | MATCH |
| 42 | IDB | vtd | 2006 | `idb_civil_pct_pro_se` | 35.0365 | 35.0365 | cv88on.txt: DISTRICT 10, FY(FDATEUSE)=2006, PROSE 1-3 / PROSE 0-3 | MATCH |
| 43 | IDB | gud | 2010 | `idb_crim_felony_defendants_filed` | 47 | 47 | cr96on.txt: FISCALYR 2010, DISTRICT 93, CTFIL=1, FOFFLVL1=4 | MATCH |
| 44 | IDB | iand | 2012 | `idb_crim_trial_rate` | 2.9197 | 2.9197 | cr96on.txt: FISCALYR 2012, DISTRICT 62, CTTR=1, trial DISP1 | MATCH |
| 45 | IDB | nynd | 1990 | `idb_civil_pct_prisoner_petitions` | 19.8061 | 19.8061 | cv88on.txt: DISTRICT 06, FY(FDATEUSE)=1990, NOS 510-560 block | MATCH |
| 46 | IDB | nmid | 2016 | `idb_civil_terminated` | 28 | 28 | cv88on.txt: DISTRICT 94, TAPEYEAR != 2099, FY(TDATEUSE)=2016 | MATCH |
| 47 | IDB | kywd | 2000 | `idb_crim_pct_drugs` | 22.6300 | 22.6300 | cr96on.txt: FISCALYR 2000, DISTRICT 44, CTFIL=1, D2 6500-6999 | MATCH |
| 48 | IDB | vtd | 2018 | `idb_crim_defendants_filed` | 162 | 162 | cr96on.txt: FISCALYR 2018, DISTRICT 10, CTFIL=1 | MATCH |
| 49 | IDB | tnmd | 2017 | `idb_crim_felony_defendants_filed` | 275 | 275 | cr96on.txt: FISCALYR 2017, DISTRICT 50, CTFIL=1, FOFFLVL1=4 | MATCH |
| 50 | IDB | ksd | 2023 | `idb_crim_pct_drugs` | 33.1924 | 33.1924 | cr96on.txt: FISCALYR 2023, DISTRICT 83, CTFIL=1, D2 6500-6999 | MATCH |
| 51 | IDB | mied | 2023 | `idb_crim_pct_dismissed` | 5.1351 | 5.1351 | cr96on.txt: FISCALYR 2023, DISTRICT 45, CTTR=1, DISP1 in {1,10-15,20,21} | MATCH |

**Result: 51/51 MATCH.** The random sample happened to contain no `ussc_*_sentence_months` row. The two real errors
were found by the exhaustive recompute and cross-checks below. Targeted trace rows for them:

| lane | district | FY | variable | table | auditor | source + locator | result |
|---|---|---|---|---|---|---|---|
| USSC | laed | 2002 | `ussc_mean_sentence_months` | 91.3 (N=408) | 51.3 (N=369) | opafy02nid.dat, DISTRICT 35: 39 records have SENSPLT0 missing (38 also SENTIMP missing) | **MISMATCH** |
| USSC | laed | 2002 | `ussc_median_sentence_months` | 37.0 | 33.0 | same | **MISMATCH** |
| USSC | prd | 2004 | `ussc_mean_sentence_months` | 96.3 | 62.1 | opafy04nid.dat, DISTRICT 04, 55 missing | **MISMATCH** |
| USSC | ncwd | 2002 | `ussc_median_sentence_months` | 60.0 | 50.0 | opafy02nid.dat, DISTRICT 19, 40 missing | **MISMATCH** |
| USSC | cacd | 2007 | `ussc_mean_sentence_months` | 64.8 | 45.9 | opafy07nid.dat, DISTRICT 73, 76 missing | **MISMATCH** |
| USSC | US | 2002 | `ussc_mean_sentence_months` (national.csv) | 51.5 | 46.6 | opafy02nid.dat, all 64,366 records, 746 missing | **MISMATCH** |
| USSC | lawd | 1998 | `ussc_count_offense_drug_trafficking` | 32 | belongs to lamd | law98.pdf Table 1: column header "Middle Louisiana"; lane's lamd FY1998 = 32 | **WRONG DISTRICT** |
| USSC | lawd | 1998 | `ussc_cases_offense_known` | 117 | belongs to lamd | law98.pdf notes: "Of the 117 guideline cases from the Middle District of Louisiana" | **WRONG DISTRICT** |

## 2. Findings in detail

### Blocker 1: USSC sentence length FY2002-FY2017 counts missing terms as 469.99 months

`pipeline/ussc/compute.py:141-148`:

```python
s = df["SENSPLT0"]
return s.where(s <= 470, 469.99)
```

`Series.where` keeps a value where the condition is True. For a missing value `NaN <= 470` is False, so the code
replaces every missing `SENSPLT0` with 469.99. The documented formula is `mean(min(SENSPCAP or SENSPLT0, 470))`, and the
documentation says "N = all cases with the value"; the code follows neither. FY2018+ uses `SENSPCAP` unchanged and is
correct.

Evidence:

* For all 1,504 district-years FY2002-FY2017, the lane's median equals the median under the NaN→469.99 rule (1,504/1,504).
  Its mean equals that rule's mean within 0.05 (1,504/1,504).
* Its `n_basis` equals all records, including missing ones (1,504/1,504). The correct N, non-missing records only,
  differs in 416 district-years.
* 2,457 records are affected: 746 in FY2002, falling to 2 in FY2017.
* Size of the damage: 406 mean cells and 113 median cells fall outside published rounding. 282 mean cells are off by
  more than 1 month, 57 by more than 5 and 23 by more than 10. The worst is E.D. La. FY2002, off by +40.0 months.
* National means are inflated: FY2002 51.5 against 46.6 correct, FY2003 50.2 against 47.2, FY2004 50.9 against 48.4.
  This manufactures a spurious early-2000s decline in average sentences, exactly where the brief's "After Booker" story
  would look.
* The lane's tests pass because FY2002-17 sentence length has no published comparator (`basis = computed_ussc_definition`).
* The lane noticed one FY2021 record where SENSPCAP is missing but SENSPLT0 "matched otherwise". That record is this
  same NaN case.

Fix: in `sentence_2018`, use `s.mask(s > 470, 469.99)` (NaN stays NaN) and compute `n_basis` from the non-null count.
Add a test that pins `laed` FY2002 to mean 51.3, median 33.0, N 369, plus a test that `n_basis` equals the non-null
SENSPLT0 count. Then rebuild `observations`, `national.csv` and `components.parquet`.

### Major 2: W.D. La. FY1998 offense mix is M.D. La.'s data

`law98.pdf` (URL `.../1998/law98.pdf`) is M.D. La.'s packet:

* every district column header reads "Middle Louisiana";
* its notes say "Of the 117 guideline cases from the Middle District of Louisiana".

The lane's safety rule ("a table whose notes name a different district is not used") removed Table 7 only. Table 1's
note names no district, so Table 1 passed.

Result: the lane's `lawd` FY1998 offense-known N, drug trafficking, firearms, fraud, immigration and other counts, and
the five shares, are **identical to `lamd` FY1998** (11/11 values). They also conflict with the same row's
`ussc_cases_range_known` = 285, taken from E.D. Va.'s all-district Table 8.

A global scan of every lane and year for identical district vectors finds this pair and no other. (I checked FCMS core
counts, IDB civil and criminal counts, and the USSC offense mix.)

Fix: treat the "National | <district>" column header as authoritative and reject the whole packet if any header names
another district. Log `lawd` FY1998 offense-mix values as a gap. Add a duplicate-vector test.

The same safety rule is also fragile in the other direction. Notes wrapped across lines escape it: the FY1998 N.D. Cal.
and N.D. Iowa Table 7 notes say "Eastern District of California" and "Western District of Iowa". I checked both by hand.
The headers name the correct court and each note's N (582; 163) equals that district's own total, so the values are
correct and these are USSC typos.

### Minor items

3. **`derived` flag (USSC).** `ussc_pct_prison`, `ussc_mean/median_sentence_months`, `ussc_mean/median_prison_months`
   and `ussc_count/pct_offense_other` all carry `derived: false`. Yet some of their years are lane computations, not
   USSC prints: FY2002-17, FY2018+ and FY1995-2001 respectively. The per-row `basis` column is honest, but the brief and
   contract require derived values to be labelled `derived` with a formula. Suggest emitting `derived` per row, or a
   `derived_years` list.
4. **FY1995-99 packet non-reconciliation (USSC).** I re-read every one of the 94 FY1998 Table 1 "Drugs - Trafficking"
   rows and the 94 FY1999 Table 7 TOTAL N rows with my own parser. Both match the lane exactly (sums 19,533 and 45,436),
   but the national packet columns print 19,615 and 45,379. So the per-district packets are internally inconsistent with
   the national figures. That is a source issue, but the report claims exact sums only for FY2000-01 and is silent here.
   It should say so, and the web lane should not present FY1995-99 district counts as summing to the nation.
5. **Vacant judgeship months (FCMS).** FY2003: districts sum to 453.8, national page prints 444.8. My own
   `pdftotext` sum over all 94 pages of the FY2004 and FY2005 profiles reproduces this, so it is not a parse error.
   Other years differ by 0.1-0.5 (rounding of one-decimal district values). Add to `reconciliation.csv` and the report.
6. **Source oddities without caveat (FCMS).** S.D. Fla. FY2023 civil median filing-to-disposition is printed "0.0"
   (rank 1; civil filings per judgeship jumped from 469 to 1,191 that year). D.N.M.I. FY2024 prints jurors present "0"
   and not selected "0". These are faithful to the source, but a choropleth will show S.D. Fla. as the fastest court and
   D.N.M.I. as having 0 jurors. Suggest a cell-level caveat, or treating the D.N.M.I. 0/0 as "no jury selections".
7. **Gap log (FCMS).** `data/gaps/fcms.json` does not cover 4,326 by-design empty cells:
   * `fcms_civil_type_copyright_patent_trademark` FY2021-25 and `fcms_civil_type_intellectual_property_rights`
     FY2010-20 (the relabel);
   * `fcms_rank_{us,circuit}_pct_change_filings_5yr` FY2010 and FY2012-25 (not printed);
   * `fcms_rank_*_trials_completed_per_judgeship` D.N.M.I. FY2024.

   All are explained in the lane report, but the contract asks for gaps in the JSON fragment.
8. **Default FCMS table mixes counting units.** See the verdict table. `observations_current_method` checks out: FY2005
   and FY2009 equal the FY2010 profile, FY2011 equals the FY2012 profile, and FY2012 equals the FY2015 profile (94/94
   each). The web lane must use it for any criminal-sensitive time series, or mark the FY2010/11/12 zig-zag.

## 3. Reconciliation

**FCMS national vs sum of districts** (`observations` vs `national`):

* Exact in all 27 years for filings, terminations and pending totals, and for judgeships.
* Exact in all 22 years for civil and criminal felony case-mix totals.
* Civil cases over 3 years old is exact in 26 of 27 years. FY2011 is off by 1 (40,434 vs 40,435); the lane documents it.
* Vacant months differ, see item 5.

**USSC districts vs national:**

* FY2000-2025: district `ussc_cases_total` sums equal national in every year.
* `ussc_cases_range_known`: equal in all 31 years.
* National within-range share recomputed from pooled district numerators: max difference 0.049 points.
* FY1995-99: see item 4. Part of that gap is the logged missing districts; the rest is the source.

**USSC internal sums:**

* Offense shares per district-year sum to 99.8-100.2.
* The four-way range shares (FY2006-17 and the 2018 scheme) sum to 99.9-100.1.

**IDB vs FCMS civil filings** (2,068 district-years, FY2004-25):

* Median absolute difference 0.18%. 87.6% of cells are within 1%; 97.9% within 5%.
* Stable year to year: the median absolute % per year is 0.10-0.58.
* De-duplication is right. Without it, FY2013 national is 291,769 against FCMS 284,604; with the lane's key it is
  284,137.
* My alternative key (FDATEUSE in place of FILEDATE) changes at most 8 cases in a district-year and at most 0.12 points
  on any share, so the result does not depend on that key choice.
* The 23 cells above 10% are the ones the lane documents: M.D. Fla. FY2006/08, N.D. Ohio FY2004, E.D. La. FY2009-11,
  D.N.D. FY2011-14, D. Wyo. FY2021-22, D.N.M.I. small counts, and so on. Each IDB value was reproduced from the raw
  file, so they are IDB-vs-AO counting differences, not parse or de-dup bugs.

**IDB felony defendants filed vs FCMS "Total Criminal" (defendant years):** exact in 1,504/1,504 cells.

**Period alignment.** For each cross-source comparison I shifted one series by -1, 0 and +1 years:

* IDB civil vs FCMS: median |log ratio| 0.087 / **0.002** / 0.080.
* IDB felony filed vs FCMS: exact share 0.5% / **100%** / 0.5%.
* USSC sentenced vs IDB convicted defendants: 0.129 / **0.042** / 0.124.

No off-by-one fiscal years.

**Crosswalks.** Per-district median ratios IDB/FCMS civil run 0.93-1.003, and USSC sentenced over IDB convicted runs
0.70-1.04. A swapped E/W pair would show up as a far outlier, and there is none. The duplicate-vector scan finds only
the `lamd`/`lawd` FY1998 copy (item 2). My USSC and IDB district maps were built from the codebook appendix text, not the
lane tables, and reproduce the lane on every cell.

**Implausible values:**

* No negatives (outside % change) and no percent above 100 in any lane; no NaN values; no duplicate keys.
* 5x year-on-year jumps (68 FCMS, 13 USSC, 11 IDB) trace to known events:
  * mass-tort MDLs: N.D. Fla. 3M earplugs, D.S.C., S.D. W. Va., N.D. Ala.;
  * the N.D. Iowa FY2008 immigration surge;
  * D. Ariz. fraud 89 / 495 / 84 / 517 (FY2006-09). The FY2008 packet itself prints 84.
* The one exception is W.D. La. FY1998, which is item 2.

**Units.** FCMS medians are in months, and percents are 0-100 in all three lanes. FCMS fractional judgeships (E.D. Ky.
4.5/5.5, W.D. Ky. 4.5, E.D. Okla. 1.5, N.D. Okla. 3.5) are printed that way in the source (seen on the N.D. Okla. FY2021
page).

## 4. Definitions (USSC)

I compared eight district-years, none of them among the lane's hand-checked fixtures, against each district's own
packet table. For each I compared the packet, the lane value and my own datafile count:

| district-year | scheme | cells | result |
|---|---|---|---|
| D. Ariz. FY2008 (az08.pdf Table 8) | BOOKERCD | 8 | 7 MATCH. Gov't-sponsored is printed 60.0 vs lane 59.9: the count 2,232/3,724 is exact, and the packet prints the sum of rounded sub-shares (4.9 + 51.9 + 3.2). This is the documented FY2006-09 convention. |
| W.D. Tex. FY2012 (txw12.pdf Table 8) | BOOKERCD | 8 | 8 MATCH |
| N.D. Ill. FY2015 (iln15.pdf Table 8) | BOOKERCD | 8 | 8 MATCH (denominator 722 of 725 cases) |
| S.D. Fla. FY2021 (fls21.pdf Table 8) | SENTRNGE | 12 | 12 MATCH |
| D. Guam FY2023 (gu23.pdf) | SENTRNGE | 6 | 6 MATCH |
| C.D. Cal. FY2019 (cac19.pdf) | SENTRNGE | 10 | 10 MATCH |
| D. Mont. FY2003 (mt03.pdf, departure table) | DEPART_S/DEPART_D | 4 | 4 MATCH (343 cases; 83.7% within; 9.9% §5K1.1) |
| D. Alaska FY2005 (ak05.pdf pre- and post-Booker tables) | pooled halves | 3 | 3 MATCH ((22+97)/(34+168) = 58.9%; (5+26)/202 = 15.3%) |

Denominators (`ussc_cases_range_known`) equal the packet "TOTAL CASES", which excludes cases whose sentence couldn't be
compared with the range, in every case.

**Definitional breaks:**

* **Booker.** The four-way grouping is emitted only FY2006-17; FY2005 above/gov/non-gov are omitted and logged; FY2005
  within-range and §5K1.1 are pooled across the halves (verified for D. Alaska).
* **Blakely.** FY2004 halves are pooled.
* **§5K3.1.** Starts FY2006; logged.
* **FY2018 SENTRNGE.** The lane says BOOKERCD and SENTRNGE group every case identically in the FY2014-17 overlap. I
  checked this record by record on the supplemental join: 0 disagreements in each of FY2014-17 (75,836 / 71,003 /
  67,742 / 66,873 records), including the §5K1.1 and §5K3.1 codes.
* **Offense scheme switches.** OFFTYPE2 to OFFTYPSB in FY2010, then OFFGUIDE in FY2018; fraud vs
  fraud/theft/embezzlement kept separate. Both are reproduced exactly by my code.
* **Prison-rate denominator change.** Fine-only cases are included in every year; the change is labelled. The values
  are correct as defined, but see item 3.

**Not honest as implemented:** the sentence-length convention for FY2002-17 (blocker 1). The documentation is right;
the code is not.

## 5. Coverage

Variables with fewer than 10 years, or fewer than 94 districts:

| lane | variable | years | districts | in gap log? |
|---|---|---|---|---|
| FCMS | `fcms_civil_type_intellectual_property_rights` | 5 (2021-25) | 94 | **no** (relabel; item 7) |
| FCMS | `fcms_civil_type_copyright_patent_trademark` | 11 (2010-20), ends at relabel | 94 | **no** (item 7) |
| FCMS | `fcms_rank_{us,circuit}_pct_change_filings_5yr` | 7 (2004-11) | 94/93 | **no** for FY2010 and FY2012+ (item 7); FY1999-2003 yes |
| FCMS | `fcms_weighted_filings_per_judgeship` (+ ranks) | 27 | 91 | yes (territorial courts print "-") |
| FCMS | `fcms_median_months_civil_filing_to_trial` (+ ranks) | 27 | 92 | yes (fewer than 10 trials; D. Guam / D.N.M.I. never) |
| FCMS | `fcms_rank_circuit_*` | 22 | 93 | yes (D.D.C. has no circuit peers) |
| FCMS | `fcms_rank_*_trials_completed_per_judgeship` | 22 | 94 | value gap logged; **rank** cell for D.N.M.I. FY2024 not logged |
| USSC | `ussc_*_fraud_theft_embezzlement` | 8 (2018-25) | 94 | yes (category break) |
| USSC | FY1995-99 cells for D.N.M.I. and 10 district-years | - | 90-93 per year | yes, all covered |
| IDB | (none under 10 years) | - | 94 | pro se FY1988-98 and D. Nev. FY1999 logged; all covered |

Machine check: every missing district-year cell within each lane's span was matched against `data/gaps/<lane>.json`,
honouring the wildcard and text period forms.

* IDB: 0 uncovered.
* USSC: 0 uncovered.
* FCMS: 4,326 uncovered, all in the three groups of item 7. FY1992-98 scans, FY1999-2003 own-year-only items, the
  unlabelled FY2004-09 case mix and the per-cell suppressions are all logged.

## 6. Tests

`PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_<lane>*.py`

| lane | result |
|---|---|
| FCMS | 71 passed (8.7 s) |
| USSC | 184 passed (1.6 s) |
| IDB | 172 passed (1.5 s) |

The passing USSC suite does not exercise FY2002-17 sentence length against an independent value, which is why
blocker 1 survived it.

## 7. What I did not check

* FCMS ranks and case-mix cells were checked only through the lane's reconciliation and my national-sum checks, not
  traced individually. The FY2004-09 mono pages were read from `pdftotext` output, which was legible for every sampled
  row; I did not render images.
* USSC FY1996, FY1997, FY2000 and FY2001 packet values were not traced individually. FY1998 drug trafficking and FY1999
  Table 7 N were re-read for all 94 districts. Packets other than the eight in section 4 were not opened. E.D. Va.
  all-district tables were not re-read; the lane's 60,030-row validation was not re-run.
* IDB: AO Judicial Business tables (C-1, C-4, D-1, D-2, D-4) were not re-parsed. The lane's reconciliation against them
  is taken as reported, and only the IDB side was recomputed. IDB offense categories other than drugs, firearms and
  immigration (fraud, violent, sex) were not recomputed. Disposition-mix, NOS-mix and patent-quarterly detail tables
  were not audited.
* The auditor scripts live in the session scratchpad (`stats_audit/`) and are not committed. Their method is described
  in section 1 and is sufficient to reproduce every number here.

---

## Fixes applied

Statistics-fix lane, 2026-11-27. Every change was made in the owning lane's code. Both lanes were rebuilt
(`python -m pipeline.ussc.build`, `python -m pipeline.fcms.build`). IDB was not touched: it reads only the FCMS
civil and criminal totals, which did not change.

Tests after the fixes: USSC 230 passed (was 184), FCMS 77 passed (was 71), whole `tests/pipeline` suite 677
passed. New regression files: `tests/pipeline/test_ussc_regressions.py` and
`tests/pipeline/test_fcms_regressions.py`. USSC packet validation still reproduces 60,030 of 60,030
published values.

| # | severity | resolution |
|---|---|---|
| 1 | blocker | **Fixed.** Reproduced exactly: laed FY2002 gave 91.3 / 37.0 / N 408 under the old rule and 51.3 / 33.0 / N 369 with missing values excluded. `pipeline/ussc/compute.py::sentence_2018` now uses `s.mask(s > 470, 469.99)`, so a missing value stays missing. `n_basis` is the non-null count automatically, because the component N counts only non-missing values. The rebuild changed 414 mean and 116 median district cells and 416 district-year Ns, all in FY2002–FY2017 (2,457 records nationally; 746 in FY2002, 2 in FY2017; recounted). National FY2002/03/04 means are now 46.6 / 47.2 / 48.4. With the fix, the pre-FY2018 rule applied to SENSPLT0 equals SENSPCAP record for record in FY2018, FY2021 and FY2025, missing values included. Tests pin laed FY2002 (51.3 / 33.0 / 369), prd FY2004, cacd FY2007, ncwd FY2002 and the national FY2002–04 means. They also assert `n_basis` equals the non-null SENSPLT0 count per district (FY2002, 2007, 2017, from the cached datafiles) and that the rule keeps NaN as NaN. The variable caveat and the lane report record the correction. |
| 2 | major | **Fixed.** Reproduced: LAW98.pdf headers read "Middle Louisiana" in Tables 1, 3, 6 and 7. New `crosswalk.district_from_header` and `fallback.header_problem`: a FY1995–2001 packet table is used only if its "National \| <district>" column header names the district. Rejection is per table, not per packet, because other packets carry one stray table among correct ones (FY1995 N.D. Ala. Table 7 "Alaska"). Across all 2,626 headed packet tables, the check newly rejects only W.D. La. FY1998 Table 1; every other foreign header was already rejected or sits on a table the lane does not read. The 11 W.D. La. FY1998 offense-mix values are removed and logged (`ussc_packet_fallback_skipped_offense_mix_table_1`, plus the `ussc_missing_cells_*` records). The reason for M.D. Ga. FY1998 Table 7 now names the root cause: its header is "Georgia", a state table. New test: no two districts share an identical offense-mix vector in any year. |
| 3 | minor | **Fixed.** Observations and `national.csv` gain a per-row boolean `derived`: true for bases `computed_ussc_definition`, `derived_from_published_counts`, `pooled_published_halves`, `sum_of_published_components` and `computed_ussc_supplemental`; false for `reproduces_published` and `published_packet`. `variables.json` gains `derived_years` and `derived_formula_by_basis`, the hover formula for each derived basis. The variable-level `derived` flag stays true only where every row is derived; the build enforces this. Beyond the audit's list, this also flags FY2004–05 range shares (pooled from the two half-year tables) and FY2014–17 SENTRNGE components as derived, since the USSC did not print those exact district figures. Tested. |
| 4 | minor | **Documented, and the audit claim corrected in part.** New `packet_reconciliation.csv` compares FY1995–2001 district sums with the national packet figure. A gap record (`ussc_fy1995_1999_packets_do_not_sum_to_national`), a caveat on every affected count variable, and the lane report all document the non-reconciliation. Correction: with all 94 districts present, the only FY1995–99 mismatch is FY1999 prison-term N, +57 (45,436 vs 45,379). The FY1998 drug-trafficking example (19,533 vs 19,615) included W.D. La.'s wrong value of 32, which is item 2. With that cell removed, the FY1998 shortfalls in the five offense counts (114 + 2 + 8 + 36 + 129) add up exactly to the offense-known shortfall of 289, which matches the missing district. In the other 29 FY1995–99 variable-years the remaining shortfall coincides with logged missing district-years, so it cannot be classed as a source inconsistency. It is not used to fill those districts. |
| 5 | minor | **Fixed.** `fcms_vacant_judgeship_months` is now in `reconciliation.csv`, with new columns `rounding_bound` (94 × 0.05 for one-decimal values), `within_rounding`, and a `note` that compares every vintage printing an out-of-bound year. Every year is within rounding except FY2003: 453.8 vs 444.8, identical in the FY2004–FY2008 profiles. That year is documented as a source inconsistency in the lane report and tested. |
| 6 | minor | **Fixed (flagged; no value changed except the two undefined D.N.M.I. cells).** All three observation tables gain a `caveat` column, and `cell_caveats.csv` lists the flagged cells. Rule 1: a disposition or trial median printed as 0.0, or below 1/8 of that year's U.S. median, is kept and flagged together with its published ranks. That flags S.D. Fla. FY2023 civil 0.0 (rank 1), E.D. Pa. FY2004–06 civil 1.0 and D.V.I. FY2002 criminal 0.7. Rule 2: jurors present printed as 0 means no jury selection was held. D.N.M.I. FY2024 jurors present and percent not selected (printed "0" in the FY2024 and FY2025 profiles; trials cell blank) are omitted from the observations and logged as gaps ("not a measured value"), and the printed value is kept in `cell_caveats.csv`. The real 0% for D.N.M.I. FY2017, when jurors were present, is kept. |
| 7 | minor | **Fixed.** New gap records: `casemix_letter_i_relabel:*` (copyright/patent/trademark FY2021–25; intellectual property rights FY2010–20) and `rank_5yr_change_not_printed:{us,circuit}` (FY2010 and FY2012–25; layout checked on the FY2010 and FY2012 page text). The build also has a new sweep that logs any district-year missing in a year the variable is published. The sweep added the D.N.M.I. FY2024 trials rank cells. A new test re-implements the auditor's machine check (wildcards, "all" and text periods honoured) over FY1999–2025: 0 uncovered cells (was 4,326). |
| 8 | minor | **Documented and made machine-readable; the default table is unchanged by design.** `observations` holds each year's own published figure. It is the only source for FY1999–2004, because the current-method series starts at FY2005 (criminal) and FY2010 (weights), so making the current-method table the default would drop years or mix sources again. `variables.json` now carries `method_sensitive`, `time_series_table` (`observations_current_method` for the 10 variables it covers) and `current_method_first_period`. With these the web lane can choose the consistent series, or annotate the FY2009–12 zig-zag, without reading prose. A test checks the pointer and the national current-method values 384,902 / 394,345 / 402,885 / 386,664. |

Not checked in this pass: the other FY1995–2001 packet tables were not re-read beyond the header survey. The
cell-caveat thresholds (0.0, or below 1/8 of the U.S. median) are a disclosure rule, not a finding about the
underlying cases.

---

## Re-check

Statistics re-check lane, 2026-11-27. I checked the two audit issues (blocker 1, major 2) against the raw sources,
not against the fixer's report, and spot-checked minors 3–8. No lane code or output was modified. My scripts are in
the session scratchpad (`recheck/`) and are not committed.

### Verdict: PASS. Blocker 1 and major 2 are resolved; no new blocker or major issue found

| # | severity | re-check result |
|---|---|---|
| 1 | blocker | **Resolved.** Matches my independent recompute from the raw zips in every cell. |
| 2 | major | **Resolved.** W.D. La. FY1998 offense mix is gone and logged. No packet value used by the lane comes from a table headed with another district. |
| 3–8 | minor | Spot-checked; all hold as the fix report describes (details below). |

### Blocker 1: sentence length (verified from `opafyYYnid.zip`)

**Method.** I wrote my own fixed-width reader. It takes column positions from each zip's `.sas` `INPUT` block, and
upper-cases the block because FY2010 declares its variables in lower case. It streams `DISTRICT`, `SENSPLT0`, `SENSPCAP`
and `SENTIMP` for FY2002–FY2025. District codes come from my own parse of codebook Appendix A
(`USSC_Public_Release_Codebook_FY99_FY25.pdf`, 94 codes). The rule: values over 470 become 469.99, a missing value stays
missing (FY2002–17 `SENSPLT0`; FY2018+ `SENSPCAP` as is). Record counts equal the lane's national `ussc_cases_total` in
all 24 years.

* **District cells.** FY2002–FY2017: 1,504/1,504 district-years have mean and median within published rounding
  (max |diff| 0.050), and `n_basis` equals my non-missing count exactly, on both the mean and median rows. FY2018–FY2025:
  752/752, same result.
* **Unrounded components.** `components.parquet` `sent2018` mean/median/n equal my values to 1e-6 in 2,280/2,280
  district-years (including the US rows).
* **National.** `national.csv`: 48/48 mean and median cells match. FY2002/03/04 means are 46.6 / 47.2 / 48.4.
* **Audit examples.** laed FY2002 51.3 / 33.0 / N 369 (39 missing); prd FY2004 62.1 (N 602); cacd FY2007 45.9 (N 1,625);
  ncwd FY2002 median 50.0 (N 554). All four match.
* **Missing records.** 2,457 records FY2002–17 (746 in FY2002, falling to 2 in FY2017; none in FY2013–14). This agrees
  with the audit and the fix report.
* **Rule vs SENSPCAP.** The SENSPLT0 rule equals SENSPCAP record for record in every year FY2018–FY2025, missing values
  included: 524,421 records, 0 disagreements (one missing record each in FY2020–23, missing in both). Values above 470
  are genuine long terms (most common 480, 600, 720; maximum 19,080), not sentinel codes, so capping them is right.
* **Scope of the change.** I compared the pre-fix lane values (the audit's `ussc_compare.csv`) with the current
  observations over all 66,928 datafile-year cells. Only the sentence variables changed: 414 mean cells, 116 median cells
  and 416 Ns, all in FY2002–FY2017. Nothing else moved.
* **Other outputs.** `observations.csv` and `observations.parquet` are identical (78,690 rows, 0 value differences). The
  variable caveat and the lane report describe the correction.

### Major 2: W.D. La. FY1998 (verified from the packet PDFs)

* **The packet.** I ran `pdftotext -layout` on `LAW98.pdf` and `LAM98.pdf`. From Table 1 to the end, the two text
  layers are byte-identical. Only the Figure A cover page differs: it is headed "Louisiana, West" and carries W.D. La.'s
  own chart. So `LAW98.pdf` is M.D. La.'s packet behind a W.D. La. cover.
* **Lane output.** `lawd` FY1998 now has no offense rows. Its only values are `ussc_cases_range_known` 285,
  `ussc_pct_within_range` 71.9 and `ussc_pct_substantial_assistance_5k1` 23.5. I re-read all three from the VAE98
  Table 8 "Western" row under Louisiana (285 / 205 71.9 / 67 23.5): they match.
* **Header scan.** I wrote my own scan of all 655 FY1995–FY2001 packets. It finds 2,626 tables with a "National |
  <district>" header; this equals the fixer's count. Of these, 2,612 name the packet's own district and 14 do not:
  * ALN95 T6/T7 "Alaska"; CAE95 T6/T7 "California, Central"; CO95 T6/T7 "Connecticut";
  * SC95 T3 "South Dakota"; ARE96 T3 "Arkansas"; CAC97 T3 "State of California";
  * GAM98 T7 "Georgia"; LAW98 T1/T3/T6/T7 "Middle Louisiana".
* **Tables the lane reads.** I joined every FY1995–2001 observation sourced from a packet Table 1 or Table 7 (9,138
  rows) to my scan. All 9,138 come from a table whose header names the observation's own district. No observation
  cites a foreign-headed table, and no `ussc_cases_total` note is taken from one.
* **Gap log.** Diffed against the pre-fix copy. The only added cells are `lawd` 1998 in the 11 offense-mix
  missing-cell records, plus the new `ussc_packet_fallback_skipped_offense_mix_table_1` and reconciliation records.
  Nothing was removed. The Table 7 skip list keeps the same districts, with a reworded reason.
* **Duplicates.** My own scans of the current USSC observations find 0 identical offense-mix vectors and 0 identical
  full district vectors in any year.

### Minors (spot checks)

* **3.** `derived` equals "basis not in {reproduces_published, published_packet}" on every row of `observations`
  (15,220 derived) and `national.csv` (162). `variables.json` carries `derived_years` and `derived_formula_by_basis`.
* **4.** In `packet_reconciliation.csv`, the only FY1995–99 variable-year that fails to reconcile with all 94
  districts present is FY1999 prison-term N (+57; my own sum is 45,436). In FY1998, with `lawd` missing, the five
  offense shortfalls (114 + 2 + 8 + 36 + 129) equal the offense-known shortfall of 289.
* **5.** Vacant months are in `reconciliation.csv`. Every year is within the 4.7 rounding bound except FY2003
  (453.8 vs 444.8), and the note lists that it is the same in all five vintages.
* **6.** `cell_caveats.csv` lists 7 cells. The S.D. Fla. FY2023, E.D. Pa. FY2004–06 and D.V.I. FY2002 values carry a
  `caveat` in `observations`, and their ranks in `observations_ranks`. The D.N.M.I. FY2024 juror cells are absent and
  logged as gaps.
* **7.** I re-ran the audit's own coverage script. FCMS: 0 uncovered (was 4,326); IDB: 0. For USSC it now reports
  4,316 pre-FY2018 `*_fraud_theft_embezzlement` cells. This is a limit of that script's period parser, which does not
  read `<=2017`. The record `ussc_fraud_category_break_2018` covers those cells and is unchanged since the audit, so this
  is not a regression.
* **8.** FCMS `variables.json` marks 42 variables `method_sensitive`. The 10 in `observations_current_method` point to
  it with `current_method_first_period`. No caveated cell falls inside the current-method table, which has no `caveat`
  column.

### Tests

`PYTHONPATH=. .venv/bin/python -m pytest -q -p no:cacheprovider …`: USSC 230 passed; FCMS 77 passed; whole
`tests/pipeline` 677 passed (no skips). The new tests pin the audit's examples. They also check `n_basis` against the
non-null SENSPLT0 count, and that the SENSPLT0 rule equals SENSPCAP. Since these tests use the lane's own reader, the
independent recompute above is the stronger evidence.

### Observations (not defects)

* **Wording nit.** The `ussc_mean_sentence_months` definition says terms over 470 are "set to 470". The code and the
  codebook use 469.99 (life = 470). The effect is at most 0.01 month per capped record; the lane report has it right.
* **Possible recovery.** `LAW98.pdf` Figure A (cover page) is W.D. La.'s own FY1998 chart: drugs 43.6%, fraud 12.5%,
  immigration 0.7%, drug types n = 126. Its categories are "select offense" groupings, not Table 1 rows, so leaving
  the offense mix as a logged gap is correct. A future pass could cite it in the gap reason.

### Not re-checked

* Packet tables other than 1, 7 and the VAE98 Table 8 Louisiana rows were not re-read for values.
* The 60,030-row packet validation was not re-run; I only confirmed that `validation.csv` has 60,030 rows, all `match`.
* FCMS and IDB values not touched by the fixes were not re-traced.
