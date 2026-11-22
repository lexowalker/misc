# Full song: notes and self-check

This file is written by `selfcheck.py --song`. Do not edit it by hand.

The lyrics are in `LYRICS.md`. The MIDI file also carries them as lyric events on the guide vocal track.

Lead guitar pitch-bend range: +/-12 semitones (RPN 0 is in the file). Set the same range if your synth ignores RPN.

## Full song

- **File:** `ill-never-love-again.mid`. **Key:** B minor. **Tempo:** 66 BPM, 4/4. **Length:** 4:44.
- **Direction:** The full song. Classic-ballad harmony, hook and taste; Nocturne bass line and phrase length.
- **Harmony:** Verse and solo frame: a bass that falls by semitones (Bm - F#7/A# - D/A - E7/G# - Gmaj7 - D/F# - Em7 - F#7). Chorus and the middle of the solo: the circle of fifths. "Again" lands on Gmaj7; the next line resolves to Bm.
- **Solo:** 28 bars, 1:42. Solo-A: the theme, low and slow, in phrases that cross the bar lines. Solo-B: one chord per bar, a rising sequence. Solo-C: the fast section. Solo-D: the theme one octave higher over the falling bass; runs land on its long notes and the peak is a whole-step bend at fret 22. The last note resolves under the last sung lines.
- **Sections:** Intro 0:00, Verse-1 0:14, Chorus-1 0:43, Link 1:05, Verse-2 1:12, Chorus-2 1:41, Bridge 2:03, Solo-A 2:32, Solo-B 3:01, Solo-C 3:23, Solo-D 3:45, Coda 4:14, Outro 4:32
- **Tracks:** Lead guitar, Lead guitar 2 (harmony / feedback), Guide vocal, Rhythm guitar / electric piano, Hammond organ, Strings, Bass, Drums

| Check | Result | Data |
|---|---|---|
| Duration 4:00 to 5:00 | pass | music 280.0 s, MIDI 281.8 s, MP3 284.2 s |
| Density rises A to C | pass | notes per second: A 1.24, B 1.83, C 8.40, D 5.10 |
| Solo-D has theme and fast material | pass | 15 theme notes and 133 fast notes of 148; 12 of 36 Solo-A theme notes return in order; theme top D5 in Solo-A, E6 in Solo-D |
| Strong beats are chord tones | pass | 102 of 102 lead and vocal notes; intentional tensions: 0 |
| Range and playability | pass | fretted B3 to D6; highest sound E6 (by bend); bends up to 2.0 semitones, 9 of 11 on the G or B string, 2 on the high E; fastest notes 13.2 per second, at most 14 onsets in one second; largest fret move at speed 3; frets 2 to 22; 0 hard moves |
| Originality | pass | 607 six-note windows compared; 1 share 5 intervals and rhythm with the reference; 1 of those are generic (an even run straight along a scale, or a 2-3 note loop); 0 real matches |

**Question for you:** Does the solo arrive too late at 2:40, or is the wait right?

## How the checks work

- **Density:** lead note-ons on MIDI channel 1, counted between the section markers in the file.
- **Solo-D:** a "theme note" is a note the score marks as theme; the check then confirms that those notes repeat the Solo-A pitch sequence in order (transposed by the recap interval). A "fast note" is shorter than 0.2 s.
- **Strong beats:** beats 1 and 3 in 4/4, the two dotted-quarter beats in 6/8, beats 1 and 3 of four in 12/8. The sounding pitch (after a bend) is compared with the chord.
- **Playability:** a search assigns a string and fret to every lead note (standard tuning, 22 frets) and minimises hand movement. A "hard move" is a move of more than 5 frets, a skip of more than 2 strings, or more than 4 frets on one string, between notes less than 0.16 s apart.
- **Originality:** every window of 6 consecutive notes (5 intervals) in each lead, harmony and vocal line is compared with every window in the reference lead guitar and vocal parts. A match needs the same 5 intervals and a similar rhythm (normalised inter-onset times, L1 distance 0.30 or less). Even-rhythm runs straight up or down a scale (diatonic, pentatonic or blues) and 2-3 note loops are common property; they are counted separately as generic. Every other match is rewritten.
