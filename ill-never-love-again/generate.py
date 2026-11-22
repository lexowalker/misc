#!/usr/bin/env python3
"""Write the five renditions (renditions/) and the full song (song/) as MIDI files.
Deterministic and rerunnable."""
import os
import sys

from gen import pieces
from gen.engine import build_midi
from gen.song import full_song

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    out = os.path.join(HERE, 'renditions')
    os.makedirs(out, exist_ok=True)
    os.makedirs(os.path.join(HERE, 'song'), exist_ok=True)
    for make in pieces.ALL + [full_song]:
        p = make()
        path = os.path.join(HERE, 'song' if make is full_song else 'renditions', p.slug + '.mid')
        build_midi(p, path)
        print('%-28s %s, %d BPM, %d/%d, %.1f s -> %s' % (p.slug, p.key, round(p.feel_bpm), p.meter[0], p.meter[1],
                                                        p.sec(p.total_q), os.path.relpath(path, HERE)))


if __name__ == '__main__':
    sys.exit(main())
