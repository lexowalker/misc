# tao-thumbnail

A 1080×1920 (9:16) thumbnail: the cover of *The Essential Tao* (trans. Thomas
Cleary) as the background, with a portrait composited in the foreground.

- `src/cover.jpg` — book cover (background)
- `src/portrait.jpg` — source portrait
- `src/portrait-indoor.jpg`, `src/portrait-outdoor.jpg`, `src/portrait-bw.jpg` — portraits for the variants
- `out/thumbnail.jpg` — rendered result (blue shirt, under the card)
- `out/thumbnail-indoor.jpg` — big, golden candlelit grade, over the lower card
- `out/thumbnail-outdoor.jpg` — close-up bleeding off the right, olive split tone, backlit hair
- `src/user-edit.jpg` — hand-edited layout (B&W portrait colorized, over the card)
- `out/thumbnail-warm.jpg` — `user-edit.jpg` with only the figure regraded (warm skin, golden key light, shaded shirt); cover untouched
- `out/thumbnail-ink.jpg` — B&W portrait multiplied into the painting like brush ink, on a cream mist

## Build

```sh
pip install rembg pillow numpy onnxruntime
python3 make_thumbnail.py src/cover.jpg src/portrait.jpg out/thumbnail.jpg
python3 variants.py   # the three variants; caches cutouts in build/
python3 warm_up.py src/user-edit.jpg out/thumbnail-warm.jpg
```

The script moves the cover's title card up to leave room for the subject.
It cuts the subject out with rembg (`birefnet-portrait`, a ~1 GB model
downloaded on first run), gives the figure a warm grade, and mutes the blue
shirt so it matches the sepia cover. Last, it adds a soft halo, a drop shadow
and a bottom vignette. `COVER_SHIFT` and `FIGURE_TOP` at the top of the script
set the layout.
