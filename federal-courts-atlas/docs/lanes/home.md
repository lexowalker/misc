# Lane report: home map and search

Status: **done**. The home page reads the web lane's catalog and values at runtime and shows all 41 measures
in four families. It has a thumbnail switcher, a time machine with landmark events, an explicit tooltip, courthouse
dots of two kinds and a "find your federal court" search box. The `#/search` page uses the same search
component, with locator maps. No statistic is written in `src/`. Every number on these pages comes from
`public/data/` (`variables.json`, `values/<id>.json`, `geo/*`, `search/*`).

## Files

| file | what it does |
|---|---|
| `src/pages/home.ts` | The page: headline and intro, search box, switcher, measure header (label, Derived tag, explainer, unit, "Higher means", national figure, legend), map, time machine, dot key, "What to keep in mind" panel. Also holds the tooltip body, the accessible names and the rank phrase. |
| `src/pages/home-switcher.ts` | `VariableSwitcher`: family tabs (`role=tablist`), the thumbnail strip (toggle buttons with `aria-pressed`) and the `<select id="variable-select">` fallback that lists every measure. |
| `src/styles/home.css` | Home layout, switcher, thumbnails, Derived tag and popover, tooltip extras, phone layout. |
| `src/data/place-index.ts` | New. The search index over `search/{places,counties,zcta,courthouses}.json` plus the district registry: parsing of the row tables, ranking, state suffixes ("Dallas, TX", "Portland Maine"), ZIP prefixes. |
| `src/components/place-search.ts` | New. `PlaceSearch`, the WAI-ARIA combobox (popup on home, inline on `#/search`). |
| `src/styles/place-search.css` | New. Combobox styles. |
| `src/pages/search.ts` | `#/search?q=`: inline combobox, preview panel with one locator map per district, example queries. |
| `src/styles/search.css` | New. Search page layout. |
| `tests/e2e/home.spec.ts` | 14 tests (13 on each project; the phone layout test runs on mobile only). |
| `tests/e2e/search.spec.ts` | 7 tests on each project. |

## How it works

### Variable switcher

- Variables are grouped by `family` in the order speed, workload, sentencing, casemix, keeping catalog order
  within a family. The tabs show the count (4, 12, 12, 13). The default is the catalog's first variable.
- Each thumbnail is a `renderThumbnail` map of the variable's **latest year**, with breaks pooled over all
  years, the same breaks the main map uses. The strip says "Small maps show each measure's latest year."
- **Lazy drawing.** Nothing for the thumbnails loads until the main map has painted. The page waits for
  `map.ready`, then two animation frames, then `requestIdleCallback` (1.2 s timeout). After that, an
  `IntersectionObserver` draws each thumbnail when it scrolls into view. Only the open family's values files
  load, and only as they become visible. Other families load when their tab opens. Until then each tile shows a
  neutral shimmer (none under reduced motion).
- Keyboard: arrow keys, Home and End move between tabs (automatic activation) and between thumbnails. The
  select lists all 41 measures in four `optgroup`s. Choosing from it opens the matching tab. Desktop has
  scroll buttons and edge fades when the strip overflows. Phones swipe (scroll-snap).
- URL state: `?v=<variable>&y=<year>` is written with `replaceQuery` on every change and read on load. A year
  the new variable lacks falls back to its latest year. When the reader switches variables, the current year is
  kept if the new variable has it.

### Measure header and legend

