# Lane report: front-end foundation

Status: **foundation complete; every page now built on it**. The design system, data layer, map and shared
components were built first, before any statistics existed. The page lanes then built each page on them against the
real data (see [Pages](#pages)), and an integration pass checked that they work together. No statistic is
hard-coded in `src/`: every number is read from `public/data/` at runtime.

## Run it

```bash
npm install
npm run dev            # opens the atlas (Vite dev server)
npm run build          # static dist/ (relative base + hash routing: works from any subpath)
npm run preview        # serve dist/ on :4173
npm run typecheck      # tsc --noEmit (TypeScript 7, strict)
npm run test:e2e       # Playwright: builds, serves dist/ with vite preview, runs desktop + mobile projects
npm run check:palette  # colorblind + contrast check of the map ramps in src/styles/tokens.css
npm run gen:registry   # regenerate src/data/registry.ts from pipeline/common/districts.py
```

Playwright is pinned to exactly 1.63.0 to match the browsers in `/opt/pw-browsers`; never run `playwright install`.

## File map

```
index.html                     shell; applies stored theme before first paint
vite.config.ts                 base './', es2022 build
playwright.config.ts           projects: desktop 1280x800, mobile 375x812 (isMobile, hasTouch); webServer = build + vite preview
scripts/gen-registry.mjs       registry.ts generator (reads the pipeline's canonical registry; no hand-copied names)
scripts/check-palette.mjs      palette check (CIEDE2000 under simulated CVD, lightness monotonicity, WCAG contrast)
src/main.ts                    entry: styles, theme, shell, router; starts the districts-lo fetch immediately on #/
src/app/router.ts              hash router + route table (lazy page modules), replaceQuery(), href()
src/app/shell.ts               skip link, header (wordmark, nav, theme toggle, mobile menu), footer (build date from manifest)
src/app/theme.ts               light/dark: follows prefers-color-scheme until chosen; persisted (try/catch) in localStorage
src/data/types.ts              Variable, ValuesFile, District, Judge, Case, Courthouse, DivisionsFile, ...
src/data/fetch.ts              loadJson(): base-relative, cached, never throws; 404/HTML fallback -> {status:'missing'}
src/data/loaders.ts            one typed loader per contract file + accessors (getValue, getRank, rankedCount, latestYear)
src/data/districts.ts          registry helpers (names, circuits, FIPS) on top of the generated registry.ts
src/map/projection.ts          composite projection: Albers lower 48 + framed insets (AK, HI, PR+VI, GU, MP)
src/map/geo.ts                 topology -> projected path strings, centroids, bounds, meshes; lazy hi-res; DEV-only fallback
src/map/scale.ts               5-step quantile classification (per-year or pooled across years)
src/map/atlas-map.ts           AtlasMap: the interactive choropleth
src/map/view.ts                ChoroplethView: AtlasMap + legend + "View as table" + source chip (use this on pages)
src/map/thumbnail.ts           small-multiple thumbnail maps (static SVG, decimated paths, one path per class)
src/map/locator.ts             locator map: one district highlighted in state context + national key map
src/map/labels.ts              greedy collision-avoided label placement; canvas text measuring
src/components/                tooltip, legend (+ No-data hatch), data-table, sparkline, year-slider, glossary, source-chip, states
src/content/glossary.ts        54 plain-English, cited definitions (all 31 required terms + procedure terms used on Learn
                               + terms used in measure names); GlossaryId type lists every id
src/content/variable-terms.ts  which glossary terms each measure's label uses (typed by GlossaryId) + fixed heading phrases
src/content/events.ts          Booker, TC Heartland, First Step Act, COVID-19 with exact dates, eventDateLabel() (AP style)
                               + periodYear() mapping
src/content/stories.ts         story prose with {key} placeholders, filled at runtime from public/data/stories/ (stories lane)
src/pages/                     home (+ home-switcher), district (+ district/), compare, stories, story (+ story/), courtroom,
                               learn (+ learn-diagrams), search, sources, table, not-found
src/courtroom/                 three.js scene, seats, floor plan, panel (courtroom lane; loaded only on #/courtroom)
src/styles/                    tokens.css, base.css, shell.css, components.css, map.css (eager); one CSS file per page chunk
tests/e2e/                     one spec per page lane, plus smoke, map, choropleth, perf, web-data, integration, a11y,
                               glossary-labels and visual; __screenshots__/{desktop,mobile,tablet}/*.jpg (review
                               captures, git-ignored); visual.spec.ts-snapshots/*.png (committed baselines)
```

## Design system (`src/styles/tokens.css`)

Every color, size, radius, shadow, z-index and duration is a custom property; components read only tokens.

- **Type.** *Newsreader* (variable, optical sizes 6–72, Production Type, designed for news) for headlines, deks and
  reading text; its display cut is used at 60–72 opsz for headlines. *Public Sans* (variable; USWDS's derivative of
  Libre Franklin, so it keeps the Franklin Gothic voice of newspaper graphics desks) for UI, labels and numbers.
  Libre Franklin was tried first and rejected: its web build ignores `tnum`, verified in the browser (`1111` and
  `0000` keep different widths). Public Sans honours `tnum`; all numbers use `tabular-nums lining-nums`. Neither
  family has true small caps, so chart annotations use the `.caps` style (uppercase, 11px, 0.075em tracking,
  semibold), as NYT and ProPublica graphics do. Self-hosted via @fontsource; only the Latin subsets download.
- **Scale.** 11 / 12 / 14 / 16 / 18 px UI steps; fluid story text 17–19px; headlines fluid 30–44px (pages) and
  34–56px (home). Body line-height 1.6; reading measure 38rem (~68 characters).
- **Spacing.** 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96. Fluid page gutter 16–32px. Touch target token 44px.
- **Radii** 2/4/6/10px, 7px for the rounded-square map buttons. **Z-index** ladder from map (0) to skip link (1000).
- **Motion.** 80/140/220/420ms plus `--dur-map` 750ms for zoom; all go to 0 under `prefers-reduced-motion`.
- **Dark theme, designed rather than inverted.** The ground is an ink navy (`#0e121a`), not black, which keeps the
  atlas's blue identity and lets the dimmest map step sit visibly above it. Text is about 92% white to avoid
  halation. Elevation comes from lighter surfaces and hairlines instead of shadows. Accent and links shift to
  periwinkle. The map ramp flips in lightness (below). The theme follows `prefers-color-scheme` until the reader
  uses the toggle; the choice is stored in `localStorage` (`fca-theme`), wrapped in try/catch, and applied by an
  inline script before first paint.

### The map style (client's choice) and its palette

- 5-step quantile scale, pale periwinkle to deep navy; legend reads **Lowest … Highest** with break values beneath
  and a separate hatched **No data** swatch; thin white district borders (0.6px) and heavier white state borders
  (1.4px), both `vector-effect: non-scaling-stroke`; white background; navy rounded-square Home, +, − buttons
  stacked bottom-right at every width (36 px with a mouse, 44 px on touch screens). On phones the map is only about
  235 px tall, so the stack hangs below the map's bottom edge: its upper half sits over the Atlantic east of the
  Southeast coast, its lower half in a 68 px strip under the map that it shares with the inset names (they stop
  short of it). `map.spec.ts` checks the column, the 44 px targets and that no district, inset frame or inset name
  lies under the stack at national view. (Until Nov 27 the phone layout put the three buttons in a row.)
- **Light ramp** (OKLCH, lightness evenly spaced, hue drifting 278°→266° so the light end reads lavender-periwinkle
  and the dark end true navy): `#e0e5fe` `#acb7ee` `#7388da` `#435cb7` `#182e72` (CIELAB L* 91, 75, 58, 42, 21).
- **Dark ramp**: `#2a3556` `#3f5190` `#6074c8` `#93a3ee` `#d4dbff` (L* 23, 36, 51, 68, 88). On a dark ground,
  salience comes from contrast with the page. With the light-mode order, "Highest" (navy) would sink into the
  background, so the lightness direction flips: Lowest is a dim indigo just above the ground and Highest a bright
  periwinkle. Hue stays in the same family, so the legend reads the same way in both themes. Borders become
  ground-colored gaps, the dark-mode analog of white borders.
- **No data**: a 45° hatch (`--map-nodata` fill + `--map-nodata-line` strokes) in neutral grey. It is near-achromatic
  and patterned, so it cannot be confused with any ramp step in any form of color-vision deficiency.
- **Check** (`npm run check:palette`; Machado et al. 2009 CVD matrices at full severity, CIEDE2000):

  | | normal | protanopia | deuteranopia | tritanopia |
  |---|---|---|---|---|
  | light: min adjacent ΔE00 | 13.6 | 13.0 | 13.8 | 12.4 |
  | dark: min adjacent ΔE00 | 11.9 | 12.7 | 11.8 | 11.9 |

  Lightness is strictly monotonic in every simulation, so order survives any CVD and grayscale printing.
  Contrast against the background, light: 1.25 / 1.95 / 3.35 / 6.08 / 12.56; dark: 1.56 / 2.49 / 4.31 / 7.78 / 13.73.
  The lowest light step (1.25:1 on white) is inherent to "pale periwinkle on white". It reads as a filled shape
  because of the district/state meshes, and the legend's lowest swatch gets a faint inset outline. Region
  identification never depends on color alone: every district has a tooltip, an aria-label and a table row.
- The map controls are `#1a2a6c` with a white icon in light mode. In dark mode they become `#26346e` with a
  `#6b7cc4` hairline border, so the button shape keeps at least 3:1 non-text contrast against the ink ground.
- Circuit map (Learn page only): four equal-lightness categorical tints (blue, sand, sage, mauve), assigned so no
  two neighbouring circuits share one. They are deliberately not the data ramp, because circuits are groups, not ranks.

## The map (`src/map/`)

- **Projection.** `d3-composite-projections` 2.0.0 was installed and checked, then rejected and removed from
  `package.json`. Its `geoAlbersUsaTerritories` puts PR/VI at the bottom right by Florida and Guam/NMI mid-left
  off California, all at 1× scale (Guam is about 10px), with no frames. `projection.ts` instead fits one projection
  per region into a framed inset in a tidy bottom-left cluster (viewBox 975×610, lower 48 = Albers scale 1300):
  Alaska (EPSG:3338-like conic; the Aleutians west of 180° included), Hawaii (main islands; the Northwestern
  Hawaiian Islands fall outside the frame, as on every national map), Guam (magnified), the Northern Mariana
  Islands (the whole chain), and Puerto Rico + U.S. Virgin Islands (about 1.25×). American Samoa has no district
  court and is not drawn. Each feature is routed to its region's projection by state code, rather than streamed
  through every projection, so geometry cannot leak between frames. Resampling is off (`precision(0)`) because the
  topology is already simplified per zoom level.
- **Tiny districts.** D.C., the Virgin Islands and the Northern Mariana Islands are a few pixels wide at national
  scale. They get **proxy chips**: small squares carrying the district's class color, offset from the district
  (D.C. sits offshore with a leader line). The chips act as hover and tap targets and hide once zoomed past 4×.
  The VI, GU and NMI paths also carry an invisible 14px hit halo.
- **Interaction.** d3-zoom with animated buttons (Home, +, −), double-click (Shift+double-click zooms out), wheel,
  drag, and pinch. The wheel zooms only once the map is "armed" by a click or focus, or with Ctrl/⌘ held, so the page
  can still scroll past the map; otherwise a hint appears. On touch at national view, one finger scrolls the page
  (`touch-action: pan-y`) and pinch zooms; once zoomed in, one-finger drag pans. Hover shows a compact tooltip
  (name, value with unit, "12th of 94" when ranks exist, period). A tap pins the tooltip with an "Open district
  profile" link, and a second tap on the same district opens it. A mouse click navigates to `#/district/:id`.
- **Keyboard and assistive tech.** Every district path is a tab stop in registry order (alphabetical by state,
  geographic within it), `role="link"`, `aria-label` "Eastern District of Virginia, <variable>: <value>, 12th of
  94, FY 2023". Focus draws a halo outline and the tooltip, and pans the district into view when zoomed. Enter
  opens it; + and − zoom; arrow keys pan; 0 resets; Esc closes the tooltip. A visually hidden help text is attached
  via `aria-describedby`. "View as table" gives a sortable `<table>` of the same data (`aria-sort`, live status).
- **Zoom levels.** At national view only `districts-lo` loads (350 KB raw, about 118 KB over the wire). Past 1.6×
  the hi-res topology is prefetched, and at 2.4× it swaps in: same path elements, new `d`, plus faint county lines.
  Below 2.0× it swaps back.
- **Courthouses.** Dots come from `geo/courthouses.json` (one per city, drawn as zero-length round-capped strokes
  with `non-scaling-stroke`, so they stay a constant size at any zoom with no per-frame work). Labels appear from
  1.7× in priority order with greedy collision avoidance: right, left, above, then below the dot. Caps are 18, 60
  and 200 labels by zoom band. Labels are laid out in screen space at the end of each zoom and translated with the
  map during it. Runs on the real `geo/courthouses.json`; the home lane draws two dot kinds (a place of holding court
  named by statute, and a city with only a courthouse building on the FJC list).
- **Inset labels** use the full name, then a short form, then none, whichever fits the frame without sitting on the
  region's own land (checked against the district shapes with `isPointInFill`). At 375 px the Guam, Northern
  Mariana Islands and Puerto Rico + Virgin Islands frames are too small for a label inside, so at national view their
  full names sit in a row in the free strip under the inset cluster, left of the zoom buttons, each joined to its
  frame by a leader line (`AtlasMap.layoutInsetKey`, UI audit). Every district also keeps its tooltip, aria-label and
  table row. Story maps label their insets on wider screens only.
- **Colors** are classes (`.q0`–`.q4`, `.nodata`, `.base`), so a theme switch recolors without re-rendering.
- **Classification** (`scale.ts`): quantile breaks with ties de-duplicated, so heavily tied data gets fewer classes
  spread across the ramp rather than empty ones. `ChoroplethView` defaults to `scaleScope: 'all'`: breaks pooled
  over every year, so a color means the same range in every year of the time machine. The legend says so.
  `'year'` is available for per-year breaks.
- **Dev-only fallback.** If `districts-lo.topo.json` is missing **and** `import.meta.env.DEV` is true, `geo.ts`
  dynamically imports `us-atlas/states-10m.json` and draws state outlines with a red "Dev preview" badge. The branch
  is dead code in production. `dist/` was checked: no us-atlas data or badge text. It is never used when the real
  topology exists; also verified by forcing a 404 in dev.

## Data layer (`src/data/`)

`loadJson(path)` fetches `${import.meta.env.BASE_URL}data/<path>`, caches the promise, and returns
`{status:'ok'|'missing'|'error'}`. A 404, a 410, or an HTML response (dev servers answer unknown paths with
`index.html`) all count as `missing`. Pages render `dataNotBuilt(file)` or another designed empty state.
Loaders normalize shape variations in one place:

- `loadVariables` accepts `[...]` or `{variables:[...]}`; `caveats` may be a string or a list.
- `loadValues` derives `years` from the values if absent. `getRank` accepts ranks nested district→year or
  year→district. `rankedCount` uses `ranked_of[year]` if provided, else counts districts with a value.
- `loadDistricts` accepts an array or an object keyed by id. `loadJudges` accepts a list or `{district: [...]}`.
  `loadCases` accepts a list or `{items|cases|results}`.
- `loadDivisions` matches the boundaries lane's actual shape: `{source, source_ids, districts: {id: {statute_sections,
  has_statutory_divisions, divisions[], counties[], places_of_holding_court[], notes}}}`. Older guessed shapes are
  still accepted.
- Place search reads the courthouses lane's `search/` files through `src/data/place-index.ts`, which feeds the
  `PlaceSearch` combobox (`src/components/place-search.ts`) on the home page and `#/search`. The earlier generic
  `loadSearchIndex` / `normalizeSearch` loader misread those files and was unused, so it was removed (data audit
  follow-up, 2026-11-27); `foldKey` stays in `loaders.ts` for the place index.

