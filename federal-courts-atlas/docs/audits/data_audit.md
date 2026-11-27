# Data audit: displayed numbers traced to raw source files

Date: 2026-11-27. Two independent auditors (A and B) each drew a fixed-seed random sample of numbers shown on the
site and traced every one back to the cached raw source file, without importing any pipeline code. A data fix lane
then resolved what they found, and the recheck lane re-traced the corrected cells to the raw files a third time.

## Result

| | Auditor A (map, table, profile stats, compare) | Auditor B (stories, profile sentences, case mix, compare strip, courtroom, bench, cases) |
|---|---|---|
| Numbers traced | 35 (random) | 35 (33 random + 2 targeted follow-ups) |
| Match | 34 | 33 of 33 random draws |
| Mismatch | 1 (#8) | 2 (#134, #135, both targeted follow-ups) |
| Read on the rendered page | 27 of 35 | 35 of 35 |

**70 numbers traced; 67 match; 3 mismatches.** All three mismatches were labeling errors, not wrong numbers: in each
case the atlas showed the exact figure computed from the USSC's own counts, but labeled it as the figure the USSC
printed, and the USSC printed a slightly different rounding. The fix lane relabeled those cells as derived with a
formula on hover. No value changed. The recheck lane re-traced all three to the raw files (see "Recheck").

## Method

### Auditor A (seed 20261127)

- **Universe.** Every (variable, district, year) value cell in `public/data/values/*.json` (41 files at the time,
  106,431 cells), the matching rank cell (106,431), and the non-null numeric fields of `public/data/districts.json`
  (population, population_census_2020, judgeships, judges_active, judges_senior: 461). 213,323 items in all, sorted by
  (kind, variable, district, year).
- **Sampler.** Python `random.Random(20261127)`. Strata drawn in a fixed order; each quota counts items already drawn
  that satisfy it: FCMS value 5; USSC value 5; IDB value 4; Census population district field 2; FJC judges 2;
  per-capita value 3; USSC FY 2018-method value 2; cell in a derived year 1; rank 4; value with year 2005 or earlier 5;
  territory or small district (gud, nmid, vid, prd, wyd, akd) 3; flagged cell (cell note or approximate population) 3;
  then one per family (speed, workload, sentencing, case mix). Each stratum uses `rng.sample` over eligible items not
  yet drawn, then `rng.choice` fills the sample to 35.
- **Tracing, without pipeline code.**
  - FCMS: `pdftotext -layout` of the cited PDF (`local_path` from `data/sources/fcms.json`); page found by district
    heading; cell read at row label and fiscal-year column.
  - USSC: an independent fixed-width reader that parses the SAS `INPUT` statement inside each cached zip and streams
    the `.dat`. District and category codes from the codebook (Appendix A; SENTRNGE 0-8; BOOKERCD 0-11; DEPART_A by
    BOOKPOST for FY 2005; OFFTYPE2, OFFTYPSB, OFFGUIDE; SENSPLT0 with values above 470 set to 469.99 and missing
    excluded). Denominator = records with a valid code. Cross-checked against the E.D. Va. all-district packet tables
    and district packets where cached.
  - IDB civil: awk stream of the raw `cv88on.txt`; filing fiscal year from FDATEUSE; de-duplicated on
    DISTRICT+OFFICE+DOCKET+ORIGIN+FILEDATE keeping the latest TAPEYEAR (keep-first and keep-last gave identical
    results). IDB criminal: streamed raw `cr96on.txt` (Deflate64) with FISCALYR and CTFIL=1; firearms codes from the
    FJC D2 labels page (7800, 7820, 7830, 7831, 9994).
  - Census: county rows (SUMLEV 50) summed over county lists read from the cached statute pages (28 U.S.C. §§ 89, 95,
    115, 123); state SUMLEV 40 row for Minnesota.
  - FJC judges: own count from the raw service CSV (start = earlier of recess and commission date on or before
    Sept. 30; termination empty or later; active if no senior date by then, otherwise senior; distinct nid).
  - Derived values recomputed from the traced inputs with the formula in the values file. Ranks recomputed from the
    values file (1 = highest, ties share).
- **Rendered.** `npx vite build` into `.e2e-dist/4301`, `vite preview` on 127.0.0.1:4301, Playwright 1.63 Chromium at
  1280 px: table rows, the map aria-label and tooltip, the district profile and compare rows.

### Auditor B (seed 9411)

- **Sampling.** One `random.Random(9411)` stream, strata in this order: (1) stories, per story: one derived key with
  `rng.choice`, then two more with `rng.sample` from the story's `{key}` placeholders (editorial thresholds and unit
  keys removed); (2) profiles: 4 districts, one distinctive sentence each; (3) case mix: one civil nature-of-suit row,
  one criminal offense row, one sentencing composition cell; (4) compare: one 2-district and one 3-district set,
  gaps 1 and 2 of each "Where they differ most" strip (gap 3 recomputed as a bonus); (5) courtroom: 2 districts, one
  seat and statistic each; (6) judges: 3 districts, one judge and fact each; (7) cases: 2 districts, one item each.
  Items 134 and 135 are not random: they are targeted follow-ups after a precision problem was spotted.
