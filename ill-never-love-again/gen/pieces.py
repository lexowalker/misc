"""The five renditions of "I'll Never Love Again".

Every melody here is original. Token grammar: see engine.parse_token.
Units: a sixteenth note in 4/4, an eighth note in 6/8 and 12/8.
Bar lines ('|') are checked by the engine.
"""
import re

from .engine import (GM, HARM, NATMIN, PENT, BLUES, Piece, R, Section, asc, desc, groups, harm, scale)


def octave(tokens, shift):
    return re.sub(r'([A-G][#b]?)(\d)', lambda m: m.group(1) + str(int(m.group(2)) + shift), tokens)


def arr(**kw):
    return kw


# ============================================================================ 1. Classic ballad
def classic():
    BMIN = scale('B', NATMIN)
    BPENT = scale('B', PENT)
    BHARM = scale('B', HARM)
    cyc = 'Bm:8 Em7:8 A7:8 Dmaj7:8 Gmaj7:8 C#m7b5:8 F#7sus4:8 F#7:8'
    S = [
        Section('Intro', 4, 'Bm:8 Em7:8 A7:8 Dmaj7:8 Gmaj7:8 C#m7b5:8 F#7',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.35, .45), organ=(.3, .45), strings=(.15, .35), lead=(.45, .6)),
                lead=['| B3:2 D4:2 E4>F#4:4~< /G4:5~ F#4:1_ E4:2',
                      '| C#4:2 E4:2 G4:4~ G4>A4:5~~ G4:1_ F#4:2',
                      '| B4:8~< r:8',
                      '| A#4:10~< r:6']),
        Section('Verse', 6, 'Bm Em7 A7 Dmaj7 Gmaj7 C#m7b5:8 F#7:8',
                arr(drums=('ballad', 1), bass='ballad', rhythm='arp8', rhythm_lvl=(.5, .55), organ=(.35, .45),
                    lead=(.5, .5), vocal=(.55, .7), fill=True),
                vocal=['| r:4 F#4:2 E4:2 F#4:2 D4:2 D4:4~',
                       '| r:2 E4:2 G4:2 G4:2 F#4:2 E4:6',
                       '| r:4 E4:2 E4:2 G4:3 F#4:1 E4:4',
                       '| F#4:8~ r:8',
                       '| r:2 B3:2 D4:2 G4:2 G4:4 F#4:2 D4:2',
                       '| E4:6 D4:2 C#4:8~']),
        Section('Chorus', 4, 'Em7:8 A7:8 Dmaj7:8 Gmaj7:8 C#m7b5:8 F#7:8 Gmaj7:8 F#7:8',
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.65, .7), organ=(.5, .65),
                    strings=(.4, .6), lead=(.6, .65), vocal=(.8, 1.0), fill=True, crash=True),
                vocal=['| r:2 G4:2 G4:2 B4:2 A4:4 G4:2 E4:2',
                       '| F#4:8~ r:6 F#4:2',                       # ... "I'll"
                       '| G4:4 F#4:2 C#5:6~ A#4:4',                # "nev-er LOVE a-"
                       '| B4:8~ r:8'],                             # "-gain" on a deceptive cadence
                lead=['| r:16 | r:16 | r:16 | r:12 F#4:1 E4:1_ D4:1_ C#4:1_']),
        Section('Solo-A', 4, cyc,
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.55, .6), organ=(.5, .55),
                    strings=(.35, .5), lead=(.72, .8), crash=True),
                lead=['| B3:2 D4:2 E4>F#4:4~ /G4:5~ F#4:1_ E4:2',
                      '| C#4:2 E4:2 G4:4~ G4>A4:5~~ G4:1_ F#4:2',
                      '| D4:2 G4:2 B4:4~ D5>E5:6~~ D5:1_ C#5:1_',
                      '| B4:6~ A#4:2 C#5:2 A#4:2 F#4:4~']),
        Section('Solo-B', 4, cyc,
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.6, .7), organ=(.55, .65),
                    strings=(.5, .65), lead=(.8, .9), fill=True),
                lead=['| r:1 F#4:1 B4:1 D5:1 F#5:4~ E5:2 G5:2~ F#5:1_ E5:1_ D5:2',
                      '| C#5:1 E5:1 G5:1 A5:3~ G5:1_ E5:1_ F#5:3~ E5:1 D5:1 F#5:1 A5:2',
                      '| A5>B5:4~~ A5:1_ G5:1_ F#5:1 D5:1 E5:1 G5:1 B5:2~ A5:1_ G5:1_ E5:2',
                      '| F#5:3~ E5:1 C#5:2 B4:2 A#4:1 C#5:1 E5:1 F#5:1 A#5:4~~']),
        Section('Solo-C', 4, cyc,
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.7, .8), organ=(.65, .75),
                    strings=(.6, .75), lead=(.9, .95), crash=True, fill=True),
                lead=['|', R(groups(BPENT, 'B5', 4, 4, -1), .5, accent=4),
                      R(asc(BMIN, 'E4', 11) + ['C#6'], '1/3'), 'B5:4~',
                      '|', R(['A5', 'G5', 'E5'] * 4, '1/3', accent=3), R(desc(BMIN, 'F#5', 8), .5),
                      R(['D4', 'F#4', 'A4', 'C#5', 'D5', 'F#5'], '2/3'), 'A5:4~',
                      '|', R(groups(BMIN, 'G4', 3, 8, 1), '1/3', accent=3),
                      R(['B5', 'G5', 'E5', 'C#5', 'G5', 'E5', 'C#5', 'B4', 'E5', 'C#5', 'B4', 'G4', 'C#5', 'B4', 'G4', 'E4'], .5, accent=4),
                      '|', R(asc(BHARM, 'F#4', 8), .5), 'G5:2 F#5:2',
                      R(asc(BHARM, 'A#4', 11) + ['C#6'], '1/3'), 'C#6:4~~!']),
        Section('Solo-D', 4, cyc,
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.8, .9), organ=(.75, .9),
                    strings=(.75, 1.0, True), lead=(.95, 1.0), crash=True, fill=True),
                lead=['| r:1/3', R(asc(BMIN, 'B3', 11), '1/3'), 'F#5:4~~!T',
                      R(asc(BMIN, 'B3', 12), '1/3'), 'G5:4~~!T',
                      '|', R(['C#5', 'A4', 'G4', 'A4', 'E5', 'C#5', 'A4', 'C#5', 'G5', 'E5', 'C#5', 'E5'], '1/3', tops=4), 'G5:4~T',
                      'G5>A5:5~~!T', R(desc(BMIN, 'G5', 6), .5),
                      '|', R(['D5', 'B4', 'G4', 'B4', 'G5', 'D5', 'B4', 'D5', 'B5', 'G5', 'D5', 'G5'], '1/3', tops=4), 'B5:4~~!T',
                      R(['E5', 'G5', 'B5', 'C#6', 'B5', 'C#6'], '1/3'), 'D6>E6:6~~!T',
                      '| C#6:2_ B5:4~~!T A#5:2T',
                      R(['C#6', 'A#5', 'F#5', 'E5', 'A#5', 'F#5', 'E5', 'C#5', 'F#5', 'E5', 'C#5', 'A#4'], '1/3', tops=4),
                      R(asc(BHARM, 'F#4', 11) + ['A5'], '1/3')]),
        Section('Outro', 3, 'Bm Gmaj7 Bm',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.5, .25), organ=(.7, .25), strings=(.8, .25),
                    lead=(1.0, .5), crash=True),
                lead=['| A5>B5:16~~! | B5:12~~ r:4 | r:2 F#4:2 B4:2 D5:10~<'],
                aux=['| r:10 F#6:18F r:4 | r:16']),
    ]
    S[-1].aux = ['| r:10 F#6:18F r:4 | r:16']
    return Piece('1-classic-ballad', 'Classic ballad', 'B minor', 66, (4, 4), S,
                 dict(lead=GM['dist'], vocal=GM['clarinet'], rhythm=GM['clean'], rhythm_power=GM['overdrive'], organ=GM['drawbar']),
                 notes=dict(
                     direction='Closest to the classic minor-key guitar ballad. Descending circle-of-fifths cycle, two chords per bar. Strings and Hammond.',
                     harmony='Bm - Em7 - A7 - Dmaj7 - Gmaj7 - C#m7b5 - F#7sus4 - F#7. The chorus ends on Gmaj7, not Bm: the vow lands on a deceptive cadence.',
                     solo='The theme climbs in a rising sequence (B3 to a bent E5) while the chords fall. Solo-D plays the theme one octave higher: runs land on its long notes, then its notes become the accented tops of sextuplets. The peak is a whole-step bend at fret 22.',
                     question='Is the rising theme against the falling chords the right kind of ache, or do you want a simpler, more singable theme?',
                     recap_shift=12),
                 seed=11)


