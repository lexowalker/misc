# RefDAW

A minimal, local DAW built around one workflow:

1. **Drop in a reference** (an audio file, plus a MusicXML or MIDI score if you have one). It becomes editable tracks: one per voice or instrument, with tempo, key, chords and sections detected.
2. **Edit the music** note by note in a piano roll, or ask the assistant by typing or speaking ("move this to E minor", "keep the soprano within one octave", "subtle variations on part B"). You can also **hum a melody** into a track.
3. **Export and generate:** fit the piece to an exact length (e.g. 2:47), render a WAV reference, MIDI or MusicXML, and send it to an audio-generation model (ElevenLabs Music, ACE-Step on fal.ai, or Suno by manual upload).

It runs as a small Python server with a browser front end. Nothing is uploaded anywhere except the API calls you trigger.

## Setup (macOS, Apple Silicon or Intel)

```bash
cd refdaw
./setup.sh            # installs uv if needed, then Python 3.11 + dependencies into .venv
```

```bash
./run.sh              # starts http://localhost:8765 and opens it
```

Use Chrome or Safari; both have built-in speech recognition for voice commands. Allow microphone access when you first hum or speak.

`./setup.sh --stems` also installs Demucs (PyTorch, ~1 GB) for the "Separate stems first" import option. That option helps with band or pop mixes, where drums, bass and vocals should be split before transcription.

### API keys (`refdaw/.env`)

| Key | What it unlocks | Needed? |
|---|---|---|
| `ANTHROPIC_API_KEY` | The assistant (text and voice editing) | Yes, for the assistant |
| `ELEVENLABS_API_KEY` | Eleven Music generation, and server-side speech-to-text in browsers without it | Optional |
| `FAL_KEY` | ACE-Step audio-to-audio generation (your rendered mix as the reference) | Optional |

Transcription, humming, editing, playback and export need no keys. They all run locally.

Instrument samples (General MIDI soundfonts) download on first use from `gleitz.github.io/midi-js-soundfonts` and are cached in `refdaw/cache/`. Offline, a simple built-in synth plays instead.

## Using it

**Import:** drag an audio file and/or a score anywhere on the window, or use *Import*.
- *Ensemble* picks how the transcribed notes are split into tracks (sax quartet, string quartet, strings, piano, organ, orchestra, band, generic). *Auto* guesses from the file name.
- *Audio only:* [Basic Pitch](https://github.com/spotify/basic-pitch) transcribes the polyphony, beat tracking builds a tempo map so the notes line up with the recording, and notes are split into voices by range. Expect a solid sketch that needs some cleanup, not a perfect score.
- *With a score (MusicXML, MXL or MIDI):* the score's notes are used and aligned to the recording (chroma + dynamic time warping), so the original audio still plays in sync under the tracks. This is far more accurate, and the recommended route when a score exists.

**Transport:** Space plays and pauses, Enter stops, Home jumps to the start. Click the ruler to move the playhead and drag it to select a range. Alt-click a section to select it. L loops the range, K toggles the metronome.

**Piano roll:** double-click adds or deletes a note. Drag to move, drag the right edge to resize. Shift-click or drag a box to select. Arrows nudge (Shift+↑/↓ moves by an octave). ⌘C / ⌘V paste at the playhead, ⌘D duplicates, Delete removes, Q quantizes, D switches to the draw tool. ⌘-scroll zooms, F fits the song to the window.

**Header:** BPM, key (change it and choose whether the notes move too), and *Length → target*. **Fit** changes the tempo so the piece ends exactly at the target length.

**Assistant:** it sees the tracks, key, tempo, sections, chords and your current selection (track, ruler range or selected notes). It edits with exact tools (transpose, change key or mode, limit range, invert, retrograde, quantize, humanize, fit length, copy, stretch, vary, set instrument, …) and writes new notes for creative requests. Each request is one undo step.

**Hum:** choose a target (a new track or an existing one, in replace or layer mode), then press *Record hum*. A one-bar count-in plays, then playback starts from the playhead. Hum, then press stop. The pitches are tracked with pYIN, snapped to the key and grid if you want, and dropped in at the right beat.

**Export:** WAV mix, one WAV per track, MIDI (with the tempo map), MusicXML (quantized to sixteenths), or project JSON.

**Generate:**
- *ElevenLabs Music:* style prompt + instruments + exact length. With *Follow my sections*, the section lengths come from your arrangement. It doesn't take reference audio, so it matches structure, length and style, not your notes.
- *ACE-Step (fal.ai):* renders your mix and uses it as the reference audio, with your style tags and length. This keeps the most of your edited melody and harmony.
- *Suno:* there's no public API. RefDAW renders `mix.wav` and writes a prompt to paste into Suno's *Upload audio → Cover*. Suno will reject a recognisable commercial recording, which is one reason to upload your own edited render instead.

Generated files are saved in `refdaw/projects/<id>/` and listed in the Generate dialog.

The ElevenLabs and fal request formats were written from their documentation as of mid-2026. If a provider has changed a model id or field, set it under *Advanced* in the dialog or in `.env` (`REFDAW_ELEVEN_MODEL`, `REFDAW_FAL_ENDPOINT`). The fal "extra args" field merges raw JSON into the request.

## Layout

```
server/
  app.py         FastAPI routes, background jobs, MIDI/MusicXML export, soundfont cache
  core.py        project model, tempo map, GM instruments, key/chord detection, voice splitting
  transcribe.py  audio → notes (Basic Pitch on ONNX Runtime), beats, sections, optional Demucs
  score.py       MusicXML/MIDI import and alignment to the recording
  edits.py       deterministic editing operations (shared by the UI and the assistant)
  agent.py       Claude tool-use loop over the editing operations
  hum.py         hummed melody → notes
  generate.py    ElevenLabs / fal ACE-Step / Suno hand-off
web/             no-build front end (vanilla JS modules, Web Audio, canvas)
projects/        your projects (git-ignored)
```

Projects are plain JSON: notes are `{p: MIDI pitch, s: start beat, d: duration in beats, v: velocity}`, and `tempoMap` holds `[beat, seconds]` anchors from the reference recording.

## Notes on accuracy

- Polyphonic transcription of dense acoustic ensembles is the hardest case. Expect wrong octaves, merged or split repeated notes, and occasional ghost notes. Voice splitting is a heuristic based on pitch range and voice leading. A score import fixes all of this.
- Instrument recognition is not automatic. The ensemble preset sets the starting instruments, and you or the assistant can change any track's instrument.
- After you change the tempo or length, the original recording no longer lines up and is marked "out of sync" (the waveform greys out). The tracks themselves are unaffected.
