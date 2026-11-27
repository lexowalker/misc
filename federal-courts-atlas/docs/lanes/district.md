# Lane report: district profile (`#/district/:id`)

Status: **done** for all 94 districts. Every number on the page is read at runtime from `public/data/`
(web lane, boundaries lane, courthouses lane). Nothing is hard-coded, estimated or filled in; a missing value
reads "No data" and a missing file shows a designed empty state.

## Files

| file | what it does |
|---|---|
| `src/pages/district.ts` | The page: hero (kept from the foundation: crumbs, kicker, name, short form, locator, facts), at a glance, sticky in-page navigation, section shells, lazy loading, previous / next, deep links (`?s=bench`). |
| `src/pages/district/common.ts` | Formatting that never rounds away a published fraction, rank phrasing, rank strip, formula hint, section shell, `whenNear()` lazy trigger, date helpers, view toggle. |
| `src/pages/district/stats.ts` | Key statistics by family, and "What stands out" with per-sentence verification. |
| `src/pages/district/bench.ts` | The bench timeline and its table (lazy chunk). |
| `src/pages/district/mix.ts` | Nature-of-suit and offense mix bars; sentencing composition chart and table (lazy chunk). |
| `src/pages/district/geography.ts` | Divisions, places of holding court, statutory carve-outs, county list, courthouse buildings (lazy chunk). |
| `src/pages/district/cases.ts` | Recent CourtListener items or the empty state (lazy chunk). |
| `src/styles/district.css` | All district styles, including four page-scoped chart colors (below). |
| `tests/e2e/district.spec.ts` | 21 tests, run in both projects (the 94-district sweep runs on desktop only). |

Shared modules touched (additive only): `src/components/source-chip.ts` gained an optional `compact` flag (default
`false`): publisher and dataset name only, with the full dataset, vintage and retrieval date in the link title,
and duplicate short names collapsed. No signature changed. `src/styles/pages.css` was not edited; its existing
district rules (`.crumbs`, `.district-head`, `.district-hero`, `.facts`) are still used.

## Data read

| section | file(s) | notes |
|---|---|---|
| Hero, at a glance, geography, prev / next | `districts.json` | population (latest, period, derived formula, approximate flag and note), 2020 Census count for the territories, counties, divisions, places, carve-outs, judgeships, active / senior judges, `prev` / `next` |
| Locator | `geo/districts-lo.topo.json`, `geo/courthouses.json` | dots for `place_of_holding_court` points only; labels placed with `src/map/labels.ts` |
| What stands out, key statistics, case mix | `profiles/<id>.json`, `variables.json` | labels, units, formats, formulas, caveats and breaks come from the catalog |
| Bench | `judges/<id>.json`, `sources.json` | the right edge of the chart is the FJC file's retrieval date |
| Courthouses | `geo/courthouses.json` | `courthouse` kind (FJC buildings in current district-court use) |
| Recent cases | `cases/<id>.json` | up to 5 items |
| Source chips | `sources.json` | loaded once, after first paint |

## Sections

1. **Hero.** Name, short form, circuit, Article III or IV (glossary term), the statute that defines the
   district, a locator map with labelled places of holding court and the national inset, and "Compare with…"
   (`#/compare?d=<id>`) and "Back to the map".
2. **At a glance** (right column of the hero on desktop). Population with its period and a derived chip
   (sum of county estimates). The five carve-out districts carry an "Approximate" flag with the web lane's note.
   The territories show "No data" with the reason and, separately, their 2020 Census count with its own source.
   Counties named in the statute, authorized judgeships (FY, FCMS), active and senior judges (as of Sept. 30,
   derived from the FJC file, formula on the chip).
3. **What stands out.** The web lane's template sentences, each with a compact source chip (derived plus
   formula when any claim is derived) and a "See the measure" link that scrolls to and highlights the stat row.
   "How this is written" shows the method. **Each sentence is re-checked in the browser**: every claim's value,
   printed the way the page prints it, must appear in the sentence, or the sentence is not shown (see Issues).
4. **Key statistics.** Grouped as Speed, Workload, Sentencing, Case mix. The 15 featured measures show first;
   "Show N more … measures" reveals the rest (41 in all). Each row: label and period; value with unit (or
   "No data", plus "Last reported for FY …" when older data exist); rank phrased with an explicit direction
   ("84th highest of 94", "Highest of 94", "Lowest of 51") with an ƒ popover giving the rank formula and a rank
   strip from lowest (left) to highest (right); national figure or "None published"; a sparkline over the
   variable's full year range with gaps left as gaps; a compact source chip ("Derived" plus formula where the
   latest cell is derived); cell notes (small bases, approximate population, FCMS flagged cells); and "About
   this measure" (explainer, "Higher means", series breaks, caveats, links to the table and the map).
