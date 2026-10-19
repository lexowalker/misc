# Punctilious: a 95-second vertical explainer

`punctilious.mp4` is 1080×1920 (9:16), 30 fps, 94.7 s long, with narration, a music bed and sound effects.

**Contents:** a hook (crooked frame, missing comma, dotless i) → the word and how to say it → the definition → etymology (Latin *pungere* → *punctum* → Italian *puntiglio* / Spanish *puntillo* → English *punctilio*, 1590s → *punctilious*, 1630s) → related words (punctual, punctuation, puncture, pungent) → three example sentences → similar and opposite words, and how it differs from *punctual* → outro.

## How it's built

| File | Role |
|---|---|
| `narration.py` | Script and voiceover (Kokoro TTS, `af_heart` voice). Writes `build/voice.wav` and `build/timeline.{json,js}` with the start and end time of every line. |
| `index.html`, `scenes.js` | All visuals. `render(t)` draws the frame for second `t`, and every cue is keyed to the narration timeline. |
| `render.mjs` | Playwright captures each frame to `build/frames/` and writes the sound-effect cue list to `build/sfx.json`. |
| `audio.py` | Synthesizes a marimba music bed and the sound effects, then mixes them under the voice into `build/mix.wav`. |
| `fonts/` | Fraunces, Inter and JetBrains Mono (SIL OFL), from Google Fonts. |

## Rebuild

```sh
pip install kokoro-onnx soundfile numpy
# model files: kokoro-v1.0.onnx + voices-v1.0.bin from
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
python3 narration.py path/to/model_dir
node render.mjs frames 30 4
python3 audio.py
ffmpeg -framerate 30 -i build/frames/%05d.jpg -i build/mix.wav -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k -shortest -movflags +faststart punctilious.mp4
```
