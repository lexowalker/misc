# hardware-concepts

A single-page decision file for a solo hardware founder weighing two household tool concepts (US launch, USD):

- **Modular Power Toolkit**: a flat right-angle hex driver head (D-head) on a shared 12 V power base, plus an angled hammer head (H-head) study.
- **Home Lift & Mover**: a thin powered lift platform (P-1) that slides under furniture, lifts it, and steers it through a home.

Each tab opens with a large interactive drawing and a parts key. The drawing has assembled, exploded and in-use views, plus a section or plan view. Below the drawing come the engineering verdict, prototype stages, costs, alternatives, partners and standards, a recommendation, and expandable evidence and calculations.

Open `index.html` in a browser. It is self-contained apart from Google Fonts.

## Build

```sh
node build.mjs            # writes index.html and dist/artifact.html (body-only variant for hosting)
NODE_PATH=$(npm root -g) node test/check.cjs   # optional: Playwright checks at desktop and phone widths
```

Node 20+ is required. The checks need Playwright with Chromium.

The plan-view path search takes about 40 s and is cached in `dist/turn-cache.json`. The cache is keyed by the item and route dimensions, so changing either re-runs the search.

## Where to edit

| What | File |
|---|---|
| Every dimension, target and calculation (stack height, gear stress, lift geometry, tipping, thresholds) | `content/model.mjs` |
| Part IDs, names, one-sentence functions (shared by drawings, key and BOM) | `content/parts.mjs` |
| BOMs, labour, 100 / 1,000-unit runs, competitors, standards, source URLs | `content/business.mjs` |
| Prose: verdicts, provisional choices, prototype stages, partners, recommendation | `content/text.mjs` |
| Drawings | `figures/driver.mjs`, `figures/mover.mjs`, helpers in `figures/geom.mjs` |
| Interaction (views, selection, mechanisms, readouts) | `src/app.js` |
| Look | `src/styles.css` |

Totals are computed from the rows at build time, so tables always reconcile. Readouts are computed in the browser from the same numbers that move the parts.

## Drawings

The isometric solids use the [Anatomy](https://github.com/wheresryan22/anatomy) kit (MIT, vendored at `vendor/anatomy/`, commit `1482e84`, 2026-10-18).

Following its raptor-engine example, parts separate along their assembly axes. Following its dial-indicator example, a control drives the motion, here the lift slider and approach slider.

This project adds:
- convex prisms along any axis
- ID callouts on a top layer that travels with the parts
- functional colour accents
- dimensioned 2D sections, which the Anatomy style otherwise avoids but this brief asks for

The figures were checked by screenshot review and `test/check.cjs`. They have not been run through Anatomy's own geometry audit.

## Evidence labels

- **sourced**: a published spec or code.
- **listing**: a US retail price seen in search results on 2026-11-15. The pages were not opened, so re-check before quoting.
- **target**: a proposed, unverified value.
- **measure**: a placeholder that must be measured.
- **calc**: derived on the page.
- **estimate**: an estimate.

The manufacturer pages for Milwaukee and Bosch could not be loaded during research. Their specs come from retailer listings.

## Explainer video

`video/home-lift-mover-explainer.mp4` is a 3-minute narrated explainer for the mover. The voiceover (`video/voiceover.mp3`) was generated with ElevenLabs (voice: Ryan, American documentary narrator). `video/voiceover-words.json` is its word-timestamp transcript, which sets each scene's length, the cue points that pin animations to the words, and the subtitles. Delete those two files to get the silent, captioned cut. To rebuild:

```sh
node build.mjs && node video/build-video.mjs && NODE_PATH=$(npm root -g) node video/render.cjs
```

The scenes are in `video/scenes.js`. `video/explainer.html` plays the animation live in a browser.
