# Death Over Your Left Shoulder

A 1:54 short (plus 2 s of black) set on a Sonora highway at night in 1966. Carlos, driving a cream Chevy II Nova, is followed by a black Ford Galaxie that closes in, runs him off the road and then vanishes. He is left alone on the highway with Don Juan's words: "Death is always over your left shoulder."

`death_over_your_left_shoulder.mp4` is the first cut: 1920×824, 24 fps, 1:56, stereo, about −16 LUFS.

## What's here

| Path | Contents |
|---|---|
| `death_over_your_left_shoulder.mp4` | The master (H.264 at 6 Mbps, AAC 256k) |
| `prod/edit.py` | The whole edit and mix. `EDL` sets each shot's source clip, in point and length; `MIX` places every sound layer with its start time, gain and fades. |
| `prod/video/v1/` | First pass of all 18 shots: Seedance 2.5 image-to-video, 720p, 21:9, each started from its approved storyboard frame |
| `prod/video/v2/` | Retakes: shots 1, 2 and 3 (the pursuer had appeared too early) and `shot11b`, the hands insert |
| `prod/audio/raw/` | ElevenLabs audio: dialogue (two takes of each line), 18 sound-effect layers and the radio bolero. `../superseded/` holds two layers that came back almost silent. |
| `stills/` | The approved storyboard opening frame for each shot (`sh01.jpg` to `sh18.jpg`) |
| `sheets/` | HD reference sheets: Carlos, the Nova, the Galaxie and the environment |
| `shot03_*.mp4` | The earlier Kling v4 vs Seedance 2.5 model test |

## The edit

Shots are cut to the shot list's timecodes, scaled from 1470×630 to 1920×824, and given one shared grain pass so they read as one film. Shot 11 is two inserts: the foot on the accelerator (1.4 s), then the hands on the wheel (1.6 s). The cut to black lands as Carlos's head is still turning.

Sound is built in layers rather than taken from the video model:
- **Beds:** desert wind (louder after the crash), the Nova's interior engine, and a 1960s bolero on a band-limited "AM radio" chain that is drowned out by static as the Galaxie closes in.
- **Hits:** pursuer roar, gasp, floored engine, tire screeches, gravel skid, sputter to idle, cooling-engine ticks, door, footsteps.
- **Voices:** Carlos (ElevenLabs "Luis Carlos", a Northern Mexican accent) and Don Juan, a dry, close whisper. The beds dip 10 dB under Don Juan's line.
- **Ending:** a wind gust that builds into a hollow whistle, then a hard cut to silence with the picture.

Every source is first level-matched to −20 dB, so the gains in `MIX` are relative and easy to rebalance.

## Rebuild

```sh
cd prod
python3 edit.py            # full rebuild, about 8 minutes
python3 edit.py --audio    # remix only, reusing the cut picture
```

Requires ffmpeg. The generation nodes remain in Flora (project "Highway Film": production, retake and storyboard frames) and in the ElevenLabs flow "Death Over Your Left Shoulder · Sound", so any shot or sound can be regenerated from the same inputs.

## Model test (earlier)

`shot03_kling-v4.mp4` and `shot03_seedance-2.5.mp4` are the side-by-side test that chose Seedance 2.5: it held Carlos's identity and performance better than Kling v4.
