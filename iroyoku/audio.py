"""Score and sound design for Iroyoku, all synthesized: koto, shamisen, shakuhachi, taiko, bells,
pads, and the city around them. Reads build/cues.json (scene times + sound cues) -> build/mix.wav"""
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")
SR = 48000
rng = np.random.default_rng(7)
cues = json.load(open(os.path.join(B, "cues.json")))
TOTAL = cues["total"]
SC = {s["id"]: s["a"] for s in cues["scenes"]}
N = int(TOTAL * SR) + SR * 4

dry = np.zeros((2, N), np.float32)   # music + fx, dry
wet = np.zeros((2, N), np.float32)   # sent to reverb
amb = np.zeros((2, N), np.float32)   # ambience bed


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def lp_sweep(x, f0, f1):
    """lowpass whose cutoff glides from f0 to f1 (a crossfade between two filters)"""
    w = np.linspace(0, 1, len(x))
    return lp(x, f0) * (1 - w) + lp(x, f1) * w


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def put(buf, t, x, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or len(x) == 0:
        return
    x = x[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(x)] += x * l * 1.41
    buf[1, i:i + len(x)] += x * r * 1.41


def add(t, x, gain=1.0, pan=0.0, rev=0.3):
    put(dry, t, x, gain, pan)
    put(wet, t, x, gain * rev, pan)


def env(n, a, d):
    t = tt(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def fade(x, a=.01, r=.05):
    n = len(x)
    e = np.ones(n)
    ia, ir = int(a * SR), int(r * SR)
    if ia: e[:ia] = np.linspace(0, 1, ia)
    if ir: e[-ir:] *= np.linspace(1, 0, ir)
    return x * e


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def seqsum(parts):
    """sum (offset_seconds, array) parts into one array"""
    n = max(int(o * SR) + len(x) for o, x in parts)
    out = np.zeros(n)
    for o, x in parts:
        i = int(o * SR)
        out[i:i + len(x)] += x
    return out


# ------------------------------------------------------------------ instruments
def koto(m, dur=2.5, bright=1.0):
    f = midi(m)
    n = int(dur * SR)
    t = tt(n)
    s = np.zeros(n)
    for k in range(1, 12):
        fk = f * k * (1 + .0006 * k * k)
        if fk > 16000: break
        a = (1 / k ** 1.1) * (np.sin(np.pi * k * .23) + .2) * bright ** (k / 4)
        s += a * np.sin(2 * np.pi * fk * t + k) * np.exp(-t * (1.2 + k * .9))
    # slight pitch "oshide" bend at the attack
    s *= np.minimum(1, t / .002)
    click = hp(noise(.03), 2000) * env(int(.03 * SR), .0005, .006) * .3
    s[: len(click)] += click
    return s * .5


def shamisen(m, dur=1.2):
    f = midi(m)
    n = int(dur * SR)
    t = tt(n)
    s = np.zeros(n)
    for k in range(1, 16):
        fk = f * k
        if fk > 15000: break
        s += (1 / k ** .8) * np.sin(2 * np.pi * fk * t + k * .7) * np.exp(-t * (3 + k * 1.6))
    s = np.tanh(s * 1.8) * .6  # sawari buzz
    s[: int(.02 * SR)] += hp(noise(.02), 1500) * .4 * np.linspace(1, 0, int(.02 * SR))
    return s * np.minimum(1, t / .001)


def shaku(m, dur, vib=1.0, breath=.25, bend=True):
    f = midi(m)
    n = int(dur * SR)
    t = tt(n)
    vibd = .006 * vib * np.clip((t - .35) / .6, 0, 1) * np.sin(2 * np.pi * 5.2 * t)
    glide = (1 - np.exp(-t / .09)) * .03 - .03 if bend else 0
    ph = 2 * np.pi * np.cumsum(f * (1 + vibd + glide)) / SR
    s = np.sin(ph) + .25 * np.sin(2 * ph) + .08 * np.sin(3 * ph)
    br = bp(noise(dur), max(80, f * .8), min(20000, f * 3.5)) * breath * 3
    shape = np.minimum(1, t / .12) * np.minimum(1, (dur - t) / .25).clip(0)
    swell = .75 + .25 * np.sin(np.pi * np.clip(t / dur, 0, 1))
    return (s * .5 + br) * shape * swell * .5


def pad(ms, dur, cutoff=1400, det=.004, att=1.5, rel=2.0):
    n = int(dur * SR)
    t = tt(n)
    s = np.zeros(n)
    for m in ms:
        f = midi(m)
        for d in (-det, 0, det):
            ph = 2 * np.pi * f * (1 + d) * t + rng.random() * 6
            s += (2 * ((ph / (2 * np.pi)) % 1) - 1) * .3
    s = lp(s, cutoff)
    e = np.minimum(1, t / att) * np.clip((dur - t) / rel, 0, 1)
    return s * e * .18 / max(1, len(ms) ** .5)


def taiko(size=1.0, dur=1.4):
    n = int(dur * SR)
    t = tt(n)
    f = 46 / size + 40 * np.exp(-t * 18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5)
    s += lp(noise(dur), 900) * np.exp(-t * 28) * .5
    return s * .9


def kane(m=88, dur=1.2):
    n = int(dur * SR)
    t = tt(n)
    f = midi(m)
    return sum(a * np.sin(2 * np.pi * f * r * t) for r, a in ((1, 1), (2.41, .6), (3.9, .4), (5.3, .25))) * np.exp(-t * 4) * .25


def bell(m, dur=3.0, decay=1.2):
    n = int(dur * SR)
    t = tt(n)
    f = midi(m)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (decay / r ** .5)) for r, a in ((1, 1), (2.76, .35), (5.4, .12), (8.9, .05))) * .3


