# Builds the soundtrack: narration, field-recorded nightingales (ducked under the voice),
# a quiet synthesized score (drone in the In scale, koto plucks, taiko, hyoshigi clappers),
# and the little demonstration sounds cued by the picture (build/cues.json).
# Writes build/mix.wav (48 kHz stereo).
import json, subprocess
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = __file__.rsplit('/', 1)[0]
SR = 48000
TL = json.load(open(f'{ROOT}/build/timeline.json'))
CUES = json.load(open(f'{ROOT}/build/cues.json'))
DUR = TL['duration']
N = int(DUR * SR) + SR
rng = np.random.default_rng(3)
seg = {s['id'][:3]: s for s in TL['segments']}
cards = TL['cards']

def load(f, ss=0.0, t=None, sr=SR):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(ss)] + (['-t', str(t)] if t else []) + ['-i', f'{ROOT}/{f}', '-ac', '2', '-ar', str(sr), '-f', 's16le', '-']
    a = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.int16).astype(np.float32) / 32768
    return a.reshape(-1, 2)

def db(x): return 10 ** (x / 20)
def env_ad(n, a=0.005, d=None, sr=SR):
    t = np.arange(n) / sr
    e = np.minimum(1, t / max(a, 1e-4))
    return e * (np.exp(-t / d) if d else 1)
def fade(x, fi, fo):
    n = len(x); e = np.ones(n)
    a, b = int(fi * SR), int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b))
    return x * (e[:, None] if x.ndim == 2 else e)
def pan(m, p):  # mono → stereo, equal power
    th = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(th), m * np.sin(th)], 1)
def place(out, x, t, g=1.0):
    i = int(t * SR)
    if i >= len(out) or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), len(out) - i)
    out[i:i + n] += x[:n] * g
def bandpass(x, lo, hi, order=4):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x, axis=0)
def lowpass(x, f, order=4):
    return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x, axis=0)
