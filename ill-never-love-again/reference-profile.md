# Reference profile

Abstract data and observations from the reference material. No melodies are
transcribed here. The reference files are private study copies in
`references/` (not in git). The scripts in `analysis/` made these numbers.

Method limits:

- The MusicXML has no fret or string data and no bend marks. Bends are written
  as slides or grace notes. "Slides" below counts all of them.
- Basic Pitch note accuracy on distorted guitar is poor. The audio numbers are
  good for shape (where, how dense, how high), not for exact notes.
- Demucs could not download its model here (the network blocked the host).
  For "The Loner" (a full mix) the script used harmonic/percussive filtering
  instead. Its register numbers include bass and keyboards. Its tempo,
  loudness, long-note and vibrato numbers are usable.

## 1. Score: Gary Moore, "Still Got the Blues" (MusicXML)

| Item | Value |
|---|---|
| Key | A minor |
| Meter | 6/8, felt in two |
| Tempo | quarter = 82, so the felt beat (dotted quarter) is 54.7 BPM |
| Length | 158 bars, 2.2 s per bar, about 5:47 |
| Parts | vocal line, electric piano, lead guitar, rhythm guitar, bass, drums |
| Vocal range | D4 to A5 as written |

### Section map

| Mark | Bars | Time | Content |
|---|---|---|---|
| Intro | 2-9 (8) | 0:02 | Guitar theme. 23 notes in 8 bars. |
| A | 10-25 (16) | 0:20 | Verse. Vocal only. |
| B | 26-33 (8) | 0:55 | Refrain. Repeat with first and second endings. |
| C | 34-51 (18) | 1:12 | Verse 2. The guitar answers the vocal. |
| D | 52-61 (10) | 1:52 | Bridge. |
| E | 62-77 (16) | 2:14 | Mid solo, one 16-bar cycle. |
| F, G | 78-91 (14) | 2:49 | Refrain and extension. |
| H | 92-158 (67) | 3:20 | Outro solo: four 16-bar cycles and a 3-bar ending. 42% of the song. |

### Harmony

- Verse and solo cycle (8 bars, then varied for 8 more):
  `iv7 - bVII(sus) - IIImaj7 - VImaj7 - iiø7 - V - i - i`.
  In A minor: Dm7 - G - Cmaj7 - Fmaj7 - Bm7b5 - E - Am - Am.
  This is a descending circle of fifths.
- Refrain: `i - v - i - iv - bVI7 - V7 - i`.
- Bridge: stepwise bass motion around `ii - V - i`, then `VI - v - iv - i`.
- Harmonic rhythm: one chord per bar (2.2 s). Bars 7-8 of a cycle often hold
  two chords per bar. The V chord is often a sus4 that resolves.

### Intro theme (8 bars)

- 3 to 4 notes per bar (about 1.6 notes per second). 7 of 23 notes are held
  for a dotted quarter or more.
- 4 phrases, each 1.5 to 1.75 bars long. Rest share: 20%.
- Motion: 68% steps, 27% repeated notes, no leaps of a fourth or more.
- Register: one octave only, in the middle of the neck.
- Shape: one short cell that repeats one step lower over each new chord.

### Mid solo (section E, 16 bars, 35 s)

- 87 notes and 21 grace notes. 13 slides, 3 vibrato marks, 15 held notes.
- Notes per bar: `3 5 3 5 3 4 2 4 3 6 4 5 4 7 10 19`.
  Twelve bars restate the theme. All of the speed is in the last three bars.
- Register by 4-bar block (low / median / high):
  G3 / C#5 / F5, G4 / B4 / E5, G3 / C#5 / G5, C4 / E4 / D5.
- Rest share: 3%. The line never stops; long notes make the space.

### Outro solo (section H, 67 bars, 147 s)

- 439 notes and 84 grace notes. 109 slides, 26 vibrato marks, 35 held notes.
- Note lengths: 37% shorter than a sixteenth, 29% sixteenths, 21% eighths,
  5% quarters, 8% held (dotted quarter or more).
- Motion: 49% steps, 16% repeated notes, 16% leaps of a fourth or more.
- Phrases (bars): 6.8, 12.3, 28.0, 11.8, 2.8, 4.3. Rest share: 2%.
- Fastest bar: 20 notes (9.1 notes per second).
- Notes per bar:
  `3 5 3 4 3 3 3 5 | 2 5 4 5 3 4 7 12 | 3 2 5 8 13 9 2 5 | 3 13 7 5 5 18 8 11 |`
  `9 3 18 14 17 10 18 4 | 8 5 20 8 4 6 6 5 | 4 5 3 5 3 4 4 8 | 2 4 4 6 2 3 5 14 | 13 6 1`