## How pages plug in

All pages are lazy modules exporting `title` and `render(ctx) → cleanup?`. Add the route in `src/app/router.ts`.
Shorthand addresses go in `ALIASES` there and are rewritten in the address bar (today `#/story/<slug>` becomes
`#/stories/<slug>`). Rules that keep the pages working together:

- **three.js loads only on `#/courtroom`**, through `await import('three')` inside the courtroom chunk. The perf and
  integration specs assert that the home page never requests it.
- **Shared modules change additively** (new options with defaults, new exports). Page-specific styling stays scoped
  to the page's root class (`.district-page`, `.cmp-page`, `.cr-panel`, ...).
- **Numbers print as published.** `formatValue()` never rounds away a published fraction: a `.0f` format still
  prints shared judgeships as halves (3.5). The web pipeline's `fmt_number()` follows the same rule.
- **Derived values** use `sourceChip({derived, formula})`. The formula popover opens on hover (devices that hover),
  on keyboard focus, and on a click or tap: `ensureFormulaPopovers()` in `source-chip.ts` is one document-level
  handler for every `.source-chip__formula` button on every page (iOS Safari does not focus a tapped button, so a
  focus-only popover never opened there). It toggles `aria-expanded` on the button and `data-open` on the popover;
  Escape or an outside click closes it. Pages that build their own ƒ buttons call it too (district, compare,
  courtroom). A closed popover is `display: none`, so it cannot widen a phone page. Buttons are 24 px (WCAG 2.2).