- Family, label, a **Derived** tag when the measure is derived, the explainer, a unit phrase ("Measured in
  months.") and "Higher means ..." (from `higher_means`).
- **Derived tag.** It is a button whose formula popover opens on hover or keyboard focus (`role=tooltip`,
  `aria-describedby`). Escape hides it, as WCAG 1.4.13 requires.
  - Wholly derived variables use `formula`.
  - Variables derived only in some years (USSC FY 2004 to 2005, FY 2002 to 2017) read "Derived for FY 2002 to
    2017" and show `formula_by_basis`.
  - The same formulas also appear as plain text in the panel below the map, for touch and print.
- **National figure** ("All district courts, FY 2025"). It is read from `national` in the values file, with a
  Derived tag in `national_derived_years`. The `national_note` is shown in the panel below. Nothing is shown
  when no national figure is published.
- **Legend.** It uses `ChoroplethView`'s legend, moved beside the measure name so the map starts higher on the
  page. The legend head shows only the period (`legendHead: 'year'`). The note says the colors are pooled: "Colors
  are pooled across FY 1999 to 2025, so a color means the same range in every year. Each color holds about a
  fifth of all values." When ties leave fewer than five groups, the note says how many there are.

### Time machine

- `YearSlider` covers the variable's years, with Booker (FY 2005), TC Heartland (FY 2017), the First Step Act
  (signed Dec. 21, 2018, so FY 2019) and COVID-19 (FY 2020) from `src/content/events.ts`. Each marker is a
  button that jumps to its year. Play and pause are built in. Under reduced motion each step lasts at least
  1.4 s, and the color transitions are off through the motion tokens.
- **Shared fix (additive):** event labels that would overlap (First Step Act beside COVID-19) are now lifted
  onto a second row, with a longer leader line. A `ResizeObserver` re-runs the check when the width changes. The
  home spec asserts that no two labels overlap.

### Tooltip and accessible names

- The tooltip shows:
  - the district name and the measure's short label;
  - the value with its unit (`formatValue`);
  - the rank direction in words: "Highest of 94", "5th highest of 94 districts", "Tied for 40th lowest of 94
    districts", or "Lowest of 94";
  - the period, and the derived rank with its rule ("derived rank 55th of 94 (1 = highest)");
  - the cell note from `cell_notes`: FCMS flagged cells, small bases, approximate population;
  - for derived cells, a Derived tag and the formula.
- Missing values read "No data", next to the same hatch swatch used on the map and in the legend.
- **How the rank phrase is counted.** Rank 1 is the web lane's highest value (competition ranking). The
  position from the bottom is counted the same way from that year's values (1 + the number of lower values).
  The tooltip names whichever end is nearer, and says "Tied for" when another district has the same value. It
  never shows a number that is not in the values file, apart from this position count, which is labeled
  derived.
- **Accessible names** keep the existing pattern, "Eastern District of Virginia, Median time to resolve a
  civil case: 4.9 months, 94th of 94, FY 2025", which other specs rely on. A cell caveat is appended after the
  period ("... FY 2023. Note: ..."). The rank direction is in the map's screen-reader help text (`ariaHelp`):
  "Ranks count from the highest value: 1st of 94 is the highest."

### Courthouse dots

`AtlasMap` now has an option `courthouseKinds`, which the home page turns on. A solid dot marks a city that the
statute names as a place of holding court. An open ring marks a city that has only an FJC-listed courthouse
building (7 cities). A key under the slider explains the two dots and notes that dots mark cities, not
buildings. Labels appear on zoom, as designed by the front-end lane.

### Search ("find your federal court")

- **Index** (`place-index.ts`). It reads the courthouses lane's four files (shapes in
  `docs/lanes/courthouses.md`):
  - places (38,204);
  - counties (3,230);
  - ZCTAs (33,790);
  - courthouses (786).

  It also includes the 94 districts and the states, from the registry.
- **Loading.** The files load on the first focus or keystroke on home, and right away on `#/search`. Together
  they are about 2.5 MB.
- **Matching** works on folded text (accents, case and punctuation ignored). Results rank in this order:
  1. exact matches;
  2. matches that start the name at a word break;
  3. matches on the start of every word;
  4. matches anywhere in the name.
- **Ties** are broken in this order:
  1. a city where the statute says court is held (taken from the courthouse rows of kind `p`), so "Dallas"
     finds Dallas, TX first;
  2. kind: states, then districts, then places, then counties, then courthouse buildings;
  3. Census place type;
  4. name and state, alphabetically.
- A trailing state code or state name filters to that state ("Alexandria, VA", "portland oregon"). If the filter
  finds nothing, the search runs again on the whole text.
