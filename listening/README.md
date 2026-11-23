# Listening

A three-minute short film told one word at a time. A machine keeps a seed alive on a dead planet; long after it stops, something new learns to ask why. 228 spoken words, each with its own image in its own style, cut on the beat of a 120 BPM score that speeds up, stops, and opens out.

- Moodboard: https://claude.ai/artifact/PdV1mQRRg6XwL2FD9pxkCp
- Images: Flora project "Listening (one-word film)" (Seedream 5.5; Nano Banana 2.1 with two character references for the robot and the creature).
- Voice, score and sound effects: ElevenLabs flow "Listening (one-word film)" (voice "Steven - Deep Documentary Narrator", eleven_v4; eleven_music_v2_5; eleven_text_to_sound_v3).

## Files

| File | What it is |
|---|---|
| `words.py` | The script, as ten voice takes of single words. |
| `prompts.txt` | One image prompt per word (`{R}` robot, `{C}` creature). `prompts.json` is the expanded form. |
| `timeline.py` | The edit: every cue's start time on the beat grid. Writes `timeline.json`. |
| `split_voice.py` | Cuts each voice take into one clip per word at the pauses. |
| `build_audio.py` | Re-cuts the score to the film's structure, places the words, adds air, mixes. |
| `render.py` | Draws the picture: image, camera move, centred word, grain. |
| `build.sh` | Runs the whole build to `build/listening.mp4`. |
| `fetch_frames.py` | Re-downloads the frames from the Flora URLs in `runs/`. |
| `audio/` | Source voice takes, the two score takes (`score_a` is used) and sound effects. |
| `fonts/Fraunces.ttf` | The word's typeface (SIL Open Font License). |

## Build

```
pip install numpy scipy soundfile pillow opencv-python-headless
python3 fetch_frames.py      # frames are not in the repo
python3 split_voice.py
./build.sh
```

Needs `ffmpeg`. The frames and the finished film are not committed (too heavy); Flora URLs can expire, in which case the frames are still on the Flora canvas.
