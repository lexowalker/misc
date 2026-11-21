You are composing the first MIDI sketches for an original song. Work in the repo folder `ill-never-love-again/`. Read `README.md` and `lyric-inspiration.md` there first.

## The aim (keep this at the centre of every decision)

"Moderately slow blues song featuring an extraordinary and substantial electric solo on a Les Paul. (Reference audio: Gary Moore's Still Got the Blues; Gary Moore's Parisienne Walkways; other beautiful and heartbreaking melodies of the loving and losing humans go through). The solo includes extraordinary virtuosity in its fast parts (shredding is ok) and hauntingly achy arcs and truly heartbreaking moments in its slow sections. These two seamlessly recapitulate each other in the crescendo leading into their resolution at the end. The song is called "I'll Never Love Again" and it's the quintessential loved and lost tune."

The emotional core: the title is a vow that the music keeps disproving. The singer says "never again" because they never stopped loving. The guitar says what the words cannot.

## Deliverable

Five distinct MIDI renditions of the song, each about 2 minutes (1:50 to 2:10). Render each one to audio. Publish one artifact page where I can listen to all five, read a short description of each, see section timestamps, and download the .mid files. I will listen and give feedback. Then we choose a direction.

## Reference assets

Google Drive folder: https://drive.google.com/drive/folders/13iFyxtcueQyqevoPIOTFm-0BVTMX3Glo

| File | Use |
|---|---|
| `still-got-the-blues-gary-moore.mxl` | Primary reference. MusicXML score with tab data. Parse this first (music21 or direct XML). |
| `still-got-the-blues-gary-moore-guitar-tab.pdf` | Backup only, if the MXL is unclear. |
| `GARY MOORE - Still got the blues --GUITAR SOLO - ISOLATED.mp3` | Isolated solo. Use for tempo, dynamics, phrasing, vibrato and bend feel that the score does not show. |
| `Gary Moore - The Loner [HD].mp3` | Instrumental. Study the long sustained singing melody, the space between phrases, and how the theme builds. |
| `Guthrie Govan - Ancestral, Isolated Guitar Solo ...mp3` | Study long-form solo architecture: motivic development, how fast bursts grow out of a melodic idea, and the build to a climax. |
| `Zakk Wylde - 'Farewell Ballad' Solo (2006, Original).mp3` | Les Paul ballad shred. Study the slow-to-fast transitions, pentatonic speed runs, wide vibrato, and harmonised lines. |

Parisienne Walkways is not in the folder. Use general knowledge of its character only: a long, sustained, vocal melody, and a famous held note that sings and feeds back.

Download the files into `ill-never-love-again/references/` and add that folder to `.gitignore`. Never commit these files. They are copyrighted and for private study only.

## Step 1: Analyse the references, then write a reference profile

Write `ill-never-love-again/reference-profile.md` (commit this). It must contain abstract data and observations only: no transcribed melodies.

For the MXL: key, tempo, meter, section map, chord progression and harmonic rhythm. For the solo: length in bars; note density per bar (notes per beat) as a curve; pitch register per bar (lowest, highest, median) as a curve; phrase lengths; ratio of rest to sound; and how often bends, vibrato, slides and held notes appear.

For the MP3s: transcribe the guitar with Basic Pitch (use Demucs first if a track is not isolated). Note-level accuracy will be poor on distorted guitar. That is fine: extract the tempo, the loudness curve, the onset-density curve, the pitch-range curve, and where the fastest and slowest passages sit as a fraction of the solo length. Write down what each solo teaches us in plain words.

End the profile with a "design rules" list that you derive from the data, e.g. "the slow theme returns at about 75% of the solo, one octave higher" (an example, not a fact). Use these rules in Step 2.

## Step 2: Compose five renditions

### Form of each 2-minute rendition
Each rendition is a compressed version of the whole song, like a trailer. It must show the full emotional arc, especially the solo arc. Approximate plan (adjust to tempo):

1. Intro (about 10–15 s): solo guitar states a fragment of the slow theme over a soft pad or organ.
2. Verse (about 20–25 s): a guide vocal melody, sparse band.
3. Chorus (about 15–20 s): the hook. Set the words "I'll never love again" (6 syllables) as the melodic peak of the chorus. Make the hook singable and memorable.
4. Solo (about 50–60 s), in four phases:
   a. Slow and aching: few notes, long bends, wide vibrato, space.
   b. Building: phrases get longer and climb in register.
   c. Fast and virtuosic: shred bursts, legato runs and pentatonic sequences.
   d. Recapitulation and crescendo: the slow theme and the fast material merge. Example techniques: the slow theme's notes become the accented top notes of a fast run; fast runs end on the theme's long notes; the theme returns an octave higher. This is the most important moment in the piece.