- Reusable pieces: `ChoroplethView` / `AtlasMap`, `renderLocator`, `renderThumbnail`, `YearSlider`,
  `renderSparkline` (shared domains and a dashed national reference line are options), `DataTable`, `PlaceSearch`,
  `term()` / `rich()` for glossary terms, and the designed empty states in `src/components/states.ts`.
- **Glossary terms in labels.** `variableLabel(v)` renders a measure's name with the terms listed for it in
  `src/content/variable-terms.ts`; `phraseLabel(text)` does the same for fixed headings ("nature of suit",
  "guideline range", §5K1.1, §5K3.1); `glossLabel(text, refs)` is the general form. They use
  `term(id, text, { label: true })`: the definition is referenced from one shared hidden container instead of sitting
  inside the label, so a heading, a row header or anything named by its content keeps the plain label as its name;
  where the line is under 24 px tall, padding with an equal negative margin makes the target 24 px without moving
  the text; punctuation touching a term ("(§5K1.1)") stays on its line. Used on the home measure header, compare
  rows, the `#/table/<variable>` heading, the profile's key statistics and its case-mix headings. The home switcher's
  thumbnails are buttons, so the family's terms are listed under the strip instead. A tap opens a term's
  definition: a press focuses the button in Chrome, so the click now toggles from the state before the press
  (before Nov 27 a tap on Android opened and closed it at once).