- **Tracing, without pipeline code.** Own streaming parsers over the cached raw files: IDB civil `cv88on.txt`
  (11,071,506 rows), IDB criminal `cr96on.txt` (6,345,702 rows), USSC FY 2025 `opafy25nid.dat` (66,662 records;
  DISTRICT 4037-4038, SENSPCAP 3949-3954, SENTRNGE 4190), `pdftotext -layout` for FCMS and USSC packet PDFs, pandas for
  the FJC CSVs, cached CourtListener JSON only. Parser checks: civil FY 2024 terminations 396,635 equal AO table C-1;
  USSC range-known 66,036, within range 33,979 and §5K3.1 count 4,012 equal packet Table 9 totals.
- **Rendered.** `.e2e-dist/4302`, `vite preview` on 127.0.0.1:4302, Chromium at 1280x900: story number spans and
  popovers, standout lists, case-mix rows, compare gaps, courtroom rows, bench rows and cases.

## Auditor A sample (35 numbers)

| n | Where shown | District | Measure | Period | Shown | Source file and locator | Source value | Result | Read on page |
|---|---|---|---|---|---|---|---|---|---|
| 1 | map tooltip, aria-label, table | miwd | civil_disposition_months | FY 2006 | 8.0 months; 76th of 94 | `data/raw/http/www.uscourts.gov/8a6367a11cdc0cdeb8cf3d11.pdf` p.41 MICHIGAN WESTERN, Median times, Filing to Disposition, Civil, col 2006 | 8.0 (3-way tie: rank 76) | match | yes |
| 2 | table | ohnd | terminations_per_judgeship | FY 2020 | 416; 55th of 94 | `www.uscourts.gov/62d148978121a39996666ee1.pdf` p.42 OHIO NORTHERN, Actions per Judgeship, Terminations | 416 | match | yes |
| 3 | table | mied | civil_trial_months | FY 2017 | 25.9 months; 35th of 67 | `www.uscourts.gov/cf20304be244be17f01ce31a.pdf` p.40 MICHIGAN EASTERN, From Filing to Trial (Civil Only) | 25.9 | match | yes |
| 4 | table | ctd | criminal_disposition_months | FY 2020 | 14.8 months; 13th of 94 | `www.uscourts.gov/62d148978121a39996666ee1.pdf` p.8 CONNECTICUT, Filing to Disposition, Criminal Felony | 14.8 | match | yes |
| 5 | table | tnmd | pending_per_judgeship | FY 2013 | 657; 15th of 94 | `www.uscourts.gov/cd6149a32747f318f7e24097.pdf` p.45 TENNESSEE MIDDLE, Pending Cases | 657 | match | yes |
| 6 | values file | ctd | within_range_pct | FY 2018 | 38.5 (67 of 94) | `www.ussc.gov/c0c9d91c91ce67ba20d59fbb.zip` DISTRICT=05, SENTRNGE=0 over 0-8; packet `34624ac849d0ac0f74504535.pdf` p.15 Table 9 | 124/322 = 38.5; packet prints 38.5 | match | no |
| 7 | map tooltip | nvd | govt_below_range_pct (derived) | FY 2015 | 27.0%; 47th of 94 | `www.ussc.gov/974357ab0394805c129f11bb.zip` joined to `bd4fb03e83c0e31ff58c362a.zip`, DISTRICT=78, SENTRNGE 2,3,4,7; packet `b5823123c538fd6ba9bee2bc.pdf` p.19 | 149/551 = 27.0 | match | yes |
| 8 | table, map tooltip | flsd | govt_below_range_pct_2006 | FY 2008 | 10.0%; 82nd of 94; not tagged derived | `www.ussc.gov/c035e40361a622bad8a6845e.zip` DISTRICT=31, BOOKERCD 5-7 over 0-11; packet `4584cfe715ce20ed293498a3.pdf` p.13 Table 8 | datafile 217/2,162 = 10.04; packet prints 10.1 | **mismatch** (label) | yes |
| 9 | table | ilnd | median_sentence_months (derived) | FY 2005 | 33.0 months; 45th of 94 | `www.ussc.gov/f1af1591a4ea6f3f91546aaa.zip` DISTRICT=52, SENSPLT0 non-missing | median 33.0, N 1,016 | match | yes |
| 10 | values file | rid | nongovt_below_range_pct_2006 | FY 2006 | 25.8 (5 of 94) | `www.ussc.gov/313c6cb08b572f43762805ee.zip` DISTRICT=03, BOOKERCD 8-11; packet `7365f7309837acc6d3620051.pdf` p.15 | 32/124 = 25.8 | match | no |
| 11 | table | mdd | crim_firearms_pct (derived) | FY 2011 | 9.3%; 63rd of 94 | `www.fjc.gov/9f961c8f3159642783af4592.zip` cr96on.txt, DISTRICT=16, FISCALYR=2011, CTFIL=1, D2FOFFCD1 firearms set | 166/1,790 = 9.3 | match | yes |
| 12 | compare | pawd | pro_se_pct (derived) | FY 2024 | 39.0%; 38th of 94 | `www.fjc.gov/8248453448ff200d56a790af.zip` cv88on.txt, DISTRICT=15, deduped filing cohort, PROSE 1-3 | 1,100/2,823 = 39.0 | match | yes |
| 13 | compare | nynd | pro_se_pct (derived) | FY 2008 | 44.5%; 15th of 94 | same file, DISTRICT=06 | 622/1,399 = 44.5 | match | yes |
| 14 | map tooltip | prd | crim_firearms_pct (derived) | FY 1998 | 4.6%; 75th of 94 | `www.fjc.gov/9f961c8f3159642783af4592.zip`, DISTRICT=04, FISCALYR=1998 | 29/628 = 4.6 | match | yes |
| 15 | profile | iand | population (derived) | July 1, 2025 | 1,336,565 | `www2.census.gov/6d156aee135757a10fa0e1a1.csv` POPESTIMATE2025 over the 52 counties of 28 U.S.C. § 95(a) | 1,336,565 | match | yes |
| 16 | profile | mnd | population (derived) | July 1, 2025 | 5,830,405 | same file, SUMLEV 40 STATE 27 | 5,830,405 | match | yes |
| 17 | table | cacd | senior_judges (derived) | Sept. 30, 2008 | 9; 6th of 91 | `www.fjc.gov/239aa4b12723ed2a2b60c60c.csv` C.D. Cal., counting rule | 9 (named) | match | yes |
| 18 | table | arwd | active_judges (derived) | Sept. 30, 1952 | 2; 23rd of 82 | same file, W.D. Ark. | 2 (Lemley, Miller) | match | yes |
| 19 | map tooltip, profile | ohnd | civil_filings_per_100k (derived) | FY 2025 | 68.3; 44th of 91 | `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` p.42 case-mix Civil Total; Census POPESTIMATE2025 over 40 counties of § 115(a) | 3,900 / 5,713,723 x 100,000 = 68.3 | match | yes |
| 20 | profile | tnwd | civil_filings_per_100k (derived) | FY 2025 | 97.2; 18th of 91 | same PDF p.46; 22 counties of § 123(c) | 1,513 / 1,556,945 x 100,000 = 97.2 | match | yes |
| 21 | map tooltip | flmd | civil_filings_per_100k (derived) | FY 2008 | 71.7; 37th of 91 | `www.uscourts.gov/89fe11b51bca5ccf8a95c771.pdf` p.91; `www2.census.gov/9e5713bb6b50f4a5659ec937.csv` POPESTIMATE2008, 35 counties of § 89(b) | 7,593 / 10,584,393 x 100,000 = 71.7 | match | yes |
| 22 | map tooltip | cod | nongovt_below_range_pct (derived) | FY 2020 | 23.9%; 52nd of 94 | `www.ussc.gov/609fecd2495e49fff7f74b24.zip` DISTRICT=82, SENTRNGE 5 and 8; packet `ffa691819897512fe6fc70d5.pdf` p.17 | (3+91)/393 = 23.9 | match | yes |
| 23 | table rank | cacd | trials_per_judgeship | FY 2003 | 14; 73rd of 94 | `www.uscourts.gov/71da9a8b5a62d5dc3281011e.pdf` p.68, col 2003; rank recomputed | 14; rank 73 (4-way tie) | match | yes |
| 24 | values file rank | nmid | sentenced_drug_trafficking_pct | FY 2008 | rank 2 (66.7) | rank recomputed; `www.ussc.gov/c035e40361a622bad8a6845e.zip` DISTRICT=94, OFFTYPE2=10 | 12/18 = 66.7; rank 2 | match | no |
| 25 | values file rank | ncmd | patent_share_pct | FY 2001 | rank 43 | rank recomputed; numerator from cv88on.txt DISTRICT=18, NOS 830 | 12 filings; rank 43 | match | no |
| 26 | table rank | mtd | civil_trial_months | FY 2017 | 26.2; 31st of 67 | `www.uscourts.gov/cf20304be244be17f01ce31a.pdf` p.72 MONTANA | 26.2; rank 31 (tie) | match | yes |
| 27 | values file | lamd | active_judges (derived) | Sept. 30, 1995 | 2 (84 of 91) | `www.fjc.gov/239aa4b12723ed2a2b60c60c.csv` M.D. La. | 2 (Parker, Polozola) | match | no |
| 28 | values file | paed | active_judges (derived) | Sept. 30, 1950 | 8 (4 of 82) | same file, E.D. Pa. | 8 (named) | match | no |
| 29 | table | nmid | patent_share_pct (derived) | FY 2023 | 0.0%; 76th of 94 | cv88on.txt DISTRICT=94, filing cohort FY 2023 | 0 NOS 830 filings | match | yes |
| 30 | map tooltip | vid | prisoner_petitions_pct (derived) | FY 2017 | 6.8%; 90th of 94 | cv88on.txt DISTRICT=91, NOS 510-560 | 10/148 = 6.8 | match | yes |
| 31 | map tooltip, compare | nmid | sentenced_firearms_pct | FY 2018 | 0.0%; lowest of 94; small-base note | `www.ussc.gov/c0c9d91c91ce67ba20d59fbb.zip` DISTRICT=94, OFFGUIDE=13 | 0/14 | match | yes |
| 32 | map tooltip, table | nmid | within_range_pct (derived) | FY 2005 | 82.8%; 4th of 94; note | packet `www.ussc.gov/9569fb84e957e5ad81f5395f.pdf` p.17 and p.32; datafile `f1af1591a4ea6f3f91546aaa.zip` | (5+19)/(5+24) = 82.8 | match | yes |
| 33 | values file | nmid | sentenced_drug_trafficking_pct | FY 2010 | 39.3 (26 of 94) | `www.ussc.gov/126905acffae99c6abc6f0c7.zip` DISTRICT=94, OFFTYPSB=10 | 11/28 = 39.3 | match | no |
| 34 | values file | akd | sentenced_immigration_pct | FY 2008 | 5.9 (63 of 94) | `www.ussc.gov/c035e40361a622bad8a6845e.zip` DISTRICT=95, OFFTYPE2=27; packet `0c26d67830f315b40e24f44b.pdf` p.4 | 10/169 = 5.9; packet 5.9 | match | no |
| 35 | table rank | insd | prisoner_petitions_pct (derived) | FY 2022 | 34.6%; 23rd of 94 | cv88on.txt DISTRICT=56; rank recomputed | 1,279/3,697 = 34.6; rank 23 | match | yes |

