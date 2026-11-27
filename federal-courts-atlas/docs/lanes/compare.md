# Lane report: compare mode (`#/compare`)

Status: **done**. Compare mode puts two to four districts side by side. Every number on the page is read at runtime
from `public/data/values/<variable>.json`; labels, units, formulas and caveats come from `public/data/variables.json`.
Nothing in `src/` is a statistic.

## What the page does

Address: `#/compare?d=vaed,mdd&y=2019`. `d` lists up to four registry ids in order; `y` is optional. The address
updates as the reader adds, removes or changes the year (commas stay readable), and a reload restores the same view.

1. **Picker.** A search box (WAI-ARIA combobox with a listbox). It matches the registry id (`vaed`), the short form
   with or without punctuation (`E.D. Va.`, `edva`), the full name, the state name or postal code, and plain words in
   any order (`eastern virginia`). Arrow keys move, Enter adds, Escape closes. A click on the empty box lists all 94.
   Districts already chosen are marked "Added" and cannot be added twice. At four, the box is disabled until one is
   removed.
2. **Cards.** Each district's locator map (from `renderLocator`), short form, name (links to the profile), state and
   circuit, and a remove button. On a wide screen each card sits directly above its column.
3. **Year shown.** Default "Latest common year": each row shows the latest year in which every chosen district has a
   value. If no year has all of them, the row shows the latest year with the most districts and says so ("the latest
   year with data for two of three"). Choosing a year applies it to every row; a row whose series does not reach it
   says "Not published for FY 2010. This series covers FY 2014 to FY 2025." and shows No data. The year list holds
   every year covered by at least five measures (FY 1988 on).
4. **Where they differ most** (derived). Among the catalog's main measures (`featured: true`, 15 today), the three
   that put the chosen districts furthest apart in the national rankings. For each: the higher and lower district,
   their values and ranks, a strip showing both positions from lowest to highest, and the difference (percentage
   points for shares) with the ratio for other units. The heading carries a Derived label and the formula on hover,
   focus or tap. Method:
   - Gap in standing = (rank of the lower district − rank of the higher district) ÷ (districts ranked − 1), in the
     year that row shows. Ranks come from the values file.
   - Difference and ratio are computed from the values as printed, so a reader's own subtraction matches.
   - Cells with a caveat note (small bases, flagged printed values, approximate population) are left out.
   - With one district the box asks for a second; if no main measure separates them it says so.
5. **Rows**, grouped by family (Speed, Workload, Sentencing, Case mix). The main measures show first; a
   "Show N more" button loads and adds the rest of a family. Each row:
   - Measure cell: label, the year shown and why, the national figure for that year ("None published" where the
     values file has none; "(derived)" in years the USSC lane computed it), "Higher means ...", a compact source chip
     built from the cell sources actually shown (`getCellSources` for each district plus the national source), and
     "About this measure" (explainer, series breaks, caveats, the national note, links to the map and table).
   - One cell per district: value and unit (`valueParts`, so published halves such as 3.5 judgeships are never rounded
     away), rank as "12th highest of 94" (rank 1 is the highest value), a sparkline, and, when they apply, a "Derived
     value" flag (derived year or cell in a variable that is not derived as a whole) and a "Note" toggle with the
     cell's caveat text. Missing values read "No data".
   - **One shared y-domain per row**: every year of every chosen district plus the national series. One shared
     x-domain too (the variable's full span), labeled with its first and last year on wide screens. The national
     series is a dashed line on the same scale; a hairline and ring mark the year shown.
   - **One district marked per row**, with a symbol and a word, never color alone: "▲ Highest" or, for measures the
     catalog reads lowest first (`default_rank_direction: "asc"`, the speed measures), "▼ Lowest". Ties read "Tied
     highest". No mark when fewer than two districts have values or all are equal.
   - Derived rows: the chip label reads "Derived" and its ƒ button shows the formula (`formula`, or
     `formula_by_basis` for that year's USSC basis). Ranks have their own ƒ in the key ("Derived by the atlas").
6. **No district chosen**: four starting points, described by geography or law only: E.D. Va. + D. Md. (across the
   Potomac), E.D. Tex. + W.D. Tex. + D. Del. (the TC Heartland courts), S.D. Cal. + D. Ariz. + W.D. Tex. + S.D. Tex.
   (four of the five border districts), S.D.N.Y. + C.D. Cal. + N.D. Ill. (Manhattan, Los Angeles, Chicago).
   **One district chosen** (the profile's "Compare with…" link): its card, rows without leader marks, and quick-add
   buttons for other districts in its state and circuit.

## Layout and design

- One column grid shared by the cards and every row: a lead column (16.5rem on wide screens, 15rem, then 11rem
  below 1000px) and one column per district. CSS subgrid lines up value, rank and trend across a row even when a
  badge or a long unit wraps in one cell.
- Two districts on a wide screen (`.cmp--wide`): value and rank on the left of each cell, a larger trend on the right.
- Stacked (`.cmp--stacked`): when a column would be narrower than about 150px (every phone; four districts on a
  tablet), cards become a compact list with small locators and each row reflows into one line per district (short
  name, value, rank, sparkline). There is no horizontal page scroll at 375px (tested). Column headers stay in the
  accessibility tree, visually hidden. A resize that crosses the threshold redraws.
- Sticky column header (district short names) under the site header while a family scrolls.
- Dark mode uses the existing tokens only (ink ground, periwinkle highlight, hairlines instead of shadows); reviewed
  in screenshots. Reduced motion turns off the row flash and skeleton pulse.

## Data loading

`variables.json` and the lo-res topology load first. The 15 main measures' values files (about 1.2 MB raw, far less
gzipped) load in parallel right away, because the summary needs them. The other 26 load only when the reader opens
"Show more" for a family. `loadJson` caches every file, so changing districts or the year redraws instantly.
Profiles are not used: they carry ranks for the latest year only, and the year selector needs every year.

## Accessibility

- Each family is a `role="table"` with column headers (short name plus the full name for screen readers), row headers
  (the measure) and cells. Sparklines are `role="img"` with a label naming the district, the first and last values,
  the low and high, and the national dashed line.
- The picker is a combobox with `aria-activedescendant`, `aria-expanded`, a live count of matches and a live message
  after each add or remove. Focus moves to the next card's remove button after a removal and to the new card when the
  picker fills up. Changing the year keeps focus on the select.
- Formula popovers open on hover, keyboard focus, or a tap (`aria-expanded` on the button; Escape or a tap elsewhere
  closes). On this page they are hidden with `display: none` when closed, so they can never widen a phone screen.
- All buttons and toggles are at least 44px tall on touch layouts.

## Files

- `src/pages/compare.ts` (rewritten), `src/styles/compare.css` (new), `tests/e2e/compare.spec.ts` (new), this report.
- `src/styles/pages.css`: removed the old compare section (picker and card styles this page no longer uses).
  `.compare-select` and `.select-wrap` stay; the table page uses them.
- Shared modules, additive only:
  - `src/components/sparkline.ts`: new optional `domain`, `xDomain`, `reference`, `referenceLabel`, `markYear`,
    `labelPrefix`. With none of them set the output is unchanged.
  - `src/styles/components.css`: styles for `.sparkline__ref`, `.sparkline__year`, `.sparkline__mark--year`.
- Reads, without editing, `src/pages/district/common.ts` (`fmtValue`, `fmtNumberOnly`, `valueParts`, `rankPhrase`,
  `RANK_FORMULA`), so rank and number wording match the district profile.

## Tests

`CI=1 E2E_PORT=4204 npx playwright test tests/e2e/compare.spec.ts --trace off`: 19 passed, 1 skipped by design (the
keyboard test runs on desktop only). Every expected number is computed in the test from `public/data/`:

- E.D. Va. + D. Md.: every main row's year (latest common), each value and rank phrase, the national figure, the
  marked district and direction, and the row's shared y-domain (`data-domain`) against the files.
- E.D. Tex. + W.D. Tex. + D. Del.: the summary's three measures recomputed with the same method; the Derived label
  and formula popover; "Go to the row" moves focus to that row.
- Picker: by short form, id and plain words; URL sync; four maximum; remove; duplicates refused; Escape closes.
- Year selector on the four border districts: one year for every row, values for that year, "Not published" rows,
  URL `y=`, kept after reload, back to the default.
- E.D. Va. + D. Guam: a derived per-capita row (formula text equals `variables.json`), No data for Guam, a cell note
  shown in full; tap opens and closes the formula on mobile.
- Empty and one-district states; keyboard add and family expansion; dark mode; labels verbatim from the catalog.
- No horizontal overflow and no em-dash in page text, at 1280px and 375px.

Screenshots reviewed (desktop and mobile, `tests/e2e/__screenshots__/{desktop,mobile}/`): `compare-vaed-mdd`,
`compare-txed-txwd-ded`, `compare-four-border-year`, `compare-one`, `compare-empty`, `compare-dark`,
`compare-dark-rows`, `compare-derived-formula`, `compare-search-open`, `compare-workload-expanded` (desktop).
Mobile full-page captures of three or four districts reach the 16,000-pixel encoding limit and are cut there by the
shared helper.

## Not checked

- Screen readers were not run (VoiceOver, NVDA); the table and combobox semantics were checked in the DOM only.
- Only Chromium was tested. Subgrid needs Safari 16 or later and Firefox 71 or later; older browsers fall back to
  cells that may not line up across a row, with no loss of content.
- Tablet widths between 375px and 1280px were not captured; the stacking threshold is computed, not media-query
  based, and was exercised at the two tested widths and by reasoning.
- The copy (suggestion notes, key, method text) still needs the copy audit. The suggestion notes state geography and
  law from general knowledge (which districts border D.C. or Mexico, where three courts sit), not from a source file.
- The summary method is new analysis by this lane. It is documented on the page and in this report, but it has not
  been reviewed by the statistics audit.
