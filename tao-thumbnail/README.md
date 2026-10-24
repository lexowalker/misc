# tao-thumbnail

A 1080×1920 (9:16) thumbnail: the cover of *The Essential Tao* (trans. Thomas
Cleary) as the background, with a portrait composited in the foreground.

- `src/cover.jpg` — book cover (background)
- `src/portrait.jpg` — source portrait
- `out/thumbnail.jpg` — rendered result

## Build

```sh
pip install rembg pillow numpy onnxruntime
python3 make_thumbnail.py src/cover.jpg src/portrait.jpg out/thumbnail.jpg
```

The script moves the cover's title card up to leave room for the subject.
It cuts the subject out with rembg (`birefnet-portrait`, a ~1 GB model
downloaded on first run), gives the figure a warm grade, and mutes the blue
shirt so it matches the sepia cover. Last, it adds a soft halo, a drop shadow
and a bottom vignette. `COVER_SHIFT` and `FIGURE_TOP` at the top of the script
set the layout.