def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x, axis=0)
IR = None
def reverb(x, wet=0.25, length=2.2):
    global IR
    if IR is None:
        n = int(length * SR); t = np.arange(n) / SR
        IR = np.stack([rng.standard_normal(n) * np.exp(-t * 3.2), rng.standard_normal(n) * np.exp(-t * 3.2)], 1).astype(np.float32)
        IR = lowpass(IR, 5000) * 0.03
    y = np.stack([signal.fftconvolve(x[:, c], IR[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 4

# ---------- narration ----------
voice = load('build/voice.wav')[:, 0]
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
venv = signal.sosfiltfilt(signal.butter(2, 3, fs=SR, output='sos'), np.abs(voice))
duck = np.clip(venv / 0.03, 0, 1)                       # 1 while speaking

# ---------- nightingale beds ----------
beds = np.zeros((N, 2), np.float32)
c = {i: (c_['t0'], c_['t1']) for i, c_ in enumerate(cards)}
BEDS = [  # (start, end, file, file offset, gain dB, lowpass Hz or None)
    (0.8, seg['s03']['t0'] + 6, 'build/rec/lithuania.flac', 2.0, -6, None),
    (seg['s03']['t0'] + 6, c[1][0] + 0.5, 'build/rec/lithuania.flac', 60.0, -12, None),
    (seg['s05']['t1'] - 3, seg['s06']['t0'], 'build/rec/lithuania.flac', 95.0, -18, None),
    (seg['s08']['t0'] - 2, c[4][0] + 0.5, 'build/rec/berlin.mp3', 40.0, -8, None),
    (c[5][1] - 0.5, seg['s11']['t0'] + 22, 'build/rec/lithuania.flac', 30.0, -12, 2500),
    (seg['s11']['t0'] + 21, c[6][0] + 0.5, 'build/rec/berlin.mp3', 120.0, -6, None),
    (c[6][1] - 0.5, c[7][0] + 0.6, 'build/rec/koos.mp3', 900.0, 2, None),
    (c[6][1] - 0.5, c[7][0] + 0.6, 'build/rec/lithuania.flac', 70.0, -16, None),
    (seg['s13']['t0'] + 17, DUR, 'build/rec/lithuania.flac', 100.0, -10, None),
]
for t0, t1, f, off, g, lp in BEDS:
    x = load(f, off, t1 - t0)
    x = highpass(x, 900)
    if lp: x = reverb(lowpass(x, lp), 0.5)
    place(beds, fade(x, 1.5, 2.0), t0, db(g))
beds *= (1 - 0.82 * duck)[:, None]

# city noise for the Berlin traffic moment
t0c, t1c = seg['s11']['t0'] + 21, c[6][0] + 0.5
n = int((t1c - t0c) * SR)
rumble = lowpass(rng.standard_normal(n), 220) * 2.5 + bandpass(rng.standard_normal(n), 300, 1500) * 0.3
rumble *= 0.6 + 0.4 * np.sin(np.arange(n) / SR * 0.7)
place(beds, fade(pan(rumble, 0) * db(-22), 1.5, 2.0), t0c)

# ---------- score ----------
music = np.zeros((N, 2), np.float32)
IN = [62, 63, 67, 69, 70, 74, 75, 79, 81, 82]           # D in-scale (miyako-bushi), MIDI
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def pad_tone(freqs, dur):
    t = np.arange(int(dur * SR)) / SR; y = np.zeros(len(t))
    for f in freqs:
        for d in (-0.15, 0.15):
            y += np.sin(2 * np.pi * (f + d) * t + rng.random() * 6) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + rng.random() * 6))
    return lowpass(y, 1400) / len(freqs)
CHORDS = [[38, 50, 57], [39, 51, 58], [43, 50, 55], [38, 45, 50], [34, 46, 53], [38, 50, 57], [43, 51, 55], [38, 50, 57]]
bounds = [0] + [cc['t0'] for cc in cards] + [DUR]
for i in range(len(bounds) - 1):
    a, b = bounds[i], bounds[i + 1] + 2
    x = pad_tone([hz(m) for m in CHORDS[i % len(CHORDS)]], b - a)
    place(music, fade(pan(x, 0), 2.5, 2.5), a, db(-31))
def koto(f, dur=2.4):                                     # Karplus-Strong pluck
    n, p = int(dur * SR), int(SR / f)
    buf = rng.uniform(-1, 1, p); y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return highpass(y, 120) * env_ad(n, 0.002, 1.2)
KOTO = {m: koto(hz(m)) for m in IN}
def arpeggio(t, notes, gap=0.16, g=-18, p=0):
    for j, m in enumerate(notes): place(music, pan(KOTO[m], p + (j - len(notes) / 2) * 0.12), t + j * gap, db(g))
def taiko(t, g=-15):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * (55 + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 3.5) + lowpass(rng.standard_normal(n), 400) * np.exp(-tt * 30) * 0.4
    place(music, pan(y, 0), t, db(g))
def clack(t, g=-14):
    for k, dt in enumerate((0, 0.14)):
        n = int(0.06 * SR); y = bandpass(rng.standard_normal(n), 1400, 3800, 2) * env_ad(n, 0.0005, 0.012) * 4
        place(music, pan(y, -0.15 + k * 0.3), t + dt, db(g))

# ---------- picture-cued sounds ----------
fx = np.zeros((N, 2), np.float32)
def tone(f, dur, fm=0.0, fmr=30, a=0.01, d=None, harm=0.15):
    t = np.arange(int(dur * SR)) / SR
    ff = (f(t) if callable(f) else np.full_like(t, f)) * (1 + fm * np.sin(2 * np.pi * fmr * t))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    y = np.sin(ph) + harm * np.sin(2 * ph)
    e = np.minimum(1, t / a) * np.minimum(1, (dur - t) / 0.02).clip(0)
    return y * e * (np.exp(-t / d) if d else 1)
def click():
    n = int(0.008 * SR); return bandpass(rng.standard_normal(n), 2000, 9000, 2) * env_ad(n, 0.0003, 0.002) * 3
def buzz(dur=0.3):
    t = np.arange(int(dur * SR)) / SR
    y = signal.sawtooth(2 * np.pi * 3200 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 45 * t)))
    return bandpass(y, 2000, 7000, 2) * np.minimum(1, (dur - t) / 0.03) * 0.6
def trill(times, f=3000):
    out = np.zeros(int((times[-1] + 0.1) * SR))
    for tt in times:
        s = tone(lambda u: f * (1.3 - 3 * u), 0.03, a=0.002); i = int(tt * SR); out[i:i + len(s)] += s
    return out
