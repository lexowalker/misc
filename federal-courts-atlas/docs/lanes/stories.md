# Lane report: guided stories

Five scrollytelling essays, built only from the atlas's processed data. The words live in the front end; every
number, chart series and map layer comes from a data file the stories pipeline writes from `data/processed/*`.

- **Build:** `python -m pipeline.stories.build` (about 3 s). For the Makefile:

  ```
  stories: python -m pipeline.stories.build
  ```

  It reads `data/processed/{fcms,idb,ussc}` and `data/sources/*.json` only, and runs after `make web` or
  independently of it (it does not read `public/data/` from other lanes). Two runs give byte-identical files.
- **Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_stories.py` (44 tests);
  e2e `tests/e2e/stories.spec.ts` (10 tests per project, desktop and mobile).
- **No new dependencies.** Charts are hand-built SVG on `d3-array` (already installed). No npm or Python packages
  added.

## The stories

| slug | title | steps | graphics | main sources |
|---|---|---|---|---|
| `rocket-docket` | The Rocket Docket | 9 | map (FY 2025, FY 2020, zoomed), 4 line charts, rank strip | FCMS |
| `patent-capital` | How Texas Became the Patent Capital, and What Happened After TC Heartland | 9 | 2 maps, national line, annual lines, quarterly lines, before/after slope, Texas share | IDB civil |
| `border-districts` | The Border Districts | 9 | map (+ zoom to the five), share lines, bars, 94-district bars, disposition lines, dot plot, small multiples | IDB criminal, FCMS, USSC |
| `after-booker` | After Booker: How Often Sentences Fall Outside the Guideline Range | 9 | national line, stacked area, 2 maps (FY 2004, FY 2025), distribution ribbon, 80-district bars | USSC |
| `where-trials-went` | Where Trials Went | 9 | civil count and rate lines, criminal rate and plea lines, 2 maps (FY 1996, FY 2025), 41-district bars, FCMS trials line | IDB, FCMS |

All five are the research lane's "strong" stories. The two "usable" ones were not built:

- *The Mass-Tort Wave* needs counts of cases in MDL docket 2885, which exist only in the raw IDB extract, not in
  `data/processed`. Logged as `mass_tort_mdl_counts_not_processed` in `data/gaps/stories.json`. Its national effects
  appear as caveats (Rocket Docket, Where Trials Went) using the processed N.D. Fla. termination counts.
- *The Pandemic Years* would be buildable from processed data (FCMS current-method medians, trials per judgeship,
  IDB trial counts) but was left out for time; the pipeline structure makes it a one-module addition.

The research lane's suggested title "How Far Judges Stray from the Guidelines" was replaced with the neutral
"How Often Sentences Fall Outside the Guideline Range", as it recommended.

## How numbers get into the text

1. `pipeline/stories/<story>.py` computes each number with pandas and registers it with `Story.num` (or `year`,
   `district`). Each entry is `{value, unit, text, bare, decimals, source_ids, how, derived, formula?, year?,
   headline?}`: the exact value, the display text, the source ids of the rows it came from, a plain-English note on
   how it was computed and, for anything derived (shares, counts of years, sums, percentiles, ranks we computed), a
   formula. The builders also raise if a qualitative sentence in the text stops being true (for example "below the
   national median in every year", "the five lowest trial rates", "led every year since"), so a data refresh cannot
   silently falsify the prose.
2. `src/content/stories.ts` holds the prose with placeholders: `{key}` (display text), `{key:bare}`,
   `{key:year}` (the number's fiscal year), `{key:word}` / `{key:Word}` (small integers as words),
   `{ev:id}` / `{evy:id}` (landmark dates from `src/content/events.ts`), `[[term|text]]` glossary terms.
   Step text and deks contain no bare digits.
3. `src/pages/story/prose.ts` fills the placeholders at runtime. Each number becomes a `.story-num` span; derived
   numbers are buttons whose popover shows "Derived", the formula, how it was computed and the source (hover, focus
   or tap). Published numbers show their source on hover. A missing key throws and the page shows an error state
   instead of a sentence with a gap.

`tests/pipeline/test_stories.py` recomputes **every** number in every story file from scratch, with its own pandas
code (it does not import the pipeline's helpers), and a meta-test fails if any number in a file has no independent
expectation. It also re-derives the display text with its own rounding, checks every chart series and every map
layer cell against the lane tables (and that no layer cell is filled in), parses `src/content/stories.ts` to check
that every placeholder exists in the story's file (deks only use headline numbers, which `index.json` carries), that
charts and map layers/years referenced by steps exist, that step text has no hard-coded digits, that no FJC judge
name appears in the prose, that no file of the lane contains U+2014, that sources are registered with URLs and no
local paths, and that the build is deterministic and the published files are current. The e2e spec checks at
runtime that every digit in a rendered step or dek sits inside a number, date or glossary span, and that each
number span shows exactly its data-file text.

## Files

```
pipeline/stories/build.py            entry point; writes the story files, index.json, the gap fragment
pipeline/stories/common.py           table readers, Story registry, formatting, provenance
pipeline/stories/{rocket_docket,patent_capital,border_districts,after_booker,where_trials_went}.py
public/data/stories/<slug>.json      {slug, build_date, numbers, charts, layers, sources}
public/data/stories/index.json       {order, stories: {slug: {build_date, numbers (headline only), thumb}}}
data/gaps/stories.json               mass_tort_mdl_counts_not_processed
src/content/stories.ts               titles, deks, steps (text + graphic state), chart captions, method notes
src/pages/stories.ts                 index: cards with thumbnail maps and filled deks
src/pages/story.ts                   the scrollytelling page
src/pages/story/types.ts             data-file types
src/pages/story/prose.ts             template filling, number popovers
src/pages/story/charts.ts            line (bands, marks, preliminary shading, crosshair tooltip), rank strip,
                                     bars (labeled, and compact 94-district), slope, stacked area, small multiples,
                                     dot plot; plus chartTable() for the data tables
