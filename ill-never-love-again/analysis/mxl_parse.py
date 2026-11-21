"""Parse the reference MusicXML into simple note lists (private study only)."""
import xml.etree.ElementTree as ET
from fractions import Fraction

STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def parse(path):
    """Return (parts, rehearsals, repeats). Time unit: quarter notes, bar = 3.0 (6/8)."""
    root = ET.parse(path).getroot()
    parts = {}
    rehearsals = []
    barlines = []
    for pi, part in enumerate(root.findall('part')):
        pid = part.attrib['id']
        notes = []
        div = 24
        open_ties = {}
        ottava = 0
        for mi, meas in enumerate(part.findall('measure')):
            pos = Fraction(0)
            last_onset = Fraction(0)
            for el in meas:
                if el.tag == 'attributes':
                    d = el.find('divisions')
                    if d is not None:
                        div = int(d.text)
                elif el.tag == 'direction':
                    r = el.find('.//rehearsal')
                    if r is not None and pi == 0:
                        rehearsals.append((mi, r.text))
                    o = el.find('.//octave-shift')
                    if o is not None:
                        t = o.attrib.get('type')
                        size = (int(o.attrib.get('size', 8)) - 1) // 7 * 12
                        ottava = {'down': size, 'up': -size}.get(t, 0)
                elif el.tag == 'barline' and pi == 0:
                    rep = el.find('repeat')
                    end = el.find('ending')
                    if rep is not None:
                        barlines.append((mi, 'repeat-' + rep.attrib['direction']))
                    if end is not None:
                        barlines.append((mi, 'ending%s-%s' % (end.attrib.get('number'), end.attrib.get('type'))))
                elif el.tag == 'backup':
                    pos -= Fraction(int(el.find('duration').text), div)
                elif el.tag == 'forward':
                    pos += Fraction(int(el.find('duration').text), div)
                elif el.tag == 'note':
                    grace = el.find('grace') is not None
                    dur = Fraction(0) if grace else Fraction(int(el.find('duration').text), div)
                    chord = el.find('chord') is not None
                    onset = last_onset if chord else pos
                    if el.find('rest') is None and el.find('pitch') is not None:
                        p = el.find('pitch')
                        midi = (STEP[p.find('step').text] + int(p.findtext('alter') or 0)
                                + 12 * (int(p.find('octave').text) + 1))
                        ties = [t.attrib['type'] for t in el.findall('tie')]
                        n = dict(bar=mi, pos=onset, t=mi * 3 + onset, dur=dur, midi=midi, grace=grace,
                                 slide=el.find('.//slide') is not None,
                                 vib=el.find('.//inverted-mordent') is not None,
                                 fermata=el.find('.//fermata') is not None)
                        if 'stop' in ties and midi in open_ties:
                            open_ties[midi]['dur'] += dur
                            if 'start' not in ties:
                                del open_ties[midi]
                        else:
                            notes.append(n)
                            if 'start' in ties:
                                open_ties[midi] = n
                    if not chord and not grace:
                        last_onset = pos
                        pos += dur
                    elif grace:
                        last_onset = pos
        parts[pid] = notes
    return parts, rehearsals, barlines
