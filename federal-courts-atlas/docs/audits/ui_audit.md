# UI audit

Date: 2026-11-27. The UI lane captured every route at three widths in both themes, fixed what it found and added an
automated accessibility scan. The recheck lane then looked again at the views changed since, and fixed two more
problems (see "Recheck").

## What was looked at

- **Routes captured.** All at 1280x800 (desktop) and 375x812 (mobile, DPR 2), in light and dark, as full pages:
  - home: default; sentencing measure with FY 2006; patent filings with FY 1990
  - districts: vaed, nmid, gud, akd, dcd, nysd, oknd
  - compare with 2 districts (vaed, txed) and with 4 (vaed, txed, nysd, gud)
  - the stories index, and each of the 5 stories at the top, mid-scroll and "How we did this", plus a full page
  - the courtroom after the scene is ready
  - Learn; search with a query (Richmond) and with no results; sources; `#/table/civil_disposition_months`; a
    not-found route
- **Viewport captures** for sticky or scrolly pages: home, vaed, the courtroom and the story steps.
- **Tablet (768 px, light):** home, vaed, compare-2 and the Rocket Docket story.
- **Total:** 181 captures in `tests/e2e/__screenshots__/{desktop,mobile,tablet}/ui-*.jpg` (JPEG q80). That folder is
  git-ignored, so these are local review files. Every capture was read; mobile full pages taller than 8,000 CSS px
  were captured again at DPR 1 so the whole page could be seen.

## Problems found and fixed by the UI lane

### Known issues from the integration report

1. **Story source line cut off on phones.** The sticky graphic's caption and source were clamped to 3 lines with an
   ellipsis. Also, on phones "Derived: show formula" toggled a box that was always hidden, and on desktop the box was
   always visible. Now the caption and source wrap in full, the formula opens as a small raised panel over the chart
   on phones, and `[hidden]` is respected everywhere.
2. **Low-contrast dimmed squares in the Rocket Docket rank strip.** Dimmed with 35% opacity before. Now a tint of the
   series color with the number in the series color: 5.44:1 light, 5.16:1 dark.
3. **No labels on the Guam, N. Mariana Is. and P.R. & V.I. insets at 375 px.** The full names now sit in a row under
   the inset cluster at national view, each joined to its frame by a thin leader line. Story maps show inset names on
   wider screens.
4. **No visible labels on the year-slider event diamonds at 375 px** (three overlapped). On phones the track shows
   plain diamonds and the four events are labelled buttons under the slider, 32 px tall, named by their visible
   text. Colliding year tick labels are thinned to the decades.
5. **Very dark courtroom on a phone.** Labels and panel pass axe in dark at both widths. The dark-theme lights were
   raised moderately (mean stage luminance 25-29 of 255 before, 31-34 after), keeping the evening look.
6. **Formula popover relied on a tap focusing the button** (which iOS Safari does not do). One document-level handler
   now toggles every formula button on click or tap; Escape and an outside click close it; hover rules apply only
   under `(hover: hover)`. Buttons grew from 22 to 24 px.
7. **District in-page nav current section** stayed stale after scrolling back up. It is now computed from section
   positions on scroll, and on phones the current link scrolls into view.

### Other problems found and fixed

- Inactive story step cards (desktop) failed contrast at 4.06:1; they now use `--color-text-3` (5.4:1 light, about
  6:1 dark).
- The search page with no results had an invalid listbox (axe critical); the message is now a disabled option.
- Long judge names were cut off with an ellipsis; they now wrap.
- The table route at 375 px half-hid the rank column; headings now wrap on phones.
- The Northern Mariana Islands locator map looked nearly blank; island districts get a halo.
- The Border Districts felony chart (6 series) had no line labels; highlighted and national lines are labelled.
- Crowded first x-axis label on narrow story charts; the first label now needs 44 px of room.
- Raised event markers on desktop overlapped their neighbours' targets (axe target-size); fixed.

### Checked and fine

- **Focus:** every element tabbed to on home, district, compare, a story, the courtroom and Learn shows an outline or
  ring in both themes.
- **Keyboard:** map paths, switcher tabs and select, thumbnails, slider, play button, event markers and the search
  combobox are reachable.