## Pages

Each page has its own lane report.

| Page | Route | Report |
|---|---|---|
| Home map, variable switcher, time machine, place search | `#/`, `#/search` | [home.md](home.md) |
| District profile | `#/district/:id` | [district.md](district.md) |
| Compare mode | `#/compare?d=…` | [compare.md](compare.md) |
| Guided stories | `#/stories`, `#/stories/:slug` | [stories.md](stories.md) |
| The Courtroom | `#/courtroom` | [courtroom.md](courtroom.md) |
| Data files behind every page | `public/data/` | [web.md](web.md) |
| Learn, sources, table, not found | `#/learn`, `#/sources`, `#/table/:variable` | this report |

## Testing

`tests/e2e/` (both projects): `smoke.spec.ts` (every route renders with an `h1` and no console errors, dark-mode
captures, the mobile menu collapses with ≥44px rows, no horizontal overflow at 1280 or 375); `map.spec.ts` (94
paths with names, territories inside insets, zoom buttons, hi-res swap and back, keyboard order, focus tooltip,
+/0 keys, Enter navigates, hover or tap tooltip, table toggle and sort, theme toggle persists across reload,
glossary popover and `aria-describedby`); `choropleth.spec.ts`; `perf.spec.ts`. Each page lane adds its own spec
(`home`, `search`, `district`, `compare`, `stories`, `courtroom`, `web-data`).