Density and register by 4-bar block:

| Bars | Share of solo | Notes/s | Low | Median | High |
|---|---|---|---|---|---|
| 1-4 | 0-6% | 1.7 | G3 | D5 | F5 |
| 5-8 | 6-12% | 1.6 | G3 | C5 | E5 |
| 9-12 | 12-18% | 1.8 | G3 | C#5 | F5 |
| 13-16 | 18-24% | 3.0 | G4 | A4 | E5 |
| 17-20 | 24-30% | 2.1 | B3 | D5 | G5 |
| 21-24 | 30-36% | 3.3 | A2 | A4 | F5 |
| 25-28 | 36-42% | 3.2 | D3 | G#4 | G5 |
| 29-32 | 42-48% | 4.8 | A3 | D5 | A5 |
| 33-36 | 48-54% | 5.0 | A4 | A5 | D6 |
| 37-40 | 54-60% | 5.6 | E4 | E5 | E6 |
| 41-44 | 60-66% | 4.7 | G2 | E5 | E6 |
| 45-48 | 66-72% | 2.4 | G3 | C6 | E6 |
| 49-52 | 72-78% | 1.9 | G3 | D5 | F5 |
| 53-56 | 78-84% | 2.2 | G3 | B4 | E5 |
| 57-60 | 84-90% | 1.8 | G4 | D5 | G5 |
| 61-64 | 90-96% | 2.7 | A3 | F4 | D5 |
| 65-67 | 96-100% | 3.0 | A2 | Bb3 | A4 |

What the outro solo does:

1. Cycle 1 (0-24%): the theme again, almost unchanged.
2. Cycle 2 (24-48%): the theme with fast bursts inside it. Each burst is one
   or two bars. The register goes down to the low strings and back.
3. Cycle 3 (48-72%): the peak. Register and density peak together. The top
   note is E6: a whole-step bend at the highest fret. The median pitch is one
   octave above cycle 1.
4. Cycle 4 (72-96%): the theme returns at its first register and its first
   density. A fast falling run closes the solo in the last 5%.

## 2. Audio

Curves are per tenth of each track. Loudness is in dB below the track peak.

### "Still Got the Blues", isolated solo (160 s)

| Curve | Tenths 1 to 10 |
|---|---|
| Loudness | -8 -4 -3 -3 -2 -3 -3 -3 -8 -31 |
| Onsets per second | 6.4 5.1 5.1 6.1 5.9 6.9 4.3 5.7 3.6 4.5 |
| Pitch, 95th percentile | F#5 E5 F5 F5 D6 E6 D6 F5 E5 C5 |
| Notes of 1 s or longer | 2 3 3 0 0 0 3 1 5 5 |

- Tempo estimate: 117.5 BPM. That is twice the felt beat: about 59 BPM.
- Peak density: 9.3 notes per second, at 51-53% and again at 92-93%.
- Highest notes at 58-69%. Longest notes (1.6 to 2.1 s) at 16%, 69%, 85%, 95%.
- Vibrato on long notes: 3.9 Hz median (3.3 to 5.1), depth ±14 cents median,
  ±27 cents at the 90th percentile.
- Lesson: the level is flat within 2 dB for 80% of the solo. The build comes
  from density and register, not from volume. Long notes sit at the start and
  the end; the middle has none.

### "The Loner" (278 s, full mix, no stem separation)

- Tempo: about 56 BPM felt.
- 17 to 32 notes of 1 s or longer in every tenth. Longest note: 4.3 s.
  Median note: 0.24 s.
- Peak density at 54%. Highest notes at 50-64% and again at 96-97%.
- Vibrato: 4.8 Hz median (3.7 to 5.7), ±20 cents median, ±53 cents at the
  90th percentile.
- Lesson: sustain is the instrument. The theme uses notes of 1 to 4 seconds
  all the way through, also in the loud parts. The widest vibrato is on the
  longest notes. The theme comes back at the end, higher.

### "Ancestral", isolated solo (64 s)

| Curve | Tenths 1 to 10 |
|---|---|
| Loudness | -5 -3 -2 -3 -3 -4 -4 -4 -4 -17 |
| Onsets per second | 7.0 5.3 9.5 9.0 8.7 4.5 9.2 5.9 8.9 4.8 |
| Pitch, median | B4 C#5 G#4 Bb4 C4 C#5 Bb4 G#5 Eb5 E4 |
| Pitch, 95th percentile | C#5 Eb5 G#5 A5 G#5 F5 Bb5 D6 Bb5 C#5 |