# ============================================================================ 2. Nocturne
def nocturne():
    EMIN = scale('E', NATMIN)
    EPENT = scale('E', PENT)
    EHARM = scale('E', HARM)
    lament = 'Em B7/D# G/D A7/C# Cmaj7 G/B'
    verse = ['| r:3 E4:1 F#4:1 G4:1 | F#4:3 r:3',
             '| r:3 G4:1 A4:1 B4:1 | A4:3 G4:2 E4:1',
             '| r:3 E4:1 G4:1 B4:1 | B4:2 A4:1 G4:3',
             '| r:2 A4:1 A4:1 G4:1 E4:1 | F#4:6~',
             '| r:3 E4:1 F#4:1 G4:1 | A4:3 F#4:3',
             '| r:3 G4:1 A4:1 B4:1 | C#5:4 B4:1 A4:1']
    chorus = ['| B4:3~ G4:1 E4:1 G4:1 | A4:3 F#4:3 | r:1 F#4:1 A4:1 B4:2 A4:1 | G4:3~ r:2 B4:1',
              '| C5:2 B4:1 E5:3 | E5:3~ D#5:3 | E5:6~ | r:6']    # "I'll nev-er LOVE a-gain"
    S = [
        Section('Intro', 6, 'Em9 Em9 Cmaj7 Cmaj7 Am7 B7sus4:3 B7:3',
                arr(rhythm='arp6', rhythm_lvl=(.45, .55), strings=(.2, .35), lead=(.52, .64)),
                lead=['| r:1 E4:1 G4:1 A4>B4:3~< | B4:6~~<', '| G4:1 B4:1 D5>E5:4~ | E5:4~ D5:1_ B4:1',
                      '| C5:4~ B4:1_ A4:1 | B4:6~<']),
        Section('Verse', 12, lament + ' Am7 B7 Em B7/D# G/D A7/C#',
                arr(bass='sparse', rhythm='arp6', rhythm_lvl=(.4, .5), strings=(.15, .3), lead=(.5, .5), vocal=(.5, .65)),
                vocal=[octave(' '.join(verse), -1)]),
        Section('Chorus', 8, 'Cmaj7 D Bm7 Em Am7 B7sus4:3 B7:3 Cmaj7 B7',
                arr(drums=('c', 1), bass='pulse', rhythm='arp6', rhythm_lvl=(.5, .6), strings=(.3, .5), organ=(.2, .35),
                    lead=(.5, .5), vocal=(.7, .95)),
                vocal=[octave(' '.join(chorus), -1)]),
        Section('Solo-A', 8, lament + ' Am7 B7',
                arr(drums=('c', 1), bass='sparse', rhythm='arp6', rhythm_lvl=(.45, .5), strings=(.25, .4), lead=(.68, .78)),
                lead=['| r:1 E4:1 G4:1 A4>B4:3~ | B4:4~~< A4:2', '| G4:1 B4:1 /D5:4~ | C#5:4~ B4:1_ A4:1_',
                      '| G4:1 B4:1 D5>E5:4~~ | D5:5~ B4:1', '| C5:4~ B4:1_ A4:1 | F#4:6~~']),
        Section('Solo-B', 6, 'Em Em/G Am7 B7 Cmaj7 D',
                arr(drums=('c', 1), bass='pulse', rhythm='arp6', rhythm_lvl=(.5, .6), strings=(.35, .55), organ=(.25, .4),
                    lead=(.78, .88), fill=True),
                lead=['| r:1 B4:1 E5:1 G5:2~ F#5:1', '| E5:1 F#5:1 G5:1 A5>B5:3~~', '| A5:2~ G5:1 E5:1 G5:1 A5:1',
                      '| F#5:.5 A5:.5 B5:2~ A5:.5_ F#5:.5_ D#5:2~', '| E5:.5 G5:.5 B5:.5 C6:2.5~~ B5:.5_ G5:.5_ E5:1',
                      '| F#5:.5 A5:.5 D6:3~~ C6:.5_ A5:.5_ F#5:1']),
        Section('Solo-C', 6, 'Em Em Cmaj7 Cmaj7 Am7 B7',
                arr(drums=('c', 2), bass='pulse', rhythm='arp6', rhythm_lvl=(.6, .7), strings=(.5, .65), organ=(.4, .5),
                    lead=(.88, .94), crash=True),
                lead=['| B5:.5!', R(desc(EMIN, 'A5', 10), .25), R(asc(EMIN, 'E4', 12), .25),
                      '| B5:3~~!', R(groups(EPENT, 'B5', 4, 3, -1), .25, accent=4),
                      '|', R(groups(EMIN, 'E4', 3, 8, 1), .25, accent=3),
                      '| B5:3~~!', R(desc(EMIN, 'G5', 10), .25), 'G4:.5',
                      '|', R(['E5', 'C5', 'A4'] * 2 + ['G5', 'E5', 'C5'] * 2, .25, accent=3),
                      R(['A5', 'G5', 'E5'] * 2 + ['C6', 'A5', 'G5'] * 2, .25, accent=3),
                      '|', R(asc(EHARM, 'F#4', 12), .25), 'A5>B5:3~~!']),
        Section('Solo-D', 8, lament + ' Am7:3 B7sus4:3 B7',
                arr(drums=('c', 2), bass='pulse', rhythm='arp6', rhythm_lvl=(.7, .85), strings=(.6, 1.0, True), organ=(.5, .75),
                    lead=(.94, 1.0), crash=True, fill=True),
                lead=['| r:.25', R(asc(EMIN, 'E4', 11), .25), 'B5:3~~!T',
                      '| B5:1.5~T', R(['A5', 'F#5', 'D#5', 'B4', 'D#5', 'F#5'], .25), 'A5:3~~!T',
                      '|', R(['G5', 'D5', 'B4', 'D5', 'B5', 'G5', 'D5', 'G5', 'D6', 'B5', 'G5', 'B5'], .25, tops=4), 'D6:3~~!T',
                      '| C#6:3~~!T', R(['A5', 'G5', 'E5', 'C#5', 'A4', 'G4', 'A4', 'C#5', 'E5', 'G5', 'A5', 'B5'], .25),
                      '|', R(['C6', 'B5', 'G5', 'E5', 'G5', 'B5'], .25), 'D6>E6:4.5~~!T',
                      '| D6:2~~!T', R(groups(EPENT, 'D6', 4, 4, -1), .25, accent=4),
                      '|', R(['A4', 'C5', 'E5', 'G5', 'A5', 'B5'], .25), 'C6:1.5~!T', 'B5:1.5~!T',
                      R(['A5', 'G5', 'F#5', 'E5', 'D5', 'B4'], .25),
                      '| F#5:1.5~!T', R(asc(EHARM, 'B3', 16) + ['C#6', 'D6'], .25)]),
        Section('Outro', 5, 'Em Cmaj7 Amadd9 Em9 Em9',
                arr(bass='sparse', rhythm='arp6', rhythm_lvl=(.5, .2), strings=(.8, .15), organ=(.5, .15), lead=(1.0, .45), crash=True),
                lead=['| D6>E6:6~~!T | E6)D6:1 B5:5~ | B5:6~< | E5:6~< | E5:6~'],
                aux=['| r:3 B6:9F | r:18']),
    ]
    return Piece('2-nocturne', 'Nocturne', 'E minor', 87, (6, 8), S,
                 dict(lead=GM['dist'], vocal=GM['clarinet'], rhythm=GM['epiano'], rhythm_power=GM['epiano'], organ=GM['drawbar']),
                 notes=dict(
                     direction='Slower and much emptier. 6/8, felt in two. Electric piano, soft strings, brushes-level drums. The guide vocal sits one octave lower (baritone range).',
                     harmony='A lament bass falls by semitones (Em - B7/D# - G/D - A7/C# - Cmaj7 - G/B) while the melody rises against it. The chorus lands on Cmaj7 under "again".',
                     solo='Very long notes first: about 1.3 notes per second. The fast section uses legato flurries with long landing notes, not constant speed. Solo-D returns the theme one octave higher; every long theme note is fed by a run.',
                     question='Does this much space work for you, or does the solo need more notes before the fast section?',
                     recap_shift=12),
                 seed=22)