def suzu(dur=1.6):
    out = np.zeros(int(dur * SR))
    for k in range(9):
        o = int(k * .045 * SR + rng.random() * .02 * SR)
        b = bell(96 + rng.integers(-2, 4), .9, .25) * (1 - k / 11)
        out[o:o + len(b)] += b[: len(out) - o]
    return out


def wood(f=1400, dur=.12):
    n = int(dur * SR)
    return bp(noise(dur), f * .85, f * 1.15, 2) * env(n, .0005, .02) * 3


def whisper(dur=1.4, f=1200):
    n = int(dur * SR)
    t = tt(n)
    x = bp(noise(dur), f, f * 4) + .5 * bp(noise(dur), 300, 900)
    syll = (np.sin(2 * np.pi * 3.2 * t - np.pi / 2) * .5 + .5) ** 2
    return x * syll * np.sin(np.pi * t / dur) * 1.4


def heartbeat(n=4, bpm=72, gain=1.0):
    out = np.zeros(int((n * 60 / bpm + 1) * SR))
    for k in range(n):
        for off, g in ((0, 1), (.22, .7)):
            o = int((k * 60 / bpm + off) * SR)
            x = taiko(1.6, .5) * g * gain
            out[o:o + len(x)] += x[: len(out) - o]
    return out


def sweep(f0, f1, dur, decay=.2):
    n = int(dur * SR)
    f = np.geomspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, decay)


def swish(dur=.6, lo=400, hi=4000):
    n = int(dur * SR)
    return bp(noise(dur), lo, hi) * np.sin(np.linspace(0, np.pi, n)) ** 2


def chord_swell(ms, dur, cutoff=2400):
    return pad(ms, dur, cutoff, att=dur * .45, rel=dur * .45)


IN = [0, 1, 5, 7, 8]    # miyako-bushi: D Eb G A Bb
YO = [0, 2, 5, 7, 9]    # yo scale: D E G A B
ROOT = 62


def deg(scale, d, base=ROOT):
    o, i = divmod(d, len(scale))
    return base + 12 * o + scale[i]


