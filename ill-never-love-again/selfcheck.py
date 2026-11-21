#!/usr/bin/env python3
"""Data checks for the five renditions. Run after generate.py (and after render.py for MP3 lengths).

Checks: duration, solo density curve, theme and fast material in Solo-D, chord tones on strong
beats, guitar range, playability (a fingering search), and originality against the private
reference score (only when references/ exists on this machine).
Writes renditions/NOTES.md and renditions/selfcheck.json.
"""
import json
import os
import subprocess
import sys

import mido

from gen import pieces
from gen.engine import GTR_HI, GTR_LO, name_of

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'renditions')
REF = os.path.join(HERE, 'references', 'mxl', 'lg-45587443.xml')
OPEN = [40, 45, 50, 55, 59, 64]            # E A D G B E
FAST = 0.16                                # seconds: inter-onset time that counts as "fast"
INTENT = {  # strong-beat notes that are not chord tones on purpose: (slug, section, bar, unit, voice) -> reason
    ('1-classic-ballad', 'Verse', 2, 8.0, 'vocal'): 'Appoggiatura: the 9th leans on the beat and resolves down to the root.',
}


def mmss(s):
    return '%d:%02d' % (int(s) // 60, int(s) % 60)


def lcs(a, b):
    m = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            m[i + 1][j + 1] = m[i][j] + 1 if x == y else max(m[i][j + 1], m[i + 1][j])
    return m[-1][-1]


# ------------------------------------------------------------------ playability
def fingering(notes, spq):
    """Dynamic programming over (string, fret) choices. Returns the chosen positions."""
    cands = []
    for n in notes:
        c = [(s, n['fret'] - o) for s, o in enumerate(OPEN) if 0 <= n['fret'] - o <= 22]
        cands.append(c)
    INF = 1e18
    cost = [[INF] * len(c) for c in cands]
    back = [[0] * len(c) for c in cands]

    def static(n, s, f):
        k = 0.02 * f                                   # mild preference for lower positions
        if n['amt'] >= 1.0:
            k += {0: 30, 1: 30, 2: 10, 3: 0, 4: 0, 5: 2}[s]      # bends belong on the G and B strings
            k += 6 if f < 5 else 0
        return k

    for j, (s, f) in enumerate(cands[0]):
        cost[0][j] = static(notes[0], s, f)
    for i in range(1, len(notes)):
        ioi = max(0.03, (notes[i]['t'] - notes[i - 1]['t']) * spq)
        w = min(8.0, 0.35 / ioi)                       # fast notes make movement expensive
        for j, (s, f) in enumerate(cands[i]):
            for k, (ps, pf) in enumerate(cands[i - 1]):
                df = abs(f - pf)
                ds = abs(s - ps)
                c = cost[i - 1][k] + w * (max(0, df - 3) ** 2 + 2.5 * max(0, ds - 1) ** 2 + 0.3 * df + 0.2 * ds)
                if s == ps and f == pf and ioi < FAST:
                    c += 0.5                           # fast repeated note
                c += static(notes[i], s, f)
                if c < cost[i][j]:
                    cost[i][j], back[i][j] = c, k
    j = min(range(len(cands[-1])), key=lambda x: cost[-1][x])
    path = []
    for i in range(len(notes) - 1, -1, -1):
        path.append(cands[i][j])
        j = back[i][j]
    return path[::-1]


def playability(p):
    notes = p.voices['lead']
    spq = 60.0 / p.bpm
    path = fingering(notes, spq)
    hard = []
    max_df = max_ds = 0
    for i in range(1, len(notes)):
        ioi = (notes[i]['t'] - notes[i - 1]['t']) * spq
        if ioi < FAST:
            (s0, f0), (s1, f1) = path[i - 1], path[i]
            df, ds = abs(f1 - f0), abs(s1 - s0)
            max_df, max_ds = max(max_df, df), max(max_ds, ds)
            if df > 5 or ds > 2 or (ds == 0 and df > 4 and ioi < 0.09):
                hard.append('%s bar %d: %s -> %s (string %d fret %d -> string %d fret %d)' % (
                    notes[i]['section'], int(notes[i]['upos'] // p.bar_units) + 1, name_of(notes[i - 1]['fret']),
                    name_of(notes[i]['fret']), 6 - s0, f0, 6 - s1, f1))
    bends = [(6 - path[i][0], path[i][1], n['amt']) for i, n in enumerate(notes) if n['amt'] >= 1.0]
    on_gb = sum(1 for s, f, a in bends if s in (2, 3))
    on_e = sum(1 for s, f, a in bends if s == 1)
    return dict(max_fret_jump_fast=max_df, max_string_jump_fast=max_ds, hard=hard, bends=len(bends),
                bends_on_g_b=on_gb, bends_on_high_e=on_e, max_bend=max([a for _, _, a in bends] or [0]),
                span=[min(f for _, f in path), max(f for _, f in path)])


# ------------------------------------------------------------------ originality
def ref_lines():
    if not os.path.exists(REF):
        return None
    sys.path.insert(0, os.path.join(HERE, 'analysis'))
    from mxl_parse import parse
    parts, _, _ = parse(REF)
    out = {}
    for pid, nm in (('P3', 'reference lead guitar'), ('P1', 'reference vocal line')):
        ns = sorted((n for n in parts[pid]), key=lambda n: (float(n['t']), n['midi']))
        out[nm] = [(float(n['t']) * 60 / 82.0, n['midi']) for n in ns]
    return out


def windows(seq, n=5):
    """seq: [(time_s, pitch)] -> {interval tuple: [(index, rhythm vector)]}"""
    d = {}
    for i in range(len(seq) - n):
        iv = tuple(seq[i + k + 1][1] - seq[i + k][1] for k in range(n))
        io = [seq[i + k + 1][0] - seq[i + k][0] for k in range(n)]
        tot = sum(io) or 1.0
        d.setdefault(iv, []).append((i, [x / tot for x in io]))
    return d


def generic(iv, rv):
    """Common-property material: an even-rhythm run straight up or down a scale (diatonic,
    pentatonic or blues), a repeated note, or a 2- or 3-note loop."""
    if max(rv) > 1.25 * min(rv):
        return False
    if all(0 < x <= 3 for x in iv) or all(-3 <= x < 0 for x in iv):
        return True
    for period in (1, 2, 3):
        if all(iv[k] == iv[k % period] for k in range(len(iv))) and (period < 3 or sum(iv[:3]) == 0):
            return True
    return False


def originality(p, ref):
    if ref is None:
        return None
    spq = 60.0 / p.bpm
    res = dict(windows=0, interval_matches=0, with_rhythm=0, generic=0, real=[])
    refw = {nm: windows(seq) for nm, seq in ref.items()}
    for key in ('lead', 'aux', 'vocal'):
        seq = [(n['t'] * spq, n['sound']) for n in p.voices[key] if not n['fb']]
        ours = windows(seq)
        notes = [n for n in p.voices[key] if not n['fb']]
        for iv, occ in ours.items():
            res['windows'] += len(occ)
            for nm, rw in refw.items():
                if iv not in rw:
                    continue
                res['interval_matches'] += len(occ)
                for i, rv in occ:
                    if any(sum(abs(a - b) for a, b in zip(rv, rr)) <= 0.30 for _, rr in rw[iv]):
                        res['with_rhythm'] += 1
                        if generic(iv, rv):
                            res['generic'] += 1
                        else:
                            n = notes[i]
                            res['real'].append('%s %s bar %d: %s (vs %s)' % (
                                key, n['section'], int(n['upos'] // p.bar_units) + 1,
                                ' '.join(name_of(x['sound']) for x in notes[i:i + 6]), nm))
    return res


# ------------------------------------------------------------------ per piece
def check(p, ref):
    spq = 60.0 / p.bpm
    r = dict(slug=p.slug, title=p.title, key=p.key, bpm=round(p.feel_bpm), meter='%d/%d' % p.meter, notes=p.notes)
    mid = mido.MidiFile(os.path.join(OUT, p.slug + '.mid'))
    r['midi_seconds'] = round(mid.length, 1)
    r['music_seconds'] = round(p.sec(p.total_q), 1)
    mp3 = os.path.join(OUT, p.slug + '.mp3')
    if os.path.exists(mp3):
        r['mp3_seconds'] = round(float(subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).decode()), 1)
    dur = r.get('mp3_seconds', r['midi_seconds'])
    r['duration_ok'] = 110 <= dur <= 130
    # markers from the file itself
    t, tempo, marks = 0, 500000, []
    for msg in mido.merge_tracks(mid.tracks):
        t += mido.tick2second(msg.time, mid.ticks_per_beat, tempo)
        if msg.type == 'set_tempo':
            tempo = msg.tempo
        if msg.type == 'marker':
            marks.append((msg.text, round(t, 1)))
    r['sections'] = [dict(name=n, start=s, mmss=mmss(s)) for n, s in marks]
    r['tracks'] = [tr.name for tr in mid.tracks[1:]]
    # lead onsets from the file (channel 0), to cross-check the model
    t, tempo, onsets = 0, 500000, []
    for msg in mido.merge_tracks(mid.tracks):
        t += mido.tick2second(msg.time, mid.ticks_per_beat, tempo)
        if msg.type == 'set_tempo':
            tempo = msg.tempo
        if msg.type == 'note_on' and msg.velocity > 0 and msg.channel == 0:
            onsets.append((t, msg.note))
    bounds = marks + [('END', p.sec(p.total_q))]
    dens = {}
    for (nm, a), (_, b) in zip(bounds, bounds[1:]):
        k = sum(1 for x, _ in onsets if a - 0.02 <= x < b - 0.02)
        dens[nm] = round(k / (b - a), 2)
    r['density'] = {k: v for k, v in dens.items() if k.startswith('Solo')}
    d = r['density']
    r['density_rises'] = d['Solo-A'] < d['Solo-B'] < d['Solo-C']
    ts = sorted(x for x, _ in onsets)
    peak, j = 0, 0
    for i, x in enumerate(ts):
        while ts[j] < x - 1.0:
            j += 1
        peak = max(peak, i - j + 1)
    r['peak_notes_per_second'] = peak
    lead = p.voices['lead']
    r['fastest_note_rate'] = round(1.0 / min((b['t'] - a['t']) * spq for a, b in zip(lead, lead[1:]) if b['t'] > a['t']), 1)
    # Solo-D: theme and fast material
    dn = [n for n in lead if n['section'] == 'Solo-D']
    theme_d = [n for n in dn if n['theme']]
    fast_d = [n for n in dn if n['d'] * spq < 0.2]
    a_seq = [(n['sound'] + p.notes['recap_shift']) % 12 for n in lead if n['section'] == 'Solo-A']
    d_seq = [n['sound'] % 12 for n in theme_d]
    r['solo_d'] = dict(notes=len(dn), theme_notes=len(theme_d), fast_notes=len(fast_d),
                       theme_in_order=lcs(a_seq, d_seq), theme_len=len(a_seq),
                       theme_top=name_of(max(n['sound'] for n in theme_d)),
                       solo_a_top=name_of(max(n['sound'] for n in lead if n['section'] == 'Solo-A')))
    r['solo_d_ok'] = len(fast_d) >= 20 and r['solo_d']['theme_in_order'] >= 0.6 * min(len(a_seq), len(d_seq))
    # chord tones on strong beats
    bad, ok, tot = [], 0, 0
    for key in ('lead', 'vocal'):
        for n in p.voices[key]:
            pos = (n['upos'] * p.unit) % p.bar_q
            if not any(abs(pos - s) < 1e-6 for s in p.strong_q):
                continue
            tot += 1
            ch = p.chord_at(n['t'] + 1e-4)
            if n['sound'] % 12 in ch.pcs:
                ok += 1
            else:
                bar = int(n['upos'] // p.bar_units) + 1
                tag = (p.slug, n['section'], bar, round(n['upos'] % p.bar_units, 2), key)
                bad.append(dict(where='%s %s bar %d' % (key, n['section'], bar), note=name_of(n['sound']), chord=ch.sym,
                                seconds=round(n['d'] * spq, 2), reason=INTENT.get(tag), tag=list(tag)))
    r['strong_beats'] = dict(total=tot, chord_tones=ok, tensions=bad)
    r['strong_ok'] = all(b['reason'] for b in bad)
    # range
    out = [n for k in ('lead', 'aux') for n in p.voices[k] if not n['fb'] and not GTR_LO <= n['fret'] <= GTR_HI]
    fr = [n['fret'] for n in lead]
    so = [n['sound'] for n in lead]
    r['range'] = dict(lowest=name_of(min(fr)), highest_fretted=name_of(max(fr)), highest_sounding=name_of(max(so)),
                      out_of_range=len(out), max_bend=max(n['amt'] for n in lead))
    r['play'] = playability(p)
    r['range_ok'] = not out and r['range']['max_bend'] <= 3 and not r['play']['hard'] and peak <= 16
    r['originality'] = originality(p, ref)
    r['orig_ok'] = None if r['originality'] is None else not r['originality']['real']
    return r


def tick(v):
    return 'not run' if v is None else ('pass' if v else 'FAIL')


def notes_md(res):
    L = ["# Rendition notes and self-check", '',
         'This file is written by `selfcheck.py`. Do not edit it by hand.', '',
         'All five are sketches of one song, about two minutes each, with the same form:',
         'Intro, Verse, Chorus, Solo-A (slow), Solo-B (build), Solo-C (fast), Solo-D (recapitulation), Outro.',
         'The melodies are different in each rendition, so each one is a real alternative.', '',
         'Lead guitar pitch-bend range: +/-12 semitones (RPN 0 is in the file). Set the same range if your synth ignores RPN.', '']
    for r in res:
        n = r['notes']
        L += ['## %s' % r['title'], '',
              '- **File:** `%s.mid`. **Key:** %s. **Tempo:** %d BPM, %s. **Length:** %s.' % (
                  r['slug'], r['key'], r['bpm'], r['meter'], mmss(r.get('mp3_seconds', r['midi_seconds']))),
              '- **Direction:** ' + n['direction'], '- **Harmony:** ' + n['harmony'], '- **Solo:** ' + n['solo'],
              '- **Sections:** ' + ', '.join('%s %s' % (s['name'], s['mmss']) for s in r['sections']),
              '- **Tracks:** ' + ', '.join(r['tracks']), '',
              '| Check | Result | Data |', '|---|---|---|',
              '| Duration 1:50 to 2:10 | %s | music %.1f s, MIDI %.1f s%s |' % (
                  tick(r['duration_ok']), r['music_seconds'], r['midi_seconds'],
                  ', MP3 %.1f s' % r['mp3_seconds'] if 'mp3_seconds' in r else ''),
              '| Density rises A to C | %s | notes per second: A %.2f, B %.2f, C %.2f, D %.2f |' % (
                  tick(r['density_rises']), r['density']['Solo-A'], r['density']['Solo-B'], r['density']['Solo-C'], r['density']['Solo-D']),
              '| Solo-D has theme and fast material | %s | %d theme notes and %d fast notes of %d; %d of %d Solo-A theme notes return in order; theme top %s in Solo-A, %s in Solo-D |' % (
                  tick(r['solo_d_ok']), r['solo_d']['theme_notes'], r['solo_d']['fast_notes'], r['solo_d']['notes'],
                  r['solo_d']['theme_in_order'], r['solo_d']['theme_len'], r['solo_d']['solo_a_top'], r['solo_d']['theme_top']),
              '| Strong beats are chord tones | %s | %d of %d lead and vocal notes; intentional tensions: %d |' % (
                  tick(r['strong_ok']), r['strong_beats']['chord_tones'], r['strong_beats']['total'], len(r['strong_beats']['tensions'])),
              '| Range and playability | %s | fretted %s to %s; highest sound %s (by bend); bends up to %.1f semitones, %d of %d on the G or B string, %d on the high E; fastest notes %.1f per second, at most %d onsets in one second; largest fret move at speed %d; frets %d to %d; %d hard moves |' % (
                  tick(r['range_ok']), r['range']['lowest'], r['range']['highest_fretted'], r['range']['highest_sounding'],
                  r['range']['max_bend'], r['play']['bends_on_g_b'], r['play']['bends'], r['play']['bends_on_high_e'],
                  r['fastest_note_rate'], r['peak_notes_per_second'], r['play']['max_fret_jump_fast'],
                  r['play']['span'][0], r['play']['span'][1], len(r['play']['hard']))]
        o = r['originality']
        if o is None:
            L.append('| Originality | not run | The reference score is not on this machine. |')
        else:
            L.append('| Originality | %s | %d six-note windows compared; %d share 5 intervals and rhythm with the reference; %d of those are generic (an even run straight along a scale, or a 2-3 note loop); %d real matches |' % (
                tick(r['orig_ok']), o['windows'], o['with_rhythm'], o['generic'], len(o['real'])))
        L.append('')
        if r['strong_beats']['tensions']:
            L.append('Intentional tensions on strong beats:')
            L += ['- %s: %s over %s (%.2f s). %s' % (b['where'], b['note'], b['chord'], b['seconds'], b['reason'] or '**NOT EXPLAINED**')
                  for b in r['strong_beats']['tensions']]
            L.append('')
        for h in r['play']['hard']:
            L.append('- Hard move: ' + h)
        if o and o['real']:
            L += ['- Reference match: ' + x for x in o['real']]
        L += ['**Question for you:** ' + n['question'], '']
    L += ['## How the checks work', '',
          '- **Density:** lead note-ons on MIDI channel 1, counted between the section markers in the file.',
          '- **Solo-D:** a "theme note" is a note the score marks as theme; the check then confirms that those notes repeat the Solo-A pitch sequence in order (transposed by the recap interval). A "fast note" is shorter than 0.2 s.',
          '- **Strong beats:** beats 1 and 3 in 4/4, the two dotted-quarter beats in 6/8, beats 1 and 3 of four in 12/8. The sounding pitch (after a bend) is compared with the chord.',
          '- **Playability:** a search assigns a string and fret to every lead note (standard tuning, 22 frets) and minimises hand movement. A "hard move" is a move of more than 5 frets, a skip of more than 2 strings, or more than 4 frets on one string, between notes less than 0.16 s apart.',
          '- **Originality:** every window of 6 consecutive notes (5 intervals) in each lead, harmony and vocal line is compared with every window in the reference lead guitar and vocal parts. A match needs the same 5 intervals and a similar rhythm (normalised inter-onset times, L1 distance 0.30 or less). Even-rhythm runs straight up or down a scale (diatonic, pentatonic or blues) and 2-3 note loops are common property; they are counted separately as generic. Every other match is rewritten.', '']
    return '\n'.join(L)


def main():
    ref = ref_lines()
    res = [check(make(), ref) for make in pieces.ALL]
    json.dump(res, open(os.path.join(OUT, 'selfcheck.json'), 'w'), indent=1)
    open(os.path.join(OUT, 'NOTES.md'), 'w').write(notes_md(res))
    okall = True
    for r in res:
        flags = {k: r[k] for k in ('duration_ok', 'density_rises', 'solo_d_ok', 'strong_ok', 'range_ok', 'orig_ok')}
        okall &= all(v is not False for v in flags.values())
        print(r['slug'], ' '.join('%s=%s' % (k[:-3] if k.endswith('_ok') else k, tick(v)) for k, v in flags.items()))
    return 0 if okall else 1


if __name__ == '__main__':
    sys.exit(main())
