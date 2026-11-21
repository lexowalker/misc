#!/usr/bin/env python3
"""Render renditions/*.mid to MP3 with FluidSynth and ffmpeg.

Each file is rendered as three stems (lead, guide vocal, band) so that the mix can be balanced
with measured levels: the lead sits in front of the band, and the guide vocal stays audible.
Needs: fluidsynth, ffmpeg, a General MIDI soundfont (FluidR3_GM by default), numpy, soundfile.
"""
import glob
import os
import subprocess
import sys
import tempfile

import mido
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'renditions')
SF2 = os.environ.get('SOUNDFONT', '/usr/share/sounds/sf2/FluidR3_GM.sf2')
STEMS = {'lead': {0, 1}, 'vocal': {2}, 'band': {3, 4, 5, 6, 9}}
# dB relative to the band, measured on the loud parts of each stem
TARGET = {'lead': 5.5, 'vocal': 1.0, 'band': 0.0}
LUFS = -16.0   # static gain to this integrated loudness: no automatic gain riding, so the dynamics stay
FX = {
    'lead': 'highpass=f=110,lowpass=f=6200,equalizer=f=1400:t=q:w=1.2:g=2.5,aecho=0.85:0.5:370:0.2',
    'vocal': 'highpass=f=120,equalizer=f=2500:t=q:w=1.5:g=2',
    'band': 'anull',
}


def stem_midi(mid, chans, path):
    out = mido.MidiFile(type=1, ticks_per_beat=mid.ticks_per_beat)
    out.tracks.append(mid.tracks[0])
    for tr in mid.tracks[1:]:
        ch = {m.channel for m in tr if hasattr(m, 'channel')}
        if ch and ch <= chans:
            out.tracks.append(tr)
    out.save(path)


def loud_rms(path):
    y, sr = sf.read(path)
    y = y.mean(axis=1) if y.ndim > 1 else y
    hop = sr // 5
    fr = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
    fr = fr[fr > 1e-4]
    return 20 * np.log10(np.percentile(fr, 75)) if len(fr) else -120.0


def render(path):
    mid = mido.MidiFile(path)
    base = os.path.splitext(path)[0]
    with tempfile.TemporaryDirectory() as tmp:
        wavs, lv = {}, {}
        for name, chans in STEMS.items():
            m = os.path.join(tmp, name + '.mid')
            w = os.path.join(tmp, name + '.wav')
            stem_midi(mid, chans, m)
            subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.7', '-r', '44100',
                            '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.72',
                            '-o', 'synth.reverb.damp=0.35', '-o', 'synth.reverb.width=0.9',
                            '-o', 'synth.reverb.level=0.75', '-o', 'synth.chorus.active=0',
                            '-F', w, SF2, m], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            wavs[name], lv[name] = w, loud_rms(w)
        gains = {k: TARGET[k] - (lv[k] - lv['band']) for k in STEMS}
        ins, filt = [], []
        for i, k in enumerate(STEMS):
            ins += ['-i', wavs[k]]
            filt.append('[%d:a]%s,volume=%.2fdB[s%d]' % (i, FX[k], gains[k], i))
        dur = mid.length
        mix = os.path.join(tmp, 'mix.wav')
        filt.append('[s0][s1][s2]amix=inputs=3:normalize=0[out]')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + ins + ['-filter_complex', ';'.join(filt), '-map', '[out]',
                        '-c:a', 'pcm_f32le', mix], check=True)
        log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mix, '-af', 'ebur128', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
        loud = float(log.rsplit('I:', 1)[1].split('LUFS')[0])
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mix, '-af',
                        'volume=%.2fdB,alimiter=limit=0.89:attack=5:release=80,afade=t=out:st=%.2f:d=1.2' % (LUFS - loud, dur - 1.2),
                        '-ar', '44100', '-b:a', '192k', base + '.mp3'], check=True)
    print('%-28s stem levels dB %s -> gains dB %s' % (
        os.path.basename(base), {k: round(v, 1) for k, v in lv.items()}, {k: round(v, 1) for k, v in gains.items()}))


def main():
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(OUT, '*.mid')))
    for f in files:
        render(f)


if __name__ == '__main__':
    main()
