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
| UI audit | 181 screenshots at 1280, 768 and 375 px in light and dark; automated accessibility scan | 7 known issues and 11 more problems fixed. The recheck lane fixed 2 more. 0 serious or critical accessibility violations. |
| Tests | Pipeline unit tests, typecheck, end-to-end browser tests | 1,228 pipeline tests passed. Typecheck clean. 321 end-to-end tests passed, 0 failed, 9 skipped by design. |

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
wording says when districts are tied; IDB FY 2026 is labeled preliminary everywhere it appears.

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
| Pipeline unit tests (`pytest tests/pipeline`) | 1,228 passed, 0 failed |
| Typecheck (`npm run typecheck`) | clean |
| Production build (`vite build`) | succeeds |
| End-to-end, Chromium, desktop 1280 px and phone 375 px (`playwright test`, 330 tests) | Final run: 321 passed, 0 failed, 9 skipped by design (for example phone-only tests in the desktop project). Of three full runs today, the first and third were clean; the second had one timeout in an accessibility test's scrolling helper that passed on 3 of 3 reruns; the helper is now bounded. |
| First map paint (perf test, unthrottled / 4x CPU throttle; target under 2 s) | 0.40 s / 0.90 s (first contentful paint 0.11 s / 0.25 s) |

Home page JavaScript before first paint: 75 KB transferred; the three.js courtroom code is not loaded on the home page.

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
  labeled preliminary on the site.
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
- **N.D. Fla.** shows 37,423 cases closed per judgeship in FY 2025, correct as published but driven by one mass-tort
  docket; the district profile does not yet explain that.