# ============================================================================ 3. Raw slow blues
def blues():
    CPENT = scale('C', PENT)
    CBLUES = scale('C', BLUES)
    CHARM = scale('C', HARM)
    band = dict(drums=('c', 2), bass='blues12', rhythm='stabs')
    S = [
        Section('Intro', 3, 'Ab7 G7#9 Cm7:9 G7:3',
                arr(organ=(.4, .5), bass='sparse', lead=(.5, .65)),
                lead=['| r:1 C5:1 Eb5:1 F5>Gb5:5~ Eb5:1_ C5:3~', '| r:1 B4:1 D5:1 F5:3~ D5:2 B4:1 G4:3~',
                      '| r:1 G4:1 Bb4:1 Bb4>C5:6~~ r:3']),
        Section('Verse', 6, 'Cm7 Fm7 Cm7 Cm7:9 C7:3 Fm7 Fm7',
                arr(organ=(.4, .5), rhythm_lvl=(.45, .5), lead=(.5, .55), vocal=(.6, .75), **band),
                vocal=['| r:3 G4:1 G4:1 Bb4:1 G4:2 Eb4:1 C4:3', '| r:3 Ab4:2 G4:1 F4:3~ r:3',
                       '| r:3 G4:1 G4:1 Bb4:1 C5:2 Bb4:1 G4:3~', '| r:3 Eb4:1 F4:1 G4:1 Eb4:3 C4:3',
                       '| r:3 C5:2 C5:1 Ab4:2 F4:1 Ab4:3', '| F4:4~ r:8'],
                lead=['| r:12', '| r:9 Ab4:1 C5:1 Eb5:1', '| F5>G5:2~ Eb5:1_ r:9', '| r:12', '| r:12',
                      '| r:4 C5:1 Eb5:1 F5:2~ Eb5:1_ C5:1 Bb4>C5:2~']),
        Section('Chorus', 6, 'Cm7 Cm7/Bb Ab7 G7#9 Fm7 Ab7:6 G7:6',
                arr(organ=(.5, .65), rhythm_lvl=(.55, .65), lead=(.6, .7), vocal=(.8, 1.0), fill=True, **band),
                vocal=['| r:3 Eb4:1 G4:1 Bb4:1 G4:3 Eb4:2 C4:1', '| r:3 Eb4:1 G4:1 Bb4:1 C5:3 Bb4:3',
                       '| r:3 C5:2 Bb4:1 Ab4:3 Gb4:2 G4:1',      # ... "I'll"
                       '| Bb4:2 G4:1 D5:6~ B4:3',                # "nev-er LOVE a-"
                       '| C5:6~ r:6', '| r:12'],                 # "-gain" over the iv chord
                lead=['| r:12 | r:12 | r:12 | r:12', '| r:6 Ab4:1 C5:1 Eb5:1 F5:3~', '| Eb5:3~ Gb5:1 Eb5:1 C5:1 B4:2~ G4:1 r:3']),
        Section('Solo-A', 3, 'Cm7 Fm7 Cm7',
                arr(organ=(.45, .5), rhythm_lvl=(.5, .5), lead=(.72, .8), crash=True, **band),
                lead=['| r:1 G4:1 Bb4:1 Bb4>C5:5~~ Bb4:1_ G4:3~', '| r:1 F4:1 Ab4:1 C5:3~ D5>Eb5:4~~ C5:2',
                      '| G4:3~ Eb4:1 F4:1 G4:1 C4:6~~']),
        Section('Solo-B', 3, 'C7 Fm7 F#dim7',
                arr(organ=(.5, .6), rhythm_lvl=(.55, .65), lead=(.8, .9), fill=True, **band),
                lead=['| r:1 E4:1 G4:1 Bb4:2 C5:1 E5:3~ G5:2~ F5:.5_ Eb5:.5_',
                      '| C5:1 Eb5:1 F5:1 Ab5:3~ Bb5>C6:3~~ Ab5:1 F5:1 Eb5:1',
                      '| C5:1 Eb5:1 F#5:1 A5:3~ C6:1.5~ A5:1.5 F#5:1 Eb5:1 C5:1']),
        Section('Solo-C', 3, 'Cm/G Ab7 G7#9',
                arr(organ=(.6, .75), rhythm_lvl=(.65, .75), lead=(.9, .95), crash=True,
                    drums=('c', 3), bass='blues12', rhythm='stabs', fill=True),
                lead=['|', R(['Eb5', 'C5', 'Bb4'] * 4, .25, accent=3), R(groups(CPENT, 'Eb5', 4, 3, -1), .25, accent=4),
                      R(asc(CBLUES, 'C4', 12), .25), 'Bb5>C6:3~~!',
                      '|', R(['C6', 'Bb5', 'Ab5'] * 2 + ['Bb5', 'Ab5', 'Gb5'] * 2, .25, accent=3),
                      R(['Ab5', 'Gb5', 'Eb5'] * 2 + ['Gb5', 'Eb5', 'C5'] * 2, .25, accent=3),
                      R(desc(CBLUES, 'Eb5', 12), .25), 'Ab3:1 C4:1 Eb4:1',
                      '|', R(asc(CHARM, 'G3', 12), .25), R(asc(CHARM, 'G4', 12), .25), 'D6:1.5~! Bb5:1.5 B5:3~~!']),
        Section('Solo-D', 4, 'Cm7 Fm7 Cm/G:6 Ab7:6 G7#9',
                arr(organ=(.75, .95), rhythm_lvl=(.75, .9), lead=(.95, 1.0), crash=True,
                    drums=('c', 3), bass='blues12', rhythm='stabs'),
                stop_bars=(3,),
                lead=['|', R(asc(CBLUES, 'C4', 12), .25), 'Bb5>C6:4~~!T',
                      R(['G5', 'Eb5', 'F5', 'Eb5', 'C5', 'Eb5', 'F5', 'Gb5'], .25), 'G5:3~!T',
                      '|', R(['F5', 'C5', 'Ab4', 'C5', 'Ab5', 'F5', 'C5', 'F5', 'C6', 'Ab5', 'F5', 'Ab5'], .25, tops=4),
                      'D6>Eb6:6~~!T C6:1!T Ab5:1 F5:1',
                      '|', R(groups(CPENT, 'G5', 4, 3, -1), .25, accent=4),
                      R(['G4', 'Bb4', 'C5', 'Eb5', 'F5', 'Gb5', 'G5', 'Bb5'], .25), 'C6:1!T',
                      'Bb5>C6:3~~!T', R(['C6', 'Bb5', 'Ab5', 'Gb5', 'Eb5', 'Gb5', 'Ab5', 'Bb5', 'C6', 'Bb5', 'C6', 'D6'], .25),
                      '| D6:3~~!', R(desc(CBLUES, 'Bb5', 12), .25), R(asc(CHARM, 'B3', 12), .25), 'F5>G5:3~~!']),
        Section('Outro', 2, 'Cm7 Cm69',
                arr(organ=(.8, .3), bass='sparse', lead=(1.0, .5), crash=True),
                lead=['| Bb5>>C6:10~~!T r:2 | r:1 G4:1 Eb4:1 C4:9~<'],
                aux=['| r:4 G6:7F r:1 | r:12']),
    ]
    return Piece('3-raw-slow-blues', 'Raw slow blues', 'C minor', 90, (12, 8), S,
                 dict(lead=GM['overdrive'], vocal=GM['clarinet'], rhythm=GM['clean'], rhythm_power=GM['clean'], organ=GM['rock_organ']),
                 notes=dict(
                     direction='A 12/8 minor blues with a small band: organ, bass, drums and guitar stabs. No strings. Overdriven lead, not full distortion. The lead answers the vocal in the verse.',
                     harmony='Minor-blues form: Cm7 - Fm7 - Cm7 - C7 - Fm7, then Cm7 - Cm7/Bb - Ab7 - G7#9. "Again" lands on Fm7 (the iv chord), not on Cm.',
                     solo='A short blues motto: two pickup notes, a bend to the tonic, a step down. Blues-box repeated licks and blues-scale runs make the fast part. Solo-D returns the motto one octave higher. The band stops for a one-bar cadenza before the last chord.',
                     question='Do you want this much grit and this little harmony, or is the song a ballad first and a blues second?',
                     recap_shift=12),
                 seed=33)