def phrase(t0, bpm, notes, inst, gain=.5, pan=0.0, rev=.35):
    """notes: (beat, degree|None, length_beats) in a scale given by inst tuple (fn, scale)"""
    fn, scale = inst
    spb = 60 / bpm
    for beat, d, ln in notes:
        if d is None: continue
        m = deg(scale, d)
        if fn is shaku:
            x = shaku(m, ln * spb + .2)
        elif fn is shamisen:
            x = shamisen(m, max(.6, ln * spb))
        else:
            x = fn(m, max(1.2, ln * spb * 2))
        add(t0 + beat * spb, x, gain, pan, rev)


def arpeggio(t0, t1, bpm, scale, degrees, inst=koto, gain=.32, pan=.2, rev=.4, every=.5):
    spb = 60 / bpm * every
    k = 0
    t = t0
    while t < t1:
        d = degrees[k % len(degrees)]
        add(t, inst(deg(scale, d), 2.2), gain * (1 - .25 * (k % 2)), pan * (1 if k % 2 else -1), rev)
        t += spb
        k += 1


# ------------------------------------------------------------------ ambience beds
def bed(t0, t1, kind, gain=1.0, fi=1.5, fo=1.5):
    dur = t1 - t0
    n = int(dur * SR)
    t = tt(n)
    if kind == "city":
        x = lp(np.cumsum(noise(dur)) * .02, 500) + .15 * bp(noise(dur), 300, 2000)
        x = x / (np.abs(x).max() + 1e-9) * .5
    elif kind == "subway":
        x = lp(np.cumsum(noise(dur)) * .03, 220)
        x = x / (np.abs(x).max() + 1e-9) * .8 * (1 + .2 * np.sin(2 * np.pi * .7 * t))
        x += .25 * bp(noise(dur), 1500, 4000) * (.5 + .5 * np.sin(2 * np.pi * .3 * t))
    elif kind == "rain":
        x = hp(noise(dur), 2500) * .25 + bp(noise(dur), 400, 1200) * .1
    elif kind == "room":
        x = lp(noise(dur), 300) * .1 + .03 * np.sin(2 * np.pi * 120 * t)
    elif kind == "park":
        x = lp(noise(dur), 500) * .25 * (.6 + .4 * np.sin(2 * np.pi * .08 * t)) + hp(noise(dur), 4000) * .03
    elif kind == "crowd":
        x = bp(noise(dur), 250, 1400) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 1.7 * t + np.sin(t)))) * .6
        x += lp(np.cumsum(noise(dur)) * .02, 300) * .3
    elif kind == "night":
        x = lp(noise(dur), 300) * .1
    level = {"city": .05, "subway": .07, "rain": .035, "room": .015, "park": .03, "crowd": .045, "night": .012}[kind]
    x = x / (np.sqrt((x ** 2).mean()) + 1e-9) * level
    x = x * np.clip(t / fi, 0, 1) * np.clip((dur - t) / fo, 0, 1)
    put(amb, t0, x.astype(np.float32), gain, 0)


def birds(t0, t1, density=.6, gain=.18):
    t = t0
    while t < t1:
        f0 = 2600 + rng.random() * 2400
        for k in range(rng.integers(2, 5)):
            x = sweep(f0 * (1 + .1 * rng.random()), f0 * (1.3 + .4 * rng.random()), .09, .04)
            add(t + k * .11, x, gain * (.5 + .5 * rng.random()), rng.random() * 1.6 - .8, .4)
        t += (1.2 + rng.random() * 3) / density


def horn(t, gain=.12):
    n = int(.5 * SR)
    tt_ = tt(n)
    s = sum(np.sign(np.sin(2 * np.pi * f * tt_)) for f in (392, 466))
    add(t, lp(s, 2000) * env(n, .01, .3), gain, rng.random() - .5, .4)


def clacks(t0, t1, period=.9, gain=.5):
    t = t0
    while t < t1:
        for off in (0, .12):
            add(t + off, lp(noise(.08), 800) * env(int(.08 * SR), .001, .02), gain, 0, .1)
        t += period


def ticks(t0, t1, rate_fn, gain=.35):
    t = t0
    while t < t1:
        add(t, wood(3200, .05), gain, -.6, .1)
        t += 1 / rate_fn(t)


