# Lane report: The Courtroom (`#/courtroom`)

Status: **done**. A procedural three.js courtroom you can explore. Choosing a seat (in the room, on its
floating label, on the 2D floor plan, or from the seat list) moves the camera to that seat's point of
view. A panel explains the role in plain English, with glossary terms, and shows real atlas figures for
that seat: national figures by default where the source publishes one, or any district the reader picks.

## Files

| file | what it holds |
|---|---|
| `src/pages/courtroom.ts` | The page: layout, seat list, district picker, URL state, focus, live region, bottom sheet, renderer choice (WebGL scene or floor plan), cleanup. |
| `src/courtroom/seats.ts` | The nine seats: names, role copy, the measures each seat shows, camera eye and look points, label anchors, click boxes. Also the room layout shared by the scene and the plan. No statistics. |
| `src/courtroom/scene.ts` | The three.js scene: procedural geometry merged by material, lights, the dollhouse room view, camera flights, look-around, picking, labels, render-on-demand loop, disposal. |
| `src/courtroom/textures.ts` | Canvas-drawn textures: wood grain, carpet, the U.S. flag, a plain court banner. |
| `src/courtroom/panel.ts` | The data panel: stat rows, population and places (gallery), the record (court reporter), the district `<select>`. |
| `src/courtroom/plan.ts` | The fallback: an SVG floor plan drawn from the same layout. |
| `src/styles/courtroom.css` | Page styles and the scene palette (`--cr-*` custom properties for both themes). |
| `tests/e2e/courtroom.spec.ts` | 12 tests (11 per project; the bottom-sheet test runs on mobile only). |
| `data/gaps/courtroom.json` | Three gaps this page surfaces (below). |

URL state: `?seat=<seat id>&d=<district id>`. `?webgl=0` forces the floor plan (for testing and for
readers who prefer it).

## Seats and what each shows

Every number is read at runtime from `public/data/` (`values/<id>.json`, `districts.json`, `sources.json`,
`manifest.json`). Labels, units, explainers and caveats come from `variables.json`. Each row shows the
variable's latest year, the value (or **No data**), the national figure when one is published, the
district's rank with a "Derived by the atlas" formula hint, a sparkline (district series with the national
series dashed), a source chip, any cell note (small base, approximate population, source caveat), and
"About this measure" (explainer, direction, caveats).

| seat | measures |
|---|---|
| Judge's bench | `judgeships`, `active_judges`, `senior_judges`, `weighted_filings_per_judgeship`, `vacant_judgeship_months`. Note: "These counts and workloads describe the whole court. The atlas reports no statistics about individual judges." |
| Courtroom deputy | `filings_per_judgeship`, `terminations_per_judgeship`, `pending_per_judgeship` |
| Court reporter | No statistics, said plainly. Instead, "The record": the source records behind every figure in the courtroom (publisher, dataset, vintage, number of source files, retrieval date) and the data build date and version. |
| Witness stand | `trials_per_judgeship`, `civil_trial_months` |
| Jury box | `civil_trial_rate_pct`, `criminal_trial_rate_pct`, `jurors_avg_present` and `jurors_pct_not_selected` (the two FCMS juror measures, published by the web lane since the 2026-11-27 data fix; D.N.M.I. FY 2024 shows No data because no jury selection was held). The "not part of the atlas yet" note now appears only if the catalog drops them. |
| Prosecution table | `felony_defendants_per_100k`, `guilty_plea_pct`, `substantial_assistance_pct`; most common charges: `crim_drugs_pct`, `crim_immigration_pct`, `crim_firearms_pct` |
| Defense table | A plain statement that the atlas has no data on defense lawyers. Then `prison_pct`, `median_sentence_months`, `within_range_pct` (people sentenced) and `pro_se_pct` (civil). |
| Lectern | `civil_disposition_months`, `criminal_disposition_months`, `civil_over_3yrs_pct` |
| Gallery | Residents (latest Census estimate, derived, with formula) and the 2020 Census count from `districts.json`; `civil_filings_per_100k`; places of holding court by statute. |

Rules applied:

- **National mode.** The value is `national[year]` with `national_source_by_year[year]` as its source.
  It is marked derived when the variable is derived or the year is in `national_derived_years`. Where no
  national figure is published (per-capita rates, judge counts, population), the row says "No national
  figure is published for this measure. Choose a district to see it." Nothing is summed or estimated.
