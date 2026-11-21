#!/usr/bin/env python3
"""Write the five renditions as MIDI files into renditions/. Deterministic and rerunnable."""
import os
import sys

from gen import pieces
from gen.engine import build_midi

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    out = os.path.join(HERE, 'renditions')
    os.makedirs(out, exist_ok=True)
    for make in pieces.ALL:
        p = make()
        path = os.path.join(out, p.slug + '.mid')
        build_midi(p, path)
        print('%-28s %s, %d BPM, %d/%d, %.1f s -> %s' % (p.slug, p.key, round(p.feel_bpm), p.meter[0], p.meter[1],
                                                        p.sec(p.total_q), os.path.relpath(path, HERE)))


if __name__ == '__main__':
    sys.exit(main())
