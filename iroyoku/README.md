# Iroyoku 色欲: a 5-minute animated yokai film

`iroyoku.mp4` is 1920×1080, 24 fps, 5:00 long (55 MB). It's wordless, with on-screen captions and a synthesized score. The film shows lust as a yokai living inside one man's mind and follows it through a single day in Manhattan. It borrows from Edo-period yokai picture scrolls (*emakimono*, *hyakki yagyō emaki*), and each new spirit gets a hanging-scroll "database card" in the style of the Nichibun yokai image collection. The look aims at a Ghibli-ish painted city.

**The cast (yokai as parts of the psyche)**

| Yokai | Plays | Design |
|---|---|---|
| 色欲 Iroyoku | lust | A white kitsune mask with gold slit eyes, a mane of fox-fire and up to nine tails. Its tails become red threads that pull at his gaze. Under the mask it is a small, scared fox kit. |
| 提灯お化け Chōchin-obake | attention | A one-eyed paper lantern that dims when he's distracted and blazes when he's present. |
| 天狗 Tengu | will | Stern, small, and easily tired. It whacks the lust yokai with its leaf fan, then falls asleep. |
| 獏 Baku | dreams | Eats his dreams at dawn and comes back at night. |
| 付喪神 Tsukumogami | the screen | His phone, an object that learned to want. |
| 一反木綿 Ittan-momen | shame | Arrives after a lapse and wraps around his shoulders. Shame feeds lust; it doesn't starve it. |
| 木霊 Kodama | stillness | Tree spirits that only appear when he is quiet. |
| 百鬼夜行 Hyakki yagyō | every hunger in the city | The night parade: oni, kappa, nopperabō, hitotsume-kozō, nekomata, nurikabe, a tanuki drummer, rokurokubi and kasa-obake. |

Other commuters carry their own small yokai too: a kappa napping on a newspaper reader, a kodama in a kid's backpack, a worry-cloth on a businessman.

**Scenes:** title scroll unrolls → dawn in the apartment (the baku, the phone, the lantern's bonk) → the 6 train (the perfume ad, the tengu) → Midtown on foot (billboards, a passer-by, the rain and a kasa-obake) → the office (the screen, two lost hours, shame) → Central Park (breath, kodama, looking straight at it: the mask slips) → Times Square at night (the parade, the nine-tailed giant, the bow, the threads turning gold, the ember becoming a fox kit and then a hearth-fire in the lantern) → home, and the scroll rolls shut.

## How it's built

There's no video generation. Every frame is drawn procedurally on an HTML canvas.

| File | Role |
|---|---|
| `kit.js` | Drawing helpers: easing, noise, ink-outlined shapes, washi paper and grain textures, yokai cards, captions, whispers. |
| `chars.js` | The human rig: a side view with a walk cycle, IK arms, sitting and bowing; a front close-up face; a back view; crowd styles. |
| `yokai.js` | All the yokai, drawn as vectors. |
| `places.js` | Painted backgrounds (apartment, subway car, a parallax Midtown street, office, Central Park, Times Square), built once into offscreen canvases. Skies, weather and light stay live. |
| `scenes.js` | The film: scene timeline, shots, staging, captions and sound cues. `render(t)` paints the frame for second `t`. Characters animate "on twos" (12 drawings a second). |
| `render.mjs` | Playwright captures each frame to `build/frames/` and writes `build/cues.json` (scene times and sound-effect cues). |
| `audio.py` | Synthesizes the score and sound design from numpy and scipy. Instruments: additive koto, buzzing shamisen, breathy shakuhachi, taiko, kane, suzu bells, pads. Ambience: city, subway, rain, crowd. The music uses the miyako-bushi (In) and yo scales, and lust has its own descending shamisen motif. Writes `build/mix.wav`. |
| `fonts/` | Shippori Mincho (subset to the film's kanji) and Cormorant Garamond, both SIL OFL. |

## Rebuild

```sh
pip install numpy scipy soundfile
npm i playwright            # or symlink a global install into node_modules/
node render.mjs frames 24 4 # ~45 min on 4 cores
python3 audio.py
ffmpeg -framerate 24 -i build/frames/%05d.jpg -i build/mix.wav -c:v libx264 -preset slow -crf 25 -tune animation \
  -pix_fmt yuv420p -af loudnorm=I=-16:TP=-1.5:LRA=14 -c:a aac -b:a 192k -shortest -movflags +faststart iroyoku.mp4
```

`node render.mjs stills 75 236` writes single frames (`build/still_<t>.png`) for checking a moment.
