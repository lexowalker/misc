"""Composition engine for the "I'll Never Love Again" MIDI sketches.

A piece is described with small text tokens (see `parse_token`) and run helpers.
The engine turns that description into a multi-track MIDI file with an expressive
lead guitar (pitch bends, vibrato, slides, CC11 swells) and a simple generated band.

All time values inside the engine are in quarter notes. Each piece has a `unit`
(a sixteenth in 4/4, an eighth in 6/8 and 12/8) that the tokens use.
Everything is deterministic: the only randomness is a seeded RNG for humanising.
"""
import math
import random
import re
from fractions import Fraction

import mido

PPQ = 480
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

# General MIDI programs (0-based)
GM = dict(dist=30, overdrive=29, clean=27, epiano=4, drawbar=16, rock_organ=18, strings=48,
          bass=33, clarinet=71)

CH_LEAD, CH_AUX, CH_VOX, CH_RHY, CH_ORG, CH_STR, CH_BASS, CH_DRUM = 0, 1, 2, 3, 4, 5, 6, 9
BEND_RANGE = 12  # semitones, set with RPN 0 on the lead, aux and vocal channels
GTR_LO, GTR_HI = 40, 86  # E2 .. D6 (22 frets, standard tuning)


def nn(name):
    """'F#4' -> MIDI number (C4 = 60)."""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    if not m:
        raise ValueError('bad note name %r' % name)
    return PC[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)] + 12 * (int(m.group(3)) + 1)