SONG = load('build/rec/berlin.mp3', 199.4, 3.3)
def demo(kind):
    if kind == 'whistle': return tone(3400, 0.35, fm=0.004, fmr=7)
    if kind == 'click': return click()
    if kind == 'buzz': return buzz()
    if kind == 'pitch':
        return tone(lambda t: 1000 + 7000 * (0.5 - 0.5 * np.cos(np.clip(t / 2.6, 0, 1) * np.pi * 1.5)), 2.6, a=0.05) * 0.6
    if kind == 'up': return tone(lambda t: 2000 + 3000 * (t / 0.35) ** 2, 0.35)
    if kind == 'down': return tone(lambda t: 6000 - 3500 * np.sqrt(t / 0.35), 0.35)
    if kind == 'swoop': return tone(lambda t: 3500 + 1500 * np.sin(t / 0.5 * np.pi * 1.5), 0.5)
    if kind == 'length':
        out = np.zeros(int(1.2 * SR))
        for j, d in enumerate((0.02, 0.06, 0.18)): s = tone(3000, d, a=0.003); i = int(j * 0.35 * SR); out[i:i + len(s)] += s
        return out
    if kind == 'loudness':
        t = np.arange(int(2.2 * SR)) / SR
        return tone(3000, 2.2, fm=0.004, fmr=6) * (0.15 + 0.85 * (0.5 + 0.5 * np.sin(t * 5)))
    if kind == 'speed':
        ts, dt, t = [], 0.16, 0.0
        while t < 3.6: ts.append(t); t += dt; dt = max(0.028, dt * 0.88)
        return trill(ts)
    if kind == 'rattle': return buzz(0.6) * 1.2
    if kind == 'twovoice': return tone(2800, 1.2, fm=0.01, fmr=5) * 0.7 + tone(lambda t: 4200 - 600 * t, 1.2, fm=0.006, fmr=9) * 0.6
    if kind == 'swap': return KOTO[74] * 0.8
    return np.zeros(10)
for cu in CUES:
    t, k = cu['t'], cu['kind']
    if k == 'song':
        x = SONG if cu['rate'] == 1 else signal.resample(SONG, int(len(SONG) / cu['rate']), axis=0)
        if cu['rate'] != 1: x = reverb(x, 0.35)
        place(fx, fade(x, 0.02, 0.3), t, cu['gain'])
    elif k == 'demo': place(fx, pan(demo(cu['sound']), 0.1), t, db(-17))
    elif k == 'taiko': taiko(t); arpeggio(t + 0.6, [62, 67, 70, 74, 79], 0.22, -16)
    elif k == 'clack': clack(t); arpeggio(t + 0.35, [74, 70, 67], 0.2, -22)
    elif k == 'stamp':
        n = int(0.5 * SR); tt = np.arange(n) / SR
        place(fx, pan(np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 14) + lowpass(rng.standard_normal(n), 900) * np.exp(-tt * 40) * 0.6, 0), t + 0.12, db(-8))
    elif k == 'beads':
        for j in range(cu['n']):
            n = int(0.02 * SR); y = bandpass(rng.standard_normal(n), 2500, 6000, 2) * env_ad(n, 0.0003, 0.004) * 2
            place(fx, pan(y, rng.uniform(-0.5, 0.5)), t + j * cu['dur'] / cu['n'] + rng.uniform(0, 0.01), db(-20))
    elif k == 'chirp':
        y = tone(lambda u: 4200 - 9000 * u, 0.09, a=0.003) * 0.8
        y[:int(0.07 * SR)] += tone(lambda u: 3800 - 6000 * u, 0.07, a=0.003) * 0.3
        place(fx, pan(y, cu.get('pan', 0)), t, db(-16))
fx = fx * (1 - 0.35 * duck)[:, None]

# ---------- mix ----------
mix = pan(voice, 0) * 1.0 + beds + reverb(music, 0.3) + reverb(fx, 0.15)
mix = mix[:int(DUR * SR)]
speech = duck > 0.5
gain = db(-19) / np.sqrt((voice[:len(mix)][speech[:len(mix)]] ** 2).mean())   # narration sits at about -19 dBFS RMS
mix = np.tanh(mix * gain / 0.95) * 0.95                                           # soft limit the rare peaks
peak = np.abs(mix).max()
sf.write(f'{ROOT}/build/mix.wav', mix.astype(np.float32), SR)
print('mix', mix.shape, 'peak before norm', round(float(peak), 3))
