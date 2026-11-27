# Twelve Strangers

An interactive, mobile-first history of trial by jury and of the idea of "a jury of your peers": from the circle of people who knew you, through Athens' lottery machines, the ordeal, Henry II's twelve, Magna Carta and Bushel's Case, to today's twelve strangers drawn at random in a big city.

The reader answers a jury summons, works through eleven chapters, and earns a seal at each of twelve interactive "exhibits" (a kleroterion, the vote on Socrates, an ordeal game, the Bushel's Case jury room, a Magna Carta decoder, a jury-size lab, a who-could-serve timeline, a sorting game, a three.js crowd that draws a jury, the vanishing trial, the scales, and a final quiz with a certificate).

Published as a claude.ai Artifact (link in the Master repo, `fun/twelve-strangers.md`).

## Layout

```
build.py          inlines src/ into index.html (the published page) and dev/preview.html
index.html        the built page, written without <html>/<head>/<body>: the Artifact host adds that skeleton
src/head.html     title, meta, Google Fonts
src/base.css      design tokens (light and dark) and shared components
src/body.html     all chapter text and the exhibit mount points
src/core.js       ticker, seals, objections, summons, widget host (TS.register / ctx)
src/widgets/      one .js and .css per exhibit
dev/check.cjs     Playwright smoke test: console errors, overflow, screenshots
```

## Build and check

```
python3 build.py                      # writes index.html and dev/preview.html
python3 build.py --harness strangers  # one widget alone: dev/harness-strangers.html
node dev/check.cjs dev/preview.html --shot /tmp/page.png [--theme dark] [--width 1280] [--full]
```

`check.cjs` needs Playwright (preinstalled in Claude cloud sessions). The page loads three.js r128 from cdnjs at run time; in a sandbox without that host, point `THREE_LOCAL` at a local `three.min.js` and the checker serves it in place of the CDN.

## Writing rules

Plain, short sentences; no em-dashes; speculation is labeled; every fact traces to the sources listed at the foot of the page.