# ------------------------------------------------------------------ sound effects
def M(*xs):
    return seqsum([(0, x) for x in xs])


def sfx(kind):
    if kind == "bell": return suzu(2.0)
    if kind == "unroll": return swish(1.6, 200, 2500) * .6 + lp(noise(1.6), 300) * .2 * np.sin(np.linspace(0, np.pi, int(1.6 * SR)))
    if kind == "stamp": return M(taiko(1.2, .8) * .8, wood(900, .1) * .5)
    if kind == "buzz":
        n = int(1.4 * SR); t = tt(n)
        return np.sign(np.sin(2 * np.pi * 150 * t)) * (np.sin(2 * np.pi * 6 * t) > 0) * .12 * np.minimum(1, (1.4 - t) / .1)
    if kind == "boing": return sweep(300, 900, .35, .12) * .5
    if kind == "yawn": return shaku(70, .9, 2, .6) * .5
    if kind == "whisper": return whisper(1.5)
    if kind == "bonk": return M(wood(700, .25) * 1.2, sweep(900, 400, .2, .08) * .3)
    if kind == "thump": return lp(noise(.2), 400) * env(int(.2 * SR), .001, .04) * 1.5
    if kind == "heartbeat": return heartbeat(6, 76, .9)
    if kind == "puff": return M(swish(.7, 800, 6000) * .8, suzu(.8) * .3)
    if kind == "thwack": return M(wood(1100, .2) * 1.3, swish(.25, 2000, 8000) * .6)
    if kind == "hiss": return bp(noise(.8), 3000, 9000) * np.sin(np.linspace(0, np.pi, int(.8 * SR))) * .5
    if kind == "brake":
        n = int(4 * SR); t = tt(n)
        s = sum(np.sin(2 * np.pi * f * t * (1 - .03 * t / 4)) for f in (2300, 3100)) * .05
        return s * np.sin(np.pi * t / 4) + lp(noise(4), 300) * .3 * np.linspace(1, 0, n)
    if kind == "chime": return seqsum([(0, bell(76, .55, .5)), (.5, bell(72, 2.0, .8))]) * 1.2
    if kind == "shimmer": return seqsum([(i * .06, bell(m, 2.2, .7)) for i, m in enumerate([86, 89, 93, 98, 101])]) * .5
    if kind == "yank": return M(sweep(500, 1500, .2, .08) * .4, wood(1600, .1))
    if kind == "thunder":
        n = int(4 * SR); t = tt(n)
        return lp(noise(4), 160) * (np.exp(-t * 1.2) + .3 * np.exp(-((t - .6) ** 2) * 8)) * 1.6
    if kind == "umbrella": return M(swish(.18, 1500, 7000) * 1.2, wood(500, .06) * .4)
    if kind == "giggle": return seqsum([(k * .12, sweep(900 + 200 * k, 1300 + 200 * k, .1, .05)) for k in range(4)]) * .3
    if kind == "tumble": return seqsum([(k * .16, wood(600 + 300 * k, .1)) for k in range(5)]) * .6
    if kind == "powerdown": return sweep(900, 60, 1.0, .5) * .5
    if kind == "cloth": return swish(1.4, 300, 3000) * .7
    if kind == "clack": return seqsum([(k * .07, wood(1800 + 200 * k, .06)) for k in range(5)]) * .6
    if kind == "breathout": return bp(noise(2.2), 300, 2500) * np.sin(np.linspace(0, np.pi, int(2.2 * SR))) ** 2 * .35
    if kind == "gasp": return M(bp(noise(.5), 600, 3000) * np.sin(np.linspace(0, np.pi, int(.5 * SR))) * .4, bell(93, 1.5, .6) * .5)
    if kind == "slip": return M(sweep(1200, 300, .6, .3) * .25, bell(81, 2, .8) * .6)
    if kind == "snap": return wood(1300, .12) * 1.2
    if kind == "whoosh": return swish(.8, 300, 5000)
    if kind == "parade": return kane(91, 1.5)
    if kind == "glitch":
        x = np.sign(noise(.25)) * .3
        return bp(x, 400, 6000) * (np.arange(len(x)) % 2400 < 1200)
    if kind == "rise":
        n = int(6 * SR); t = tt(n)
        return lp_sweep(noise(6), 200, 2000) * (t / 6) ** 2 * 1.2 + sweep(40, 90, 6, 4) * (t / 6) * .6
    if kind == "bloom": return M(chord_swell([62, 69, 74, 78, 81], 5, 3000) * 2.5, suzu(2) * .5)
    if kind == "crack": return M(wood(2400, .3) * 1.4, hp(noise(.4), 3000) * env(int(.4 * SR), .001, .08) * .8)
    if kind == "collapse":
        n = int(3 * SR); t = tt(n)
        return lp_sweep(noise(3), 4000, 400) * np.exp(-((t - 1.2) ** 2) * 1.5) * .9 + sweep(400, 40, 3, 1.5) * .4
    if kind == "hop": return M(sweep(500, 1400, .25, .1) * .4, suzu(.8) * .4)
    if kind == "chimelow": return bell(74, 4, 1.8) + bell(81, 4, 1.4) * .6
    return np.zeros(10)


