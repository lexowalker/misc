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
src/data/types.ts              Variable, ValuesFile, District, Judge, Case, Courthouse, SearchIndex, DivisionsFile, ...
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
src/content/glossary.ts        47 plain-English, cited definitions (all 31 required terms + procedure terms used on Learn)
src/content/events.ts          Booker, TC Heartland, First Step Act, COVID-19 with exact dates + periodYear() mapping
src/content/stories.ts         story prose with {key} placeholders, filled at runtime from public/data/stories/ (stories lane)
src/pages/                     home (+ home-switcher), district (+ district/), compare, stories, story (+ story/), courtroom,
                               learn (+ learn-diagrams), search, sources, table, not-found
src/courtroom/                 three.js scene, seats, floor plan, panel (courtroom lane; loaded only on #/courtroom)
src/styles/                    tokens.css, base.css, shell.css, components.css, map.css (eager); one CSS file per page chunk
tests/e2e/                     one spec per page lane, plus smoke, map, choropleth, perf, web-data and integration;
                               __screenshots__/{desktop,mobile}/*.jpg
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
  stacked bottom-right.
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
  Mariana Islands and Puerto Rico + Virgin Islands frames are too small for a clear label and go without one; every
  district still has its tooltip, aria-label and table row.
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
- `loadSearchIndex` tries `search/index.json`, `search/search-index.json`, `search/{places,cities,counties,zips,zcta,
  courthouses}.json` and the contract's `search-index.json`. It normalizes lists, `{entries|items|records}`,
  bundles (`{zips, cities, counties, courthouses}`) and plain `key → district id(s)` maps. Courthouses double as
  search entries. The published `search/` files feed the `PlaceSearch` combobox (`src/components/place-search.ts`,
  home lane) on the home page and `#/search`.

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
- **Derived values** use `sourceChip({derived, formula})`. The formula popover opens on hover, on keyboard focus and
  on a tap. A page that manages the popover itself sets `aria-expanded` on the button, and the shared `:focus` rule
  then steps aside so a second tap can close it. A closed popover is `display: none`, so it cannot widen a phone page.
- Reusable pieces: `ChoroplethView` / `AtlasMap`, `renderLocator`, `renderThumbnail`, `YearSlider`,
  `renderSparkline` (shared domains and a dashed national reference line are options), `DataTable`, `PlaceSearch`,
  `term()` / `rich()` for glossary terms, and the designed empty states in `src/components/states.ts`.

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
glossary popover and `aria-describedby`); `choropleth.spec.ts`; `perf.spec.ts`. Last full run: 50 passed, 4
skipped by design (hover tests on touch, tap tests on mouse, perf on mobile).

`choropleth.spec.ts` exercises the data path before any statistics exist without inventing any. It intercepts
`variables.json` and `values/__test_county_count.json` *inside the test only* and serves the number of counties in
each district, counted in the test from the real `districts-hi.topo.json` and labeled "TEST FIXTURE". Only the
latest period has values; earlier periods are empty to exercise the No-data hatch and the slider. Nothing is
written to `src/` or `public/`.

Screenshots (JPEG, q80) go to `tests/e2e/__screenshots__/{desktop,mobile}/`, about 12 MB in total. They are review
captures for the UI audit, not pixel-diff baselines: the data changes as lanes publish.

## Performance

Measured with Playwright against `vite preview` with the cache disabled (`tests/e2e/perf.spec.ts`, which writes
`test-results/perf.json`). "First map paint" means two frames after the 94 paths are in the DOM
(`performance.mark('atlas:first-map-paint')`):

| | first map paint | map DOM ready | first contentful paint |
|---|---|---|---|
| unthrottled (shared 4-CPU box) | **290–530 ms** | 260–420 ms | 90–170 ms |
| 4× CPU throttling | **0.85–1.37 s** | 0.72–1.26 s | 185–230 ms |

The test asserts under 2 s, that the hi-res topology does not load at national view, and that three.js is not
requested. Initial JavaScript is about 57 KB gzip (entry 29 KB + home chunk 28 KB, which includes d3-geo, d3-zoom
and topojson). Main CSS is 8.6 KB gzip. Fonts swap in and never block the map. What made the difference:
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
4. **Small insets on phones.** At 375 px the Guam, Northern Mariana Islands and Puerto Rico + Virgin Islands insets
   carry no label (there is no clear space inside their frames). Their districts keep tooltips, aria-labels and
   table rows.
5. `npm run dev` passes `--open`; on a headless machine Vite just prints the URL.

Closed since the foundation report: the courthouse and search files are published and in use; the web lane emits
`ranks` as `{district: {year: rank}}`, `ranked_of` and list-form `caveats`; the profile body, compare statistics,
stories and courtroom are built (see [Pages](#pages)); the `#/sources` page groups its files by kind of data.