`integration.spec.ts` (integration pass) visits every route in light and dark at 1280 and 375 px: `#/`, two
districts (one a territory), compare, the stories index, every story, the courtroom, learn, search, sources and a
table. Each visit scrolls the whole page so lazy sections render, then checks the heading, the theme, console
errors, the page's scroll width, and any visible element that crosses the viewport edge without a scrolling or
clipping parent. It also checks that the home page never loads three.js and stays within a JavaScript budget, and it
covers the cross-lane fixes (story address shorthand, unknown measure, fractional judgeships, tap-to-open formulas,
inset labels clear of land, grouped sources). It saves the final review set as `final-<page>-<theme>.jpg`.

`a11y.spec.ts` (UI audit) injects `axe-core` (devDependency, `node_modules/axe-core/axe.min.js`) and scans every route
in light and dark at both widths with the WCAG 2.0, 2.1 and 2.2 A/AA rules, plus four interactive states (an open
formula popover, the open place-search list, the open mobile menu, the rank chart while it dims first-place
years). Serious or critical violations fail. One narrow exclusion: inline glossary terms are left out of
`target-size`, because WCAG 2.5.8 exempts targets inside a sentence. The UI audit's review captures are
`__screenshots__/{desktop,mobile,tablet}/ui-*.jpg`.

