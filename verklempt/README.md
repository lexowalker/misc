# Verklempt: a 96-second vertical explainer

`verklempt.mp4` is 1080×1920 (9:16), 30 fps, 95.8 s long, with narration, burned-in captions, a klezmer-flavoured music bed and sound effects.

**Contents:** a hook (a lump in the throat, stinging eyes, a sentence that gets squeezed shut) → the word and how to say it (fer·KLEMPT) → the definition, and the emotions it covers besides sadness → etymology (German *klemmen* "to pinch, clamp" → *verklemmen* "to jam tight" → *verklemmt* "jammed, squeezed" → Yiddish *farklemt* פֿאַרקלעמט "choked with emotion" → American English *verklempt*) → the twist: in modern German, *verklemmt* means "uptight, inhibited" → how *Saturday Night Live*'s "Coffee Talk" sketches made it famous in the early 1990s → three example sentences → similar words → outro.

## How it's built

| File | Role |
|---|---|
| `narration.py` | Script and voiceover (Kokoro TTS, `af_heart` voice, with IPA overrides for the English, German and Yiddish forms). Writes `build/voice.wav` and `build/timeline.{json,js}` with the start and end time of every line. |
| `index.html`, `scenes.js` | All visuals. `render(t)` draws the frame for second `t`, and every cue is keyed to the narration timeline. |
| `render.mjs` | Playwright captures each frame to `build/frames/` and writes the sound-effect cue list to `build/sfx.json`. |
| `audio.py` | Synthesizes a waltz in D freygish (bass, accordion-like chords, a clarinet-like line) and the sound effects, then mixes them under the voice into `build/mix.wav`. |
| `fonts/` | Fraunces, Inter, JetBrains Mono and the Hebrew subset of Frank Ruhl Libre (all SIL OFL), from Google Fonts. |

## Rebuild

```sh
pip install kokoro-onnx soundfile numpy
# model files: kokoro-v1.0.onnx + voices-v1.0.bin from
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
python3 narration.py path/to/model_dir
node render.mjs frames 30 6
python3 audio.py
ffmpeg -framerate 30 -i build/frames/%05d.jpg -i build/mix.wav -c:v libx264 -preset slow -crf 20 -tune animation \
  -pix_fmt yuv420p -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -shortest -movflags +faststart verklempt.mp4
```
