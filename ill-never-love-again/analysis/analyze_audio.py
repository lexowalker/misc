"""Abstract curves from the reference recordings (private study only).
Prints tempo, loudness, onset density and pitch range per tenth of each track.
Usage: python3 analysis/analyze_audio.py [--hpss] file.mp3 [start_s end_s]"""
import sys, os, warnings
warnings.filterwarnings('ignore')
import numpy as np, librosa

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
HPSS = '--hpss' in sys.argv
path = ARGS[0]
y, sr = librosa.load(path, sr=22050, mono=True)
if len(ARGS) >= 3:
    y = y[int(float(ARGS[1]) * sr):int(float(ARGS[2]) * sr)]
if HPSS:  # crude lead isolation when no stem separator is available
    y = librosa.effects.harmonic(y, margin=3.0)
dur = len(y) / sr
print('file', os.path.basename(path), 'dur %.1fs' % dur)
oenv = librosa.onset.onset_strength(y=y, sr=sr)
tempo = librosa.feature.tempo(onset_envelope=oenv, sr=sr, aggregate=None)
t_glob = float(librosa.feature.tempo(onset_envelope=oenv, sr=sr)[0])
print('tempo estimate %.1f BPM (half %.1f, third %.1f)' % (t_glob, t_glob / 2, t_glob / 3))
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
db = 20 * np.log10(np.maximum(rms, 1e-6))
db -= np.percentile(db, 99)
N = 10
seg = lambda a: [a[int(i * len(a) / N):int((i + 1) * len(a) / N)] for i in range(N)]
print('loudness dB rel. peak, per tenth:', ' '.join('%.0f' % np.mean(s) for s in seg(db)))
print('silence share (< -30 dB) per tenth:', ' '.join('%.2f' % np.mean(s < -30) for s in seg(db)))

from basic_pitch.inference import predict, Model
from basic_pitch import ICASSP_2022_MODEL_PATH
import soundfile as sf, tempfile
tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
sf.write(tmp, y, sr)
model = Model(str(ICASSP_2022_MODEL_PATH).rstrip('/') + '.onnx' if not str(ICASSP_2022_MODEL_PATH).endswith('.onnx') else ICASSP_2022_MODEL_PATH)
_, _, notes = predict(tmp, model, onset_threshold=0.5, frame_threshold=0.3, minimum_note_length=58,
                      minimum_frequency=80, maximum_frequency=1500, melodia_trick=True)
os.unlink(tmp)
notes = sorted((s, e, p, a) for s, e, p, a, _ in notes if a > 0.25)
print('basic-pitch notes:', len(notes))
on = np.array([n[0] for n in notes]); pit = np.array([n[2] for n in notes]); ln = np.array([n[1] - n[0] for n in notes])
edges = np.linspace(0, dur, N + 1)
rows = {'nps': [], 'lo': [], 'med': [], 'hi': [], 'long': []}
for i in range(N):
    m = (on >= edges[i]) & (on < edges[i + 1])
    rows['nps'].append('%.1f' % (m.sum() / (dur / N)))
    for k, q in (('lo', 5), ('med', 50), ('hi', 95)):
        rows[k].append('%d' % np.percentile(pit[m], q) if m.any() else '-')
    rows['long'].append('%d' % ((ln[m] >= 1.0).sum()))
print('note onsets/s per tenth :', ' '.join(rows['nps']))
print('pitch p5  per tenth     :', ' '.join(rows['lo']))
print('pitch p50 per tenth     :', ' '.join(rows['med']))
print('pitch p95 per tenth     :', ' '.join(rows['hi']))
print('notes >= 1.0 s per tenth:', ' '.join(rows['long']))
print('note length: median %.2fs, p90 %.2fs, max %.2fs; share of notes < 0.12s: %.2f' % (np.median(ln), np.percentile(ln, 90), ln.max(), np.mean(ln < 0.12)))
# fastest / slowest 3-second windows
w = 3.0
ts = np.arange(0, max(dur - w, 0.1), 0.5)
cnt = np.array([((on >= t) & (on < t + w)).sum() for t in ts]) / w
order = np.argsort(cnt)
print('peak density %.1f notes/s; fastest windows at fractions:' % cnt.max(), ' '.join('%.2f' % ((ts[i] + w / 2) / dur) for i in sorted(order[-5:])))
print('slowest windows at fractions:', ' '.join('%.2f' % ((ts[i] + w / 2) / dur) for i in sorted(order[:5])))
hi_i = np.argsort(pit)[-5:]
print('highest notes at fractions:', ' '.join('%.2f' % (on[i] / dur) for i in sorted(hi_i)), 'max pitch', int(pit.max()))
longest = np.argsort(ln)[-5:]
print('longest notes at fractions:', ' '.join('%.2f(%.1fs)' % (on[i] / dur, ln[i]) for i in sorted(longest)))
# vibrato: pitch modulation rate on long notes via pyin (sampled)
f0, vf, _ = librosa.pyin(y, fmin=110, fmax=1400, sr=sr, frame_length=2048, hop_length=256)
rates, depths = [], []
hop = 256 / sr
for s, e, p, a in notes:
    if e - s >= 0.8:
        seg0 = f0[int((s + 0.25) / hop):int(e / hop)]
        seg0 = seg0[~np.isnan(seg0)]
        if len(seg0) > 40:
            c = 1200 * np.log2(seg0 / np.median(seg0))
            c = c[np.abs(c) < 150]
            if len(c) > 40:
                c = c - np.mean(c)
                sp = np.abs(np.fft.rfft(c * np.hanning(len(c))))
                fr = np.fft.rfftfreq(len(c), hop)
                band = (fr >= 3) & (fr <= 9)
                if band.any() and sp[band].max() > 3 * np.median(sp[1:] + 1e-9):
                    rates.append(fr[band][np.argmax(sp[band])]); depths.append((np.percentile(c, 95) - np.percentile(c, 5)) / 2)
if rates:
    print('vibrato on long notes: n=%d, rate median %.1f Hz (p25 %.1f, p75 %.1f), depth median +/-%.0f cents (p90 %.0f)' % (
        len(rates), np.median(rates), np.percentile(rates, 25), np.percentile(rates, 75), np.median(depths), np.percentile(depths, 90)))
