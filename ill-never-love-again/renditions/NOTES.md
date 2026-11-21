# Rendition notes and self-check

This file is written by `selfcheck.py`. Do not edit it by hand.

All five are sketches of one song, about two minutes each, with the same form:
Intro, Verse, Chorus, Solo-A (slow), Solo-B (build), Solo-C (fast), Solo-D (recapitulation), Outro.
The melodies are different in each rendition, so each one is a real alternative.

Lead guitar pitch-bend range: +/-12 semitones (RPN 0 is in the file). Set the same range if your synth ignores RPN.

## Classic ballad

- **File:** `1-classic-ballad.mid`. **Key:** B minor. **Tempo:** 66 BPM, 4/4. **Length:** 2:04.
- **Direction:** Closest to the classic minor-key guitar ballad. Descending circle-of-fifths cycle, two chords per bar. Strings and Hammond.
- **Harmony:** Bm - Em7 - A7 - Dmaj7 - Gmaj7 - C#m7b5 - F#7sus4 - F#7. The chorus ends on Gmaj7, not Bm: the vow lands on a deceptive cadence.
- **Solo:** The theme climbs in a rising sequence (B3 to a bent E5) while the chords fall. Solo-D plays the theme one octave higher: runs land on its long notes, then its notes become the accented tops of sextuplets. The peak is a whole-step bend at fret 22.
- **Sections:** Intro 0:00, Verse 0:14, Chorus 0:36, Solo-A 0:50, Solo-B 1:05, Solo-C 1:20, Solo-D 1:34, Outro 1:49
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Strings, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 1:50 to 2:10 | pass | music 120.0 s, MIDI 121.8 s, MP3 124.2 s |
| Density rises A to C | pass | notes per second: A 1.58, B 2.76, C 8.21, D 6.30 |
| Solo-D has theme and fast material | pass | 17 theme notes and 83 fast notes of 92; 15 of 23 Solo-A theme notes return in order; theme top E5 in Solo-A, E6 in Solo-D |
| Strong beats are chord tones | pass | 48 of 49 lead and vocal notes; intentional tensions: 1 |
| Range and playability | pass | fretted B3 to D6; highest sound E6 (by bend); bends up to 2.0 semitones, 7 of 9 on the G or B string, 2 on the high E; fastest notes 13.2 per second, at most 14 onsets in one second; largest fret move at speed 4; frets 0 to 22; 0 hard moves |
| Originality | pass | 325 six-note windows compared; 0 share 5 intervals and rhythm with the reference; 0 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

Intentional tensions on strong beats:
- vocal Verse bar 2: F#4 over Em7 (0.45 s). Appoggiatura: the 9th leans on the beat and resolves down to the root.

**Question for you:** Is the rising theme against the falling chords the right kind of ache, or do you want a simpler, more singable theme?

## Nocturne