# ============================================================================ 4. Cinematic long-form
def cinematic():
    DMIN = scale('D', NATMIN)
    DHARM = scale('D', HARM)
    EMIN = scale('E', NATMIN)
    EHARM = scale('E', HARM)
    S = [
        Section('Intro', 4, 'Dmadd9 Bbmaj7 Gm7 A7sus4:8 A7:8',
                arr(strings=(.35, .55), organ=(.3, .4), lead=(.6, .7)),
                lead=['| r:2 A3:2 /F4:8~< E4:2_ D4:2', '| D4:12~< r:4', '| r:2 G3:2 D4:2 G4:2 /Bb4:8~<', '| A4:12~< r:4']),
        Section('Verse', 6, 'Dm Dm/C Bbmaj7 Gm7 Ebmaj7 A7sus4:8 A7:8',
                arr(drums=('ballad', 1), bass='ballad', rhythm='arp8', rhythm_lvl=(.45, .55), strings=(.25, .4), organ=(.25, .35),
                    lead=(.5, .5), vocal=(.55, .7), fill=True),
                vocal=['| r:4 D4:2 E4:2 F4:4 E4:2 D4:2', '| A4:6~ G4:2 F4:4 r:4', '| r:4 D4:2 F4:2 A4:4 G4:2 F4:2',
                       '| G4:6~ F4:2 D4:6 r:2', '| r:4 Eb4:2 G4:2 Bb4:6 G4:2', '| A4:6~ G4:2 E4:8~']),
        Section('Chorus', 5, 'F:8 C/E:8 Dm:8 Bbmaj7:8 Gm7 A7sus4:8 A7:8 Bbmaj7:8 C:8',
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.6, .7), strings=(.45, .7), organ=(.4, .5),
                    lead=(.6, .6), vocal=(.8, 1.0), crash=True, fill=True),
                vocal=['| r:2 A4:2 A4:2 C5:2 C5:4 G4:4', '| A4:6~ F4:2 D4:4 r:2 D4:2',     # ... "I'll"
                       '| Bb4:6 A4:2 G4:4 r:4',                                            # "nev-er"
                       '| D5:10~ C#5:6',                                                   # "LOVE a-"
                       '| A4:8~ r:8']),                                                    # "-gain": a major 7th over Bb
        Section('Solo-A', 4, 'Dm Bbmaj7 Gm7 A7',
                arr(drums=('ballad', 1), bass='ballad', rhythm='arp8', rhythm_lvl=(.5, .55), strings=(.35, .5), organ=(.3, .4),
                    lead=(.72, .8), crash=True),
                lead=['| r:2 A3:2 /F4:8~~ E4:2_ D4:2', '| r:2 Bb3:2 F4:4 G4>A4:6~~ G4:2',
                      '| r:2 G3:2 D4:2 G4:2 /Bb4:6~~ A4:2', '| G4:4~ E4:4 C#4:8~~']),
        Section('Solo-B', 4, 'Dm/F Gm7 Ebmaj7 A7sus4:8 A7:8',
                arr(drums=('ballad', 2), bass='ballad', rhythm='arp8', rhythm_lvl=(.55, .7), strings=(.5, .7), organ=(.4, .5),
                    lead=(.8, .9), fill=True),
                lead=['| r:1 A4:1 F5:4~ E5:1_ D5:1 r:1 D5:1 A5:4~ G5:1_ F5:1',
                      '| r:1 Bb4:1 G5:4~ F5:1_ D5:1 Bb5:6~~ A5:1_ G5:1',
                      '| G5:2 Bb5:2 D6:6~~ Bb5:1_ C6:1_ G5:2 F5:1 Eb5:1',
                      '| D5:1 E5:1 G5:2 A5:4~ C#5:1 E5:1 G5:1 A5:1 C#6:4~~']),
        Section('Solo-C', 4, 'Dm Bbmaj7 Gm7:8 C7:8 A7:8 B7:8',
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.7, .8), strings=(.65, .8), organ=(.5, .6),
                    lead=(.9, .95), crash=True, fill=True),
                lead=['| D6:2~!', R(desc(DMIN, 'C6', 6), '1/3'), R(desc(DMIN, 'D5', 12), '1/3'),
                      R(groups(DMIN, 'D4', 3, 8, 1), '1/3', accent=3),
                      '| A5:2~!', R(['F5', 'D5', 'Bb4', 'F4', 'Bb4', 'D5'], '1/3'), R(desc(DMIN, 'D6', 12), '1/3'),
                      R(['Bb4', 'D5', 'F5', 'A5', 'F5', 'D5'] * 2, '1/3', accent=6), R(['D5', 'F5', 'A5', 'D6', 'A5', 'F5'], '1/3'), 'A5:2~',
                      '|', R(['D6', 'Bb5', 'G5'] * 2 + ['C6', 'Bb5', 'G5'] * 2, '1/3', accent=3), R(desc(DMIN, 'Bb5', 12), '1/3'),
                      R(asc(DMIN, 'E4', 12), '1/3'), 'C6:2~!', R(['Bb5', 'G5', 'E5', 'C5', 'E5', 'G5'], '1/3'),
                      '|', R(asc(DHARM, 'G4', 12), '1/3'), 'C#6:4~~!',
                      R(['B4', 'D#5', 'F#5', 'A5', 'B5', 'A5', 'F#5', 'D#5'], .5), 'A5>B5:4~~!']),
        Section('Solo-D', 5, 'Em Cmaj7 Am7 B7sus4:8 B7:8 Cmaj7:8 D:8',
                arr(drums=('ballad', 3), bass='ballad', rhythm='arp8', rhythm_lvl=(.8, .9), strings=(.8, 1.0, True), organ=(.6, .8),
                    lead=(.95, 1.0), crash=True, fill=True),
                lead=['|', R(asc(EMIN, 'B3', 12), '1/3'), 'G5:8~~!T F#5:2_T E5:2T',
                      '|', R(['C5', 'G4', 'E4', 'G4', 'E5', 'C5', 'G4', 'C5', 'G5', 'E5', 'C5', 'E5'], '1/3', tops=4), 'A5>B5:8~~!T',
                      R(['G5', 'E5', 'C5', 'E5', 'G5', 'A5', 'B5', 'C6', 'B5', 'A5', 'G5', 'E5'], '1/3'),
                      '|', R(['A4', 'C5', 'E5', 'A5', 'E5', 'C5'], '1/3', tops=3), R(['E5', 'A5', 'C6', 'A5', 'E5', 'A5'], '1/3'),
                      'C6:6~~!T B5:2~!T', R(desc(EMIN, 'A5', 6) + asc(EMIN, 'D5', 6), '1/3'),
                      '| A5:2~!T', R(['F#5', 'E5', 'B4', 'E5', 'F#5', 'A5'], '1/3'), 'F#5:2~!T', R(['E5', 'B4', 'A4', 'B4', 'E5', 'F#5'], '1/3'),
                      'D#5:2~!T', R(asc(EHARM, 'E4', 12), .5),
                      '|', R(['G5', 'E5', 'C5', 'E5', 'G5', 'B5'], '1/3'), 'C6:6~~!',
                      R(['F#4', 'A4', 'D5', 'F#5', 'A5', 'C6'], '1/3'), 'D6:6~~!']),
        Section('Outro', 3, 'Em Cmaj7 Em9',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.5, .2), strings=(.9, .2), organ=(.6, .2), lead=(1.0, .45), crash=True),
                lead=['| D6>E6:16~~! | E6)D6:2 B5:8~ r:6 | r:2 B3:2 /G4:8~<T F#4:2_T E4:2T'],
                aux=['| r:6 B6:16F r:10 | r:16']),
    ]
    return Piece('4-cinematic-long-form', 'Cinematic long-form', 'D minor, then E minor', 70, (4, 4), S,
                 dict(lead=GM['dist'], vocal=GM['clarinet'], rhythm=GM['clean'], rhythm_power=GM['overdrive'], organ=GM['drawbar']),
                 notes=dict(
                     direction='A composed arc built from one four-note cell: a leap up a sixth, then a two-step sigh down. Strings carry the crescendo.',
                     harmony='Dm - Bbmaj7 - Gm7 - A7 with a Neapolitan Ebmaj7 in the verse and Solo-B. A B7 pivot lifts the climax up a whole step to E minor. "Again" is a major 7th over Bbmaj7.',
                     solo='Solo-A states the cell low and warm. Solo-B shrinks the cell and moves it up in sequence. Solo-D returns the theme in the new key, one octave higher, and ends on a C - D - E climb over bVI - bVII - i. The last bar is the cell again, quiet.',
                     question='Does the key change at the climax feel earned, or does it feel like a trick?',
                     recap_shift=14),
                 seed=44)