- **District mode.** The value, sources (`getCellSources`), derived flag (`isDerivedCell`) and formula
  (the file's, else the variable's, else the USSC basis formula for that year) come from the values file.
- **Ranks** are phrased neutrally ("12th highest of 94", "Highest of 94", "Lowest of 51"), because rank 1 is
  always the highest value. For the speed measures, highest means slowest. Every rank has the formula hint.
- **Labels with glossary terms.** A seat may mark up a label (`[[weighted-filings|Weighted filings]] per
  judgeship`). The markup is used only if, stripped, it equals the published label exactly. Otherwise the
  plain label is shown, so a renamed variable can never be mislabeled.
- **Optional measures** are requested only if `variables.json` lists them, so a missing file never causes
  a 404.

## The scene

- **Built from code.** Hundreds of boxes, cylinders and planes, merged per group (each station, each wall,
  the ceiling, the rest) and per material into a few dozen meshes. Textures are drawn on canvases (wood grain, carpet with a fine diamond lattice, the U.S. flag,
  a plain navy court banner with a ring of stars). The seal is concentric brass and navy discs with
  thirteen studs. No lettering anywhere. Nothing is fetched except the three.js chunks.
- **Layout.** A judge's bench on a raised platform with paneled front, desk lamps, monitor and microphone;
  the U.S. flag at the judge's right (the room's left) and a court banner at the left; the courtroom
  deputy's desk and the court reporter's stenotype below the bench; the witness stand beside the bench on
  the jury side; a two-row jury box of 14 chairs (12 jurors and 2 alternates); counsel tables with the
  prosecution nearest the jury; a lectern; the bar with a swinging gate; seven rows of gallery pews; tall
  windows on one wall; coffered ceiling with recessed lights.
- **Room view.** A "dollhouse" view: walls between the camera and the room are hidden, and the ceiling
  fades out as the camera rises above it, so the reader looks into the room from outside. The distance is
  solved for each aspect ratio so the well and the front of the gallery always fit (a steeper, more
  top-down angle on portrait screens). Orbit is limited (azimuth about plus or minus 66 degrees, no pan,
  limited zoom). A plain mouse wheel scrolls the page; Ctrl or Cmd with the wheel, or a pinch, zooms.
- **Seat views.** The camera flies along a raised curve (1 to 1.9 seconds, ease in and out) to the seat's
  eye point and looks where a person in that seat would. Dragging turns the head (limited yaw and pitch).
  Under `prefers-reduced-motion` every move is a cut, look-around has no easing, and orbit damping is off.
- **Floating labels** name the stations in the room view. A label that would collide with another flips
  below, right or left of its dot, or collapses to the dot (its label shows on hover). Labels are
  `aria-hidden`; the seat list is the accessible way to choose.
- **Themes, deliberately different.** Light: daylight through the windows, warm walnut, navy leather and a
  muted periwinkle-navy carpet, with navy wall caps in the cut-away. Dark: the same room in the evening.
  Plaster turns ink blue, windows go to night, the ambient light drops and warm desk lamps light the bench
  and the counsel tables; the wall caps turn periwinkle. Colors come from `--cr-*` custom properties in
  `courtroom.css`, read again on every theme change.
- **Highlight.** Hovering a station (or its button in the seat list) gives it a soft periwinkle glow and
  highlights its label and list button.

## Accessibility