- **File:** `2-nocturne.mid`. **Key:** E minor. **Tempo:** 58 BPM, 6/8. **Length:** 2:06.
- **Direction:** Slower and much emptier. 6/8, felt in two. Electric piano, soft strings, brushes-level drums. The guide vocal sits one octave lower (baritone range).
- **Harmony:** A lament bass falls by semitones (Em - B7/D# - G/D - A7/C# - Cmaj7 - G/B) while the melody rises against it. The chorus lands on Cmaj7 under "again".
- **Solo:** Very long notes first: about 1.3 notes per second. The fast section uses legato flurries with long landing notes, not constant speed. Solo-D returns the theme one octave higher; every long theme note is fed by a run.
- **Sections:** Intro 0:00, Verse 0:12, Chorus 0:37, Solo-A 0:53, Solo-B 1:10, Solo-C 1:22, Solo-D 1:35, Outro 1:51
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Strings, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 1:50 to 2:10 | pass | music 122.1 s, MIDI 123.1 s, MP3 126.0 s |
| Density rises A to C | pass | notes per second: A 1.21, B 2.64, C 8.71, D 6.24 |
| Solo-D has theme and fast material | pass | 13 theme notes and 93 fast notes of 103; 12 of 20 Solo-A theme notes return in order; theme top E5 in Solo-A, E6 in Solo-D |
| Strong beats are chord tones | pass | 80 of 80 lead and vocal notes; intentional tensions: 0 |
| Range and playability | pass | fretted B3 to D6; highest sound E6 (by bend); bends up to 2.0 semitones, 5 of 9 on the G or B string, 4 on the high E; fastest notes 11.6 per second, at most 12 onsets in one second; largest fret move at speed 4; frets 0 to 22; 0 hard moves |
| Originality | pass | 324 six-note windows compared; 0 share 5 intervals and rhythm with the reference; 0 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

**Question for you:** Does this much space work for you, or does the solo need more notes before the fast section?

## Raw slow blues

- **File:** `3-raw-slow-blues.mid`. **Key:** C minor. **Tempo:** 60 BPM, 12/8. **Length:** 2:04.
- **Direction:** A 12/8 minor blues with a small band: organ, bass, drums and guitar stabs. No strings. Overdriven lead, not full distortion. The lead answers the vocal in the verse.
- **Harmony:** Minor-blues form: Cm7 - Fm7 - Cm7 - C7 - Fm7, then Cm7 - Cm7/Bb - Ab7 - G7#9. "Again" lands on Fm7 (the iv chord), not on Cm.
- **Solo:** A short blues motto: two pickup notes, a bend to the tonic, a step down. Blues-box repeated licks and blues-scale runs make the fast part. Solo-D returns the motto one octave higher. The band stops for a one-bar cadenza before the last chord.
- **Sections:** Intro 0:00, Verse 0:12, Chorus 0:36, Solo-A 1:00, Solo-B 1:12, Solo-C 1:24, Solo-D 1:36, Outro 1:52
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 1:50 to 2:10 | pass | music 120.0 s, MIDI 122.0 s, MP3 124.4 s |
| Density rises A to C | pass | notes per second: A 1.25, B 2.08, C 8.58, D 6.12 |
| Solo-D has theme and fast material | pass | 9 theme notes and 88 fast notes of 98; 8 of 15 Solo-A theme notes return in order; theme top Eb5 in Solo-A, Eb6 in Solo-D |
| Strong beats are chord tones | pass | 38 of 38 lead and vocal notes; intentional tensions: 0 |
| Range and playability | pass | fretted F3 to D6; highest sound Eb6 (by bend); bends up to 2.0 semitones, 7 of 13 on the G or B string, 6 on the high E; fastest notes 12.0 per second, at most 13 onsets in one second; largest fret move at speed 3; frets 0 to 22; 0 hard moves |
| Originality | pass | 317 six-note windows compared; 8 share 5 intervals and rhythm with the reference; 8 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

**Question for you:** Do you want this much grit and this little harmony, or is the song a ballad first and a blues second?

## Cinematic long-form

- **File:** `4-cinematic-long-form.mid`. **Key:** D minor, then E minor. **Tempo:** 70 BPM, 4/4. **Length:** 2:04.
- **Direction:** A composed arc built from one four-note cell: a leap up a sixth, then a two-step sigh down. Strings carry the crescendo.
- **Harmony:** Dm - Bbmaj7 - Gm7 - A7 with a Neapolitan Ebmaj7 in the verse and Solo-B. A B7 pivot lifts the climax up a whole step to E minor. "Again" is a major 7th over Bbmaj7.
- **Solo:** Solo-A states the cell low and warm. Solo-B shrinks the cell and moves it up in sequence. Solo-D returns the theme in the new key, one octave higher, and ends on a C - D - E climb over bVI - bVII - i. The last bar is the cell again, quiet.
- **Sections:** Intro 0:00, Verse 0:13, Chorus 0:34, Solo-A 0:51, Solo-B 1:05, Solo-C 1:18, Solo-D 1:32, Outro 1:49
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Strings, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 1:50 to 2:10 | pass | music 120.0 s, MIDI 121.7 s, MP3 124.1 s |
| Density rises A to C | pass | notes per second: A 1.17, B 2.39, C 10.66, D 6.20 |
| Solo-D has theme and fast material | pass | 14 theme notes and 96 fast notes of 107; 13 of 16 Solo-A theme notes return in order; theme top Bb4 in Solo-A, C6 in Solo-D |
| Strong beats are chord tones | pass | 44 of 44 lead and vocal notes; intentional tensions: 0 |
| Range and playability | pass | fretted G3 to D6; highest sound E6 (by bend); bends up to 2.0 semitones, 1 of 5 on the G or B string, 4 on the high E; fastest notes 14.0 per second, at most 15 onsets in one second; largest fret move at speed 4; frets 0 to 22; 0 hard moves |
| Originality | pass | 346 six-note windows compared; 0 share 5 intervals and rhythm with the reference; 0 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

**Question for you:** Does the key change at the climax feel earned, or does it feel like a trick?

## Power ballad

- **File:** `5-power-ballad.mid`. **Key:** A minor. **Tempo:** 72 BPM, 4/4. **Length:** 2:04.
- **Direction:** The biggest version. Clean arpeggios in the verse, then power chords, heavy half-time drums and harmonised twin leads.
- **Harmony:** Am - F - C - G (i - VI - III - VII) with Dm7 - E7 cadences. This is the only version where "again" lands on the tonic: the vow sounds certain, and the guitar then argues with it.
- **Solo:** An anthem-like theme with wide intervals. The fast section is the most aggressive of the five: pentatonic fours, pedal licks and harmonic-minor runs, with a second guitar in thirds. Solo-D returns the theme one octave higher with the second guitar on the long notes.
- **Sections:** Intro 0:00, Verse 0:13, Chorus 0:33, Solo-A 0:53, Solo-B 1:06, Solo-C 1:20, Solo-D 1:33, Outro 1:50
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Strings, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 1:50 to 2:10 | pass | music 120.0 s, MIDI 121.7 s, MP3 124.1 s |
| Density rises A to C | pass | notes per second: A 1.12, B 3.16, C 11.58, D 7.25 |
| Solo-D has theme and fast material | pass | 14 theme notes and 108 fast notes of 121; 14 of 15 Solo-A theme notes return in order; theme top E5 in Solo-A, E6 in Solo-D |
| Strong beats are chord tones | pass | 59 of 59 lead and vocal notes; intentional tensions: 0 |
| Range and playability | pass | fretted A3 to D6; highest sound E6 (by bend); bends up to 2.0 semitones, 4 of 8 on the G or B string, 4 on the high E; fastest notes 14.4 per second, at most 15 onsets in one second; largest fret move at speed 4; frets 2 to 22; 0 hard moves |
| Originality | pass | 462 six-note windows compared; 1 share 5 intervals and rhythm with the reference; 1 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

**Question for you:** Is this too big for the song, or is this the size the climax needs?

## How the checks work

- **Density:** lead note-ons on MIDI channel 1, counted between the section markers in the file.
- **Solo-D:** a "theme note" is a note the score marks as theme; the check then confirms that those notes repeat the Solo-A pitch sequence in order (transposed by the recap interval). A "fast note" is shorter than 0.2 s.
- **Strong beats:** beats 1 and 3 in 4/4, the two dotted-quarter beats in 6/8, beats 1 and 3 of four in 12/8. The sounding pitch (after a bend) is compared with the chord.
- **Playability:** a search assigns a string and fret to every lead note (standard tuning, 22 frets) and minimises hand movement. A "hard move" is a move of more than 5 frets, a skip of more than 2 strings, or more than 4 frets on one string, between notes less than 0.16 s apart.
- **Originality:** every window of 6 consecutive notes (5 intervals) in each lead, harmony and vocal line is compared with every window in the reference lead guitar and vocal parts. A match needs the same 5 intervals and a similar rhythm (normalised inter-onset times, L1 distance 0.30 or less). Even-rhythm runs straight up or down a scale (diatonic, pentatonic or blues) and 2-3 note loops are common property; they are counted separately as generic. Every other match is rewritten.
