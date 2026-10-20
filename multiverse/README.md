# The Multiverse: a 6½-minute animated explainer

`multiverse.mp4` is 1920×1080, 30 fps, 6:37 long, with narration, burned-in captions, an ambient music bed and sound effects. It walks through the ideas in Chapter 11, "The Multiverse," of David Deutsch's *The Beginning of Infinity* (2011).

**Chapters:** hook and title → 01 two identical worlds (fungibility, the bank-balance analogy) → 02 differentiation (red lamp / blue lamp, doppelgängers) → 03 waves of differentiation (spreading locally, no faster than light) → 04 interference (an animated Mach–Zehnder interferometer, with one path then blocked) → 05 decoherence (why worlds don't merge or communicate) → 06 measure (histories as a continuous fluid; probability as proportion) → 07 the shape of the multiverse (emergent quasi-universes, the uncertainty principle, entanglement) → 08 why believe it (Everett 1957, "shut up and calculate," hard-to-vary explanations, quantum computation) → outro.

## How it's built

| File | Role |
|---|---|
| `narration.py` | Script and voiceover (Kokoro TTS, `af_heart` voice). Writes `build/voice.wav` and `build/timeline.{json,js}`. |
| `index.html`, `scenes.js` | All visuals, drawn on one canvas. `render(t)` paints the frame for second `t`, and every cue is keyed to the narration timeline. |
| `render.mjs` | Playwright captures each frame to `build/frames/` and writes the sound-effect cues to `build/sfx.json`. |
| `audio.py` | Synthesizes the ambient pad and the sound effects, then mixes them under the voice into `build/mix.wav`. |
| `fonts/` | Fraunces, Inter and JetBrains Mono (SIL OFL). |

## Rebuild

```sh
pip install kokoro-onnx soundfile numpy
# model files: kokoro-v1.0.onnx + voices-v1.0.bin from
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
python3 narration.py path/to/model_dir
node render.mjs frames 30 4
python3 audio.py
ffmpeg -framerate 30 -i build/frames/%05d.jpg -i build/mix.wav -c:v libx264 -preset slow -crf 25 -tune animation \
  -pix_fmt yuv420p -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 160k -shortest -movflags +faststart multiverse.mp4
```