# ================================================================== the score
T = lambda sid, u: SC[sid] + u

# ---- title: fox-fire bell, shakuhachi in the dark, koto as the scroll opens
add(T("title", 0), pad([38, 45], 22, 500, att=3, rel=3), .45, 0, .2)
phrase(T("title", 1.4), 60, [(0, 3, 2.2), (2.4, 4, 1.2), (3.6, 3, .8), (4.6, 1, 1.6), (6.6, 0, 3)], (shaku, IN), .55, -.1, .6)
add(T("title", 3.7), seqsum([(i * .07, koto(deg(IN, d), 2.5)) for i, d in enumerate([5, 6, 7, 8, 9, 10, 11])]), .35, .2, .5)
arpeggio(T("title", 11.5), T("title", 21.5), 66, IN, [0, 2, 4, 5, 7, 5, 4, 2], gain=.22)
add(T("title", 11.5), pad([50, 57, 62], 11, 900, att=3, rel=3), .7, 0, .3)

# ---- dawn: a gentle yo-scale morning; the lust motif wakes
add(T("dawn", 0), pad([50, 57, 64, 69], 11, 1200, att=3, rel=2.5), .6)
arpeggio(T("dawn", 0), T("dawn", 8), 72, YO, [0, 4, 7, 9, 7, 4, 2, 4], gain=.24)
phrase(T("dawn", 2), 72, [(0, 7, 2), (2, 9, 1), (3, 8, 1), (4, 7, 3)], (shaku, YO), .4, .2, .6)
birds(T("dawn", 0), T("dawn", 13), .8)
LUST = [(0, 9, .5), (.5, 10, .5), (1, 9, .5), (1.5, 8, .5), (2, 6, .5), (2.5, 5, 1.5)]  # descending, in the In scale
phrase(T("dawn", 11.2), 96, LUST, (shamisen, IN), .4, .3, .3)
add(T("dawn", 13.2), pad([38, 45, 51], 11, 700, att=2, rel=1), .9)
heartbeat_t = T("dawn", 14)
add(heartbeat_t, heartbeat(10, 66, .35), 1, 0, .1)
phrase(T("dawn", 17.5), 96, LUST, (shamisen, IN), .32, .3, .3)
phrase(T("dawn", 21), 96, LUST[:4], (shamisen, IN), .32, .3, .3)
add(T("dawn", 26), pad([50, 57, 62, 66], 12.5, 1400, att=2, rel=3), .6)
arpeggio(T("dawn", 26.2), T("dawn", 38), 70, YO, [0, 2, 4, 7, 9, 7, 4, 2], gain=.22)
phrase(T("dawn", 27.5), 70, [(0, 4, 2), (2, 5, 1), (3, 7, 2), (5, 5, 1), (6, 4, 2.5), (9, 2, 1), (10, 4, 3)], (shaku, YO), .4, -.15, .6)
birds(T("dawn", 26), T("dawn", 38), .5, .12)
bed(T("dawn", 0), T("dawn", 38), "room", .5)

