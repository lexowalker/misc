# I'll Never Love Again

A moderately slow blues ballad built around an extended Les Paul solo. The solo
moves between aching slow sections and virtuosic fast passages, then brings both
back in a crescendo before resolving. The song is the quintessential "loved and
lost" tune.

Lyrics and the guitar composition are written by us; AI audio models are used
for the vocal, band and production around them.

## Contents

- [`lyric-inspiration.md`](lyric-inspiration.md): the specific passages
  from each literary and musical reference, what to take from each, and where
  each fits in the song.
- [`reference-profile.md`](reference-profile.md): abstract data from the
  musical references (form, harmony, density and register curves, vibrato)
  and the design rules that come from it. No melodies.
- [`renditions/`](renditions/): five two-minute MIDI sketches of the song, each
  in a different direction. [`renditions/NOTES.md`](renditions/NOTES.md) describes
  each one and gives the self-check results.
- [`song/`](song/): the full song (4:40) as MIDI, with
  [`song/LYRICS.md`](song/LYRICS.md) (the lyric and how it sits on the music) and
  [`song/NOTES.md`](song/NOTES.md) (sections, self-check). `gen/song.py` is its score.
- `gen/`, `generate.py`: the composition. `gen/pieces.py` holds the five scores
  as text; `gen/engine.py` turns them into MIDI with an expressive lead guitar
  (bends, vibrato, slides, swells) and a generated band.
- `selfcheck.py`: data checks (duration, solo density, chord tones, range,
  playability, originality). It writes `renditions/NOTES.md`.
- `render.py`: MIDI to MP3 with FluidSynth and ffmpeg.
- `page.py`, `song_page.py`: build the one-file listening pages for the renditions and the full song.
- `analysis/`: the scripts that made the reference profile.
- `prompts/`: the briefs for this work.

## Build

```bash
pip install mido numpy soundfile
python3 generate.py          # writes renditions/*.mid and song/*.mid (deterministic)
python3 selfcheck.py         # checks the renditions and writes renditions/NOTES.md
python3 selfcheck.py --song  # checks the full song and writes song/NOTES.md
```

To make audio you also need `fluidsynth`, `ffmpeg` and a General MIDI
soundfont (`fluid-soundfont-gm` on Debian or Ubuntu; set `SOUNDFONT` for another):

```bash
python3 render.py        # writes renditions/*.mp3 and song/*.mp3 (not in git)
python3 selfcheck.py     # run again to add the MP3 lengths (and with --song)
```

The lead guitar track uses a pitch-bend range of ±12 semitones. The files set
it with RPN 0. Set it by hand if your instrument ignores RPN.

## Reference files

The reference score and recordings are copyrighted. They are private study
copies in `references/`, which git ignores. Never commit them. The originality
check and the `analysis/` scripts need them; everything else runs without them
(the originality check then reports "not run").

`analysis/analyze_audio.py` also needs `librosa`, `basic-pitch` and `onnxruntime`.

## Musical references

- Gary Moore: "Still Got the Blues", "Parisienne Walkways" (tone, phrasing,
  harmony). These are described in prompts, never named or uploaded.