- **ZIP codes.** Three to five digits search ZCTA prefixes. A five-digit code with no ZCTA says so plainly.
- **Every district a place reaches into** is listed, primary first:
  - for places, the district holding the Census internal point, then `other_district_ids` ("Also W.D. Tex.");
  - for counties, the statutory district, then `split_districts` for the 8 split counties;
  - for ZCTAs, the district with the largest land share, then the others, each with its share ("52% of land
    area").

  Each district is its own option, so each opens directly.
- **Combobox** (`place-search.ts`). It follows the APG "combobox with listbox popup" pattern:
  - `role=combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls`, and `aria-activedescendant`
    on the active option;
  - Up and Down wrap; Enter opens the active option, or the first one; Escape closes the popup, and a second
    Escape clears the text;
  - Tab closes the popup; mouse hover sets the active option;
  - a polite status line announces the number of results.

  Options carry full accessible names ("Alexandria, VA, City or town, Virginia, court sits here: Eastern
  District of Virginia"). The matched text is underlined.
- **Home** uses popup mode with 8 results and a "See all N matches" link to `#/search?q=`.
- **`#/search`** uses inline mode (20 results, 8 on phones, with a hint to add a state). The preview panel
  shows the highlighted match: its kind and full name; a note when the place, county or ZIP code spans
  districts; "The law names this city as a place where the district court sits" when that applies; one card per
  district, primary first, each with a locator map, the Census point and an "Open district profile" button; and
  a one-line method note (internal point, ZCTA land shares, split counties). `?q=` is kept in the URL.

## Additive changes to shared modules

All changes add new options with defaults or fix layout. No signature changed, and pages that do not pass the
new options behave as before.

- `src/map/atlas-map.ts`:
  - new options `tooltipBody`, `ariaLabelFor`, `ariaHelp` and `courthouseKinds`;
  - a new `dots--open` path;
  - the attribute `data-courthouses-open`.
- `src/map/view.ts`: new options `legendNote`, `legendHead: 'full' | 'year'` and `rankLabel`. Home sets the table's
  rank column header to "Rank (1 = highest)".
- `src/components/year-slider.ts` and `src/styles/components.css`: event labels that would collide go onto a
  second row. This is a fix for every page that uses the slider.
- `src/styles/map.css`: the `.dots--open` style.
- `src/data/loaders.ts` was **not** changed. Its `loadSearchIndex` and `normalizeSearch` do not understand the
  courthouses lane's row tables. For example, they would turn `index.json`'s description into an entry. Nothing
  uses them any more: `place-index.ts` replaces them.

## Checks

- `npm run typecheck` passes.
- e2e on port 4201: `CI=1 E2E_PORT=4201 npx playwright test tests/e2e/home.spec.ts tests/e2e/search.spec.ts
  tests/e2e/map.spec.ts tests/e2e/choropleth.spec.ts tests/e2e/web-data.spec.ts tests/e2e/smoke.spec.ts
  tests/e2e/perf.spec.ts --trace off`. All pass (counts in the final report). One full-suite run (all specs,
  including the district lane's) also passed: 142 passed, 6 skipped by design.
- **First map paint** (`perf.spec.ts`, cold cache): 311 ms unthrottled and 790 ms at 4x CPU, against a 2 s
  limit. The hi-res topology and three.js do not load. A home test checks that no thumbnail values file starts
  loading before the `atlas:first-map-paint` mark.
- **Screenshots reviewed** in `tests/e2e/__screenshots__/{desktop,mobile}/`, in light and dark:
  - `home-fold`, `home-full`, `home-dark-fold` and `home-dark-full`;
  - `home-tooltip`, `home-nodata`, `home-derived` and `home-time-machine`;
  - `home-search` and `home-phone-fold`;
  - `search-alexandria`, `search-split-zip`, `search-empty` and `search-dark`.

  **Fixed after review:**
  - The map now starts about 90 px higher: the headline fits on one line and the legend sits beside the measure
    name.
  - On phones, the family tabs pushed the page 26 px wider than the screen: a wrapping flex line took the width
    of its widest item. The phone layout now puts the tabs, then the strip, then the select.
  - The FJC courthouse headings ("Alexandria, Louisiana (1933)") no longer have the state added a second time.
  - The search placeholder was shortened so it fits at 375 px.
  - The inline search list is capped on phones, so the preview stays close.
- There is no em-dash in any string I wrote.

## What I did not check

- Screen readers: I checked the ARIA roles and states in tests and by reading the code. I did not listen to the
  pages with NVDA, JAWS or VoiceOver.
- Search ranking is heuristic. It uses no population data, because the search files have none. "Alexandria"
  therefore lists Alexandria, LA before Alexandria, VA (both are court cities, and ties sort by state). Adding
  ", VA" narrows the list.
- Search results come straight from the courthouses lane's tables. I did not re-derive ZCTA shares or the
  `other_district_ids` lists.
- Places annexed since 2020 may lack `other_district_ids`. That caveat belongs to the courthouses lane and is
  shown only as the general method note.
- The thumbnails show each variable's latest year, not the year on the main map. The strip says so.
- I checked performance only on this machine (unthrottled and at 4x CPU). I did not test on a real phone.
- Firefox and Safari were not tested. The e2e browsers are Chromium only.