5. Resolution and outro (about 10 s): one long held note, then a quiet ending.

### Make the five renditions truly different
Each rendition must take a different direction. Suggested directions (you can change them, but keep five clearly different options):

1. **Classic ballad:** closest to the Moore ballad tradition. Minor key, about 64–68 BPM, descending circle-of-fifths progression, strings and Hammond organ.
2. **Nocturne:** slower (about 56–60 BPM), 12/8 or 6/8, much more space, very long sustained melody notes, minimal band.
3. **Raw slow blues:** a minor-blues form (i–iv–v with turnarounds), a smaller band (organ, bass, drums), less orchestral, more grit.
4. **Cinematic long-form:** a composed solo arc with motivic development, richer harmony (borrowed chords, a Neapolitan or a modulation up a step at the climax), strings carrying the crescendo.
5. **Power ballad:** heavier drums, a bigger climax, harmonised twin-lead lines in the fast section, more aggressive shred.

Use different keys across the five (all practical for guitar, e.g. A minor, B minor, D minor, E minor, C minor).

### Tracks (separate tracks and channels in each .mid)
Lead guitar (its own channel, so pitch bends do not affect other parts), guide vocal melody (a clear, voice-like patch such as oboe, clarinet or "voice oohs"), rhythm guitar or electric piano, Hammond organ, strings, bass, drums. Use section markers (MIDI marker meta events) named Intro, Verse, Chorus, Solo-A, Solo-B, Solo-C, Solo-D, Outro.

### Make the lead guitar expressive (this is the heart of the piece)
- Set the pitch-bend range with RPN 0 (use ±2 semitones for most parts, or ±12 if you need wide bends) on the lead channel.
- Bends: ramp the pitch bend up over time (whole-step and 1.5-step bends, pre-bends, bend-and-release).
- Vibrato: a periodic pitch-bend oscillation on held notes (about 5–6 Hz, wide on climactic notes). Start it late on long notes, like a real player.
- Slides: pitch-bend glides or fast chromatic grace notes.
- Dynamics: velocity shaping plus CC11 expression swells. Make held notes swell.
- Legato: overlap or tie notes in fast runs. Humanise timing slightly (a few ms) except where the run should be precise.
- Feedback ending: a long held note that swells, and optionally rises to a harmonic an octave or a fifth above.

### Playability (I will learn and play this on a real Les Paul)
- Standard tuning, 22 frets: range E2 to D6.
- Fast passages must be physically playable: think in real positions and fingerings (pentatonic boxes, three-notes-per-string scales, legato patterns). Shred bursts up to about 12–16 notes per second are fine; do not write random, impossible note clouds.
- Bends of up to 1.5 steps, normally on the B and G strings.

### Originality (a hard rule)
Use the references for architecture, tone, phrasing style and proportions only. Do not quote their melodies. After composing, compare the interval sequences of every lead line and vocal line against the Still Got the Blues transcription. If any sequence of 5 or more consecutive intervals (with similar rhythm) matches, rewrite it. Report that you ran this check.

## Step 3: Render to audio

- Use FluidSynth with the best free General MIDI soundfont you can install (e.g. MuseScore_General or FluidR3_GM). Use the overdriven or distortion guitar patch for the lead.
- Add reverb. Balance the mix so the lead guitar is clearly in front and the guide vocal is audible.
- Export MP3 (about 192 kbps). Check that each duration is 1:50 to 2:10.
- These are sketches. GM sounds are limited; the composition matters, not the tone.

## Step 4: Self-check before you publish

You cannot listen, so check with data:
- The duration is in range.
- The solo density curve rises across phases a→c, and phase d contains both theme notes and fast material.
- On strong beats, lead and vocal notes are chord tones or intentional tensions (list the intentional ones).
- All lead notes are in the guitar range, and the fast passages are playable.
- The originality check has passed.

Fix problems before you publish.

## Step 5: Publish and commit

- Artifact page: five sections, each with an audio player, a 2–3 line description (direction, key, tempo, harmony, what the solo does), section timestamps, and a .mid download. Add one short line under each with the question you most want my feedback on.
- Commit in `ill-never-love-again/`: the generator script(s) (Python, deterministic, rerunnable), the five .mid files in `renditions/`, `reference-profile.md`, and `renditions/NOTES.md` (per-rendition notes and the self-check results). Do not commit MP3s, WAVs or reference files. Keep commits to this project only and say so in the commit message.

## How to talk to me

Use ASD-STE100 Simplified Technical English, at about 80% strictness: short sentences, active voice, one instruction per sentence. Be concise and direct. When you finish, give me the artifact link, a 5-line summary (one line per rendition), and anything you could not do.
