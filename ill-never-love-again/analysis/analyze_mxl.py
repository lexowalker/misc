"""Abstract statistics of the reference score. Prints data for reference-profile.md.
No melodic content is written out: only counts, curves and chord symbols."""
import sys, os, json, collections, statistics
sys.path.insert(0, os.path.dirname(__file__))
from mxl_parse import parse

HERE = os.path.dirname(__file__)
MXL = os.path.join(HERE, '..', 'references', 'mxl', 'lg-45587443.xml')
NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
TEMPL = {'': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10), 'maj7': (0, 4, 7, 11),
         'm7b5': (0, 3, 6, 10), 'dim': (0, 3, 6), 'sus4': (0, 5, 7)}


def chord_at(parts, t0, t1):
    w = collections.Counter()
    bass = None
    for pid, k in (('P2', 1.0), ('P4', 1.0), ('P5', 2.0)):
        for n in parts[pid]:
            a, b = float(n['t']), float(n['t'] + n['dur'])
            ov = min(b, t1) - max(a, t0)
            if ov > 0:
                w[n['midi'] % 12] += ov * k
                if pid == 'P5' and (bass is None or a < bass[0]):
                    bass = (a, n['midi'] % 12)
    if not w:
        return None
    best = None
    tot = sum(w.values())
    for root in range(12):
        for name, tpl in TEMPL.items():
            sc = sum(w[(root + i) % 12] for i in tpl) / tot - 0.08 * len(tpl)
            if bass and bass[1] == root:
                sc += 0.25
            if best is None or sc > best[0]:
                best = (sc, NOTE[root] + name)
    sym = best[1]
    if bass and NOTE[bass[1]] != sym.rstrip('m7b5ajdimsu4').rstrip() and not sym.startswith(NOTE[bass[1]]):
        sym += '/' + NOTE[bass[1]]
    return sym


def solo_stats(lead, b0, b1, sec_per_bar):
    ns = [n for n in lead if b0 <= n['bar'] < b1]
    real = [n for n in ns if not n['grace']]
    rows = []
    for b in range(b0, b1):
        bn = [n for n in real if n['bar'] == b]
        ps = [n['midi'] for n in bn]
        rows.append(dict(bar=b - b0 + 1, n=len(bn), per_beat=round(len(bn) / 2, 1),
                         lo=min(ps) if ps else None, hi=max(ps) if ps else None,
                         med=int(statistics.median(ps)) if ps else None))
    # phrases: split at silence of an eighth note or more
    ev = sorted(real, key=lambda n: n['t'])
    phrases, cur, end = [], [], None
    sound = 0.0
    for n in ev:
        a, b = float(n['t']), float(n['t'] + n['dur'])
        if end is not None and a - end >= 0.5:
            phrases.append(cur); cur = []
        cur.append(n)
        sound += max(0, b - max(a, end or a)) if end is None or b > end else 0
        end = max(end or b, b)
    if cur:
        phrases.append(cur)
    total = (b1 - b0) * 3.0
    plen = [float(p[-1]['t'] + p[-1]['dur'] - p[0]['t']) / 3 for p in phrases]
    held = [n for n in real if n['dur'] >= 1.5]
    durs = collections.Counter()
    for n in real:
        d = float(n['dur'])
        durs['<1/16' if d < 0.25 else '1/16' if d < 0.5 else '1/8' if d < 1.0 else '1/4..' if d < 1.5 else 'held>=dotted-1/4'] += 1
    ivs = [abs(b['midi'] - a['midi']) for a, b in zip(ev, ev[1:])]
    return dict(bars=b1 - b0, seconds=round((b1 - b0) * sec_per_bar, 1), notes=len(real), grace=len(ns) - len(real),
                rows=rows, phrases=len(phrases), phrase_bars=[round(x, 2) for x in plen],
                rest_ratio=round(1 - sound / total, 2), slides=sum(n['slide'] for n in ns),
                vibrato_marks=sum(n['vib'] for n in ns), held=len(held), durs=dict(durs),
                step_share=round(sum(1 for i in ivs if 0 < i <= 2) / len(ivs), 2),
                leap_share=round(sum(1 for i in ivs if i >= 5) / len(ivs), 2),
                repeat_share=round(sum(1 for i in ivs if i == 0) / len(ivs), 2),
                max_notes_per_sec=round(max(r['n'] for r in rows) / sec_per_bar, 1))


def main():
    parts, reh, bl = parse(MXL)
    tempo_q = 82.0
    spb = 3 * 60 / tempo_q
    nb = 158
    print('meter 6/8, quarter=%.0f (dotted quarter=%.1f), bar=%.2fs, bars=%d, length=%.0fs' % (tempo_q, tempo_q * 2 / 3, spb, nb, nb * spb))
    print('rehearsal marks (bar index0):', reh, 'barlines:', bl)
    secs = reh + [(nb, 'END')]
    for (b0, name), (b1, _) in zip(secs, secs[1:]):
        ch = []
        for b in range(b0, b1):
            c1 = chord_at(parts, b * 3, b * 3 + 1.5)
            c2 = chord_at(parts, b * 3 + 1.5, b * 3 + 3)
            ch.append(c1 if c1 == c2 or c2 is None else '%s %s' % (c1, c2))
        act = {p: sum(1 for n in parts[p] if b0 <= n['bar'] < b1) for p in ('P1', 'P3')}
        print('\n[%s] bars %d-%d (%d bars, %.0fs-%.0fs) vocal notes=%d lead notes=%d' % (name, b0 + 1, b1, b1 - b0, b0 * spb, b1 * spb, act['P1'], act['P3']))
        print(' | '.join(str(c) for c in ch))
    for name, b0, b1 in (('Intro theme', 1, 9), ('Mid solo (E)', 61, 77), ('Outro solo (H)', 91, 158)):
        st = solo_stats(parts['P3'], b0, b1, spb)
        rows = st.pop('rows')
        print('\n==', name, json.dumps(st))
        print('density notes/bar :', ' '.join(str(r['n']) for r in rows))
        print('hi    :', ' '.join(str(r['hi'] or '-') for r in rows))
        print('median:', ' '.join(str(r['med'] or '-') for r in rows))
        print('lo    :', ' '.join(str(r['lo'] or '-') for r in rows))
    v = [n for n in parts['P1']]
    print('\nvocal range', min(n['midi'] for n in v), max(n['midi'] for n in v))


if __name__ == '__main__':
    main()