Latest full run: see the polish pass at the end of this report (361 passed, 11 skipped). Integration pass
(`CI=1 E2E_PORT=4210 npx playwright test --trace off`): 279 passed, 9 skipped by
design (touch-only tests on desktop, mouse-only and desktop-only measurements on mobile), 0 failed.

`choropleth.spec.ts` exercises the data path before any statistics exist without inventing any. It intercepts
`variables.json` and `values/__test_county_count.json` *inside the test only* and serves the number of counties in
each district, counted in the test from the real `districts-hi.topo.json` and labeled "TEST FIXTURE". Only the
latest period has values; earlier periods are empty to exercise the No-data hatch and the slider. Nothing is
written to `src/` or `public/`.

Screenshots (JPEG, q80) go to `tests/e2e/__screenshots__/{desktop,mobile,tablet}/`, about 160 MB in total
(git-ignored; 153 to 162 MB measured with `du -sh` on Nov 27, growing as specs add captures). They are review captures for the UI audit, not pixel-diff
baselines: the data changes as lanes publish.

**Visual regression** (`visual.spec.ts`, Nov 27). `toHaveScreenshot()` compares a few views that should change only
when the design does, at both widths: the two Learn diagrams, the not-found page (light and dark), the search page
before a query (the index counts in the help line are masked), the home map for authorized judgeships in FY 2015
with courthouse dots and city labels hidden (light and dark), and the E.D. Va. profile header. Animations are off,
motion is reduced, fonts are loaded, the caret is hidden, captures are clipped to the element at CSS-pixel scale,
and `maxDiffPixelRatio` is 0.002. The 16 baselines (8 views at 2 widths, about 0.9 MB) live in `tests/e2e/visual.spec.ts-snapshots/`,
which is committed (only `__screenshots__/` is git-ignored). They are specific to headless Chromium from Playwright
1.63.0 on Linux (file names end in `-linux`); fonts and anti-aliasing differ elsewhere, so run the spec on the same
kind of machine. After a deliberate design change, look at the failing diff in `test-results/`, then refresh with
`CI=1 E2E_PORT=<port> npx playwright test tests/e2e/visual.spec.ts --update-snapshots`, look at the new PNGs, and
run the spec twice more to confirm it is stable. A data rebuild that changes FY 2015 judgeships or the E.D. Va. name
would also need a refresh.

**Glossary terms on measure labels** (`glossary-labels.spec.ts`, Nov 27): every term id in
`src/content/variable-terms.ts` exists (also enforced by the typecheck through `GlossaryId`), every marked phrase
occurs in its measure's current label, glossary cross-references resolve, and the labels on the home header and
switcher, compare rows, table heading and profile open their definition by keyboard and by tap, keep the plain
label as the heading's name, give a target at least 24 px tall, and do not change the heading's height.

## Performance

Measured with Playwright against `vite preview` with the cache disabled (`tests/e2e/perf.spec.ts`, which writes
`test-results/perf.json`). "First map paint" means two frames after the 94 paths are in the DOM
(`performance.mark('atlas:first-map-paint')`):

| | first map paint | map DOM ready | first contentful paint |
|---|---|---|---|
| unthrottled (shared 4-CPU box) | **290–530 ms** | 260–420 ms | 90–170 ms |
| 4× CPU throttling | **0.85–1.37 s** | 0.72–1.26 s | 185–230 ms |
| integration pass, all pages built: unthrottled | **262–410 ms** | 254–400 ms | 100 ms |
| integration pass, all pages built: 4× CPU | **0.89 s** | 0.87 s | 212–236 ms |

The test asserts under 2 s, that the hi-res topology does not load at national view, and that three.js is not
requested. With every page built, the home page loads 11 scripts: 73 KB over the wire, 200 KB decoded, all of it
before the first map paint (entry 29 KB gzip + home chunk 32 KB gzip, which includes d3-geo, d3-zoom, topojson and
the variable switcher). No three.js or courtroom chunk is requested, even after the idle-time thumbnails load.
Main CSS is 8.7 KB gzip. Fonts swap in and never block the map. What made the difference:
the lo topology fetch starts in `main.ts` in parallel with the home chunk; each feature is projected once and
measured on planar coordinates (instead of four projections per feature); resampling is off; each border mesh is
computed once and routed to regions; state outlines are lazy.