- Tempo: about 65 BPM felt. Peak density: 13 notes per second at 28-31%.
- Highest notes at 70-74%. Only two notes are 1 s or longer.
- Lesson: density comes in waves (fast, breathe, fast, breathe). Each wave
  starts from a slow melodic idea and ends on one. The register peak comes
  late (70%+) and after the density peak, not with it.

### "Farewell Ballad", solo (97 s)

| Curve | Tenths 1 to 10 |
|---|---|
| Loudness | -28 -10 -6 -3 -2 -2 -2 -2 -13 -18 |
| Onsets per second | 6.5 9.6 8.7 8.7 12.6 9.8 11.3 12.0 6.8 5.2 |
| Pitch, 95th percentile | C5 G4 C5 G#5 D5 D5 G#5 G5 G4 Bb3 |

- Tempo: about 76 BPM felt. Peak density: 18.7 notes per second at 65-67%.
- Slowest windows at 2-21%. Long notes (1.2 to 1.6 s) all in the first half.
- Vibrato: 4.2 Hz median, ±25 cents median, ±47 cents at the 90th percentile.
- Lesson: it starts almost silent (28 dB under the peak) and takes 30% of its
  length to arrive. Speed is pentatonic and sits low on the neck. The change
  from slow to fast happens inside a phrase: a held note, then a run that
  leaves from that same note.

## 3. Design rules

Each rule comes from the data above. "Ours" says how the five renditions use it.

1. **Felt tempo 55 to 76 BPM.** Ours: 58 to 72.
2. **Start the solo with the theme at under 2 notes per second.** The
   reference solos open at 1.6 to 1.8. Ours: Solo-A is 1.1 to 1.6.
3. **Space is held notes, not silence.** Rest share in the reference solos is
   2-3%. Ours: Solo-A and Solo-B phrases connect; the long notes do the work.
4. **Speed comes in bursts of one or two bars that leave from and land on a
   melody note.** Ours: every run in Solo-C ends on a held chord tone.
5. **Density peaks between 50% and 67% of the solo.** Ours: Solo-C covers
   about 50-75% of the solo.
6. **Fast-section density: 9 notes per second for the classic ballad style,
   13 to 19 for the modern players.** Ours: Solo-C averages 8 to 12, with
   bursts of 12 to 14.4. All are under the 16 per second limit.
7. **The top note is a whole-step bend at the highest fret (E6).** Ours: four
   of five use the fret-22 bend to E6; the blues uses a half-step bend to Eb6.
8. **The theme returns at about 72-75% of the solo.** Ours: Solo-D starts at
   75%.
9. **Vibrato: 4 to 5 Hz, ±15 to 25 cents; ±40 to 50 cents on peak notes.
   It starts late on a long note.** Ours: 4.9 Hz and ±22 cents; 5.3 Hz and
   ±42 cents on climactic notes; delay 0.3 to 0.4 s. The brief said 5-6 Hz.
   The measured players are slower, so the data wins.
10. **Level stays flat in the solo; build with density and register.** Ours:
    lead expression moves only from 84% to 100% across the solo.
11. **About half of the melodic intervals are steps; one in six is a leap of
    a fourth or more.** Ours: themes move by step and keep one signature leap.
12. **Ornaments are everywhere: almost one slide, bend or grace note for
    every two notes.** Ours: most long notes are bent into or slid into.
13. **Hold the important notes for 1 to 4 seconds.** Ours: theme notes are
    0.9 to 2 s; the last note is 4 to 7 s with a feedback overtone.
14. **A slow harmonic rhythm: one chord every 2 seconds or slower.** Ours:
    1.7 to 4 s per chord.

### Where we leave the reference on purpose

- **Register at the recapitulation.** The reference brings the theme back at
  its first register and then winds down. The brief asks for the slow and
  fast material to merge in a crescendo. Ours: the theme returns one octave
  higher in Solo-D, with the register peak there and not in Solo-C.
- **Theme shape.** The reference theme is a cell that steps down in sequence.
  None of our themes does that: ours rise, arch, or leap.
- **Meter and key.** The reference is 6/8 in A minor. Only our nocturne is
  in 6/8 (E minor); only our power ballad is in A minor (4/4, other chords).
