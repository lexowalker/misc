# Where Are You, Beyond My Seeing? — a music video

`beyond-my-seeing.mp4` is 1920×1080 at 24 fps and runs 7:18, the full length of the song. Every frame is drawn in code: GLSL shaders for light, sea, sky and space, and Canvas2D for the silhouettes. There's no stock footage and no generated imagery.

## The idea

When the sun is low over the sea, its reflection makes a road of gold across the water, and that road always runs to whoever is looking. Everyone on a beach sees it ending at their own feet. The film is built on that fact, because it is the song's last line made physical: *perhaps the One I'm seeking has been searching, too, for me.*

The film opens on a single point of light in the dark. It turns out to be the morning star over the sea, and then the sunrise draws its path of gold to a child on a rock. A small light kindles in his chest, which is his question, and he carries it through his whole life. At the end he is an old man sitting on the same rock, in the same path of gold. Others stand along the shore, and each of them has a path of their own: the sea shader computes the glitter for several viewpoints at once. Then the camera turns around to the sun's side and pulls away until only the light in his chest remains. It is the same point of light the film began with, now seen from the other side.

The song's words run through the whole film as captions (`lyrics.js`) so viewers can follow them. Each line fades in just before it is sung and holds until the next. They are set in Cormorant Garamond italic; the final chorus switches to tracked capitals as the lyric sheet writes it, and "STILL!" lands large on the orchestral blast after the silence. Where the bottom of the frame holds a figure or bright water, the lines move to the top, and a soft scrim keeps them legible over bright light.

## Shots, synced to the vocal

Section starts come from word-level timings (faster-whisper over the track) and from the song's loudness envelope. The film cuts to black on the song's silences at 4:52, 4:56, 6:04, 6:08 and 6:33.7.

| Time | Section | Image |
|---|---|---|
| 0:00 | Intro, piano | A single point of light; the orchestral swell reveals the pre-dawn sea; title |
| 0:17 | Verse 1 | Sunrise; the path of gold reaches a child on a rock; his profile; an iris holding the dawn; he walks inland and grows up; a light kindles in his breast |
| 0:52 | Verse 2, strings | Ancient skylines in golden haze; a sage under a tree; a dying hand and a light going up; the silent by still water; the learned on temple steps; the climb; a doorway on the summit that opens onto the night; an endless fall through nested doorways, each onto another world; a plain of a thousand lit doorways |
| 1:33 | Pre-chorus | A far light calls and his light answers; night falls; the stars remember a face |
| 1:51 | Chorus 1 | Arms open under the Milky Way; his face against the galaxy; we fall into the pupil of his eye; an endless road under wheeling star trails that slow and freeze on "the stars themselves stand still"; darkness and his steady light |
| 2:28 | Instrumental | One walk through the turning seasons (autumn, snow, blossom, summer night); he rests under a tree and the stars swirl into a dream |
| 2:48 | Verse 3 | A sea made of light under a giant planet; a raindrop holding a thousand suns; the halls of memory; faces holding worlds; a mote that unfurls into a galaxy |
| 3:27 | Pre-chorus 2 | The aurora as a veil over still water; he reaches; it recedes; his heart's light grows until it swallows the world |
| 3:43 | Chorus 2 | Aurora and Milky Way over the ridges; his face beneath the veil; a river of lanterns, a thousand lives winding into the mountains; their lights lift off and become stars |
| 4:17 | Bridge, piano and cello | A dark room; certainty kept as a flame in a crystal vessel; the shutters burst open on the dawn; the crystal cracks, shatters, and its shards become birds of light that fly out the window |
| 4:48 | Rising | On a cliff in the wind he lets the staff fall and the wind takes his coat; on the big entrance he dissolves into light from the head down; his heart opens like a flower of light |
| 5:20 | Final chorus | Flight through nebulae and a galaxy; mountains fall to dust; the sea rises into the sky; a million worlds; soaring over a sea of clouds toward the sun |
| 6:01 | Stop-time | The old man before a rising galaxy (black on each silence); he steps forward, arms open |
| 6:23 | "I WILL SEEK YOU—" | The converging light |
| 6:34 | "STILL!" | Silence, then the sun bursts over the sea |
| 6:40 | Outro | The old man on the child's rock, in the path of gold; the shore of watchers, each with their own path; the view from the sun's side, pulling away to a single point of light |

## How it's built

| File | Role |
|---|---|
| `engine.js` | WebGL2 HDR pipeline: shot shaders render into half-float targets, then point glows, crossfades, god rays (radial blur of a sky mask), dual-filter bloom, ACES tone mapping, per-shot grade, vignette, grain and text. |
| `lib.js` | Shared GLSL: hashes, value noise, fbm, ridged noise, star fields, the Milky Way, sky scattering, sea waves. |
| `sh_sea.js` | The sea. Microfacet reflection of the sun gives the glitter path; stochastic facets twinkle near the camera and blend into a smooth lobe in the distance. Paths are also computed for other watchers. It also has the dream sea of light, aurora and a giant planet. |
| `sh_land.js` | Layered landscapes: sky, sun, clouds, stars, star trails, Milky Way, aurora, ridgelines with valley mist, silhouette layers with rim light, a dissolve, and mountains sinking into dust. |
| `sh_misc.js`, `sh_dream.js`, `sh_cosmos.js` | The eye, doorway portals, the infinite fall through doors, the raindrop lens, the ray-cast halls of memory, faces holding worlds, the galaxy, the crystal room, the nebula flight, the planets, the sea of clouds and the converging light. |
| `kit.js` | The seeker: an original silhouette rig (child, man, elder) with IK walking, sitting, kneeling, open arms, staff, wind in the coat, a profile head, and a back view. Also birds, trees, rocks, cities and arches. |
| `act1.js` … `act8.js` | The shots, timed to the song. |
| `main.js` | The timeline: which shot or shots are live at time `t`, crossfades, fades to black on silences, and timed words. |
| `render.mjs` | Playwright with SwiftShader. Captures frames, stills and contact sheets. |
| `tools/analyze.py`, `audio-env.js` | Per-frame loudness envelopes of the song (subtle audio reactivity: the chest light, glows). |
| `tools/align.py`, `lyrics.js` | The lyric sheet aligned to faster-whisper word timestamps; each line's display window. The held "I WILL SEEK YOU—" and "STILL!" are placed by the music (the held note, the silence at 6:33.7, the blast). |
| `fonts/` | Cormorant Garamond (SIL OFL). |

## Rebuild

```sh
npm i playwright                    # or symlink a global install into node_modules/
node render.mjs frames 3            # ~2.5 h on 4 cores; resumable, skips frames already on disk
sh build.sh                         # master + repo copy (needs audio/song.m4a)
```

`node render.mjs stills 23.5 408` writes single frames (`build/still_<t>.jpg`). `node render.mjs sheet 0 438 3` writes a frame every 3 s to `build/sheet/`.