- The seat list is a `<nav>` of buttons with `aria-pressed` and `aria-controls="cr-panel"`. Arrow keys,
  Home and End move between them. Activating a seat from the keyboard moves focus to the panel heading.
  Escape (or the "Room view" button, or the sheet's close button) returns to the room view and puts focus
  back on the seat's button. A polite live region announces each change.
- The canvas is `aria-hidden`; nothing depends on it. Glossary terms use the shared `term()` popovers.
  Formula and rank hints open on hover, keyboard focus and tap.
- Touch targets are at least 44 px. No horizontal page scroll at 375 px (tested). Contrast uses the
  existing tokens.

## Narrow screens

Below 960 px the panel is in the page flow until a seat is chosen, then becomes a bottom sheet (half the
screen, expandable to 88 percent, with a grip button and a close button). The page scrolls the room to the
top of the screen above the sheet and adds bottom padding so the seat list can be reached. Above 960 px the
panel sits beside the room, exactly as tall as the room and seat list, and scrolls inside.

## Performance and lifecycle

- three.js is imported only by `src/courtroom/scene.ts`, which the page itself imports with `await import()`;
  the scene does `await import('three')`. The page chunk (32 KB, 12 KB gzip) renders the seat list and panel
  at once while the 3D chunks load (three core and renderer about 190 KB gzip, OrbitControls, RoomEnvironment
  and BufferGeometryUtils about 10 KB gzip). `perf.spec.ts` still confirms the map never requests three.js.
  Without WebGL, three.js is never requested (tested).
- Render on demand: frames are drawn only while the camera flies, the reader drags, controls are damping,
  or something changed. The loop stops while the tab is hidden (`visibilitychange`) or the canvas is off
  screen (`IntersectionObserver`).
- Device pixel ratio is capped at 2 (1.5 on coarse-pointer devices). Shadows (one directional light) are
  off on coarse-pointer devices.
- Route change disposes everything: animation frame, observers and listeners, controls, geometries,
  materials (including the highlight variants), textures, the environment map, the renderer and its context
  (`forceContextLoss`), the canvas and the labels (tested by leaving and coming back).
- WebGL context loss switches to the floor plan (tested with `WEBGL_lose_context`).
- `preserveDrawingBuffer` is on only under automation (`navigator.webdriver`), for screenshots.
- Time to a ready scene in headless Chromium with software GL (SwiftShader), served locally: 2.5 to 3.5 s.

## Tests

`CI=1 E2E_PORT=4205 npx playwright test tests/e2e/courtroom.spec.ts --trace off`: 23 passed, 1 skipped by
design (the bottom-sheet test runs on mobile only). With `smoke.spec.ts` and `perf.spec.ts`: 55 passed,
3 skipped by design.

Every expected number in the spec is computed from `public/data/` at test time. The spec covers: the room
renders and paints pixels, three.js loads on this route, DPR cap; choosing a seat from the list (flight,
URL, panel, national figures and sources); district figures, ranks, derived chips, district switching,
population and places; keyboard (arrows, Home, End, Enter focus, Escape return); picking by label and by
clicking the furniture (raycast); reduced motion cuts; no-WebGL fallback (plan, list, picker, three.js not
requested); context loss; `?webgl=0`; disposal and rebuild on route change; dark mode and a runtime theme
switch; the mobile bottom sheet (geometry, expand, close, focus return, no horizontal scroll). The geometry check
waits for the sheet's 420 ms slide-in to end before measuring (third recheck, Nov 27: one full run measured it
167 ms in, 8.76 px short of the bottom).

Screenshots (`tests/e2e/__screenshots__/{desktop,mobile}/`): `courtroom-room`, `courtroom-seat-jury`,
`courtroom-district-gallery`, `courtroom-fallback`, `courtroom-dark-lectern`, and on mobile
`courtroom-room-full` and `courtroom-sheet`. With the sheet open on mobile they are viewport captures,
because a full-page capture paints the fixed sheet and sticky header mid-page. All were reviewed.

## Gaps (`data/gaps/courtroom.json`)

- `courtroom_defense_counsel_not_in_data`: no measure of defense representation in any lane.
- `courtroom_reporter_not_in_data`: no data on court reporting.

## Not checked

- Real GPUs and real phones: everything was rendered with SwiftShader in headless Chromium. Frame rate,
  battery use and the look on a real display were not measured.
- Safari and Firefox were not run (the Playwright projects are Chromium only).
- Screen readers were not run; ARIA was checked by test and by reading the markup.
- The role copy for each seat is written from well-established federal practice (Fed. R. Crim. P. 23 and
  53, Fed. R. Civ. P. 48, 28 U.S.C. § 753, the Criminal Justice Act, the Jury Selection and Service Act), not
  from a source file in the atlas. The copy audit (`docs/audits/copy_audit.md`) checked it against the rule and
  statute texts: the jury line now says "normally 12", and an unsupported line about the party with the burden of
  proof sitting nearest the jury was replaced.
- `make docs` was not run, so `DATA_GAPS.md` does not yet list this lane's gaps.