## Known gaps and open issues

1. **Hi-res build is a one-off main-thread task of about 350 ms** (2.8 MB, 3,230 counties), triggered one zoom step
   early. A Web Worker build would remove the hitch. Not re-measured in the integration pass.
2. **Glossary review.** Every definition is written from well-established law. Two items deserve a look in the copy
   audit: the `departure` entry says amendments effective Nov. 1, 2025 removed most departure provisions while keeping
   §5K1.1 and §5K3.1, and the `5k3-1` entry says fast-track programs have been used mainly for immigration offenses.
   Both come from memory, not from a source file.
3. The **Alaska inset** shows the whole Aleutian chain, which keeps mainland Alaska fairly small. Newspapers often
   crop the far Aleutians; that is a design call for the client.
4. `npm run dev` passes `--open`; on a headless machine Vite just prints the URL.
5. **Not checked by the UI audit** (headless Chromium only): real iOS Safari and Android, Firefox, WebKit, screen
   readers (NVDA, JAWS, VoiceOver), Windows high-contrast mode, and real GPUs for the courtroom (the headless run uses
   software WebGL). The iOS tap fix for formula popovers was checked with a synthetic click that does not focus the
   button, not on a device.
6. **Story maps on phones** carry no inset names (too small to read inside the sticky graphic); the districts there
   are named in the step text and the method tables. Story charts' pale context lines (for example the other border
   districts) are below 3:1 against the page by design; the highlighted line and the national line are labelled.
7. The dark courtroom is an evening room by design. The UI audit raised its light about 25% (mean stage luminance
   25 to 31 of 255 in a headless capture); labels and the panel meet AA. Judge it on a real phone screen.

Fixed by the UI audit (Nov 27): story sticky-graphic source lines no longer cut off with an ellipsis on phones (and
the formula opens as a small panel over the chart); dimmed rank-strip squares use a tint with 5.2:1 to 5.4:1 number
contrast instead of 35% opacity; inactive story step text meets 4.5:1 (was 4.06:1); phone inset names under the
inset cluster; year-slider events on phones are labelled buttons under the slider (32 px tall, named by their
visible text) with plain diamonds on the track, and colliding year labels are thinned to the decades; raised event
markers on desktop no longer overlap their neighbours' targets; formula popovers open on click or tap everywhere;
the district page's current-section underline is computed from positions (never stale, none above the first
section, the last section at the bottom of the page) and scrolls into view in the phone nav; long judge names wrap
instead of an ellipsis; tables fit three columns at 375 px; the place-search empty list is a valid listbox; island
districts get a halo on locator maps; many-series story charts name the highlighted and national lines.

Data audit follow-up (Nov 27, data fix lane): both table views (`#/table/<variable>` and the map's "View as table")
now show a Notes column with the Derived tag and the cell note (small bases, approximate population, printed caveats)
and, under the table, the formula behind that year's derived cells. Rank wording says when districts share a rank:
`rankText` adds "(tied)", the profile, compare and courtroom phrases read "Tied for 85th highest of 94" or "Tied for
lowest of 94 (66 districts)", and the home tooltip's derived rank reads "tied for" (`rankTies` in `loaders.ts`;
the web lane ranks values at display precision). `periodLabelFor` adds "(preliminary)" to IDB FY 2026 on the home
tooltip and accessible name, the table caption, compare rows and gaps, and the courtroom panel.

Recheck lane follow-up (Nov 27): at 375 px the new Notes column squeezed into about 45 px, so "Derived" was cut to
"DERIVE" and notes wrapped one word per line. On phones the Notes column is now hidden (marked optional) and the same
flags show under the district name (`src/components/cell-flags.ts`; only one copy is ever displayed). A text column
that follows a number column gets its own left gap, so "4th of 94" and "Derived" no longer touch on wide screens. The
legend track is now `clamp(12.5rem, 52vw, 15rem)` (was 10rem at 375 px), because the four break labels such as
"39.4%" overlapped by about 4 px on phones.