# ---- subway
bed(T("subway", 0), T("subway", 42), "subway", .55, 1, 2)
clacks(T("subway", 0), T("subway", 34), .85, .32)
arpeggio(T("subway", 0), T("subway", 12), 96, IN, [0, 2, 3, 2, 4, 3, 2, 1], gain=.18, every=.5)
add(T("subway", 0), pad([50, 57], 12, 800), .5)
phrase(T("subway", 7), 96, LUST, (shamisen, IN), .38, .3, .3)
add(T("subway", 9), pad([51, 57, 62, 63], 15, 1800, att=3, rel=2), .55)  # dissonant swell
phrase(T("subway", 10.5), 96, LUST, (shamisen, IN), .34, -.3, .3)
add(T("subway", 12), whisper(5, 900) * .4, .5, -.4, .5)
add(T("subway", 21), taiko(1, 1.4), .8, 0, .2)
phrase(T("subway", 21.2), 120, [(0, 7, .5), (.5, 9, .5), (1, 10, 1.5)], (shaku, IN), .5, 0, .4)
add(T("subway", 23.7), taiko(.8, 1), .7)
add(T("subway", 26), pad([50, 57, 62], 8, 1000), .5)
arpeggio(T("subway", 26), T("subway", 33.5), 70, YO, [0, 2, 4, 2], gain=.16, every=1)
phrase(T("subway", 29.5), 60, [(0, 4, 1), (1, 2, 1), (2, 0, 2.5)], (shaku, YO), .35, 0, .5)

# ---- street: walking music in the yo scale with woodblocks; lust motif at the billboard
bed(T("street", 0), T("street", 32), "city", .55)
for k in range(6): horn(T("street", 2 + k * 5.1 + rng.random() * 2), .07)
bpm = 100
add(T("street", 0), pad([50, 57, 62, 66], 20.5, 1500, att=1, rel=2), .5)
arpeggio(T("street", 0), T("street", 20.5), bpm, YO, [0, 4, 2, 4, 5, 4, 2, 4, 7, 4, 2, 4, 5, 7, 9, 7], gain=.2, every=.5)
t = T("street", 0)
while t < T("street", 20.5):
    add(t, wood(1500, .08), .22, -.3, .15)
    add(t + 60 / bpm * .75, wood(2100, .06), .14, .3, .15)
    t += 60 / bpm
phrase(T("street", 9.3), 96, LUST, (shamisen, IN), .4, .3, .3)
phrase(T("street", 16.6), 96, LUST, (shamisen, IN), .36, -.2, .3)
add(T("street", 13.3), taiko(1, 1), .6)
bed(T("street", 21), T("street", 33), "rain", .9, 3, 1)
add(T("street", 21), pad([50, 53, 57, 60], 12, 900, att=3, rel=2), .65)
arpeggio(T("street", 22), T("street", 31.5), 84, IN, [4, 3, 2, 0, 2, 3, 2, 0], gain=.18, every=.5)
phrase(T("street", 25), 60, [(0, 4, 1.5), (1.5, 3, .5), (2, 2, 2.5)], (shaku, IN), .35, 0, .5)

# ---- office: hum, rain, a clock that runs away
bed(T("office", 0), T("office", 30), "room", .6)
bed(T("office", 0), T("office", 30), "rain", .35)
ticks(T("office", 0), T("office", 20), lambda tm: 1 + 7 * max(0, (tm - T("office", 10)) / 10) ** 2, .3)
add(T("office", 4), pad([50, 57], 6, 900), .5)
phrase(T("office", 5.5), 96, LUST, (shamisen, IN), .35, .3, .3)
add(T("office", 10), pad([38, 45, 50, 51], 10.2, 600, att=4, rel=.2), 1.0)
t = T("office", 10)
while t < T("office", 20):  # pulsing low ostinato, quickening
    p = (t - T("office", 10)) / 10
    add(t, shamisen(deg(IN, [0, 1, 0, 3][int(t * 7) % 4], 38), .5), .4 + .3 * p, 0, .2)
    t += .5 - .3 * p