- **Reduced motion:** a map zoom lands instantly, story transitions are 0s, all duration tokens are 0.
- **Horizontal scroll:** at 375 px none of the 94 district pages scrolls sideways, and every captured route has
  scrollWidth equal to the viewport width.

## Accessibility scan (axe-core 4.10.3)

`tests/e2e/a11y.spec.ts` runs axe (WCAG 2.0, 2.1 and 2.2 A/AA) on 19 routes in both themes at both widths, plus four
interactive states (open formula, open search list, open mobile menu, rank chart in exceptions mode).

| Route | Before | After |
|---|---|---|
| home, home with an old year | target-size (desktop, raised event marker) | 0 |
| district vaed, nmid | target-size on 2 inline glossary terms (phone) | 0 (exempt, see below) |
| compare-2, compare-4 | target-size (22 px formula buttons) | 0 |
| each of the 5 stories | color-contrast, serious: 45 to 64 nodes each, desktop light | 0 |
| search with no results | aria-required-children, critical | 0 |
| stories index, courtroom, Learn, sources, table, not found, search with a query | clean | 0 |
| interactive states | target-size on home with the search list open | 0 |

One narrow exclusion: inline glossary terms (`.term`) are left out of the target-size rule only, because WCAG 2.5.8
exempts targets inside a sentence.

## Recheck (final lane)

The recheck lane rebuilt the site after the data and copy fixes and captured the changed views again at 375 and 1280
px (scratch folder `w3/final/pw/shots/`), confirming the UI lane's fixes 1, 3, 4 and 5 on screen (story source line
wraps; inset names row; labelled event buttons and decade ticks; dark courtroom legible). It found two new problems:

1. **Table Notes column at 375 px.** The data fix lane added a Notes column to both table views after the UI audit.
   At 375 px it squeezed into about 45 px: "Derived" was cut to "DERIVE" at the scroll edge and notes wrapped one word
   per line. On wide screens "4th of 94" and "Derived" touched with no gap. **Fixed:** on phones the Notes column is
   hidden and the same flags show under the district name (`src/components/cell-flags.ts`; only one copy is ever
   displayed, so a screen reader meets each flag once); a text column after a number column gets its own left gap.
   The table scroll area is now 342 of 342 px at 375 (no sideways scroll) and the e2e test checks the visible copy at
   both widths.
2. **Legend break labels overlapped at 375 px.** The four break values (for example "39.4% 52.0% 62.2% 72.2%")
   overlapped by about 4 px because the legend track was 10rem wide on phones. **Fixed:** the track is now
   `clamp(12.5rem, 52vw, 15rem)`. Measured after: no overlap on home at 375, 768 and 1280 px, Lowest and Highest still
   on one line, no horizontal scroll.

Not a defect: when the recheck lane moved between routes by changing only the URL hash, the new page's heading showed
a focus ring. That is the router moving focus to the heading for screen readers after an in-app navigation with no
pointer click; a mouse click on a link does not show the ring.

## Tests and performance

See `VERIFICATION.md` for the final counts. The UI lane's own full run on port 4303 gave 319 passed and 9 skipped
(by design), first map paint 366 ms (873 ms at 4x CPU throttle).

## What remains

- Pale context lines in story charts are below 3:1 against the page by design (#b9bfcb light, #4a5366 dark); the
  highlighted and national lines are labelled and the data is in the "How we did this" tables.
- Story maps on phones have no inset names (too small inside the sticky graphic).
- The dark courtroom is an evening room by design; judge its brightness on a real phone.
- The hi-res topology load causes a main-thread hitch of about 350 ms on zoom; not addressed.

## What could not be checked

- Real iOS Safari or Android Chrome on a device. The iOS tap fix was tested with a synthetic click that does not
  focus the button.
- Firefox and WebKit (Chromium only).
- Screen readers (VoiceOver, NVDA, JAWS) and Windows high-contrast mode.
- Real GPUs for the courtroom (headless uses software WebGL).
- 200% text zoom, 320 px reflow and landscape phones.
- The courtroom camera under reduced motion was confirmed in code only, not watched.
- The recheck lane did not re-read all 181 UI captures; it re-captured and read the views changed after the UI audit
  (tables, legend, home slider and insets, story graphics, compare, courtroom, oknd profile).