Closed since the foundation report: the courthouse and search files are published and in use; the web lane emits
`ranks` as `{district: {year: rank}}`, `ranked_of` and list-form `caveats`; the profile body, compare statistics,
stories and courtroom are built (see [Pages](#pages)); the `#/sources` page groups its files by kind of data.

UX follow-up (Nov 27, completeness review of the brief):

- **Glossary terms on measure labels**, with six new cited entries (below-range sentence, guilty plea, jury
  selection, median time to trial, active judge, patent case). See [How pages plug in](#how-pages-plug-in).
- **Map controls** are a vertical stack at every width, as the brief specifies (phones had a row). See
  [The map style](#the-map-style-clients-choice-and-its-palette).
- **Time machine events show their real dates** (AP style: Jan. 12, 2005; May 22, 2017; Dec. 21, 2018; March 13,
  2020) as a second line under each name, and a note under the slider says why a marker sits where it does
  ("Fiscal years run from October 1 to September 30, so an event on Dec. 21, 2018 (First Step Act) sits at FY 2019";
  for the September 30 judge counts it names the count instead). On phones the event buttons show name, period and
  date and are 44 px tall. Wider labels collide more, so `YearSlider.layoutEvents` now scores every placement of the
  (at most four) labels on up to four rows, centered or as a flag that starts or ends at its marker, and keeps the
  one with no overlap, no leader line through another label and nothing past the track's ends, then the fewest rows.
  It also runs for a single event (TC Heartland at the right end of the FY 2006 to 2017 series used to hang past the
  track) and again once web fonts load. Checked for every distinct year range in the catalog at 1280, 1024, 800, 600
  and 560 px: no overlaps, no crossings.
- **IDB FY 2026 reads "(preliminary)"** on the home map's legend year, the national figure, the map's table caption
  and the live announcement, and the slider shows "Preliminary" under the year (its spoken value ends in
  "(preliminary)"), through `periodLabelFor` and `YearSlider`'s `isPreliminary` option. The final recheck (Nov 27)
  added the same label to the `#/table/<variable>` period menu, to story chart data-table rows from a chart's
  `prelim_from` year, and to the spoken label of `renderSparkline` (its `variable` option now accepts
  `preliminary_years`).
- At 545 to 640 px with a mouse, the switcher's next arrow hung 12 px past the page edge and the page scrolled
  sideways. The arrows now sit inside the edge where the strip is full-bleed.
- Full suite after these changes (`CI=1 E2E_PORT=4502 npx playwright test --trace off`, Nov 27): 357 passed,
  11 skipped by design, 0 failed, including `a11y.spec.ts` (0 serious or critical) and `visual.spec.ts` (also run
  four more times on its own: stable).
- Not checked: real touch devices (taps were checked in Chromium's mobile emulation only), screen readers, and
  window widths other than those listed.

Polish pass (Nov 27):

- **Counts today:** 45 map variables in four families, 5 stories, 54 glossary entries.
- **Glossary:** new entry `mdl` ("multidistrict litigation (MDL)"), paraphrased from the cached text of 28 U.S.C.
  § 1407(a) (www.law.cornell.edu, fetched through `pipeline.common.http.fetch`): the Judicial Panel on Multidistrict
  Litigation may transfer civil cases with one or more common questions of fact to one district for coordinated or
  consolidated pretrial proceedings, and sends each back at or before the end of those proceedings unless it has
  already ended. The profile's MDL note uses it through `term()` (the intro's own definition was removed; the compact
  note's kicker carries the label variant). `criminal_dismissed_pct` and `sentenced_child_pornography_pct` got no
  `variable-terms` entry: no glossary term fits ("dismissed" and offense types have no entry), and none was invented.
  The border-districts story's method note now marks "section 5K3.1" with the `5k3-1` term (`[[5k3-1|section
  5K3.1]]`, rendered by `rich()`).
- **Compare "Year shown" menu:** a year that is preliminary for some measures reads "FY 2026 (preliminary for IDB
  measures)" (the live announcement too), from the catalog's `preliminary_years`, in the same "(preliminary)" words
  `periodLabelFor` uses. Other years keep the plain label.
- **Full suite** (`CI=1 E2E_PORT=4601 npx playwright test --trace off`): 361 passed, 11 skipped by design, 0 failed,
  including `visual.spec.ts` (baselines unchanged) and `a11y.spec.ts`. Pipeline: 1,252 passed. Typecheck clean.