add(T("office", 20.6), pad([38, 45, 48], 9, 500, att=2, rel=3), .9)
phrase(T("office", 21.8), 52, [(0, 4, 1.5), (1.5, 3, .5), (2, 1, 1), (3, 0, 3)], (shaku, IN), .45, 0, .6)

# ---- park: breath, stillness, a revelation, a sunset
bed(T("park", 0), T("park", 48), "park", .6, 2, 3)
birds(T("park", 0), T("park", 33), .5, .14)
add(T("park", 0), pad([50, 57, 62, 66], 9, 1200, att=2, rel=2), .5)
arpeggio(T("park", 0), T("park", 8), 64, YO, [0, 2, 4, 7], gain=.18, every=1)
add(T("park", 8.3), pad([50, 57], 13, 700, att=3, rel=3), .8)
for k in range(5): add(T("park", 11.5 + k * 2.2), bell(deg(YO, [7, 9, 8, 7, 4][k]) + 12, 3, 1.4), .4, (k % 2) - .5, .7)
add(T("park", 21), bell(81, 4, 2), .35, 0, .7)
add(T("park", 25), pad([62, 66, 69, 74], 8, 2000, att=1, rel=3), .5)
phrase(T("park", 26.2), 58, [(0, 7, 1.5), (1.5, 9, .5), (2, 8, 1), (3, 7, 1), (4, 4, 2.5)], (shaku, YO), .45, 0, .6)
add(T("park", 27.8), seqsum([(i * .25, bell(m, 2.5, .9)) for i, m in enumerate([86, 83, 81, 78])]), .3, .2, .6)
add(T("park", 33), pad([50, 57, 62, 64, 69], 10, 1600, att=3, rel=2), .55)
arpeggio(T("park", 33), T("park", 42), 60, YO, [9, 7, 4, 2, 4, 2, 0, -1], gain=.2, every=1)
phrase(T("park", 35.8), 60, [(0, 4, 2), (2, 2, 1), (3, 0, 3)], (shaku, YO), .4, -.1, .6)
add(T("park", 42), pad([38, 45, 51], 7, 600, att=2, rel=2), .8)
phrase(T("park", 43.5), 96, LUST[:4], (shamisen, IN), .3, .4, .5)

# ---- night: neon, the parade, the giant, silence, light
bed(T("night", 0), T("night", 35), "crowd", .6, 2, .3)
bed(T("night", 37), T("night", 60), "crowd", .25, 3, 3)
add(T("night", 0), pad([50, 53, 57, 62], 9.5, 1000, att=2, rel=1), .55)
for k in range(4): add(T("night", 1 + k * 2), taiko(1.3, 1.2), .15, -.3, .3)
# matsuri: don-don-doko with a flute and a gong
bpm = 120; spb = 60 / bpm
t = T("night", 9)
k = 0
while t < T("night", 20):
    for off, sz, g in ((0, 1, .3), (1, 1, .24), (2, 1.2, .2), (2.5, 1.2, .18), (3, .9, .26)):
        add(t + off * spb, taiko(sz, 1), g, -.2, .25)
    if k % 2 == 0: add(t, kane(91, 1), .5, .4, .3)
    t += 4 * spb; k += 1
phrase(T("night", 9.5), bpm, [(0, 9, 1), (1, 10, 1), (2, 9, .5), (2.5, 7, .5), (3, 6, 2), (6, 7, 1), (7, 9, 1), (8, 10, 2), (10, 9, 1), (11, 7, 1), (12, 6, 3), (16, 9, 1), (17, 10, 1), (18, 12, 2), (20, 10, 1), (21, 9, 3)], (shaku, IN), .38, .2, .4)
# the giant rises: drums gather, a cluster swells
add(T("night", 20), pad([38, 39, 45, 50, 51, 56], 15, 1400, att=8, rel=.1), .8)
t = T("night", 20)
while t < T("night", 35):
    p = (t - T("night", 20)) / 15
    add(t, taiko(1 - .2 * p, 1.2), .14 + .26 * p, rng.random() * .6 - .3, .3)
    t += .5 - .3 * p
