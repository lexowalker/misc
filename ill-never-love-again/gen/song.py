"""The full song: "I'll Never Love Again".

A blend of two sketches. From the Classic ballad: B minor, 4/4, the circle-of-fifths
chorus, the hook and the fast vocabulary. From the Nocturne: the falling "lament" bass
under the verse and the solo, the theme that rises against it, and long guitar phrases
that run across the bar lines.

Units are sixteenth notes. Lyrics are stored per section, one entry per sung note.
"""
from .engine import GM, HARM, NATMIN, PENT, Piece, R, Section, asc, desc, groups, scale


def arr(**kw):
    return kw


LAMENT = 'Bm F#7/A# D/A E7/G# Gmaj7 D/F# Em7 F#7'
CYCLE2 = 'Bm:8 Em7:8 A7:8 Dmaj7:8 Gmaj7:8 C#m7b5:8 F#7sus4:8 F#7:8'

VERSE_MELODY = ['| r:6 B3:2 D4:3 E4:1 F#4:4 | r:2 F#4:2 E4:2 E4:2 C#4:6 r:2',
                '| r:6 D4:2 F#4:3 F#4:1 A4:4 | r:2 A4:2 G#4:2 F#4:2 E4:6 r:2',
                '| r:6 D4:2 G4:3 A4:1 B4:4 | r:2 B4:2 A4:2 G4:2 F#4:6 r:2',
                '| r:6 E4:2 G4:3 F#4:1 E4:4 | r:2 D4:2 E4:2 D4:2 C#4:6 r:2']
CHORUS_MELODY = ['| r:1 E4:1 G4:2 G4:1 G4:1 B4:2 A4:3 G4:1 E4:4',
                 '| r:1 F#4:1 F#4:2 F#4:1 E4:1 D4:2 D4:2 B3:1 D4:3 F#4:2',
                 '| G4:4 F#4:2 C#5:6~ A#4:4',            # nev-er LOVE a-
                 '| B4:8~ r:8',                          # -gain, on a deceptive cadence
                 '| r:2 B3:2 E4:2 E4:2 F#4:2 E4:2 C#4:2 A#3:2',
                 '| B3:10~ r:6']
CHORUS_CHORDS = 'Em7:8 A7:8 Dmaj7:8 Gmaj7:8 C#m7b5:8 F#7:8 Gmaj7 Em7:8 F#7:8 Bm'
CHORUS_WORDS = ("So here it is. It is- n't new, "
                "and all of it is near- ly true: I'll "
                "nev- er love a- gain. "
                "I'd have to fin- ish lov- ing you.")

LYRICS = {
    'Verse-1': ("You laughed be- fore the joke was done. "
                "You sang off- key and sang it loud. "
                "You nev- er closed a cup- board door. "
                "The house is ver- y ti- dy now."),
    'Chorus-1': CHORUS_WORDS,
    'Verse-2': ("There's some- one kind who stays some nights. "
                "She waits un- til the joke is through. "
                "She clos- es ev- ery cup- board door. "
                "She's love- ly, and she is- n't you."),
    'Chorus-2': CHORUS_WORDS,
    'Bridge': ("Time's meant to take the edge off this. "
               "Let time, for once, be wrong. "
               "The day it does- n't hurt at all "
               "is when you're real- ly gone."),
    'Coda': ("One cup- board door stays o- pen now. I'll "
             "nev- er love a- gain. "
             "I nev- er"),
    'Outro': "stopped.",
}