Paths in rows 2 to 35 are under `data/raw/http/` unless shown in full.

## Auditor B sample (35 numbers)

| n | Where shown | District | Measure | Period | Shown | Source file and locator | Source value | Result | Read on page |
|---|---|---|---|---|---|---|---|---|---|
| 101 | story, Rocket Docket step 7 | vaed | worst national standing, felony disposition (derived) | FY 2005-2025 | 11th | FCMS profile PDFs, VIRGINIA EASTERN, Criminal Felony disposition, standing column | max 11 (FY 2021), min 4 (FY 2013) | match | yes |
| 102 | story, Rocket Docket dek and step 1 | vaed | median months, filing to civil trial | FY 2025 | 15.6 months | `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` VIRGINIA EASTERN | 15.6 (standing 1) | match | yes |
| 103 | story, Rocket Docket step 2 | vaed | slowest civil trial median | FY 2021 | 24.9 months | `www.uscourts.gov/e837693b6ef43edf7bab845e.pdf` | 24.9 (series max) | match | yes |
| 104 | story, Patent Capital step 6 | txwd | share of national NOS 830 filings (derived) | FY 2021 | 24.0% | `www.fjc.gov/8248453448ff200d56a790af.zip` deduped filing cohort, NOS 830, DISTRICT 42 | 914/3,804 = 24.0 | match | yes |
| 105 | story, Patent Capital step 4 | txed | share after TC Heartland (derived) | 2017Q3-2018Q2 | 13.3% | same file, NOS 830 and 835, calendar quarters, DISTRICT 40 | 519/3,896 = 13.3 | match | yes |
| 106 | story, Patent Capital step 8 | four Texas districts | Texas share (derived) | FY 2025 | 46.8% | same file, DISTRICT 39-42 | 1,927/4,120 = 46.8 | match | yes |
| 107 | story, Border Districts step 7 | five border districts | §5K3.1 sentences (derived) | FY 2025 | 3,622 of 4,012, 90.3% | `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 9; datafile `eda40f9e219bb9dc070517c8.zip` SENTRNGE=3 | 3,622/4,012 = 90.3 | match | yes |
| 108 | story, Border Districts step 3 | azd | immigration share of felony defendants (derived) | FY 2025 | 86.5% | `www.fjc.gov/9f961c8f3159642783af4592.zip` FISCALYR 2025, CTFIL=1, FOFFLVL1=4, D2FOFFCD1 8700-8799 | 7,947/9,183 = 86.5 | match | yes |
| 109 | story, Border Districts step 4 | five border districts | years holding the top 5 (derived) | FY 2004-2025 | 19 of 22 | FCMS profile PDFs, felony filings per judgeship, standing | 19 of 22 | match | yes |
| 110 | story, After Booker step 7 | all 94 | districts above 50% within range (derived) | FY 2025 | 31 | `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 9 | 31 | match | yes |
| 111 | story, After Booker step 8 | all 94 | median district within-range share (derived) | FY 2025 | 42.9% | same table | 42.9 | match | yes |
| 112 | story, After Booker step 8 | all 94 | interquartile range (derived) | FY 2025 | 24.5 points | same table | 24.5 | match | yes |
| 113 | story, Where Trials Went dek | national | drop in civil trials (derived) | FY 1988 vs 2025 | 84.7% | cv88on.txt, termination cohort, DISP 7-9 | (8,735 - 1,336)/8,735 = 84.7 | match | yes |
| 114 | story, Where Trials Went step 1 | national | civil cases decided by trial | FY 1988 | 8,735 | same | 8,735 | match | yes |
| 115 | story, Where Trials Went step 6 | all 94 | median district criminal trial rate (derived) | FY 1996 | 8.46% | cr96on.txt FISCALYR 1996, CTTR=1, DISP1 trial codes | 8.4621 | match | yes |
| 116 | profile sentence | nvd | within_range_pct and rank | FY 2025 | 17.9%, second-lowest | `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 9 Nevada | 36/201 = 17.9; rank 93 | match | yes |
| 117 | profile sentence | arwd | median_sentence_months and rank | FY 2025 | 78.0 months, second-longest | `www.ussc.gov/eda40f9e219bb9dc070517c8.zip` DISTRICT 61, SENSPCAP | 78.0; rank 2 | match | yes |
| 118 | profile sentence | flnd | terminations_per_judgeship and rank | FY 2025 | 37,423, the most | `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` FLORIDA NORTHERN | 37,423 (standing 1) | match | yes |
| 119 | profile sentence | mtd | trials_per_judgeship and rank | FY 2025 | 52, third-most | same PDF, MONTANA | 52; rank 3 | match | yes |
| 120 | profile case mix | nywd | Social Security share (derived) | FY 2026 (preliminary) | 36.2% (1,463) of 4,038 | cv88on.txt DISTRICT 09, NOS 861-865 | 1,463/4,038 = 36.2 | match | yes |
| 121 | profile case mix | gud | traffic offense share (derived) | FY 2026 (preliminary) | 2.3% (1) of 44 | cr96on.txt DISTRICT 93, D2FOFFCD1 7210 | 1/44 = 2.3 | match | yes |
| 122 | profile sentencing table | azd | below range, other (derived) | FY 2014 | 10.1%, 5,518 people | `www.ussc.gov/4596ab13c1bad64a4271cfaf.pdf` Table 9 Arizona | 559/5,518 = 10.1 | match | yes |
| 123 | compare gap 1 | kywd vs miwd | govt_below_range_pct and ranks | FY 2025 | 40.7% (21st) vs 9.5% (88th), 31.2 apart | `www.ussc.gov/eda40f9e219bb9dc070517c8.zip` SENTRNGE 2,3,4,7 | 158/388, 23/242 | match | yes |
| 124 | compare gap 2 | kywd vs miwd | within_range_pct and ranks | FY 2025 | 60.3% (17th) vs 30.7% (70th), 29.6 apart | `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 9 | 146/242, 119/388 | match | yes |
| 125 | compare gap 1 | lawd vs mssd | civil_over_3yrs_pct and ranks | FY 2025 | 28.7% (13th) vs 2.1% (lowest), 26.6 apart | `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` | 28.7, 2.1 | match | yes |
| 126 | compare gap 2 | lawd vs tnmd | within_range_pct and ranks | FY 2025 | 70.0% (4th) vs 23.9% (85th), 46.1 apart | `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 9 | 264/377, 80/335 | match | yes |
| 127 | courtroom, judge's bench | gasd | vacant_judgeship_months | FY 2025 | 0.0 months, 29th of 94 | `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` GEORGIA SOUTHERN | 0.0; 66-way tie | match | yes |
| 128 | courtroom, prosecution table | mad | felony_defendants_per_100k (derived) | FY 2025 | 8.1, 76th of 91 | cr96on.txt DISTRICT 01; `www2.census.gov/6d156aee135757a10fa0e1a1.csv` | 582 / 7,154,084 x 100,000 = 8.1 | match | yes |
| 129 | profile bench | mtd | James Franklin Battin: senior status, service end | 1990, 1996 | Feb 13, 1990; Sep 27, 1996 (death) | `www.fjc.gov/239aa4b12723ed2a2b60c60c.csv` nid 1377556 | same | match | yes |
| 130 | profile bench | nyed | Rachel Peter Kovner: commission | 2019 | Oct 17, 2019 | same file, nid 7223861 | same | match | yes |
| 131 | profile bench | iasd | Stephen Henley Locher: status | current | commissioned Jul 18, 2022; active | same file, nid 12261091 | same | match | yes |
| 132 | profile recent cases | mdd | case name, date, docket | Nov 25, 2026 | No. 1:26-cv-04934 | `www.courtlistener.com/300f181929d2375253a52743.bin` (cached) | same | match | yes |
| 133 | profile recent cases | miwd | case name, date, docket | Nov 24, 2026 | No. 1:26-cv-03353 | `www.courtlistener.com/8da2a43e5ac25136f25072af.bin` (cached) | same | match | yes |
| 134 | courtroom, defense table (targeted) | cacd | median_sentence_months | FY 2025 | 29.5 months, labeled published | `www.ussc.gov/3f2d33fe7564d7b8136c006a.pdf` Table 7 TOTAL; datafile median DISTRICT 73 | packet prints 30; datafile 29.5 | **mismatch** (label) | yes |
| 135 | courtroom, defense table (targeted) | txwd | median_sentence_months | FY 2025 | 6.6 months, labeled published | `www.ussc.gov/0628b39b5701424754f79b36.pdf` Table 7 TOTAL; datafile median DISTRICT 42 | packet prints 7; datafile 6.62 | **mismatch** (label) | yes |

Paths are under `data/raw/http/`.

## Mismatches and their resolution

### A #8: S.D. Fla. FY 2008, "Below range, government (FY 2006 to 2017 method)"

- **Finding.** The atlas showed 10.0% (217 of 2,162, the exact share) and presented the series as "the grouping the
  USSC printed", not derived. The USSC packet prints 10.1%, because its FY 2006 to 2009 tables add the rounded
  percentages of the group's parts (9.2 + 0.0 + 0.9). Same page: non-government printed 15.5, atlas 15.4. Across
  FY 2006 and FY 2008, 176 of 564 district-group cells (31%) differ by 0.1 in this way.
- **Resolution (data fix lane).** New derived basis `exact_share_of_published_counts` for the three group variables
  in FY 2006 to 2009 (`pipeline/ussc/variables.py`). Those years are now `derived_years` with a hover formula that says
  the USSC's tables can differ by 0.1. The caveat no longer says "the grouping the USSC printed". FY 2010 to 2017
  packets print the exact share (88 of 88 district-table comparisons match), so those years stay published. The
  After Booker story flags its FY 2006 split numbers as derived. Regression tests in
  `tests/pipeline/test_data_audit_fixes.py`. Value unchanged.

### B #134 and #135: C.D. Cal. and W.D. Tex. FY 2025 median sentence

- **Finding.** Shown as 29.5 and 6.6 months and labeled as published; the USSC packets print 30 and 7, because from
  FY 2011 the USSC prints whole months. Scope: 78 of 752 FY 2018 to 2025 median cells and 672 of 752 mean cells
  carried decimals the USSC never printed. The national FY 2025 mean is 47.5 here and 47 in the packet.
- **Resolution (data fix lane).** New derived basis `unrounded_published_statistic`; the mean and median sentence
  variables are now derived in every year, with a formula that says the USSC prints whole months. National figures
  follow. Values unchanged.

### Other issues the auditors raised

| Issue | Raised by | Resolution |
|---|---|---|
| Table view hid cell notes and derived tags | A | Fixed. Both table views show the Derived tag and cell note, and the year's formula under the table. The recheck lane moved the flags under the district name on phones, where a fourth column did not fit. |
| IDB shares ranked on unrounded values (4,143 groups with equal shown values but different ranks) | A, B | Fixed. Ranks are taken at display precision. Recheck: 72,357 (variable, year, shown value) groups across all 43 variables, 0 with differing ranks. |
| FY 2018-method hover text said "sum of components the USSC published" | A | Fixed: "computed from the counts the USSC publishes for each part", noting that adding the rounded percentages can give 0.1 more or less. The D. Colo. FY 2020 packet is not cached, so A's inferred printed parts stay unverified. |
| Rank wording hid ties | A, B | Fixed: "Tied for 85th highest of 94", "Tied for lowest of 94 (66 districts)", "(tied)" in tables and accessible names. Recheck: seen rendered on compare. |
| "lane" in reader-facing text; "D.D.C.." typo | B | Fixed by the copy fix lane; the recheck lane found and fixed one more instance (see the copy audit). |
| Rocket Docket standings mixed counting methods | B | Fixed in data: standings now use only the years whose profile ranks the defendant-based median (FY 2010, FY 2012 to 2025). Range unchanged (4th to 11th). The recheck lane reworded the step so it says the range covers those years. |
| Patent shares depend on de-duplication, not stated | B | Fixed: a method note on the Patent Capital story. |
| IDB FY 2026 values unlabeled outside stories | B | Fixed: "FY 2026 (preliminary)" on profiles, compare, courtroom, home tooltip and table caption. Recheck: 50 of 50 profile sentences using FY 2026 carry the label. |
| N.D. Fla. "closed 37,423 cases per judgeship" lacks mass-tort context | B | Not done. The value is correct as published; context needs a sourced figure and a wording decision. |
| 28 U.S.C. § 115(a) "Woods" county | A | Not a defect (the statute's spelling of Wood County, handled correctly). |

## Recheck (final lane)

The recheck lane re-traced the three mismatches to the raw files with its own code, after the fixes:

| Cell | Raw file and locator | Raw value | USSC printed | Atlas now shows |
|---|---|---|---|---|
| flsd FY 2008 government below range | `www.ussc.gov/c035e40361a622bad8a6845e.zip` `opafy08nid.dat`, DISTRICT cols 318-319 = 31, BOOKERCD cols 23008-23009 | 0:1,584; 5:198; 7:19; 8:23; 9:33; 10:257; 11:21; 1:1; 2:2; 3:23; 4:1; blank 111. Government 217 of 2,162 = 10.04% | 217, 10.1% (p.13 Table 8); non-government 334, 15.5% | 10.0%, Derived, with the formula |
| cacd FY 2025 median sentence | `www.ussc.gov/eda40f9e219bb9dc070517c8.zip` `opafy25nid.dat`, DISTRICT cols 4037-4038 = 73, SENSPCAP cols 3949-3954 | median 29.50 (N 932) | 30 (`3f2d...pdf` Table 7 TOTAL) | 29.5 months, DERIVED (courtroom defense panel, rendered) |
| txwd FY 2025 median sentence | same file, DISTRICT = 42 | median 6.62 (N 10,416) | 7 (`0628...pdf` Table 7 TOTAL) | 6.6 months, derived |
| national FY 2025 mean sentence | same file, all 66,662 records | mean 47.4988 | 47 (Table 7 TOTAL) | 47.5, derived |

The recheck also corrected one caveat sentence on the mean and median sentence measures. It said the figures "match
the USSC's tables once rounded", which is false for a shown 47.5 (rounds to 48) against a printed 47. It now says the
USSC's tables match the atlas's unrounded figures but can differ from the one-decimal figure shown by up to half a
month.

## What was not checked

- Uncached USSC district packets (D.N.M.I. FY 2010 and FY 2018, D. Colo. FY 2020, D.R.I. FY 2006, N.D. Ill. FY 2005,
  W.D. Ark. FY 2025) were not downloaded; those cells were traced to the datafile only.
- Ranks were recomputed from the values files; other districts' values behind each rank were not traced to source
  (except where B recounted all districts from raw data).
- No approximate-population cell (mtd, idd, wyd, ncmd, nced) and no population_census_2020, judgeships or judge-count
  district field was drawn.
- Only one FCMS FY 1999 to 2003 back-column value and one current-method FY 2005 to 2011 re-read were drawn.
- The exact-versus-printed USSC group divergence was measured for FY 2006 and FY 2008 only, not FY 2007 or 2009.
- The IDB firearms category is the atlas's own mapping of FJC offense codes; it cannot be checked against an AO
  district table (the AO's D-2 table is national only).
- The FY 2014 to 2017 SENTRNGE rebuild (supplemental file joined on USSCIDN) was checked only against published
  packet values, not re-parsed.
- FY 2026 IDB values have no published AO table to compare with; they were recounted from the raw file only.
- Story numbers outside B's sample were not systematically traced (B confirmed several incidentally).
- CourtListener URLs were not opened live (quota); only cached responses were compared.
- Rendering was read in Chromium only, at 1280 px, light theme. Dark mode, 375 px and touch popovers were not part
  of the data audit (the UI audit covers layout).
- The recheck lane did not re-trace the other 67 matched numbers; it re-traced only the three mismatches.