for k, tm in enumerate([22, 25, 27.5, 30, 31.5, 33]):
    add(T("night", tm), whisper(1.6, 700 + k * 120), .5, (k % 2) * 1.2 - .6, .6)
phrase(T("night", 22), 96, LUST, (shamisen, IN), .5, 0, .3)
phrase(T("night", 26), 96, LUST, (shamisen, IN), .55, -.3, .3)
phrase(T("night", 30), 132, LUST + [(4, 4, 1), (5, 3, 2)], (shamisen, IN), .6, .3, .3)
add(T("night", 34.6), taiko(.7, 2.5), .6, 0, .5)
# silence; then light
add(T("night", 37.4), pad([50, 57, 62, 66, 69, 76], 15, 2600, att=4, rel=4), 1.0)
arpeggio(T("night", 39), T("night", 46), 72, YO, [0, 2, 4, 5, 7, 9, 10, 12], gain=.22, every=.5)
phrase(T("night", 40), 60, [(0, 7, 2), (2, 9, 1), (3, 10, 2), (5, 9, 1), (6, 7, 2.5)], (shaku, YO), .5, 0, .6)
add(T("night", 46), pad([47, 54, 59, 62, 66], 6, 2000, att=2, rel=3), .7)
add(T("night", 51.5), pad([50, 57, 62, 66, 69], 9, 1800, att=2, rel=3), .7)
lull = [(0, 4, 1), (1, 5, 1), (2, 7, 2), (4, 5, 1), (5, 4, 1), (6, 2, 2), (8, 4, 1), (9, 2, 1), (10, 0, 3)]
phrase(T("night", 52.2), 66, lull, (koto, YO), .38, -.1, .5)
phrase(T("night", 52.6), 66, lull, (shaku, YO), .3, .1, .6)

# ---- home: the lullaby, the scroll closes
bed(T("home", 0), T("home", 26), "night", .6, 2, 4)
add(T("home", 0), pad([50, 57, 62, 66], 20, 1300, att=3, rel=6), .55)
for k in range(10):
    tm = T("home", .5 + k * 2.2)
    add(tm, koto(deg(YO, [4, 2, 5, 4, 7, 5, 4, 2, 0, 0][k]), 3), .26, (k % 2) * .6 - .3, .6)
for k in range(12):  # crickets, faint
    add(T("home", 1 + k * 1.6), np.tile(bp(noise(.02), 4000, 6000), 6) * .08, 1, .7, .3)
phrase(T("home", 13), 60, [(0, 7, 2), (2, 4, 1), (3, 2, 1), (4, 0, 4)], (shaku, YO), .35, 0, .7)
add(T("home", 21), pad([38, 45, 50], 7, 700, att=1, rel=4), .6)

# ---- cue sound effects from the picture
for c in cues["sfx"]:
    x = sfx(c["type"])
    add(c["t"], x, .5 * c.get("gain", 1), 0, .25)

# ------------------------------------------------------------------ mix
ir_n = int(3.2 * SR)
it = tt(ir_n)
irs = [hp(noise(3.2), 150) * np.exp(-it * 2.1) * .03 for _ in range(2)]
rev = np.stack([fftconvolve(wet[i], irs[i])[:N] for i in range(2)])
mix = dry + rev.astype(np.float32) + amb
# gentle glue: soft clip
# gentle glue: soft clip only the rare peaks above .8
over = np.abs(mix) > .8
mix[over] = np.sign(mix[over]) * (.8 + .2 * np.tanh((np.abs(mix[over]) - .8) / .2))
fo = int(2.0 * SR)
end = int(TOTAL * SR)
mix[:, end - fo:end] *= np.linspace(1, 0, fo)
mix = mix[:, :end]
peak = np.abs(mix).max()
mix = mix / peak * .89
sf.write(os.path.join(B, "mix.wav"), mix.T, SR, subtype="PCM_16")
print("wrote mix.wav", mix.shape[1] / SR, "s, peak", peak)