# ============================================================================ 5. Power ballad
def power():
    AMIN = scale('A', NATMIN)
    APENT = scale('A', PENT)
    AHARM = scale('A', HARM)
    c1a = groups(APENT, 'C6', 4, 4, -1)
    c1b = groups(AMIN, 'F4', 3, 8, 1)
    c3a = ['C6', 'A5', 'E5'] * 2 + ['B5', 'A5', 'E5'] * 2
    c3b = ['A5', 'E5', 'C5'] * 2 + ['G5', 'E5', 'C5'] * 2
    c4a = desc(AHARM, 'D6', 12)
    S = [
        Section('Intro', 4, 'Am F C G',
                arr(rhythm='arp8', rhythm_lvl=(.6, .7), strings=(.25, .4), lead=(.62, .72)),
                lead=['| E4:6~< A4:2 C5:8~', '| A4:6~ G4:2_ F4:2 A4:2 C5:4~', '| G4:8~< r:8', '| B4:6~ A4:2_ G4:8~']),
        Section('Verse', 6, 'Am F C G/B Dm7 E7sus4:8 E7:8',
                arr(drums=('ballad', 1), bass='ballad', rhythm='arp8', rhythm_lvl=(.5, .6), organ=(.3, .4),
                    lead=(.5, .5), vocal=(.55, .7), fill=True),
                vocal=['| r:4 A3:2 C4:2 E4:4 D4:2 C4:2', '| C4:6~ r:2 A3:2 C4:2 F4:4', '| E4:6~ D4:2 C4:4 r:4',
                       '| r:4 D4:2 D4:2 G4:4 E4:2 D4:2', '| F4:6~ E4:2 D4:4 A4:4', '| A4:8 G#4:8~']),
        Section('Chorus', 6, 'F G C:8 G/B:8 Am Dm7:8 E7:8 Am',
                arr(drums=('power', 2), bass='power', rhythm='power', rhythm_lvl=(.6, .75), organ=(.45, .6), strings=(.4, .6),
                    lead=(.6, .7), vocal=(.85, 1.0), crash=True, fill=True),
                vocal=['| r:2 A4:2 A4:2 A4:2 C5:4 A4:4', '| B4:6~ G4:2 G4:4 r:4', '| r:2 G4:2 G4:2 C5:2 B4:4 G4:4',
                       '| A4:8~ r:6 A4:2',                               # ... "I'll"
                       '| A4:4 A4:2 D5:6~ B4:4',                         # "nev-er LOVE a-"
                       '| A4:8~ r:8'],                                   # "-gain": here the cadence is real
                lead=['| r:16 | r:16 | r:16 | r:16 | r:16', '| r:10 A3:2 C4:2 D4:2']),
        Section('Solo-A', 4, 'Am F C G',
                arr(drums=('power', 2), bass='power', rhythm='power', rhythm_lvl=(.6, .65), organ=(.45, .5), strings=(.3, .45),
                    lead=(.75, .82), crash=True),
                lead=['| /E4:6~ A4:2 B4>C5:8~~', '| A4:6~ G4:2_ F4:2 A4:2 C5:4~', '| D5>E5:7~~ D5:1_ C5:4 G4:4~', '| B4:6~ A4:2_ G4:8~~']),
        Section('Solo-B', 4, 'Am F Dm7 E7',
                arr(drums=('power', 2), bass='power', rhythm='power', rhythm_lvl=(.65, .75), organ=(.5, .6), strings=(.45, .6),
                    lead=(.82, .9), fill=True),
                lead=['| r:1 E5:1 A5:2~ G5:1_ E5:1 D5:1 E5:1 G5>A5:4~~ G5:1_ E5:1 G5:1 E5:1',
                      '| A4:1 C5:1 F5:2~ E5:1 F5:1 A5:2~ C6:4~~ A5:1_ G5:1_ F5:2',
                      '| D5:1 F5:1 A5:1 C6:1 D6:4~~ C6:1 A5:1 F5:1 D5:1 F5:2 A5:2',
                      '| G#5:3~ B5:1 D6:2 B5:1 G#5:1 E5:1 G#5:1 B5:1 C6:1 D6>E6:4~~']),
        Section('Solo-C', 4, 'F G Am E7/G#',
                arr(drums=('power', 3), bass='power', rhythm='power', rhythm_lvl=(.8, .9), chug=True, organ=(.6, .7), strings=(.55, .7),
                    lead=(.92, .96), crash=True, fill=True),
                lead=['|', R(c1a, .5, accent=4), R(c1b, '1/3', accent=3),
                      '| B5:2~!', R(['G5', 'D5', 'B4', 'D5', 'G5', 'B5'], '1/3'), R(desc(AMIN, 'D6', 12), '1/3'),
                      R(['G4', 'B4', 'D5', 'G5', 'B5', 'D6', 'B5', 'G5', 'D5', 'B4', 'G4', 'B4'], '1/3', accent=6),
                      R(['D5', 'G5', 'B5', 'D6', 'B5', 'G5'], '1/3'), 'D6:2~!',
                      '|', R(c3a, '1/3', accent=3), R(c3b, '1/3', accent=3),
                      R(asc(AMIN, 'A4', 11) + ['C6'], '1/3'), 'D6>E6:4~~!',
                      '|', R(c4a, '1/3'), R(asc(AHARM, 'G#4', 12), '1/3'),
                      R(['E5', 'G#5', 'B5', 'D6', 'B5', 'G#5'] * 2, '1/3', accent=6), 'G#5:1 B5:1 D6:2~!'],
                aux=['|', R(harm(c1a, APENT, -1), .5, accent=4), R(harm(c1b, AMIN, 2), '1/3', accent=3),
                     '| r:16',
                     '|', R(harm(c3a, AMIN, -2), '1/3', accent=3), R(harm(c3b, AMIN, -2), '1/3', accent=3), 'r:4 B5:4~~!',
                     '|', R(harm(c4a, AHARM, -2), '1/3'), 'r:12']),
        Section('Solo-D', 5, 'Am F C G E7sus4:8 E7:8',
                arr(drums=('power', 3), bass='power', rhythm='power', rhythm_lvl=(.85, 1.0), chug=True, organ=(.7, .9), strings=(.75, 1.0, True),
                    lead=(.96, 1.0), crash=True, fill=True),
                lead=['| E5:4~!T', R(['E5', 'F5', 'G5', 'A5', 'G5', 'E5'], '1/3'), 'A5:2!T B5>C6:5~~!T',
                      R(['B5', 'A5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', 'G5'], '1/3'),
                      '| A5:4~!T', R(['G5', 'C5', 'A4', 'C5', 'F5', 'C5', 'A4', 'C5', 'A5', 'F5', 'C5', 'F5'], '1/3', tops=4), 'C6:5~~!T',
                      R(['G5', 'A5', 'B5', 'C6', 'D6', 'C6', 'B5', 'C6', 'D6'], '1/3'),
                      '| D6>E6:8~~!T', R(['C6', 'G5', 'E5', 'G5', 'C6', 'D6'], '1/3', tops=6), R(['E5', 'G5', 'C6', 'G5', 'E5', 'C5'], '1/3'),
                      'G5:2~!T', R(['E5', 'C5', 'G4', 'C5', 'E5', 'G5'], '1/3'),
                      '| B5:4~~!T', R(['G5', 'D5', 'B4', 'D5', 'G5', 'B5'], '1/3'), 'A5:2!T G5:2~!T',
                      R(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'], '1/3', accent=6),
                      '| A5:2~!', R(['B4', 'E5', 'A5', 'B5', 'A5', 'E5'], '1/3'), 'B5:2~!', R(['E5', 'A5', 'B5', 'D6', 'B5', 'A5'], '1/3'),
                      'G#5:2~!', R(asc(AHARM, 'E4', 14) + ['C6', 'D6', 'C6', 'D6'], '1/3')],
                aux=['| r:8 G5>A5:5~~! r:3', '| F5:4~! r:4 A5:5~~! r:3', '| B5>C6:8~~! r:8', '| G5:4~~! r:12', '| r:16']),
        Section('Outro', 3, 'Am Fmaj7 Am',
                arr(bass='sparse', rhythm='arp8', rhythm_lvl=(.5, .25), organ=(.7, .25), strings=(.85, .2), lead=(1.0, .45), crash=True),
                lead=['| G5>A5:16~~!T | A5:8~~ r:8 | r:2 E4:2 A4:2 C5:10~<T'],
                aux=['| r:8 E6:18F r:6 | r:16']),
    ]
    return Piece('5-power-ballad', 'Power ballad', 'A minor', 72, (4, 4), S,
                 dict(lead=GM['dist'], vocal=GM['clarinet'], rhythm=GM['clean'], rhythm_power=GM['overdrive'], organ=GM['drawbar']),
                 notes=dict(
                     direction='The biggest version. Clean arpeggios in the verse, then power chords, heavy half-time drums and harmonised twin leads.',
                     harmony='Am - F - C - G (i - VI - III - VII) with Dm7 - E7 cadences. This is the only version where "again" lands on the tonic: the vow sounds certain, and the guitar then argues with it.',
                     solo='An anthem-like theme with wide intervals. The fast section is the most aggressive of the five: pentatonic fours, pedal licks and harmonic-minor runs, with a second guitar in thirds. Solo-D returns the theme one octave higher with the second guitar on the long notes.',
                     question='Is this too big for the song, or is this the size the climax needs?',
                     recap_shift=12),
                 seed=55)


ALL = [classic, nocturne, blues, cinematic, power]
