# Copy audit

Date: 2026-11-27. Status: all 57 findings resolved, then rechecked. By severity: 5 strike, 34 fix and 18 nit (the
fix lane's own summary said "23 strike or fix, 34 nits"; the recheck lane recounted the table below). The fix lane used the audit's proposed text as written for 49 of them and rewrote 8 where better-supported
wording was available. The recheck lane confirmed every resolution against the current source and generated output,
and fixed four more sentences (see "Recheck").

## Scope

The audit read about 1,400 reader-facing sentences:

- **Stories:** every story title, dek, step, caption, method intro and method note.
- **Story popovers and charts:** every number's "how" text and formula, and every chart and map layer title.
- **Profiles:** all 94 district profiles, which hold 194 "distinctive" sentences and 94 context sentences.
- **Variables:** the catalog explainers, caveats and fact templates.
- **Values files:** the national notes and the labels for each derived year.
- **Content and pages:** the glossary, events, the Learn page and its diagrams, the courtroom seats and panel, the
  compare, home, search, table, shell, sources and district modules.
- **Notes and empty states:** the CourtListener cases note and the empty-state messages.

It also searched for em-dashes in `src/`, `public/data/`, the docs (except `BRIEF.md`), the root `.md` files and the
pipeline code that writes reader-facing text.

## Method

1. Read the brief, the data contract, `PROGRESS.md` and the stories, FCMS, IDB and USSC lane reports.
2. Filled every story template with its data-file values, using a node copy of the `prose.ts` logic. Read every
   sentence with its numbers, plus every number's "how" text and formula and every chart and layer title.
3. Recomputed each qualitative claim from `data/processed` with pandas, independent of the story code:
   - FCMS rank counts, national medians and felony standings.
   - IDB patent leaders, Texas shares, N.D. Fla. terminations, D.D.C. dismissal and trial rates, and border-district
     shares.
   - USSC spread of the four sentence groups across the 80 districts with 200 or more cases, the above-range trend,
     and the §5K3.1 offense mix taken from the cached FY 2018 and FY 2025 datafiles.
4. Re-verified every profile sentence and context sentence against `public/data` only: value, year, rank, ranked_of,
   tie flag, position, circuit extreme and derived formula. None failed.
5. Fetched the legal sources through `pipeline.common.http.fetch` (cached under `data/raw/http`):
   - law.cornell.edu: Booker, Blakely, TC Heartland; Fed. R. Crim. P. 23 and 53; Fed. R. Civ. P. 48; 28 U.S.C.
     §§ 476, 541, 753, 1861, 1863; 18 U.S.C. § 3006A.
   - govinfo.gov: Pub. L. 115-391; Proclamation 9994; CARES Act § 15002.
   - ussc.gov: 2025 amendments, reader-friendly text.
   - Already cached: the AO's FCMS Explanation of Selected Terms (2016).

The fix lane applied the findings in the code that generates the text, never in `public/data` by hand. It then reran
`make stories`, `make web` and `make docs`, compared `public/data` before and after with a JSON diff (no number or
year changed), re-read the 2025 amendment text from the cached ussc.gov PDF before changing the glossary and the
Learn page, and checked the rendered pages in Chromium.

## Findings and resolutions

| ID | Where | Severity | Finding | Resolution |
|---|---|---|---|---|
| F01 | Rocket Docket, step 1 | fix | "show why the name stuck" claims to explain the nickname | Applied: "Federal court statistics fit the name." |
| F02 | Rocket Docket, step 3 | fix | "ranks every district" (only districts with a median are ranked, 37 to 83 a year) | Applied |
| F03 | Rocket Docket, step 6 | strike | "Cases that end without a trial" (the AO median covers all civil cases, trial or not) | Applied: "Civil cases as a whole move quickly there, too." |
| F04 | Rocket Docket, note 3 | nit | "current-method table" is pipeline vocabulary and blurs the March 2012 change | Applied. The recheck lane found the same phrase in Border Districts note 3 and fixed it too. |
| F05 | Patent Capital, step 1 | strike | "closely watched" has no support | Applied (struck) |
| F06 | Patent Capital, step 4 | nit | "U.S. companies" (TC Heartland concerns domestic corporations) | Applied: "U.S. corporations" |
| F07 | Story method intros (3) | fix | "the atlas's IDB lane" / "USSC lane" | Applied |
| F08 | Border Districts, step 9 | fix | "everyone sentenced" (only people reported to the USSC) | Applied |
| F09 | Border Districts, note 6 | fix | "Sentence outcomes reflect each district's mix of cases" is causal | Applied |
| F10 | Border Districts, step 8 and dek | nit | "use them very differently" gives districts agency; "outsized" is evaluative | Applied: "Yet the share varies widely among the five"; "a large share" |
| F11 | After Booker, dek | fix | "Before 2005" covers years the data does not; "far more" overstates | Rewritten: "Before 2005, from FY 1995 to FY 2004, between ... In FY 2025, ... did, and districts differ more from one another." The year range comes from data placeholders. |
| F12 | After Booker, step 1 | fix | "For each federal sentence" (the Guidelines skip Class B and C misdemeanors and infractions) | Applied: "For most federal sentences" |
| F13 | After Booker, steps 3 and 5 | nit | "of all sentences" (the shares are of range-known cases) | Applied |
| F14 | After Booker, step 4 | nit | "stayed rare" hides the rise from 1.6% to 4.8% | Applied. The story build now stops with an error if above-range stops being the smallest of the three groups in any year. |
| F15 | After Booker, steps 6 and 7 | fix | "kept" implies agency; the 80% test is "80% or more" | Applied |
| F16 | After Booker, step 9 | strike | "The spread is widest" is wrong | Applied: "... also vary widely." |
| F17 | After Booker, note 4 | fix | PROTECT Act and FY 2003 claim is wrong and bears on no figure | Applied: before Booker every below-range sentence was a departure; since Booker, variances too |
| F18 | 7 places | fix | "half-year tables" (the FY 2004 and FY 2005 splits are about 9+3 and 3+9 months) | Applied everywhere: "part-year tables" |
| F19 | After Booker "within" map layer | fix | FY 2004 map cells are derived but the layer showed no formula | Applied: the layer's "how" text gives the pooling formula |
| F20 | Where Trials Went, step 8 (D.D.C.) | fix | The dismissal figure, with no context, invites readers to guess a cause | Applied: "Dismissed cases count in the base of the trial rate. The data does not record why the cases were dismissed." |
| F21 | Story page, maps paragraph | fix | "The maps use the same district values" is wrong for Border Districts | Rewritten per story; the Border Districts map names its felony-only measure |
| F22 | three story builders | fix | "IDB lane ..." in about 30 number popovers; "D.D.C.." double period | Applied |
| F23 | border_districts.py, rocket_docket.py | nit | "current-method table" | Applied: "current-method series" |
| F24 | patent_capital.py | fix | "patent_quarterly table" (a file name) | Applied: "IDB civil file" |
| F25 | after_booker.py | fix | "USSC n_basis." | Applied |
| F26 | 3 story builders | nit | Raw variable names DISP1, SENTRNGE | Applied |
| F27 | 11 story numbers | nit | Counts of years and picked extremes were marked published | Applied: marked derived with a one-line formula |
| F28 | profiles.py | fix | Profile sentences used IDB FY 2026 with no warning | Applied: "In FY 2026 (preliminary), ...". Recheck: 50 of 50 such sentences carry the label. |
| F29 | catalog prisoner_petitions_pct fact | fix | Did not say it leaves out code 463 | Applied |
| F30 | catalog civil_trial_rate_pct fact | nit | "ended in a trial verdict" (bench trials count too) | Applied: "were decided by a trial" |
| F31 | District page fallback | fix | "No measure puts this district ..." overclaimed | Rewritten to say what the summary leaves out. The recheck lane found the note had stopped showing for oknd, waed and idd once their size sentence passed the number check, and fixed that (see "Recheck"). |
| F32 | catalog.py and values.py | fix | "the atlas's ... lane" in 22 caveats, 2 national notes, 1 basis label | Applied. The USSC national note now covers the packet years too. |
| F33 | immigration and firearms caveats | fix | "reproduces ... exactly" (checked only for FY 2005 to 2025) | Rewritten: "exactly for FY 2005 to 2025; other years could not be checked" |
| F34 | criminal_disposition_months caveat | fix | "first proceeding" misreads the AO definition | Applied |
| F35 | criminal_disposition_months explainer | fix | A plea does not stop the clock; sentencing does | Applied |
| F36 | felony_defendants_per_100k explainer | fix | "major ports of entry" has no support | Applied |
| F37 | patent_filings explainer | fix | "plaintiffs can choose among courts, so ..." is causal | Applied |
| F38 | nongovt_below_range_pct explainer | strike | "usually after a request by the defense" has no support | Applied (struck) |
| F39 | within_range_pct explainer | fix | "prison term" (the sentence can be probation) | Applied |
| F40 | civil_trial_rate_pct caveat | nit | "related cases" is an inference | Rewritten without "related" |
| F41 | pro_se_pct caveat | nit | "such cases" is ambiguous | Applied |
| F42 | trials_per_judgeship explainer | nit | "emergency orders" | Applied: the AO's wording |
| F43 | Glossary, "departure" | fix | Said §5K3.1 survived the 2025 amendments | Applied. Recheck: the cached ussc.gov PDF says the amendment "deletes most departures" and early disposition "is moved from §5K3.1 to Chapter Three, Part F" (§3F1.1). |
| F44 | Glossary, "§5K3.1" | fix | Present tense; the provision moved to §3F1.1 | Applied, with the new cite |
| F45 | Glossary, "prisoner petition" | fix | Did not explain the code 463 difference | Applied |
| F46 | Learn, sentencing | fix | "most recently" is an unsourced superlative | Applied: "for example" |
| F47 | Learn page and diagram | fix | Presented the old three-step process as current | Applied; the diagram has two sub-steps |
| F48 | Learn; courtroom jury seat | nit | "12 jurors" (Rule 23(b) allows fewer) | Applied: "normally 12" |
| F49 | Courtroom prosecution seat | strike | The burden-of-proof seating custom has no authority | Rewritten: "In a civil case, the party bringing the suit sits at a counsel table like this one." |
| F50 | Search, county note | fix | "assigns every county" (8 counties are split by statute) | Applied: "this whole county" |
| F51 | Search, dek | nit | American Samoa has no federal district court | Applied |
| F52 | Cases note (7 districts) | fix | "free-tier quota", "pipeline run", "gap is logged" | Applied |
| F53 | Empty states | nit | "pipeline" in reader-facing text | Applied in all four |
| F54 | README, DATA_CONTRACT, two lane reports, preview.py | fix | Em-dashes | Applied. `data/processed/boundaries/preview.png` kept the old title until the fix pass (Nov 27) re-rendered it from the committed TopoJSON (see `docs/lanes/boundaries.md`). |
| F55 | District key stats note | nit | "a high rank means a slower court" is ambiguous | Applied: "rank 1 is the slowest court" |
| F56 | Compare, dek | nit | "rank among all 94 districts" | Applied |
| F57 | Patent Capital, note 5 | nit | Touch users cannot hover | Applied: "Hover over or select a number" |

Also added by the fix lane: `tests/pipeline/test_copy.py`, which fails on any em-dash in `public/data`, the lane
`variables.json` files and the story, glossary and events content, and on pipeline vocabulary ("lane", "parquet",
"n_basis", "pipeline", "observations table") in reader-facing fields. `pipeline/build_docs.py` strips em-dashes from
`SOURCES.md` and `DATA_GAPS.md`.

## Recheck (final lane)

**Old text gone.** For each finding the recheck lane searched `src/`, `public/data/`, `pipeline/web/` and
`pipeline/stories/` for the original wording. All 57 are gone from reader-facing text. The remaining matches were
code comments, a file path the story code reads, and a gap-record description that goes to `DATA_GAPS.md`, not the
site, plus one real miss:

- **Border Districts method note 3** still said "Disposition times use the FCMS current-method table." Fixed:
  "Disposition times use the AO's current method, which counts defendants."

**New text supported.** Read rendered in Chromium: the After Booker dek ("Before 2005, from FY 1995 to FY 2004,
between 64.0% and 72.1% ... In FY 2025, 51.5% did"), the above-range sentence (1.6% in FY 2006 to 4.8% in FY 2025),
the Border Districts maps paragraph, the Patent Capital de-duplication note, the D.D.C. dismissal note, and the
glossary entries against the cached 2025 amendment PDF.

**Three more sentences fixed by the recheck lane:**

- **Rocket Docket step 7.** "Its national standing ranged from 4th to 11th" followed a sentence about all 21 years,
  but the data fix lane had limited the standings to the 15 years the AO ranked on the same defendant-based measure.
  Now: "In the years the AO ranked districts on this same measure, its national standing ranged from 4th to 11th."
- **Mean and median sentence caveat.** "From FY 2018 the figures match the USSC's tables once rounded" is false for
  the national FY 2025 mean (shown 47.5, which rounds to 48; the USSC prints 47). Now: "From FY 2018 the USSC prints
  these figures in whole months. Its tables match the atlas's unrounded figures, but can differ from the one-decimal
  figure shown here by up to half a month."
- **USSC small-district caveat.** "their shares can swing widely" was also attached to the mean and median sentence
  measures, which are not shares. Now "their figures can swing widely".

**District "What stands out" note.** After another lane fixed the half-judgeship number check, oknd (and waed and idd,
which also have no outlier sentence) showed only the size sentence under a dek that promises facts "where this court
sits at an extreme". The "no measure used for this summary puts this district at an extreme" note is now shown after
the size sentence for those three districts as well.

## Checks after the fixes

- `make stories web docs` reran; pipeline tests 1,228 passed (includes `test_copy.py`); `npm run typecheck` clean.
- Full end-to-end suite: see `VERIFICATION.md` for the final counts.
- No em-dash in `src/`, `public/data/`, `docs/` (except `BRIEF.md`), `README.md` or the root `.md` files. No
  pipeline vocabulary in any string value of `public/data` that the site displays. The only matches are judge and
  county names (for example "Lane County"), the `lane` and `lane_table` keys and a courthouse `statute_note`, none of
  which the site renders.

## Not checked

- **2026 Guidelines amendments.** These took effect November 1, 2026 and were not read. They may have changed §3F1.1
  or §5K1.1 again. The glossary and Learn page describe the November 2025 text.
- **Taken from memory, not from a fetched source:** the "rocket docket" nickname; Guam and the Northern Mariana
  Islands sharing one U.S. Attorney; "every district court also has magistrate judges"; the courtroom deputy's duties
  and open-courtroom statements; supervised release replacing parole for offenses from November 1, 1987; the
  U.S.-Mexico border county list.
- **Not read for copy:** CourtListener case titles and summaries, judge biographical records, and courthouse and
  division notes. The lane reports were only searched for em-dashes, not read for facts.
- **Not reviewed in this audit:** `src/courtroom/panel.ts`, `events.ts` beyond dates, `sources.ts` and `table.ts`
  strings from other lanes.
- **Not regenerated:** `data/processed/boundaries/preview.png` (only its title string was fixed). Re-rendered in the
  fix pass (Nov 27); only the title changed.
- **Lane-internal files.** `data/processed/{idb,ussc}/variables.json` and `pipeline/ussc/variables.py` still say
  "lane" and "half-year" in places. They do not reach the site.
- **Screen readers and other browsers.** No screen reader was run. Only Chromium was used.
