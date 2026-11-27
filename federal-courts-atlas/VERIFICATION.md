# Verification

Date: 2026-11-27. This page says what was checked in the Federal Courts Atlas, how, what failed, what was fixed, and
what nobody checked. Each check was done by a separate lane that did not build the thing it checked. The details are
in `docs/audits/`.

## Summary

| Check | What was done | Result |
|---|---|---|
| Data audit | 70 numbers shown on the site traced back to the raw source files by two independent auditors | 67 matched. 3 were real figures carrying the wrong label (shown as the USSC's printed figure when the USSC printed a slightly different rounding). All 3 are now labeled derived with a formula. No value changed. |
| Boundary audit | 64 counties in 24 multi-district states spot-checked against the statute text, then all 2,225 counties in those states re-derived from scratch | Passed. 0 district or division mismatches. 5 minor issues, all fixed or documented. |
| Statistics audit | 51 sampled cells traced; independent recompute of the case-level files | 51 of 51 matched. 1 blocker and 1 major issue found and fixed, then rechecked against the raw files. |
| Copy audit | About 1,400 reader-facing sentences checked against the data and fetched legal sources | 57 findings, all resolved. The recheck lane fixed 4 more sentences. |
| UI audit | 181 screenshots at 1280, 768 and 375 px in light and dark; automated accessibility scan | 7 known issues and 11 more problems fixed. The recheck lane fixed 2 more, and the third recheck 1 (a glossary popover that reopened after a quick closing click). 0 serious or critical accessibility violations. |
| Additions after the main audit | 51 new numbers and facts (how cases end, offenses of people sentenced, two new map measures, MDL notes for 22 districts and the MDL 2885 caveat on 11 measures, juror figures, event dates, new legal statements) traced to the raw files with independent code by two recheck lanes; 92 + 84 review captures of the changed views. A third recheck checked the fix pass that followed (no new numbers). | All 51 matched. 5 small display problems fixed (see below). |
| Tests | Pipeline unit tests, typecheck, end-to-end browser tests | 1,254 pipeline tests passed. Typecheck clean. 364 end-to-end tests passed, 0 failed, 14 skipped by design, in the third recheck's last full run, on the final code (an earlier run had one test that measured a sliding panel too early; the test was fixed; see Tests). |

## Data audit

Two auditors drew numbers at random with fixed seeds (A: 20261127, B: 9411) from every place the site shows a number:
map tooltips and tables, district profiles, compare, the stories, the courtroom panel, the bench and recent cases.
Each one was traced to the cached raw file with the auditor's own code, not the atlas's pipeline: PDF pages read
with `pdftotext`, USSC and FJC case-level files streamed with independent readers, Census and FJC CSVs read directly.
B's items 134 and 135 were targeted follow-ups, not random draws. Full method, every locator and the source values:
`docs/audits/data_audit.md`.

Source files are under `data/raw/http/` (git-ignored local cache; each has a URL and SHA-256 in `data/sources/`).
"Derived" marks values the atlas computed; the site shows their formula on hover.

| n | Where shown | District | Measure | Year | Value shown | Source file and locator | Result |
|---|---|---|---|---|---|---|---|
| 1 | map, table | miwd | civil median months, filing to disposition | FY 2006 | 8.0 | FCMS `www.uscourts.gov/8a6367a11cdc0cdeb8cf3d11.pdf` p.41 | match |
| 2 | table | ohnd | terminations per judgeship | FY 2020 | 416 | FCMS `62d148978121a39996666ee1.pdf` p.42 | match |
| 3 | table | mied | civil median months, filing to trial | FY 2017 | 25.9 | FCMS `cf20304be244be17f01ce31a.pdf` p.40 | match |
| 4 | table | ctd | felony median months, filing to disposition | FY 2020 | 14.8 | FCMS `62d148978121a39996666ee1.pdf` p.8 | match |
| 5 | table | tnmd | pending cases per judgeship | FY 2013 | 657 | FCMS `cd6149a32747f318f7e24097.pdf` p.45 | match |
| 6 | values file | ctd | sentenced within range | FY 2018 | 38.5% | USSC `www.ussc.gov/c0c9d91c91ce67ba20d59fbb.zip` DISTRICT 05; packet p.15 | match |
| 7 | map | nvd | below range, government (derived) | FY 2015 | 27.0% | USSC `974357ab0394805c129f11bb.zip` + supplemental, DISTRICT 78 | match |
| 8 | table, map | flsd | below range, government (2006-17 method) | FY 2008 | 10.0% | USSC `c035e40361a622bad8a6845e.zip` DISTRICT 31; packet `4584cfe715ce20ed293498a3.pdf` p.13 prints 10.1 | mismatch (label); fixed |
| 9 | table | ilnd | median sentence (derived) | FY 2005 | 33.0 months | USSC `f1af1591a4ea6f3f91546aaa.zip` DISTRICT 52 | match |
| 10 | values file | rid | below range, non-government (2006-17 method) | FY 2006 | 25.8% | USSC `313c6cb08b572f43762805ee.zip` DISTRICT 03; packet p.15 | match |
| 11 | table | mdd | firearms share of felony defendants (derived) | FY 2011 | 9.3% | IDB `www.fjc.gov/9f961c8f3159642783af4592.zip` DISTRICT 16 | match |
| 12 | compare | pawd | civil cases with a pro se party (derived) | FY 2024 | 39.0% | IDB `8248453448ff200d56a790af.zip` DISTRICT 15 | match |
| 13 | compare | nynd | civil cases with a pro se party (derived) | FY 2008 | 44.5% | same file, DISTRICT 06 | match |
| 14 | map | prd | firearms share (derived) | FY 1998 | 4.6% | IDB `9f961c8f3159642783af4592.zip` DISTRICT 04 | match |
| 15 | profile | iand | population (derived) | 2025 | 1,336,565 | Census `www2.census.gov/6d156aee135757a10fa0e1a1.csv`, 52 counties of 28 U.S.C. § 95(a) | match |
| 16 | profile | mnd | population (derived) | 2025 | 5,830,405 | same file, state row 27 | match |
| 17 | table | cacd | senior judges (derived) | Sept. 30, 2008 | 9 | FJC `www.fjc.gov/239aa4b12723ed2a2b60c60c.csv` | match |
| 18 | table | arwd | active judges (derived) | Sept. 30, 1952 | 2 | same file | match |
| 19 | map, profile | ohnd | civil filings per 100,000 (derived) | FY 2025 | 68.3 | FCMS `b1bbda81a12a87b71e626c3a.pdf` p.42 + Census 2025 | match |
| 20 | profile | tnwd | civil filings per 100,000 (derived) | FY 2025 | 97.2 | same PDF p.46 + Census 2025 | match |
| 21 | map | flmd | civil filings per 100,000 (derived) | FY 2008 | 71.7 | FCMS `89fe11b51bca5ccf8a95c771.pdf` p.91 + Census `9e5713bb6b50f4a5659ec937.csv` | match |
| 22 | map | cod | below range, non-government (derived) | FY 2020 | 23.9% | USSC `609fecd2495e49fff7f74b24.zip` DISTRICT 82 | match |
| 23 | table rank | cacd | trials per judgeship | FY 2003 | 14; 73rd of 94 | FCMS `71da9a8b5a62d5dc3281011e.pdf` p.68 | match |
| 24 | values file rank | nmid | drug trafficking share of sentences | FY 2008 | 66.7%; 2nd | USSC `c035e40361a622bad8a6845e.zip` DISTRICT 94 | match |
| 25 | values file rank | ncmd | patent share (derived) | FY 2001 | 43rd | IDB `8248453448ff200d56a790af.zip` DISTRICT 18 | match |
| 26 | table rank | mtd | civil median months, filing to trial | FY 2017 | 26.2; 31st of 67 | FCMS `cf20304be244be17f01ce31a.pdf` p.72 | match |
| 27 | values file | lamd | active judges (derived) | Sept. 30, 1995 | 2 | FJC service CSV | match |
| 28 | values file | paed | active judges (derived) | Sept. 30, 1950 | 8 | FJC service CSV | match |
| 29 | table | nmid | patent share (derived) | FY 2023 | 0.0% | IDB civil file, DISTRICT 94 | match |
| 30 | map | vid | prisoner petition share (derived) | FY 2017 | 6.8% | IDB civil file, DISTRICT 91 | match |
| 31 | map, compare | nmid | firearms share of sentences | FY 2018 | 0.0% (14 people) | USSC `c0c9d91c91ce67ba20d59fbb.zip` DISTRICT 94 | match |
| 32 | map, table | nmid | sentenced within range (derived) | FY 2005 | 82.8% | USSC packet `9569fb84e957e5ad81f5395f.pdf` p.17, p.32 | match |
| 33 | values file | nmid | drug trafficking share of sentences | FY 2010 | 39.3% | USSC `126905acffae99c6abc6f0c7.zip` DISTRICT 94 | match |
| 34 | values file | akd | immigration share of sentences | FY 2008 | 5.9% | USSC `c035e40361a622bad8a6845e.zip` DISTRICT 95; packet p.4 | match |
| 35 | table rank | insd | prisoner petition share (derived) | FY 2022 | 34.6%; 23rd | IDB civil file, DISTRICT 56 | match |
| 101 | Rocket Docket | vaed | worst national felony standing (derived) | FY 2005-2025 | 11th | FCMS profile PDFs, standing column | match |
| 102 | Rocket Docket | vaed | civil median months to trial | FY 2025 | 15.6 | FCMS `b1bbda81a12a87b71e626c3a.pdf` | match |
| 103 | Rocket Docket | vaed | slowest civil median to trial | FY 2021 | 24.9 | FCMS `e837693b6ef43edf7bab845e.pdf` | match |
| 104 | Patent Capital | txwd | share of national patent filings (derived) | FY 2021 | 24.0% | IDB civil file, NOS 830 | match |
| 105 | Patent Capital | txed | share after TC Heartland (derived) | 2017Q3-2018Q2 | 13.3% | IDB civil file, NOS 830 and 835 | match |
| 106 | Patent Capital | four Texas districts | Texas share (derived) | FY 2025 | 46.8% | IDB civil file | match |
| 107 | Border Districts | five districts | §5K3.1 sentences (derived) | FY 2025 | 3,622 of 4,012 (90.3%) | USSC packet `968d645857350fd39905a3b0.pdf` Table 9 | match |
| 108 | Border Districts | azd | immigration share of felony defendants (derived) | FY 2025 | 86.5% | IDB criminal file, DISTRICT 70 | match |
| 109 | Border Districts | five districts | years in the top 5 (derived) | FY 2004-2025 | 19 of 22 | FCMS profile PDFs | match |
| 110 | After Booker | all 94 | districts above 50% within range (derived) | FY 2025 | 31 | USSC packet Table 9 | match |
| 111 | After Booker | all 94 | median district within-range share (derived) | FY 2025 | 42.9% | USSC packet Table 9 | match |
| 112 | After Booker | all 94 | interquartile range (derived) | FY 2025 | 24.5 points | USSC packet Table 9 | match |
| 113 | Where Trials Went | national | drop in civil trials (derived) | FY 1988-2025 | 84.7% | IDB civil file, DISP 7-9 | match |
| 114 | Where Trials Went | national | civil cases decided by trial | FY 1988 | 8,735 | IDB civil file | match |
| 115 | Where Trials Went | all 94 | median district criminal trial rate (derived) | FY 1996 | 8.46% | IDB criminal file | match |
| 116 | profile | nvd | within range, second-lowest | FY 2025 | 17.9% | USSC packet Table 9 | match |
| 117 | profile | arwd | median sentence, second-longest | FY 2025 | 78.0 months | USSC `eda40f9e219bb9dc070517c8.zip` DISTRICT 61 | match |
| 118 | profile | flnd | terminations per judgeship, the most | FY 2025 | 37,423 | FCMS `b1bbda81a12a87b71e626c3a.pdf` | match |
| 119 | profile | mtd | trials per judgeship, third-most | FY 2025 | 52 | same PDF | match |
| 120 | profile case mix | nywd | Social Security share (derived) | FY 2026 (preliminary) | 36.2% | IDB civil file, NOS 861-865 | match |
| 121 | profile case mix | gud | traffic offense share (derived) | FY 2026 (preliminary) | 2.3% | IDB criminal file | match |
| 122 | profile sentencing | azd | below range, other (derived) | FY 2014 | 10.1% | USSC packet `4596ab13c1bad64a4271cfaf.pdf` Table 9 | match |
| 123 | compare | kywd vs miwd | below range, government; gap | FY 2025 | 40.7% vs 9.5%; 31.2 points | USSC FY 2025 datafile | match |
| 124 | compare | kywd vs miwd | within range; gap | FY 2025 | 30.7% vs 60.3%; 29.6 points | USSC packet Table 9 | match |
| 125 | compare | lawd vs mssd | civil cases over 3 years old; gap | FY 2025 | 28.7% vs 2.1% | FCMS `b1bbda81a12a87b71e626c3a.pdf` | match |
| 126 | compare | lawd vs tnmd | within range; gap | FY 2025 | 70.0% vs 23.9% | USSC packet Table 9 | match |
| 127 | courtroom | gasd | vacant judgeship months | FY 2025 | 0.0 | FCMS `b1bbda81a12a87b71e626c3a.pdf` | match |
| 128 | courtroom | mad | felony defendants per 100,000 (derived) | FY 2025 | 8.1 | IDB criminal file + Census 2025 | match |
| 129 | profile bench | mtd | Judge Battin: senior status, service end | 1990, 1996 | Feb 13, 1990; Sep 27, 1996 | FJC service CSV, nid 1377556 | match |
| 130 | profile bench | nyed | Judge Kovner: commission | 2019 | Oct 17, 2019 | FJC service CSV, nid 7223861 | match |
| 131 | profile bench | iasd | Judge Locher: commission, status | 2022 | Jul 18, 2022; active | FJC service CSV, nid 12261091 | match |
| 132 | profile cases | mdd | case filed, docket number | 2026 | Nov 25, 2026; 1:26-cv-04934 | cached CourtListener `300f181929d2375253a52743.bin` | match |
| 133 | profile cases | miwd | case filed, docket number | 2026 | Nov 24, 2026; 1:26-cv-03353 | cached CourtListener `8da2a43e5ac25136f25072af.bin` | match |
| 134 | courtroom | cacd | median sentence | FY 2025 | 29.5 months | USSC packet `3f2d33fe7564d7b8136c006a.pdf` Table 7 prints 30; datafile median 29.5 | mismatch (label); fixed |
| 135 | courtroom | txwd | median sentence | FY 2025 | 6.6 months | USSC packet `0628b39b5701424754f79b36.pdf` Table 7 prints 7; datafile median 6.62 | mismatch (label); fixed |

**What the mismatches were and how they were fixed.** For FY 2006 to 2009 the USSC's tables print a sentencing
group's share as the sum of its parts' rounded shares (S.D. Fla. FY 2008: 9.2 + 0.0 + 0.9 = 10.1), while the atlas
showed the exact share from the same counts (217 of 2,162 = 10.0). From FY 2011 the USSC prints average and median
sentences in whole months, while the atlas showed one decimal. Both were labeled as the USSC's printed figures. They
are now marked derived, with a formula that says how and by how much the USSC's tables can differ. The recheck lane
re-traced all three to the raw files after the fix (S.D. Fla. BOOKERCD counts 217 of 2,162; C.D. Cal. median 29.50,
N 932; W.D. Tex. median 6.62, N 10,416; national mean 47.4988 against 47 printed).

**Also fixed after the data audit:** table views now show the Derived tag and cell notes; ranks are taken at the
precision shown, so districts that show the same number share a rank (recheck: 0 of 72,357 groups differ); rank
wording says when districts are tied. IDB FY 2026 values are labeled "(preliminary)" wherever one is shown: on the
home map (legend year, national figure, slider readout, tooltip, each district's accessible name, map table
caption), on the table page (caption and period menu), on district profiles (key statistics, "What stands out",
the case mix, "How cases end", the MDL notes and the sparklines' spoken labels), in compare rows and gaps, in the
courtroom panel, and in story charts (a shaded "Prelim." band, the tooltip and the data-table rows). Three things
name the year without the word because they label a choice or a span rather than a value: the compare page's
"Year shown" menu (the IDB rows it fills read "FY 2026 (preliminary)"), year ranges such as "1996 to 2026" under
sparklines and on axes, and source citations that quote the FJC's own file description ("FY 1996 through FY
2026"). The period menu, the story table rows and the sparkline labels were fixed by the final recheck (Nov 27).

## Additions after the main audit

After the audits, a gap-closing pass added "How cases end" (civil and criminal) and "Offenses of people sentenced"
to every profile, two map measures (criminal defendants whose cases were dismissed; child pornography as a share of
people sentenced), notes on multidistrict litigation (MDL) dockets for 8 districts, a line on duty stations, glossary
terms on measure labels and dated time-machine events. A final recheck lane traced the new kinds of number to the
cached raw files with its own code. It did not use the pipeline's parsers: it streamed `cv88on.txt` and `cr96on.txt`
out of the FJC zips, split the lines itself and applied the codebooks' rules. The civil termination cohort is every
record not pending (TAPEYEAR other than 2099), by the fiscal year of TDATEUSE. The civil filing cohort is
de-duplicated on district, office, docket, origin and filing date, keeping the latest tape year. The criminal side is
the FISCALYR snapshot with CTTR = 1. Group codes were read from the codebook PDFs, and PDFs were read with
`pdftotext`. Its civil closing totals equal the AO's Table C-1, read from the xlsx: 396,635 in FY 2024 and 407,539
in FY 2025, and for FY 2025 E.D. Va. 3,869, N.D. Fla. 149,260 and D.N.M.I. 15. TAPEYEAR equals the TDATEUSE fiscal
year on every FY 2024 to 2026 record.

| n | Where shown | District | Measure | Year | Value shown | Source file and locator | Result |
|---|---|---|---|---|---|---|---|
| 201 | profile, How civil cases ended | vaed | Dismissed: settled (derived) | FY 2026 (preliminary) | 6.2% (372 of 5,988) | IDB civil `www.fjc.gov/8248453448ff200d56a790af.zip`, DISTRICT 22, DISP 13, termination cohort | match |
| 202 | same panel, All districts tick | all 94 | Dismissed: settled (derived) | FY 2026 (preliminary) | 16.9% (54,323 of 322,269) | same file, all districts | match |
| 203 | same panel, FY 2025 switch | vaed | Dismissed: settled (derived) | FY 2025 | 10.5% (406 of 3,869) | same file | match |
| 204 | same panel, FY 2025 switch | flnd | Dismissed: withdrawn by the plaintiff (derived) | FY 2025 | 98.9% (147,646 of 149,260) | same file, DISTRICT 29, DISP 12 | match |
| 205 | same panel | nmid | Transferred or remanded (derived) | FY 2026 (preliminary) | 27.3% (9 of 33) | same file, DISTRICT 94, DISP 0, 1, 10, 11 | match |
| 206 | profile, How criminal cases ended | vaed | Convicted: guilty plea (derived) | FY 2026 (preliminary) | 76.2% (1,027 of 1,347) | IDB criminal `www.fjc.gov/9f961c8f3159642783af4592.zip`, FISCALYR 2026, CTTR 1, DISTRICT 22, DISP1 4 and 5 | match |
| 207 | same panel, FY 2025 switch | vaed | Not convicted: dismissed (derived) | FY 2025 | 18.2% (247 of 1,360) | same file, DISP1 1, 10-15, 20, 21 | match |
| 208 | same panel, All districts ticks | all 94 | the six criminal groups and the total | FY 2025 | 75,151 plea; 1,189 jury; 174 bench; 5,336 dismissed; 135 and 57 acquitted; 82,042 | AO Table D-4 FY 2025 `www.uscourts.gov/3404f78624cfe3df3e0b9c14.xlsx`, Total row | match (7 of 7) |
| 209 | map, table, profile key statistics | vaed | Criminal defendants whose cases were dismissed (derived) | FY 2026 (preliminary) | 19.3% (260 of 1,347) | IDB criminal file | match |
| 210 | home map, all district courts | all 94 | same measure (derived) | FY 2026 (preliminary) | 5.8% (4,810 of 82,895) | IDB criminal file | match |
| 211 | same measure, caveat | all 94 | FJC dismissals above the AO's table | FY 1997-2004 | "7% to 12% more" | IDB criminal file against the D-4 PDFs (`ao_jb_d4_1997` to `_2005`), Total rows | match (7.2% to 11.9%; FY 2005 equal at 8,141) |
| 212 | profile, Offenses of people sentenced | vaed | Fraud/theft/embezzlement | FY 2025 | 15.6% (138 of 884); all districts 7.6% (5,080 of 66,662) | USSC packet `www.ussc.gov/968d645857350fd39905a3b0.pdf` Table 1, p.2 | match |
| 213 | same block | mtd | Drug trafficking (and the 4 other named types) | FY 2025 | 39.7% (160 of 403) | USSC packet `a659493fe314cbed39860d93.pdf` Table 1 | match (5 of 5) |
| 214 | same block | vaed | All other offense types (derived) | FY 2025 | 32.7% (289 of 884) | packet Table 1: 884 − 227 − 103 − 96 − 138 − 31; the USSC prints no combined row, so the derived label is right | match |
| 215 | map, table, profile key statistics | vaed | Child pornography, share of people sentenced | FY 2025 | 3.5% (31 of 884) | packet Table 1 | match |
| 216 | same measure | vaed | same | FY 2010, FY 2015 | 2.7% (55 of 2,075), 2.4% (35 of 1,461) | packets `7643e3deef9d1916b990627e.pdf`, `b5823123c538fd6ba9bee2bc.pdf`, primary offense table | match |
| 217 | profile, What stands out, Key statistics and Case mix MDL notes | flnd | civil cases closed in MDL 2885 | FY 2025 | 147,231 of 149,260 | IDB civil file, DISTRICT 29, termination cohort, MDLDOCK 2885 | match |
| 218 | full MDL note, history | flnd | civil cases filed in MDL 2885, the most | FY 2020 | 202,693 of 204,990 | IDB civil file, filing cohort | match |
| 219 | full MDL note, history | flnd | civil cases closed in MDL 2885, the most | FY 2024 | 139,357 of 141,214 | IDB civil file, termination cohort | match |
| 220 | MDL notes | flnd | civil cases filed in MDL 3140 | FY 2026 (preliminary), FY 2025 | 5,256 of 7,237; 1,275 of 3,251 | IDB civil file, filing cohort | match (C-1 prints 3,248 filings for FY 2025; the note counts FJC records, as its formula says) |
| 221 | every profile, How civil cases ended, FY 2025 | all 94 | civil cases closed in MDL 2885 | FY 2025 | 147,231 of 407,539 | IDB civil file, all districts | match |
| 222 | MDL notes | flnd | docket names and case numbers | 2019, 2025 | In re: 3M Combat Arms Earplug Products Liability Litigation, 3:19-md-02885; Depo-Provera, 3:25-md-03140 | GovInfo MODS `www.govinfo.gov/fc4a82b76010883aa3ca9972.xml`, `80f4b0da02c64347c544d9f1.xml` (sha256 equal to the source records; author N.D. Fla.) | match |
| 223 | courtroom jury box, map, table | vaed | average present for jury selection | FY 2025 | 54.5 | FCMS `www.uscourts.gov/b1bbda81a12a87b71e626c3a.pdf` p.25 | match |
| 224 | same | vaed | percent not selected or challenged | FY 2025 | 31.0% | same PDF p.25 | match |
| 225 | same | flnd | both juror measures | FY 2025 | 43.7; 28.4% | same PDF p.90 | match |
| 226 | same | nmid | both juror measures | FY 2025; FY 2024 | 116.0, 52.6%; FY 2024 "No data" | same PDF p.78 prints 0 for FY 2024 (no jury selection held); gap record in `data/gaps/fcms.json` | match |
| 227 | home time machine | national | event dates | 2005-2020 | Jan. 12, 2005; May 22, 2017; Dec. 21, 2018; March 13, 2020 | LII syllabi 04-104 and 16-341 ("Decided"); GovInfo Pub. L. 115-391 ("Approved December 21, 2018"); Federal Register 2020-05794 (Proclamation 9994 of March 13, 2020) | match |
| 228 | glossary, median time to trial | national | not computed below 10 civil trials | current | 10 | AO Explanation of the Judicial Caseload Profiles `15d2d50a078fed33d349b32a.xlsx` | match |
| 229 | MDL note, first sentence | national | what an MDL docket is | current | cases from many districts, one court, pretrial proceedings | 28 U.S.C. § 1407(a), fetched from LII by the recheck | match |
| 230 | child pornography measure, caveat | national | own USSC category from FY 2010 | FY 2010 | "first reported ... in FY 2010" | FY 2008 packet `4584cfe715ce20ed293498a3.pdf` lists "Pornography/Prostitution"; USSC codebook: OFFTYPSB from FY 2010 | match |
| 231 | same caveat; Offenses of people sentenced note | national | classification by main guideline from FY 2018 | FY 2018 | "main guideline applied" | USSC codebook `36b420a2608f0e77db3cad32.pdf`: OFFGUIDE "generated mainly from the primary guideline", used from FY 2018 | match |
| 232 | profile MDL note, brief and full | ohsd | civil cases filed in MDL 2846 | FY 2024 | 3,817 of 6,099 | IDB civil `www.fjc.gov/8248453448ff200d56a790af.zip`, DISTRICT 48, filing cohort, MDLDOCK 2846 | match |
| 233 | full MDL note, history | ohsd | MDL 2846 filings above a quarter; the most | FY 2019-2023; FY 2021 | 5,226 of 7,576 | same file, filing cohort | match |
| 234 | profile MDL note | ohsd | MDL 2433: closed; filed | FY 2019; FY 2015 | 3,562 of 5,987; 2,663 of 5,245 | same file, termination and filing cohorts | match |
| 235 | profile MDL note | wvsd | civil cases closed in MDL 2327 | FY 2020 | 1,391 of 3,321 | same file, DISTRICT 25, termination cohort | match |
| 236 | full MDL note, history | wvsd | MDL 2327: filed, the most; closed, the most | FY 2012-2018, FY 2014; FY 2017-2019, FY 2019 | 12,474 of 36,364; 17,082 of 41,663 | same file | match |
| 237 | full MDL note | wvsd | MDL 2326 closed; MDL 2325 closed, filed, closed | FY 2020; FY 2016, FY 2013, FY 2015 | 970 of 3,321; 5,746 of 17,561, 7,717 of 27,962, 8,527 of 12,594 | same file | match |
| 238 | profile MDL note, brief and full | laed | civil cases closed in MDL 2740 | FY 2026 (preliminary), FY 2025 | 3,273 of 5,870; 6,058 of 10,713 | same file, DISTRICT 3L, termination cohort | match |
| 239 | full MDL note | laed | MDL 2592: closed; filed, the most; closed, the most | FY 2023; FY 2016; FY 2020 | 2,002 of 6,925; 11,513 of 16,541; 11,638 of 16,978 | same file | match |
| 240 | full MDL note | laed | MDL 2179 filed; MDL 1657 closed | FY 2013; FY 2010 | 2,195 of 6,505; 5,159 of 9,742 | same file | match |
| 241 | MDL notes on all 22 districts | 22 districts | every docket above 25% of civil cases filed or closed | FY 2010-2026 | 150 docket-years: 43 sentences, 107 years in history lines | same file, both cohorts, every district | match (the recount found the same 150 and no others; every count, total, peak, year list and latest year equal) |
| 242 | MDL 2885 caveat on 6 filing measures | flnd; all 94 | civil cases filed in MDL 2885 | FY 2020 | 202,693 of 204,990; 202,695 of 470,373 | same file, filing cohort | match |
| 243 | MDL 2885 caveat on 6 closing measures | flnd; all 94 | civil cases closed in MDL 2885 | FY 2025 | 147,231 of 149,260; 147,231 of 407,539 | same file, termination cohort | match |
| 244 | same caveats, year spans | flnd | "most" of filings; "most" of closings | FY 2020-2024; FY 2021-2025 | the spans shown | same file: filings 93.6% to 98.9% (FY 2019 45.7%, FY 2025 0.5%); closings 86.2% to 98.7% (FY 2020 32.3%) | match |
| 245 | same caveats (why only MDL 2885) | all 94 | dockets above 25% of all districts' civil cases | FY 2010-2026 | MDL 2885 only | same file: FY 2020 filings 43.1%, FY 2024 closings 35.1%, FY 2025 closings 36.1%; no other docket-year | match |
| 246 | pro se caveat | flnd | "Many are coded pro se" | FY 2020 | (no number shown) | same file: 109,944 of the 202,695 MDL 2885 filings carry PROSE 1, 2 or 3 | match |
| 247 | MDL note rule text | all 94 | docket numbers coded from FY 2010 | FY 1988-2009 | 223 of 5,420,719 termination records carry one | same file: at most 99 in any year before FY 2010; 2,336 to 163,348 a year from FY 2010 | match |
| 248 | measures left without the caveat (docs only) | all 94 | MDL 2885 cases with nature of suit 830 or 835; with a trial disposition | FY 2019-2026 | 0; 19 (FY 2021-2022) | same file, DISP 7-9 | match (19 = 5 in FY 2021, 14 in FY 2022; that is 5 of N.D. Fla.'s 20 and 14 of its 57 trial-disposition closings, not above a quarter) |
| 249 | MDL notes, docket names | 22 districts | name, case number, transferee court | various | 26 named dockets | GovInfo MODS records listed in `data/sources/idb.json` (`govinfo_uscourts_*`) | match (26 of 26: file sha256 equal to the manifest, `caseNumber` ends in the docket as md, mn or ml, `courtCode` is the transferee court, title equal once "In re" and a docketing note are set aside); 13 dockets shown by number only |
| 250 | glossary, multidistrict litigation (MDL) | national | what an MDL is | current | transfer of civil cases sharing common questions of fact, convenience and just and efficient conduct, remand at or before the end of pretrial proceedings | 28 U.S.C. § 1407(a), cached LII page `www.law.cornell.edu/48637b966c6d9fd4e652ceee.bin` (sha256 162e0544...) | match ("a single district" rests on (a)'s "coordinated or consolidated pretrial proceedings" and (b)'s "the transferee district") |
| 251 | MDL 2885 caveats, "count in" | flnd | whether FCMS counts include MDL cases | FY 2020-2025 | (no number shown) | AO profile explanation `www.uscourts.gov/15d2d50a078fed33d349b32a.xlsx` (medians "of all closed cases"; filings, terminations and pending "including transfers"); AO Table C-1 FY 2018-2025 note (pending "includes cases that have been transferred under a Multidistrict Litigation (MDL) order"); N.D. Fla. FCMS series | consistent (weighted filings per judgeship 950 to 35,559 from FY 2019 to 2020; civil median 5.3 to 47.7 months from FY 2021 to 2025). No AO text names MDL cases for medians or weighted filings |

Beyond these rows, the recheck recomputed every group in the two "How cases end" panels for vaed, flnd and nmid in
both years, for the district and the all-district column. That is 120 civil and 72 criminal cells, all equal to
the profiles. It also recomputed the dismissed share for those three districts in FY 2025 and FY 2026 (6 cells,
equal to the values file).

**Fixed by the final recheck** (all display only; no value changed):

- On the MDL notes, the case number 3:25-md-03140 broke across two lines at a hyphen on desktop. Case numbers now
  stay on one line.
- The table page's period menu showed "FY 2026" for IDB measures. It now reads "FY 2026 (preliminary)", as the
  caption under it already did.
- The data tables under story charts printed "FY 2026" rows without the word preliminary, although the chart above
  shades that year as preliminary. The rows now say so.
- The spoken label of profile sparklines ended "in FY 2026". It now ends "in FY 2026 (preliminary)" for IDB
  measures.
- A doc said the visual-regression set has 20 baselines. It has 16 (8 views at 2 widths, 901 KB); corrected in
  `docs/lanes/frontend.md`.

**Second recheck (after the polish pass, Nov 27).** The polish pass extended the MDL notes to every year from FY 2010
(22 districts), added one MDL 2885 caveat to 11 measures, relabeled the compare page's year menu and added a glossary
entry for multidistrict litigation. A second recheck lane, which did not build any of it, traced it again with its own
code (rows 232 to 251). It streamed `cv88on.txt` out of the FJC zip, split each line itself (the first 21 fields from
the left and the last 23 from the right, because party names can hold a tab) and rebuilt both cohorts from the
codebook's rules: 11,071,506 records and 11,035,840 cases after de-duplication, with no tie that changes a count. It
read the docket names from the cached GovInfo MODS files with an XML parser and the glossary entry against the cached
text of 28 U.S.C. § 1407. It also took 84 captures of the changed views: the ohsd, wvsd, laed and flnd notes
(brief, full, case mix and glossary popover), the compare year menu, a caveat on the home map and on the table page,
at 1280 and 375 px in light and dark, and the fixed compare menu also at 1024 and 768 px. It looked at 26 of them by
eye, with at least one light and one dark capture, and one at each width, of every view. A script checked all 84 for
sideways scroll, page errors, the popover staying on screen and the menu label fitting, and found no problem.

**Fixed by the second recheck** (display only; no value changed):

- On desktop, the compare page's "Year shown" menu cut its new label to "FY 2026 (preliminary for IDB me". A native
  select cannot wrap, and the column is about 16 rem wide. The closed menu now shows a copy of the chosen option
  that wraps, and the native select lies on top of it, invisible, so clicks, keys and screen readers still use it.
  A compare test now checks that the whole label shows without clipping and that the arrow keys still change the
  year.
- Test only: the compare tests' wait helper could pass before the page had drawn any row, so one run read the year
  menu before it existed. It now waits for the menu and the first row.

**Third recheck (after the fix pass, Nov 27).** The fix pass replaced a stale gap record that said MDL docket counts
were not processed, rewrote the brief MDL note's line about other dockets as one sentence, made a click pin the
glossary popover open, tried 46 more GovInfo package ids for the 13 MDL dockets shown by number only, re-rendered the
boundary preview image without an em-dash in its title, and made the accessibility scan's scroll step fail fast. A
third recheck lane, which did not build any of it, checked each claim with its own code and captures. No value shown
on the site changed and no docket was newly named, so no data-audit row was added.

- **Rebuild.** `make stories web docs` ran three times. All 563 files under `public/data/`, `data/processed/`,
  `data/gaps/`, `data/sources/`, plus `SOURCES.md` and `DATA_GAPS.md`, were byte-identical after every run and equal
  to the files the fix pass left.
- **Tests.** Pipeline tests: 1,254 passed in each of three runs. Typecheck clean; `vite build` succeeds. Four full
  end-to-end runs (`CI=1 E2E_PORT=4710 npx playwright test --trace off`, both projects, 378 tests). Run 1, on the
  fix pass's code, and run 2, after the glossary fix: 364 passed, 14 skipped by design, 0 failed. Run 3: 363
  passed, 1 failed. The phone courtroom test read the bottom sheet's position 167 ms into its 420 ms slide-in,
  8.76 px short of the bottom; a frame-by-frame sample of the same slide-in reads 8.76 px at 167 ms and 0.01 px at
  485 ms. Alone, the test passed 30 of 30 times. It now waits for the slide-in to end (below). Run 4, on the final
  code: 364 passed, 14 skipped by design, 0 failed. The 16 visual baselines passed in every run and were not
  rewritten.
- **Gap record.** The new record `mass_tort_story_not_written` is true: 5 stories ship, the docket table
  `data/processed/idb/civil_mdl_dockets` exists, `civil_mdl_meta.json` gives FY 2010, and the MDL 2885 caveats are on
  the affected measures. The two stories describe N.D. Fla.'s closings without naming the docket; those closings were
  139,357 of 141,214 (FY 2024) and 147,231 of 149,260 (FY 2025) MDL 2885 cases (rows 217 and 219). No text in
  `DATA_GAPS.md`, `docs/lanes/stories.md` or the README still says the counts are unprocessed.
- **MDL note sentence.** The recheck recomputed, from the processed docket table, the years each docket was above 25%
  of a district's civil cases filed or closed from FY 2010: 39 of 39 year lists equal the profiles' `years_text`, on
  the same 22 districts. It compared the rendered sentence with text written out by hand for flnd, ohsd, wvsd, laed,
  ilnd (two dockets, neither current, both shown by number) and ksd (one docket, so no such sentence), at 1280 and
  375 px in light and dark: 24 captures and 96 checks (text, old fragment gone, no em-dash, no sideways scroll), all
  passing. Eight of the captures were read by eye; the sentence is plain, grammatical and readable in both themes.
- **Glossary popover.** A script drove it by mouse, keyboard (Tab, Enter, Space, Escape) and touch on the Learn page,
  N.D. Fla.'s MDL note and key statistics, and the measure labels on the home map and compare page, in light and
  dark: 185 checks. Clicking or tapping inside a pinned popover keeps it open. One defect was found and fixed (below).
- **GovInfo names.** Of 89 cached `www.govinfo.gov` responses, 47 were fetched by the fix pass (17:09 to 17:10 UTC):
  exactly the 46 ids it added to `NAME_CANDIDATES` and one check of a real record (case 2:09-md-02047, E.D. La.),
  which no source record uses. All 46 are the same 44,172-byte "Page Not Found" page with no MODS record in it. All
  85 candidate ids are cached, and rerunning `make idb-mdl` left the cache at 4,295 files and its outputs unchanged.
  The gap record lists exactly the 13 unnamed dockets and their 9 transferee courts. The 26 named dockets still
  verify (file sha256 equal to the manifest, an md, mn or ml case number ending in the docket, the transferee court).
- **Preview image.** Only pixel rows 13 to 30 of `preview.png` changed: the title's em-dash became a colon.
  Nothing else in the image or the boundary files changed.
- **Accessibility scan.** Only `scrollThrough` changed: the same 19 routes, the same axe tags, the same target-size
  exclusion and the same serious-or-critical filter. A verbatim copy of the helper, run on four-district compare at
  375 px with the page's main thread blocked, failed after 5,006 ms with "scrollThrough: reading the window height
  on .../#/compare?d=vaed,txed,nysd,gud did not finish within 5000 ms ..."; unblocked, it reached the bottom in 887 ms.
- **Global.** No file over 20 MB; no secrets by pattern; `data/raw/` holds only the 8 allowed hosts, and the last
  CourtListener response was fetched at 08:46 UTC, before the fix pass. Literal em-dashes were found in five pipeline
  files (present since the project skeleton) and were removed (below). Two boundary files keep them on purpose:
  `data/processed/boundaries/statute_parsed.json` and `statute_crosscheck.csv` quote 28 U.S.C. word for word, and the
  Code's subsection headings use them (after "(b) Middle District." in 28 U.S.C. § 113, for example). Neither reaches
  the site.

**Fixed by the third recheck** (no value changed):

- Glossary popover: a click that closed a pinned popover less than 120 ms after the pointer reached the term (so the
  hover delay was still running) closed it and then reopened it 120 ms later. It happened at 0, 40 and 80 ms, not
  at 200 or 400 ms. The spec checked the closed state at once and missed it. A press on a term now cancels a pending
  hover-open, and the spec checks that the popover is still closed 400 ms later (that check fails without the fix).
- Code only: the five pipeline files with literal em-dashes (`boundaries/statute.py`, `common/manifest.py`,
  `fcms/parse.py`, `idb/jb.py`, `ussc/packets.py`) now write the character as `\u2014` where a parser must match it,
  and two docstrings were reworded. Their syntax trees are identical to before apart from the two docstrings.
- Test only: the phone courtroom test measured the bottom sheet before its 420 ms slide-in ended. It now waits for
  the sheet's own animation to finish, then checks the same 2 px bound; it passed 20 of 20 times alone.
- Docs: `docs/lanes/idb.md` said two to four more ids were tried per docket; it was three or four.

**Not checked by the third recheck:**

- The MDL counts were not traced to the raw FJC file again (the second recheck did that, rows 232 to 251); the year
  lists were recomputed from the processed docket table only. GovInfo was not searched again; this lane made no
  network request and read the 46 not-found pages from the cache.
- The glossary popover was driven only in headless Chromium with a simulated mouse, keyboard and touch: no screen
  reader, no real touch screen, no pen. The story number popovers and the formula popovers were not driven.
- Seen but left as is: hovering a second term while one is pinned shows the second term's popover, which closes when
  the pointer leaves it. (Fixed after this recheck, by the orchestrator: after a click inside a pinned popover,
  focus was on the page itself and Escape closed the popover without moving focus back to the term, because closing
  the popover cleared the term first. Escape now returns focus to the term without reopening the popover;
  `glossary-popover.spec.ts` checks it, and that check fails on the previous `glossary.ts`.)
- The cause of the earlier one-off 1.6-minute stall in the scroll step is still unknown; it did not recur in any of
  this lane's four full runs. A later full run by the orchestrator (after the glossary Escape fix, port 4803) had
  363 passed, 1 failed, 14 skipped: the same stall, now caught by the 5 s guard on desktop two-district compare
  (scroll step 5, 2,560 px). An investigation was started and then stopped at the user's request, with no changes.

## Boundary audit

Full report: `docs/audits/boundary_audit.md`.

- **Spot check:** 64 counties across 24 multi-district states, each against the quoted statute sentence: all pass.
  The rows include Virginia's independent cities, St. Louis city, retired county-equivalents and split counties.
- **Full re-derivation:** the auditor parsed 28 U.S.C. §§ 81-131 from two sources (Cornell LII HTML and the House
  OLRC XML release, identical word for word in all 180 relevant sentences) and matched all 2,225 county-equivalents
  in the 24 states with its own code: 0 district mismatches, 0 division mismatches. All 38 Virginia independent cities
  pass a geometry test of § 127(c). All 144 statutory divisions match.
- **Geometry:** valid, no gaps, no overlaps; carve-outs (Yellowstone and others) correct.
- **Fixes:** split counties now carry a marker; one invalid polygon (Iberia Parish) repaired; split-county
  populations documented as approximate (mtd, idd, wyd, ncmd, nced per-capita rates are flagged); Hawaii inset framing
  and undrawn statutory areas recorded as gaps. 106 boundary tests pass.

## Statistics audit

Full report: `docs/audits/stats_audit.md`.

- 51 of 51 sampled cells across FCMS, USSC and IDB matched the sources. An independent recompute reproduced 28,663
  of 28,663 IDB criminal cells and 3,666 of 3,666 cells for each IDB civil variable checked.
- **Blocker, fixed:** USSC average and median sentences for FY 2002 to 2017 counted missing sentence lengths as 470
  months (E.D. La. FY 2002 showed 91.3 instead of 51.3). Fixed and rechecked against the raw files in every cell.
- **Major, fixed:** W.D. La. FY 1998 offense mix was M.D. La.'s data (the source packet carried the wrong district).
  Removed and logged as a gap; a header check now rejects such tables.
- Six minor issues fixed or documented (derived flags on computed years, source totals that do not add up, implausible
  printed cells flagged, missing gap records, the FCMS counting-method change).

## Copy audit

Full report: `docs/audits/copy_audit.md`. About 1,400 reader-facing sentences were checked against the atlas's own
data and against fetched legal sources (court opinions, rules and statutes on law.cornell.edu and govinfo.gov, the
2025 Guidelines amendments on ussc.gov). 57 findings: 5 marked strike (unsupported or wrong), 34 marked fix and 18
small wording nits. Examples: a claim that the Rocket Docket statistics "show why the name stuck" (a motive claim) was
removed; "the spread is widest" in After Booker was wrong and was rewritten; the glossary now reflects the November
1, 2025 Guidelines amendments that moved §5K3.1 to §3F1.1. A test now fails the build on any em-dash or pipeline word
in reader-facing data. The recheck lane confirmed every resolution and fixed 4 more sentences, including a caveat that
claimed the sentence figures "match the USSC's tables once rounded" (not true for a shown 47.5 against a printed 47).

## UI audit

Full report: `docs/audits/ui_audit.md`. 181 screenshots of every page type at desktop, tablet and phone widths in
both themes were reviewed. Fixed: story source lines cut off on phones, unlabeled map insets and timeline markers on
phones, low-contrast chart squares and step text, a formula popover that did not open on iPhone taps, a stale
section highlight, clipped judge names, an invalid search list, crowded chart labels. An automated accessibility scan
(axe-core, WCAG 2.2 A/AA) runs on 19 routes in both themes at both widths: 0 serious or critical violations (11
routes failed before). No page scrolls sideways at 375 px (all 94 district pages checked). The recheck lane fixed two
more phone problems: the new table Notes column was clipped at 375 px, and the map legend's break values overlapped.

## Tests

| Suite | Result |
|---|---|
| Pipeline unit tests (`pytest tests/pipeline`) | 1,254 passed, 0 failed (after `make stories web docs`; run three times by the third recheck). Three more `make stories web docs` runs gave byte-identical output in all 563 files under `public/data/`, `data/processed/`, `data/gaps/`, `data/sources/`, `SOURCES.md` and `DATA_GAPS.md`. |
| Typecheck (`npm run typecheck`) | clean |
| Production build (`vite build`) | succeeds |
| End-to-end, Chromium, desktop 1280 px and phone 375 px (`playwright test`, 378 tests) | Third recheck, four full runs (`CI=1 E2E_PORT=4710 npx playwright test --trace off`). Run 1 (the fix pass's code), run 2 (after the glossary fix) and run 4 (the final code, with the courtroom test fix): 364 passed, 0 failed, 14 skipped by design (for example phone-only tests in the desktop project). Run 3: 363 passed, 1 failed: the phone courtroom test measured the bottom sheet 167 ms into its 420 ms slide-in. It passed 30 of 30 times alone; it now waits for the slide-in to end and passed 20 of 20 times alone and in run 4. Earlier, the second recheck (372 tests, five runs) saw one 1.6-minute timeout in the phone accessibility scan of four-district compare, while scrolling; it did not recur there or in any later run, and that scroll step now fails within 5 s with a message instead (fix pass). The 16 visual-regression baselines (`visual.spec.ts`) passed in every run and were not rewritten. The accessibility scans (`a11y.spec.ts` on every route, plus an axe test of flnd's MDL note and case-mix blocks in `district.spec.ts`) found 0 serious or critical violations. |
| First map paint (perf test, unthrottled / 4x CPU throttle; target under 2 s) | 0.30 s / 0.89 s (first contentful paint 0.08 s / 0.17 s), last run on the final code. The third recheck's other three runs measured 0.28-0.35 s / 0.81-0.99 s. |

Home page JavaScript before first paint: 79 KB transferred; the three.js courtroom code is not loaded on the home page.

## What was not verified

- **Browsers and devices.** Only Chromium was used, in a headless test browser. Not tested: Safari on a real iPhone,
  Firefox, Android Chrome on a device, landscape phones, 320 px screens and 200% text zoom. The iPhone tap fix was
  tested with a simulated tap, not on a device.
- **Assistive technology.** No screen reader (VoiceOver, NVDA, JAWS) was run, and Windows high-contrast mode was not
  tried. Accessibility was checked with an automated scanner and keyboard tests only.
- **The 3D courtroom on real graphics hardware.** Tests used software rendering. Brightness of the dark courtroom on
  a real phone screen was not judged.
- **Numbers outside the samples.** 70 displayed numbers were traced by hand out of more than 200,000. The rest rely
  on the pipeline's own tests (for example, every story number is recomputed by a test, and every profile sentence is
  re-checked against the published values).
- **Uncached USSC district packets** (D.N.M.I. FY 2010 and FY 2018, D. Colo. FY 2020, D.R.I. FY 2006, N.D. Ill.
  FY 2005, W.D. Ark. FY 2025) were not downloaded; those cells were checked against the USSC case-level files only.
- **IDB FY 2026** has no published court table to compare with; it was checked against the raw file only and is
  labeled preliminary on the site (see the Data audit section for exactly where).
- **Civil "How cases end" groups** were recomputed from the FJC records but have no AO table at district level to
  compare with: only the civil closing totals match Table C-1. The settled, voluntary and other-dismissal codes
  depend on how each clerk's office codes cases. The criminal groups match AO Table D-4 nationally for FY 2005 to
  2025; D-4 has no district rows.
- **13 MDL dockets are shown by number only** (1507, 2197, 2299, 2325, 2326, 2327, 2391, 2502, 2545, 2753, 2782,
  2873, 3060); no GovInfo record that names them was found, including in a second search of 46 more package ids
  (fix pass; four or five ids per docket in all, listed in the gap record). GovInfo's sitemaps and API were not
  tried. MDL notes start in FY 2010, because the FJC records
  almost never carry a docket number before then, so a docket that dominated a court only before FY 2010 gets no note.
- **Not re-checked by the final recheck:** the new glossary statement that drug-patent (Hatch-Waxman) cases carry
  nature-of-suit code 835 since 2017 (it rests on the IDB lane's first 835 filing, June 2017); the other new
  glossary definitions beyond those in the additions table; numbers for districts other than those in the table.
  The final recheck read 92 captures of the changed views, not every page.
- **The IDB firearms and immigration categories** are the atlas's mapping of FJC offense codes. They match the AO's
  published national totals for FY 2005 to 2025; earlier years and district-level splits could not be checked.
- **CourtListener links** were compared with cached responses only; the live pages were not opened (daily quota).
  Seven districts (wied, wiwd, wyd, prd, vid, gud, nmid) have no recent cases yet.
- **Legal statements taken from memory, not a fetched source:** the "rocket docket" nickname; Guam and the Northern
  Mariana Islands sharing one U.S. Attorney; magistrate judges in every district; the courtroom deputy's duties;
  supervised release replacing parole from November 1, 1987. The Guidelines amendments effective November 1, 2026
  were not read; the glossary describes the November 2025 text.
- **Not read for wording:** CourtListener case titles, judge biographical records, courthouse notes.
- **Boundaries:** the Fort Bragg, Camp Mackall and Butner areas use Census landmark polygons as a stand-in for the
  surveyed legal lines.
- **N.D. Fla.** shows 37,423 cases closed per judgeship in FY 2025, as published. The profile carries an MDL note
  (147,231 of its 149,260 civil cases closed that year were in MDL 2885), and the 11 measures built on civil filings,
  closings or pending cases carry a caveat naming MDL 2885 (rows 242 to 248). That FCMS counts and medians include
  MDL cases rests on the AO's definitions and on N.D. Fla.'s own series (row 251); no AO text says so for medians or
  weighted filings in so many words.