def full_song():
    BMIN = scale('B', NATMIN)
    BPENT = scale('B', PENT)
    BHARM = scale('B', HARM)
    verse_band = dict(drums=('ballad', 1), bass='ballad', rhythm='arp8')
    chorus_band = dict(drums=('ballad', 2), bass='ballad', rhythm='arp8')
    S = [
        Section('Intro', 4, 'Bm F#7/A# Gmaj7 F#7sus4:8 F#7:8',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.45, .55), organ=(.3, .45), strings=(.2, .4), lead=(.55, .68)),
                lead=['| r:4 B3:2 D4:2 E4>F#4:8~<', '| F#4:10~~< E4:6', '| D4:2 F#4:2 A4>B4:12~', '| B4:6~ A#4:2 C#5:8~<']),
        Section('Verse-1', 8, LAMENT,
                arr(rhythm_lvl=(.5, .55), organ=(.35, .45), lead=(.5, .5), vocal=(.55, .7), fill=True, **verse_band),
                vocal=VERSE_MELODY),
        Section('Chorus-1', 6, CHORUS_CHORDS,
                arr(rhythm_lvl=(.6, .7), organ=(.5, .6), strings=(.35, .55), lead=(.58, .62), vocal=(.8, .95), crash=True, **chorus_band),
                vocal=CHORUS_MELODY,
                lead=['| r:16 | r:16 | r:16', '| r:8 D5:2 B4:2 A4:2 F#4:2', '| r:16 | r:16']),
        Section('Link', 2, 'Bm F#7',
                arr(rhythm_lvl=(.55, .5), organ=(.45, .4), strings=(.35, .3), lead=(.62, .66), fill=True, **chorus_band),
                lead=['| r:4 B3:2 D4:2 E4>F#4:8~', '| F#4:6~ E4:2 C#4:8~']),
        Section('Verse-2', 8, LAMENT,
                arr(rhythm_lvl=(.52, .6), organ=(.4, .5), strings=(.2, .35), lead=(.52, .56), vocal=(.6, .75), fill=True, **verse_band),
                vocal=VERSE_MELODY,
                lead=['| r:16 | r:16', '| A4:4~ F#4:2 r:10 | r:16', '| B4:4~ A4:1_ G4:1 r:10 | r:16', '| G4:2 B4:4~ r:10 | r:16']),
        Section('Chorus-2', 6, CHORUS_CHORDS,
                arr(rhythm_lvl=(.65, .72), organ=(.55, .65), strings=(.45, .6), lead=(.6, .66), vocal=(.85, 1.0), crash=True, **chorus_band),
                vocal=CHORUS_MELODY,
                lead=['| r:16 | r:16 | r:16', '| r:8 F#5:4~ D5:2 B4:2', '| r:16 | r:16']),
        Section('Bridge', 8, 'Gmaj7 A F#m7 Bm Gmaj7 A Em7 F#7sus4:8 F#7:8',
                arr(rhythm_lvl=(.6, .75), organ=(.5, .7), strings=(.45, .75), lead=(.6, .6), vocal=(.8, 1.0), fill=True, **chorus_band),
                vocal=['| r:6 B4:2 B4:3 A4:1 B4:4 | r:2 A4:2 C#5:2 B4:2 A4:6 r:2',
                       '| r:6 A4:2 A4:6~ r:2 | r:2 F#4:2 B4:2 A4:2 F#4:6 r:2',
                       '| r:6 B4:2 D5:3 C#5:1 B4:4 | r:2 A4:2 C#5:2 B4:2 A4:6 r:2',
                       '| r:6 G4:2 B4:4 A4:4 | B4:6 A#4:2 C#5:8~']),
        # ---------------------------------------------------------------- the solo
        Section('Solo-A', 8, LAMENT,
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.5, .58), organ=(.45, .55), strings=(.3, .5),
                    lead=(.72, .8), crash=True),
                lead=['| r:4 B3:2 D4:2 E4>>F#4:8~~<',
                      '| F#4:4~ E4:2_ C#4:6~~ r:4',
                      '| r:2 D4:2 /F#4:4~ A4:6~~ F#4:2',
                      '| G#4:6~~ F#4:2_ E4:4~\\ r:4',
                      '| r:2 D4:2 F#4:2 A4>>B4:8~~ A4:2',
                      '| A4:4~ F#4:2 A4:2 D5:6~~ r:2',
                      '| A4>B4>A4:6~ G4:2 E4:4~\\ r:4',
                      '| r:2 F#4:2 A#4:4~ B4>>C#5:8~~']),
        Section('Solo-B', 6, 'Em7 A7 Dmaj7 Gmaj7 C#m7b5 F#7',
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.6, .7), organ=(.55, .65), strings=(.5, .65),
                    lead=(.8, .9), fill=True),
                lead=['| r:2 B4:2 E5:2 F#5>G5:6~~ F#5:2_ E5:2',
                      '| E5:2 G5:2 G5>A5:6~~ G5:2_ E5:2 r:2',
                      '| /F#5:4~~ D5:2_ E5:2 F#5:2 A5:4~~ r:2',
                      '| D5:1 E5:1 G5:2 A5>>B5:8~~! A5:2_ G5:2',
                      '| G5:4~ E5:2_ G5:2 B5>C#6:4~~! B5:1_ G5:1 E5:2',
                      '| C#5:1 E5:1 F#5:1 A#5:1 B5>>C#6:8~~! r:2 F#5:1 A5:1']),
        Section('Solo-C', 6, CYCLE2 + ' Bm:8 Em7:8 C#m7b5:8 F#7:8',
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.7, .8), organ=(.65, .75), strings=(.6, .75),
                    lead=(.9, .95), crash=True, fill=True),
                lead=['| A5>B5:6~~! r:2',
                      R(['B5', 'A5', 'G5', 'F#5', 'E5', 'D5', 'B4', 'E5', 'G5', 'A5', 'G5', 'F#5'], '1/3', accent=3), 'E5:4~~!',
                      '|', R(['G5', 'F#5', 'E5', 'C#5', 'E5', 'G5', 'A5', 'G5', 'E5', 'C#5', 'E5', 'G5'], '1/3', accent=4),
                      'G5>A5:4~~! F#5:2~ r:2',
                      R(['D5', 'F#5', 'A5', 'D6', 'C#6', 'B5', 'A5', 'F#5', 'A5', 'B5', 'C#6', 'D6'], '1/3', accent=4),
                      '| B5:4~~! A5:2_ G5:2',
                      R(['G5', 'F#5', 'E5', 'C#5', 'E5', 'G5', 'B5', 'G5', 'E5', 'G5', 'B5', 'C#6'], '1/3', accent=4), 'B5>C#6:4~~!',
                      '| B5:4~~! r:2', R(['B4', 'C#5', 'D5', 'E5', 'F#5', 'G5'], '1/3'), 'A#5:4~~!',
                      R(['C#6', 'B5', 'A#5', 'G5', 'F#5', 'E5', 'F#5', 'G5', 'A#5', 'B5', 'C#6', 'B5'], '1/3', accent=3),
                      '| C#6>D6:4~~!',
                      R(['B5', 'A5', 'F#5', 'F5', 'E5', 'D5', 'B4', 'D5', 'E5', 'F5', 'F#5', 'A5'], '1/3', accent=3),
                      R(['B5', 'A5', 'G5', 'E5', 'G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5', 'A5'], '1/3', accent=4), 'A5>B5:4~~!',
                      '| B5>C#6>B5:4~~! G5:2_ E5:2 A#5:4~~! r:1',
                      R(['C#4', 'D4', 'E4', 'F#4', 'G4', 'A#4', 'B4', 'C#5', 'D5'], '1/3')]),
        Section('Solo-D', 8, LAMENT,
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.8, .92), organ=(.75, .92), strings=(.75, 1.0, True),
                    lead=(.95, 1.0), crash=True, fill=True),
                lead=['| E5>F#5:10~~!T r:2',
                      R(['B4', 'D5', 'F#5', 'B5', 'A5', 'F#5', 'F5', 'E5', 'D5', 'B4', 'D5', 'F#5'], '1/3', accent=4),
                      '| F#5:6~~!T E5:2T C#5:4~~!T',
                      R(['C#5', 'E5', 'F#5', 'A#5', 'C#6', 'A#5', 'F#5', 'E5', 'F#5', 'A#5', 'C#6', 'A#5'], '1/3', accent=4),
                      '| A5:10~~!T r:2',
                      R(['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'B5', 'A5', 'F#5', 'A5', 'B5', 'A5'], '1/3', accent=3),
                      '| G#5:6~~!T F#5:2_ E5:4~~!T',
                      R(['E5', 'G#5', 'B5', 'D6', 'B5', 'G#5', 'E5', 'G#5', 'B5', 'D6', 'B5', 'A5'], '1/3', accent=4),
                      '| A5>>B5:10~~!T r:2',
                      R(['G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5', 'F#5', 'G5', 'A5', 'B5', 'C#6'], '1/3', accent=3),
                      '| D6:10~~!T r:2',
                      R(['F#5', 'A5', 'B5', 'D6', 'B5', 'A5', 'F#5', 'A5', 'B5', 'D6', 'B5', 'D6'], '1/3', accent=4),
                      '| D6>>E6:12~~!T D6:2_ B5:2T',
                      '| C#6:6~~!T B5:2 A#5:4~~!',
                      R(['F#5', 'G5', 'A#5', 'B5', 'C#6', 'A#5', 'F#5', 'E5', 'F#5', 'A#5', 'B5', 'A5'], '1/3', accent=4)]),
        # ---------------------------------------------------------------- the last words
        Section('Coda', 5, 'Bm Em7 C#m7b5:8 F#7:8 Gmaj7 Em7:8 F#7:8',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.5, .35), organ=(.6, .3), strings=(.75, .3),
                    lead=(1.0, .5), vocal=(.6, .75), crash=True),
                lead=['| A5>>B5:16~~!T | B5:10~~ r:6 | r:16 | r:16 | r:16'],
                aux=['| r:8 F#6:16F r:8 | r:16 | r:16 | r:16'],
                vocal=['| r:6 B3:2 D4:3 E4:1 F#4:4 | r:2 F#4:2 G4:2 F#4:2 E4:6 F#4:2',
                       '| G4:4 F#4:2 C#5:6~ A#4:4', '| B4:8~ r:8', '| r:10 C#4:2 E4:2 C#4:2']),
        Section('Outro', 2, 'Bm Bm',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.35, .2), organ=(.3, .15), strings=(.3, .1), lead=(.5, .4), vocal=(.6, .5)),
                vocal=['| B3:10~ r:6 | r:16'],
                lead=['| r:4 B3:2 D4:2 E4>F#4:8~<', '| F#4:6~ D4:2 B3:8~<']),
    ]
    p = Piece('ill-never-love-again', 'Full song', 'B minor', 66, (4, 4), S,
              dict(lead=GM['dist'], vocal=GM['clarinet'], rhythm=GM['clean'], rhythm_power=GM['overdrive'], organ=GM['drawbar']),
              notes=dict(
                  direction='The full song. Classic-ballad harmony, hook and taste; Nocturne bass line and phrase length.',
                  harmony='Verse and solo frame: a bass that falls by semitones (Bm - F#7/A# - D/A - E7/G# - Gmaj7 - D/F# - Em7 - F#7). '
                          'Chorus and the middle of the solo: the circle of fifths. "Again" lands on Gmaj7; the next line resolves to Bm.',
                  solo='28 bars, 1:42. Solo-A: the theme, low and slow, in phrases that cross the bar lines. Solo-B: one chord per bar, '
                       'a rising sequence. Solo-C: the fast section. Solo-D: the theme one octave higher over the falling bass; runs land '
                       'on its long notes and the peak is a whole-step bend at fret 22. The last note resolves under the last sung lines.',
                  question='Does the solo arrive too late at 2:40, or is the wait right?',
                  recap_shift=12),
              seed=101)
    p.lyrics = {k: v.split() for k, v in LYRICS.items()}
    for sec, words in p.lyrics.items():
        k = sum(1 for n in p.voices['vocal'] if n['section'] == sec)
        if k != len(words):
            raise ValueError('lyrics: %s has %d sung notes and %d syllables' % (sec, k, len(words)))
    return p


# The lyric as it reads on paper (the hyphenated version above is for the note setting).
LINES = [
    ('Verse-1', 'Verse 1', ["You laughed before the joke was done.", "You sang off-key and sang it loud.",
                            "You never closed a cupboard door.", "The house is very tidy now."]),
    ('Chorus-1', 'Chorus', ["So here it is. It isn't new,", "and all of it is nearly true:",
                            "I'll never love again.", "I'd have to finish loving you."]),
    ('Verse-2', 'Verse 2', ["There's someone kind who stays some nights.", "She waits until the joke is through.",
                            "She closes every cupboard door.", "She's lovely, and she isn't you."]),
    ('Chorus-2', 'Chorus', ["So here it is. It isn't new,", "and all of it is nearly true:",
                            "I'll never love again.", "I'd have to finish loving you."]),
    ('Bridge', 'Bridge', ["Time's meant to take the edge off this.", "Let time, for once, be wrong.",
                          "The day it doesn't hurt at all", "is when you're really gone."]),
    ('Solo-A', 'Guitar solo', None),
    ('Coda', 'Coda', ["One cupboard door stays open now.", "I'll never love again.", "I never stopped."]),
]