def name_of(midi):
    return '%s%d' % (NAMES[midi % 12], midi // 12 - 1)


# ----------------------------------------------------------------------------- chords

QUAL = {
    '': (0, 4, 7), 'm': (0, 3, 7), '5': (0, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10),
    'maj7': (0, 4, 7, 11), 'm7b5': (0, 3, 6, 10), 'dim7': (0, 3, 6, 9), 'sus4': (0, 5, 7),
    '7sus4': (0, 5, 7, 10), '7#9': (0, 4, 7, 10, 15), 'add9': (0, 4, 7, 14), 'madd9': (0, 3, 7, 14),
    'm9': (0, 3, 7, 10, 14), 'm6': (0, 3, 7, 9), 'm69': (0, 3, 7, 9, 14), 'maj9': (0, 4, 7, 11, 14),
}


class Chord:
    def __init__(self, sym):
        self.sym = sym
        m = re.fullmatch(r'([A-G][#b]?)([^/]*)(?:/([A-G][#b]?))?', sym)
        if not m or m.group(2) not in QUAL:
            raise ValueError('bad chord %r' % sym)
        self.root = nn(m.group(1) + '0') % 12
        self.ivs = QUAL[m.group(2)]
        self.pcs = sorted({(self.root + i) % 12 for i in self.ivs})
        self.bass = nn(m.group(3) + '0') % 12 if m.group(3) else self.root

    def voicing(self, lo, n=4):
        """Close voicing: each chord tone at its lowest pitch at or above `lo`."""
        ps = sorted(lo + (pc - lo) % 12 for pc in self.pcs)
        return ps[:n]

    def third(self):
        return (self.root + self.ivs[1]) % 12

    def fifth(self):
        return (self.root + (self.ivs[2] if len(self.ivs) > 2 else 7)) % 12


# ----------------------------------------------------------------------------- scales and runs

NATMIN = (0, 2, 3, 5, 7, 8, 10)
HARM = (0, 2, 3, 5, 7, 8, 11)
PENT = (0, 3, 5, 7, 10)
BLUES = (0, 3, 5, 6, 7, 10)


def scale(root, ivs, lo=36, hi=90):
    r = nn(root + '0') % 12
    return [p for p in range(lo, hi + 1) if (p - r) % 12 in ivs]


def _p(x):
    return nn(x) if isinstance(x, str) else x


def asc(sc, start, n):
    i = sc.index(_p(start))
    return sc[i:i + n] if i + n <= len(sc) else _fail('asc beyond scale')


def desc(sc, start, n):
    i = sc.index(_p(start))
    if i - n + 1 < 0:
        _fail('desc beyond scale')
    return sc[i - n + 1:i + 1][::-1]


def groups(sc, start, size, count, direction):
    """Sequence: `count` groups of `size` scale steps; each group starts one step further."""
    i = sc.index(_p(start))
    out = []
    for g in range(count):
        for k in range(size):
            out.append(sc[i + direction * (g + k)])
    return out


def harm(pitches, sc, shift):
    """Diatonic harmony line: move every pitch `shift` scale steps."""
    return [sc[sc.index(_p(p)) + shift] for p in pitches]


def _fail(msg):
    raise ValueError(msg)


class R:
    """A fast run: equal note lengths, legato by default, optional accents."""

    def __init__(self, pitches, d, accent=None, legato=True, tops=None):
        self.pitches = [_p(p) for p in pitches]
        self.d = Fraction(d).limit_denominator(48) if not isinstance(d, Fraction) else d
        self.accent = accent      # accent every n-th note
        self.legato = legato
        self.tops = tops          # like accent, and the accented notes count as theme notes


# ----------------------------------------------------------------------------- tokens

TOK = re.compile(
    r'(?P<slide>/)?(?P<a>[A-G][#b]?\d|r)'
    r'(?:(?P<op>>>|>|\))(?P<b>[A-G][#b]?\d|q))?(?P<rel>>[A-G][#b]?\d)?'
    r':(?P<dur>[\d./]+)(?P<flags>[~!_<.\\FT]*)')


def parse_token(tok):
    """Token grammar (durations are in piece units):

    r:4            rest
    A4:6           plain note
    A4>B4:6        bend from the fretted A4 up to B4 (fast bend)
    A4>>B4:6       slow bend
    A4>q:3         quarter-tone "blue" bend
    A4>B4>A4:8     bend and release
    B4)A4:4        pre-bend: sounds B4 at the attack, releases to the fretted A4
    /A4:4          slide into the note from two frets below
    flags: ~ vibrato, ~~ wide vibrato, ! accent, _ legato (slurred from the previous note),
           < volume swell, . staccato, \\ fall-off, F feedback fade-in, T theme note (for the checks)
    """
    m = TOK.fullmatch(tok)
    if not m:
        raise ValueError('bad token %r' % tok)
    dur = Fraction(m.group('dur')) if '.' not in m.group('dur') else Fraction(m.group('dur')).limit_denominator(48)
    if m.group('a') == 'r':
        return dict(rest=True, dur=dur)
    fl = m.group('flags')
    a = nn(m.group('a'))
    n = dict(rest=False, dur=dur, fret=a, sound=a, mode='none', amt=0.0,
             vib=fl.count('~'), acc='!' in fl, leg='_' in fl, swell='<' in fl, stacc='.' in fl,
             fall='\\' in fl, fb='F' in fl, theme='T' in fl, slide=bool(m.group('slide')), run=False)
    op, b = m.group('op'), m.group('b')
    if op:
        if b == 'q':
            n.update(mode='up', amt=0.5)
        elif op == ')':
            hi = nn(m.group('a'))
            lo = nn(b)
            n.update(fret=lo, sound=hi, mode='pre', amt=float(hi - lo))
        else:
            tgt = nn(b)
            n.update(sound=tgt, amt=float(tgt - a), mode='slow' if op == '>>' else 'up')
            if m.group('rel'):
                n['mode'] = 'updown'
    return n


def flatten(items):
    """Items (token strings and R runs) -> list of note/rest dicts with unit durations.
    A '|' token asserts that the cursor sits on a bar line."""
    out = []
    for it in items:
        if isinstance(it, R):
            for i, p in enumerate(it.pitches):
                top = bool(it.tops) and i % it.tops == 0
                out.append(dict(rest=False, dur=it.d, fret=p, sound=p, mode='none', amt=0.0, vib=0,
                                acc=top or (bool(it.accent) and i % it.accent == 0),
                                leg=it.legato and i > 0 and not top, swell=False, stacc=False, fall=False,
                                fb=False, theme=top, slide=False, run=True))
        else:
            for tok in it.split():
                out.append('|' if tok == '|' else parse_token(tok))
    return out


# ----------------------------------------------------------------------------- piece model

class Section:
    def __init__(self, name, bars, chords, arr, lead=(), aux=(), vocal=(), stop_bars=()):
        self.name, self.bars, self.arr = name, bars, arr
        self.chords = chords.split() if isinstance(chords, str) else chords
        self.lead, self.aux, self.vocal = list(lead), list(aux), list(vocal)
        self.stop_bars = set(stop_bars)


class Piece:
    def __init__(self, slug, title, key, bpm, meter, sections, programs, notes, seed, feel_bpm=None):
        self.slug, self.title, self.key, self.bpm, self.meter = slug, title, key, bpm, meter
        self.sections, self.programs, self.notes, self.seed = sections, programs, notes, seed
        num, den = meter
        self.compound = den == 8
        self.unit = 0.5 if self.compound else 0.25          # quarters per token unit
        self.bar_q = num * 4.0 / den                        # quarters per bar
        self.bar_units = int(round(self.bar_q / self.unit))
        self.beat_q = 1.5 if self.compound else 1.0         # felt beat
        self.feel_bpm = feel_bpm or (bpm / 1.5 if self.compound else bpm)
        self.strong_q = [0.0, self.bar_q / 2] if num in (4, 12) else [0.0, 1.5]
        self._layout()

    def _layout(self):
        t = 0.0
        self.sec_start = {}
        self.chord_tl = []      # (t, dur, Chord, section)
        for s in self.sections:
            self.sec_start[s.name] = t
            s.t0 = t
            u = 0
            for c in s.chords:
                sym, d = c.split(':') if ':' in c else (c, self.bar_units)
                d = int(d)
                self.chord_tl.append((t + u * self.unit, d * self.unit, Chord(sym), s))
                u += d
            if u != s.bars * self.bar_units:
                raise ValueError('%s/%s: chords fill %d units, expected %d' % (self.slug, s.name, u, s.bars * self.bar_units))
            t += s.bars * self.bar_q
        self.total_q = t
        self.voices = {}
        for key in ('lead', 'aux', 'vocal'):
            notes = []
            for s in self.sections:
                notes += self._place(s, getattr(s, key), key)
            self.voices[key] = notes

    def _place(self, s, items, key):
        cur = Fraction(0)
        out = []
        for n in flatten(items):
            if n == '|':
                if cur % self.bar_units != 0:
                    raise ValueError('%s/%s/%s: bar line at unit %s (bar %d + %s)' % (
                        self.slug, s.name, key, cur, cur // self.bar_units + 1, cur % self.bar_units))
                continue
            if not n['rest']:
                n = dict(n, t=s.t0 + float(cur) * self.unit, d=float(n['dur']) * self.unit, section=s.name,
                         upos=float(cur))
                out.append(n)
            cur += n['dur']
        if items and cur != s.bars * self.bar_units:
            raise ValueError('%s/%s/%s: fills %s units, expected %d' % (self.slug, s.name, key, cur, s.bars * self.bar_units))
        return out

    def sec(self, q):
        return q * 60.0 / self.bpm

    def chord_at(self, t):
        for t0, d, c, _ in self.chord_tl:
            if t0 - 1e-6 <= t < t0 + d - 1e-6:
                return c
        return self.chord_tl[-1][2]

    def level(self, s, key, t):
        """Linear dynamic level of a part inside a section (0..1)."""
        v = s.arr.get(key)
        if v is None:
            return None
        l0, l1 = v[0], v[1]
        return l0 + (l1 - l0) * min(1.0, max(0.0, (t - s.t0) / (s.bars * self.bar_q)))

    def section_at(self, t):
        for s in self.sections:
            if s.t0 - 1e-6 <= t < s.t0 + s.bars * self.bar_q - 1e-6:
                return s
        return self.sections[-1]


# ----------------------------------------------------------------------------- MIDI writing

class Track:
    def __init__(self, name, channel=None, program=None):
        self.name, self.channel, self.ev = name, channel, []
        if program is not None:
            self.add(0, mido.Message('program_change', channel=channel, program=program))

    def add(self, tick, msg, prio=1):
        self.ev.append((max(0, int(round(tick))), prio, len(self.ev), msg))

    def note(self, t_q, d_q, pitch, vel):
        t0 = t_q * PPQ
        self.add(t0, mido.Message('note_on', channel=self.channel, note=int(pitch), velocity=int(max(1, min(127, vel)))), 2)
        self.add(max(t0 + 10, (t_q + d_q) * PPQ), mido.Message('note_off', channel=self.channel, note=int(pitch), velocity=0), 0)

    def cc(self, t_q, num, val):
        self.add(t_q * PPQ, mido.Message('control_change', channel=self.channel, control=num, value=int(max(0, min(127, val)))), 1)

    def bend(self, t_q, semis):
        v = int(round(max(-1.0, min(1.0, semis / BEND_RANGE)) * 8191))
        self.add(t_q * PPQ, mido.Message('pitchwheel', channel=self.channel, pitch=v), 1)

    def rpn_bend_range(self, semis):
        for num, val in ((101, 0), (100, 0), (6, semis), (38, 0), (101, 127), (100, 127)):
            self.add(0, mido.Message('control_change', channel=self.channel, control=num, value=val), 0)

    def to_mido(self):
        tr = mido.MidiTrack()
        tr.append(mido.MetaMessage('track_name', name=self.name, time=0))
        last = 0
        for tick, _, _, msg in sorted(self.ev, key=lambda e: (e[0], e[1], e[2])):
            tr.append(msg.copy(time=tick - last))
            last = tick
        return tr


def smooth(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def render_voice(piece, tr, notes, kind, rng):
    """Write an expressive monophonic line (lead, aux lead or guide vocal)."""
    spq = 60.0 / piece.bpm                      # seconds per quarter
    lead = kind in ('lead', 'aux')
    for i, n in enumerate(notes):
        s = piece.section_at(n['t'])
        lvl = piece.level(s, 'lead' if lead else 'vocal', n['t'])
        lvl = 0.7 if lvl is None else lvl
        dur_s = n['d'] * spq
        fast = dur_s < 0.2
        if lead and not fast and (n['amt'] > 0 or dur_s >= 0.7):
            # Subtle blues layback on bent and sustained lead notes
            jit = rng.uniform(0.006, 0.020)
        elif lead and fast:
            # Gentle human micro-timing contour inside fast runs
            jit = rng.uniform(-0.005, 0.006)
        else:
            jit = rng.uniform(-0.003, 0.003) if fast else rng.uniform(-0.008, 0.008)
        t = max(0.0, n['t'] + jit / spq)
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        slur_next = nxt is not None and nxt['leg'] and abs(nxt['t'] - (n['t'] + n['d'])) < 1e-6
        gate = n['d'] * (0.5 if n['stacc'] else 1.0)
        if slur_next:
            d = gate + 0.02 / spq
        elif fast:
            d = gate * 0.94
        else:
            d = gate - min(0.05 / spq, gate * 0.08)
        # velocity with subtle dynamic shaping on runs and bends
        vel = (62 + 50 * lvl) if lead else (70 + 30 * lvl)
        vel += 14 if n['acc'] else 0
        vel += 6 if (lead and n['amt'] >= 1.0 and not n['swell']) else 0
        vel -= 16 if n['leg'] else 0
        vel += rng.uniform(-4, 4)
        if n['fb']:
            vel = 96

        # ---- pitch curve (semitones relative to the fretted note), time in seconds
        amt, mode = n['amt'], n['mode']
        t_up = min(0.18, dur_s * 0.45)
        if mode == 'slow':
            t_up = min(0.95, dur_s * 0.42)
        vib_on = n['vib'] > 0 and dur_s >= 0.4
        wide = n['vib'] >= 2
        v_rate = 5.0 if wide else 4.7
        v_depth = (0.48 if wide else 0.24) if lead else 0.13
        v_delay = min(0.42, dur_s * 0.34) if mode in ('none', 'pre') else t_up + min(0.24, dur_s * 0.14)
        v_ramp = 0.32

        def curve(x):
            b = 0.0
            if mode == 'slow':
                # Lean briefly on the starting pitch before lifting into the bend
                lead_in = t_up * 0.14
                b = amt * smooth((x - lead_in) / max(0.04, t_up - lead_in))
            elif mode == 'up':
                b = amt * smooth(x / t_up)
            elif mode == 'updown':
                tr_ = min(0.28, dur_s * 0.32)
                b = amt * smooth(x / t_up) * (1 - smooth((x - (dur_s - tr_ * 1.35)) / tr_))
            elif mode == 'pre':
                hold = dur_s * 0.35
                b = amt * (1 - smooth((x - hold) / min(0.24, dur_s * 0.3)))
            if n['slide'] and x < 0.085:
                b += -2.0 * (1 - x / 0.085)
            if n['fall'] and x > dur_s - 0.22:
                b += -5.0 * smooth((x - (dur_s - 0.22)) / 0.22)
            if vib_on and x > v_delay:
                env = smooth((x - v_delay) / v_ramp)
                # Slight bloom over long sustains
                bloom = 1.0 + 0.15 * smooth((x - v_delay) / max(0.5, dur_s - v_delay))
                ph = 2 * math.pi * v_rate * (x - v_delay)
                if mode in ('up', 'slow') or (mode == 'updown' and x < dur_s * 0.7):
                    b += v_depth * env * bloom * (math.sin(ph) - 0.35)      # a bent string dips below the target
                else:
                    b += v_depth * env * bloom * 0.8 * (1 - math.cos(ph))   # an unbent string can only go sharp
            return b

        static = mode == 'none' and not n['slide'] and not n['fall'] and not vib_on
        tr.bend(t - 2.0 / PPQ, curve(0.0))
        tr.note(t, d, n['fret'], vel)
        if not static:
            step = 0.012
            x = step
            end = d * spq
            while x < end:
                tr.bend(t + x / spq, curve(x))
                x += step

        # ---- CC11 expression: section level, plus a swell on long notes
        base = 0.42 + 0.58 * lvl
        if n['fb']:
            k = 0.0
            while k <= 1.0001:
                x = k * dur_s
                env = smooth(k / 0.55) * (1 - 0.75 * smooth((k - 0.8) / 0.2))
                tr.cc(t + x / spq, 11, 127 * 0.8 * env)
                k += 0.02
        elif dur_s >= 0.55:
            x = 0.0
            while x < dur_s:
                k = x / dur_s
                if n['swell']:
                    env = 0.3 + 0.7 * smooth(k / 0.45)
                else:
                    env = 0.84 + 0.16 * smooth(k / 0.35)
                if n['fall'] and x > dur_s - 0.2:
                    env *= 1 - 0.8 * smooth((x - (dur_s - 0.2)) / 0.2)
                tr.cc(t + x / spq, 11, 127 * base * env)
                x += 0.04
        else:
            tr.cc(t - 1.0 / PPQ, 11, 127 * base)


# ----------------------------------------------------------------------------- band parts

KICK, RIM, SNARE, HAT, HATO, RIDE, CRASH, TOM1, TOM2, TOM3, TOM4 = 36, 37, 38, 42, 46, 51, 49, 50, 47, 45, 43


def drum_bar(piece, style, lvl, bar_index):
    """One bar of drums: list of (pos_q, note, velocity)."""
    h = []
    if lvl <= 0:
        return h
    if not piece.compound:
        if style == 'power':
            for i in range(8):
                h.append((i * 0.5, HATO if (lvl >= 3 and i % 2 == 0) else HAT, 78 if i % 2 == 0 else 55))
            if lvl >= 3:
                h += [(1, SNARE, 120), (3, SNARE, 122), (0, KICK, 118), (0.5, KICK, 96), (1.5, KICK, 104),
                      (2, KICK, 112), (2.5, KICK, 96), (3.5, KICK, 100)]
                if bar_index % 2 == 0:
                    h.append((0, CRASH, 108))
            else:
                h += [(2, SNARE, 118), (0, KICK, 114), (1.5, KICK, 98), (3.5, KICK, 92)]
                if bar_index % 4 == 0:
                    h.append((0, CRASH, 96))
        else:
            cym = RIDE if lvl >= 3 else HAT
            v = {1: 50, 2: 62, 3: 76}[lvl]
            for i in range(8):
                h.append((i * 0.5, cym, v if i % 2 == 0 else v - 16))
            if lvl == 1:
                h += [(1, RIM, 68), (3, RIM, 72), (0, KICK, 86), (2, KICK, 76)]
            elif lvl == 2:
                h += [(1, SNARE, 98), (3, SNARE, 102), (0, KICK, 100), (1.5, KICK, 78), (2, KICK, 92)]
            else:
                h += [(1, SNARE, 110), (3, SNARE, 114), (0, KICK, 110), (1.5, KICK, 88), (2, KICK, 102), (3.5, KICK, 86)]
                if bar_index % 4 == 0:
                    h.append((0, CRASH, 100))
    else:
        beats = int(round(piece.bar_q / 1.5))
        cym = RIDE if (lvl >= 3 or lvl == 1) else HAT
        v = {1: 44, 2: 60, 3: 74}[lvl]
        for b in range(beats):
            for k, dv in enumerate((0, -18, -12)):
                h.append((b * 1.5 + k * 0.5, cym, v + dv))
            back = b % 2 == 1
            if back:
                h.append((b * 1.5, RIM if lvl == 1 else SNARE, {1: 62, 2: 100, 3: 114}[lvl]))
            elif lvl >= 2 or b == 0:
                h.append((b * 1.5, KICK, {1: 80, 2: 98, 3: 110}[lvl] - (0 if b == 0 else 10)))
            if lvl >= 2 and not back and b > 0:
                h.append((b * 1.5 - 0.5, KICK, 74))
            if lvl >= 3 and back and b == beats - 1:
                h.append((b * 1.5 + 1.0, KICK, 84))
        if lvl >= 3 and bar_index % 2 == 0:
            h.append((0, CRASH, 100))
    return h


def drum_fill(piece, lvl):
    """Tom fill over the last felt beat (two beats when loud). Positions relative to bar start."""
    span = piece.beat_q * (2 if lvl >= 3 else 1)
    n = int(round(span / (0.25 if not piece.compound else 0.5))) if lvl < 3 else int(round(span / 0.25))
    start = piece.bar_q - span
    toms = [SNARE, TOM1, TOM2, TOM3, TOM4]
    out = []
    for i in range(n):
        tom = toms[min(len(toms) - 1, i * len(toms) // n)]
        out.append((start + i * span / n, tom, 70 + 12 * lvl + 20 * i / n))
    return out, start


def build_band(piece, tracks, rng):
    drums, bass, rhy, org, strs = (tracks[k] for k in ('drums', 'bass', 'rhythm', 'organ', 'strings'))
    bar_q = piece.bar_q
    # ---------------- drums
    bar_no = 0
    for si, s in enumerate(piece.sections):
        spec = s.arr.get('drums')
        nxt = piece.sections[si + 1] if si + 1 < len(piece.sections) else None
        for b in range(s.bars):
            t0 = s.t0 + b * bar_q
            hits = []
            if b in s.stop_bars:
                hits = [(0, KICK, 118), (0, CRASH, 112)]
            elif spec:
                hits = drum_bar(piece, spec[0], spec[1], b)
                if b == s.bars - 1 and s.arr.get('fill') and (b + 1) not in s.stop_bars:
                    fill, start = drum_fill(piece, spec[1])
                    hits = [x for x in hits if x[0] < start - 1e-6 or x[1] == KICK] + fill
            if b == 0 and s.arr.get('crash'):
                hits += [(0, CRASH, 110), (0, KICK, 112)]
            for pos, note, vel in hits:
                drums.note(t0 + pos + rng.uniform(-0.004, 0.004), 0.25, note, vel + rng.uniform(-4, 4))
            bar_no += 1
    # ---------------- chord-following parts
    tl = piece.chord_tl
    prog_state = {}
    for ci, (t0, d, ch, s) in enumerate(tl):
        nxt = tl[ci + 1][2] if ci + 1 < len(tl) else ch
        bar_in_sec = int((t0 - s.t0 + 1e-6) // bar_q)
        stop = bar_in_sec in s.stop_bars
        hit_d = piece.beat_q * 0.5
        # bass ------------------------------------------------------------
        style = s.arr.get('bass')
        if style:
            lvl = 0.55 + 0.35 * (piece.level(s, 'lead', t0) or 0.5)
            root = 28 + (ch.bass - 28) % 12            # E1 .. D#2
            if root > 40:
                root -= 12
            fifth = root + 7 if root + 7 <= 43 else root - 5
            nroot = 28 + (nxt.bass - 28) % 12
            appr = nroot + (1 if nroot < root else -1) if nroot != root else fifth
            if appr < 28:
                appr += 12
            ev = []
            if stop:
                ev = [(0, hit_d, root)]
            elif style == 'sparse':
                ev = [(0, d * 0.97, root)]
            elif style == 'pulse':
                ev = [(0, d - 0.5, root), (d - 0.5, 0.45, appr)]
            elif style == 'power':
                k = int(round(d / 0.5))
                ev = [(i * 0.5, 0.44, root) for i in range(k - 1)] + [((k - 1) * 0.5, 0.44, appr)]
            elif style == 'blues12':
                nb = int(round(d / 1.5))
                seq = [root, fifth, root + 12 if root + 12 <= 45 else root, None]
                for b in range(nb):
                    p0 = b * 1.5
                    if b == nb - 1 and nb > 1:
                        third = root + ch.ivs[1]
                        ev += [(p0, 0.48, fifth), (p0 + 0.5, 0.48, third if third <= 45 else third - 12), (p0 + 1.0, 0.48, appr)]
                    else:
                        p = seq[b % 4] or root
                        ev += [(p0, 0.98, p), (p0 + 1.0, 0.46, p)]
            else:  # ballad
                if d >= 3.9:
                    ev = [(0, 1.45, root), (1.5, 0.45, root), (2, 1.45, fifth), (3.5, 0.45, appr)] + \
                         [(4 + i, 0.95, root) for i in range(int(d - 4))]
                else:
                    ev = [(0, d - 0.55, root), (d - 0.5, 0.45, appr)]
            for pos, dd, p in ev:
                bass.note(t0 + pos + rng.uniform(-0.004, 0.004), dd, p, 62 + 40 * lvl + rng.uniform(-4, 4))
        # rhythm guitar / electric piano -----------------------------------------
        style = s.arr.get('rhythm')
        if style:
            want = piece.programs['rhythm_power'] if style == 'power' else piece.programs['rhythm']
            if prog_state.get('rhy') != want:
                rhy.add(max(0, t0 * PPQ - 2), mido.Message('program_change', channel=CH_RHY, program=want), 0)
                prog_state['rhy'] = want
            lvl = piece.level(s, 'rhythm_lvl', t0) or 0.6
            if stop:
                for p in ch.voicing(48, 4):
                    rhy.note(t0, hit_d, p, 88)
            elif style == 'power':
                r0 = 40 + (ch.bass - 40) % 12
                if r0 > 50:
                    r0 -= 12
                r0 = max(r0, 40)
                chord = [r0, r0 + 7, r0 + 12]
                k = int(round(d / 2.0)) or 1
                for i in range(k):
                    for p in chord:
                        rhy.note(t0 + i * 2.0 + rng.uniform(0, 0.006), min(1.95, d - i * 2.0 - 0.05), p, 78 + 30 * lvl)
                if s.arr.get('chug'):
                    for i in range(int(round(d / 0.5))):
                        if i % 4 != 0:
                            rhy.note(t0 + i * 0.5, 0.3, r0, 70 + 30 * lvl)
            elif style in ('arp8', 'arp6'):
                v = ch.voicing(48 if style == 'arp8' else 52, 4)
                low = v[0] - 12 if v[0] - 12 >= 40 else v[0]
                v = [low] + v[1:] + ([v[0] + 12] if len(v) < 4 else [])
                pat = [0, 1, 2, 3, 2, 1, 2, 3] if style == 'arp8' else [0, 1, 2, 3, 2, 1]
                k = int(round(d / 0.5))
                for i in range(k):
                    p = v[pat[i % len(pat)] % len(v)]
                    rhy.note(t0 + i * 0.5 + rng.uniform(-0.004, 0.004), 1.4, p,
                             44 + 34 * lvl + (8 if i % len(pat) == 0 else 0) + rng.uniform(-4, 4))
            elif style == 'stabs':
                v = ch.voicing(55, 4)
                nb = int(round(d / 1.5))
                for b in range(nb):
                    if b % 2 == 1:
                        for p in v:
                            rhy.note(t0 + b * 1.5 + 0.5 + rng.uniform(0, 0.008), 0.42, p, 56 + 34 * lvl)
                        if rng.random() < 0.5:
                            for p in v:
                                rhy.note(t0 + b * 1.5 + 1.0, 0.3, p, 44 + 30 * lvl)
            elif style == 'pad':
                for p in ch.voicing(52, 4):
                    rhy.note(t0, d * 0.97, p, 50 + 30 * lvl)
        # organ ---------------------------------------------------------------
        if s.arr.get('organ'):
            dd = hit_d if stop else d * 0.99
            for p in ch.voicing(55, 4):
                org.note(t0, dd, p, 80)
        # strings -------------------------------------------------------------
        if s.arr.get('strings'):
            sv = s.arr['strings']
            v = ch.voicing(57, 4)
            root = 36 + (ch.bass - 36) % 12
            ps = [root, root + 12] + v[-3:]
            if len(sv) > 2 and sv[2]:
                ps.append(v[-1] + 12)
            dd = hit_d if stop else d * 1.0
            for p in ps:
                strs.note(t0, dd, p, 84)
    # continuous CC11 for the pads
    for tr, key in ((org, 'organ'), (strs, 'strings')):
        for s in piece.sections:
            if not s.arr.get(key):
                continue
            n = int(s.bars * bar_q / 0.25)
            for i in range(n + 1):
                t = s.t0 + i * 0.25
                tr.cc(t, 11, 127 * (0.25 + 0.75 * piece.level(s, key, min(t, s.t0 + s.bars * bar_q - 1e-3))))


# ----------------------------------------------------------------------------- assemble

MIX = {  # CC7 volume, CC10 pan, CC91 reverb send
    'lead': (118, 64, 70), 'aux': (104, 74, 80), 'vocal': (112, 60, 60), 'rhythm': (74, 40, 50),
    'organ': (62, 84, 50), 'strings': (80, 58, 80), 'bass': (100, 64, 10), 'drums': (98, 64, 35),
}


def build_midi(piece, path):
    rng = random.Random(piece.seed)
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage('track_name', name="I'll Never Love Again - %s" % piece.title, time=0))
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(piece.bpm), time=0))
    meta.append(mido.MetaMessage('time_signature', numerator=piece.meter[0], denominator=piece.meter[1],
                                 clocks_per_click=36 if piece.compound else 24, time=0))
    last = 0
    for s in piece.sections:
        tick = int(round(s.t0 * PPQ))
        meta.append(mido.MetaMessage('marker', text=s.name, time=tick - last))
        last = tick
    end = int(round((piece.total_q + piece.bar_q * 0.5) * PPQ))
    meta.append(mido.MetaMessage('end_of_track', time=end - last))
    mid.tracks.append(meta)

    P = piece.programs
    tracks = {
        'lead': Track('Lead guitar', CH_LEAD, P['lead']),
        'aux': Track('Lead guitar 2 (harmony / feedback)', CH_AUX, P['lead']),
        'vocal': Track('Guide vocal', CH_VOX, P['vocal']),
        'rhythm': Track('Rhythm guitar / electric piano', CH_RHY, P['rhythm']),
        'organ': Track('Hammond organ', CH_ORG, P['organ']),
        'strings': Track('Strings', CH_STR, GM['strings']),
        'bass': Track('Bass', CH_BASS, GM['bass']),
        'drums': Track('Drums', CH_DRUM),
    }
    for k, tr in tracks.items():
        vol, pan, rev = MIX[k]
        tr.cc(0, 7, vol)
        tr.cc(0, 10, pan)
        tr.cc(0, 91, rev)
        tr.cc(0, 11, 100)
    for k in ('lead', 'aux', 'vocal'):
        tracks[k].rpn_bend_range(BEND_RANGE)
    render_voice(piece, tracks['lead'], piece.voices['lead'], 'lead', rng)
    render_voice(piece, tracks['aux'], piece.voices['aux'], 'aux', rng)
    render_voice(piece, tracks['vocal'], piece.voices['vocal'], 'vocal', rng)
    lyr = getattr(piece, 'lyrics', None)
    if lyr:      # one MIDI lyric event per sung note
        for sec, words in lyr.items():
            sung = [n for n in piece.voices['vocal'] if n['section'] == sec]
            for n, w in zip(sung, words):
                tracks['vocal'].add(n['t'] * PPQ, mido.MetaMessage('lyrics', text=w if w.endswith('-') else w + ' '), 1)
    build_band(piece, tracks, rng)
    for k, tr in tracks.items():
        if k == 'strings' and not any(s.arr.get('strings') for s in piece.sections):
            continue
        mid.tracks.append(tr.to_mido())
    mid.save(path)
    return mid