src/pages/story/story-map.ts         the atlas choropleth as a story graphic
src/styles/stories.css               layout, charts, popovers, index
tests/pipeline/test_stories.py, tests/e2e/stories.spec.ts
```

`data/sources/stories.json` was not needed: every source id is an existing lane source, and each story file embeds
the provenance records (dataset, publisher, URL, vintage, retrieval date) of the ids it uses.

### Data file shapes

- `numbers`: as above. `unit` is one of `months, percent, points, count, cases, defendants, people, districts,
  years, per_judgeship, ratio, rank, fy, district`.
- `charts[id]`: `{kind: line|rankstrip|bars|slope|stack|multiples|dots|leaders, title, unit, format, source_ids,
  derived, formula?, how, ...}` with kind-specific series (see `src/pages/story/types.ts`). Line charts may carry
  `band` / `band2` (lo/hi arrays), `prelim_from` (FY 2026 IDB), `derived_x` (pooled USSC years).
- `layers[id]`: the shape of a web values file (`values: {district: {year: value}}`, `years`, `unit`, `format`,
  `period_type`) plus `source_ids`, `how`, `derived`, `formula?`. Only published (or derived-from-published) cells
  appear; anything else is No data on the map.

## Design notes

- **Layout.** Wide screens: text column (cards) beside a sticky figure; the figure's height follows the column width
  (container query) so the map is not lost in white space. Narrow screens (below 60rem): the figure is sticky on
  top (52svh) with an opaque ground, and the text scrolls up *beneath* it, so the graphic is never covered; the
  active step is the one crossing the middle of the band below the figure. No horizontal scroll at 375 px (tested).
- **Map.** `StoryMap` reuses the atlas geometry, projection, insets, ramp, No-data hatch and legend, but not
  `AtlasMap`: a story graphic should not add 94 tab stops or zoom controls, and it needs outlined, labeled focus
  districts and a scripted frame. It animates between national view and a set of districts with a 750 ms ease
  (the `--dur-map` token). Breaks are pooled over all of a layer's years, so FY 2004 and FY 2025 maps compare.
- **Charts.** One axis per chart (no dual axes); the national figure is a neutral gray line; the focus series is
  categorical slot 1. The three categorical colors (light `#2f4fb5 #c4580f #0e8a72`, dark `#8297f0 #e2753a
  #2fb093`) pass the dataviz validator in both modes (worst adjacent CVD dE 11.8 light, 11.7 dark; all at least 3:1
  on the surface). Every series is also direct-labeled, so identity never rests on color alone. Line charts have a
  crosshair tooltip; bars and dots have per-mark tooltips.
- **Accessibility.** Steps are real paragraphs in reading order. The figure's frame has `role="img"` and an
  `aria-label` describing what it shows at the current step (values included). Every chart's full data is in a
  `<details>` table under "How we did this". Derived numbers are keyboard-reachable buttons with an
  `aria-expanded` popover; Escape closes it. Under `prefers-reduced-motion` the graphic still follows the text but
  every change is instant (tested). Print hides the graphic and prints the steps.
- **Dark mode** uses the atlas's dark ramp (the map flips in lightness), the dark chart slots above, and dark
  stacked-area tones; reviewed in screenshots.

## Copy rules followed

Neutral, short sentences; timing, not causes ("That was the first full fiscal year of the COVID-19 pandemic";
"The data records the outcomes; it does not say why practice differs"); no judge names or judge-level claims;
no em-dashes. Legal context that is not data (what *Booker* and *TC Heartland* decided) is one clause each and
links to the glossary. Method notes quote rule changes from the lane reports (NOS 835 created June 2017, the
FCMS proceeding-date change in March 2012, the USSC FY 2018 method) without new statistics; where a note cites a
statistic it is templated from the data file.

## Caveats and what I did not check

- Values were recomputed from the processed lane tables, not re-read from the PDFs or raw datafiles; that step is
  the lanes' own tests, the statistics audit and the research lane's raw-extract recounts.
- The legal one-liners (*Booker* made the Guidelines advisory; *TC Heartland* narrowed patent venue for U.S.
  companies) and the method dates in the notes come from the glossary, `events.ts` and lane reports, not from data.
  The copy audit should read them.
- Thresholds (at least ten civil trials for an AO median, 500 terminated defendants, 200 range-known cases, 10%
  trial rate, 80% within range) are editorial or AO rules; the 500 / 200 / 10% / 80% values are templated numbers
  and named in the text.
- "Four of the five had the four highest guilty-plea shares" is computed against districts with 500 or more
  terminated defendants (S.D. Cal. is the exception, below the national share).
- D.D.C. is the top of the FY 2025 criminal trial-rate range; the step reports, without comment, that 41.4% of its
  defendants' cases ended in dismissal that year against 4.9% the year before (research lane caution).
- The e2e run used a manually started preview server: Vite 8's command lock refused a second `vite preview` while
  another lane's server was up, so I built into `.e2e-dist/4203`, started
  `vite preview --port 4203 --bypass-lock` and ran `E2E_PORT=4203 npx playwright test tests/e2e/stories.spec.ts
  --trace off` without `CI=1` (so Playwright reused that server).
- Not checked: screen-reader output with a real reader (only the accessible names and roles), Safari/Firefox
  rendering, and the hover popover on touch for published numbers (touch users get sources in "How we did this").