5. **The bench over time.** One row per FJC service record: initials avatar ringed in the party color, name
   (last name only on phones), a D / R / O letter tag (the non-color cue), and a bar from start of service to
   senior status in the party color, then a fainter band of the same hue for senior service. Ongoing service
   runs square to the right edge (the FJC file's retrieval date). Filters: **Since 1980** (default: anyone in
   service at any time since Jan. 1, 1980), **Current bench**, **All years**. Hover, focus or tap shows the
   appointing president and party (or, for statutory reassignments, the president of record), commission,
   recess appointment, senior status, end of service and the FJC's reason. "View as table" swaps in a sortable
   table with the same rows. The party is the appointing president's as the FJC records it; the note under the
   chart says it says nothing about how a judge decides cases. No photos and no judge-level statistics. The
   three territorial courts get an empty state explaining that Article IV judges are not in the FJC directory.
6. **Case mix.** IDB civil nature-of-suit mix and criminal offense mix for the latest IDB year: one bar per
   group (share, with the count in parentheses) and a tick for the all-district share; 8 groups first, then
   "Show all". Each block keeps the lane's basis text, a small-base note under 30 cases, the IDB FY 2026
   caveat, and a derived chip with the share formula. Below: the USSC four-way composition as 100% stacked
   columns, in two small multiples that are never joined (FY 2006 to 2017 as printed; FY 2014 to 2025 rebuilt
   from the FY 2018 method), with the FY 2018 method change marked in the second panel. Columns resting on
   fewer than 30 people are drawn lighter. Hover, or focus the chart and use the arrow keys, for a tooltip with
   all four shares and the number of people; "View as table" gives every year of both series.
7. **Geography.** Statutory divisions (name, places where court is held, member counties by name) or, for
   districts without divisions, the statute's places of holding court; statutory carve-outs (Yellowstone,
   Fort Bragg and Camp MacKall, FCI Butner); the full county list (collapsible); courthouse buildings in use
   with "District court use since" and a link to the FJC history page. Notes that street addresses were not
   available.
8. **Recent cases.** Up to five CourtListener items: kind (civil docket, criminal docket, opinion), case name
   (italic, linked), filing date, docket number, nature of suit. "How these were chosen" shows the selection
   rule. The seven districts with no items get an empty state with the cases lane's note and a link to search
   the court on CourtListener.
9. **Previous / next district** (registry order, from `districts.json`) and a second "Compare with other
   districts" link.

## Design notes

- Same system as the rest of the atlas: Newsreader for headlines, deks and the "What stands out" sentences;
  Public Sans for UI and numbers (tabular figures in columns, proportional in tiles); 2px black rules over
  section heads; small-caps kickers; tokens only.
- **Sentencing composition colors.** The atlas tokens have no categorical palette, so the page defines four
  series colors in `district.css`, scoped to `.district-page`, with separate light and dark steps (the dark set
  is selected for the ink ground, not inverted). Light: within `#3d55b0`, below (other) `#00927c`, below
  (government) `#9e7ad6`, above `#c9781c`. Dark: `#6d84e0`, `#16a58c`, `#a98ae6`, `#d08a2a`. Both sets pass the
  dataviz validator against their surfaces (`#ffffff`, `#0e121a`): lightness band, chroma floor, adjacent CVD
  separation (worst deutan dE 12.7 light, 12.4 dark), normal-vision floor (21.6 / 19.1) and 3:1 contrast. Within
  range sits on the baseline (the series most read), above range on top. The legend lists the series in stack
  order. Segments are separated by a 1px surface gap rather than 2px so a 1% segment stays visible.
- Case-mix bars use `--map-q3` with the national share as a text-colored tick; the party colors are the
  existing `--color-party-*` tokens. In dark mode the senior band is a fainter tint of the party color, so the
  legend says "fainter band" rather than "lighter".
- Source chips on this page flow as one line of text (label, citation, ƒ), and the formula popover opens on
  tap and focus as well as hover (the shared rule only opens on `:focus-visible`). Hidden popovers are
  `display: none` here, and `.district-page` has `overflow-x: clip` as a guard, so nothing widens the page.

## Accessibility

- One `h1`; every section is a labelled `section` with an `h2` that receives focus from the in-page nav.
- In-page nav links are real links (`#/district/<id>?s=<section>`), so they can be opened or shared; the page
  scrolls to `?s=` on load. `aria-current` marks the section in view.
- Bench: one tab stop for the whole list (roving tabindex; Up, Down, Home, End move between judges); each
  judge's details are in `aria-describedby`; the table view is the full equivalent.
- Composition chart: focusable, Left / Right / Home / End step through years, a live region reads the year's
  four shares; table view.
- Every value in the mix bars is printed as text; the all-district share is in visually hidden text per row.
- Glossary terms: Article III / IV, senior status, division, guideline range, §5K1.1, §5K3.1.
- Smooth scrolling and the "See the measure" flash are disabled under `prefers-reduced-motion` (the flash
  becomes a focus outline).

## Performance

- The page chunk is 22.6 KB (8.5 KB gzip) plus 24.5 KB CSS (5.1 KB gzip). Bench (8.6 KB), case mix (9.8 KB),
  geography (4.3 KB) and cases (1.7 KB) are separate chunks imported only when their section comes within
  700 px of the viewport, together with `judges/<id>.json` and `cases/<id>.json`.
- Cold cache, `vite preview`, 1280 px, this shared machine: locator drawn at about 0.73 to 0.77 s and key
  statistics at about 0.74 to 0.78 s (vaed, nysd, gud). With 4x CPU throttling: 1.8 to 2.0 s. About 730 KB is
  transferred on a cold first visit (topology, courthouses, districts, sources, variables, profile); coming from
  the home page most of it is already cached.

## Tests

`CI=1 E2E_PORT=4202 npx playwright test tests/e2e/district.spec.ts --trace off`: **41 passed, 1 skipped**
(the 94-district sweep runs on desktop only). The smoke spec also passes on port 4202 (31 passed, 1 skipped by
design, both projects). Expectations about numbers are read from `public/data/` inside the tests.

- vaed, txed, cand, nmid, dcd, akd, wyd, prd, gud: every section renders, no console errors, no horizontal
  scroll, no em-dash in the page text.
- At a glance: population, approximate flag, judgeships; territory "No data" plus 2020 Census count.
- oknd's 3.5 judgeships print as 3.5, and the rounded template sentence is not shown.
- Key statistics: value, rank wording, national figure, sparkline, source, derived formula on focus, "Show more".
- wyd civil trial median: "No data" and "Not ranked".
- What stands out: sentence text equals the profile file, one chip each, "See the measure" highlights the row.
- Bench: row counts for each filter match the judges file, no images, legend, one tab stop, arrow keys, tooltip,
  sortable table.
- Territory (gud): Article IV empty state, cases empty state.
- Case mix: top group label and share, two composition charts, FY 2018 annotation, keyboard tooltip, table.
- Cases link to CourtListener; prev / next and compare links.
- Section nav updates the URL; `?s=geography` deep link.
- Dark mode capture; all 94 profiles render every section without errors or overflow.

Review captures (JPEG) in `tests/e2e/__screenshots__/{desktop,mobile}/`: `district-<id>.jpg` for the sample
districts, `district-gud-full.jpg`, `district-txed-dark.jpg`, `district-txed-dark-mix.jpg`,
`district-bench-tooltip.jpg`. Mobile full-page captures are clipped at the encoder limit (8,000 CSS px) by the
shared helper.

## Issues for other lanes

1. **Web lane: the size-and-circuit sentence rounds half judgeships.** kyed (5.5 printed "6"), kywd (4.5 printed
   "4"), oked (1.5 printed "2") and oknd (3.5 printed "4"). The template formats judgeships with `.0f`. Only
   oknd uses that sentence as its paragraph; the page's check drops it and shows a neutral "no measure stands
   out" line instead. Fix in `pipeline/web/profiles.py` (print one decimal when the value is fractional), then
   `make web`. The same `.0f` format makes `formatValue` show 4 for oknd on the home map tooltip and table;
   this page works around it locally (`fmtValue` in `common.ts`).
2. **Web lane copy:** `case_mix.sentencing_composition.note` says "the USSC lane found…" (pipeline vocabulary).
   The page writes its own note instead; the data field should be reworded for other pages.
3. **Prisoner petitions differ between the NOS mix and the measure.** In FY 2026 the JS 44 "Prisoner petitions"
   group includes NOS 463 detention habeas (80,415 nationally per the IDB lane), while `prisoner_petitions_pct`
   counts 510 to 560 only (vaed: 50.9% vs 14.6%). The page explains this under the civil mix. Compare and story
   lanes should do the same if they show both.
4. **Shared source chip:** the formula popover only opens on hover or `:focus-visible`, which a tap does not
   trigger, and hidden popovers use `visibility` so they still count toward scroll width. This page overrides
   both; the shared CSS could adopt the same rules.
5. Once the cases lane refills wied, wiwd, wyd, prd, vid, gud and nmid and `make web` runs, those pages show
   their cases with no code change.

## Not checked

- Screen readers were not run (VoiceOver, NVDA); semantics were checked by reading the DOM and by keyboard in
  Playwright only.
- Copy was written to be neutral and em-dash free, but has not been through the copy audit.
- Values are taken as published in `public/data/`; this lane did not re-trace them to the raw sources.
- Every district was rendered and checked for errors and overflow at 1280 px, but only the nine sample
  districts (plus oknd) were looked at in screenshots, and mobile only for vaed, nmid, wyd, gud and txed.
- Very long benches (nysd "All years": 160 rows) render correctly but make a long page; no virtualisation.
- Forced-colors / Windows high-contrast mode was not tested.
