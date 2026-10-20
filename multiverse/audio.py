"""Synthesize an ambient music bed and the sound effects, then mix them under the voiceover -> build/mix.wav."""
import json, os
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")
SR = 48000
rng = np.random.default_rng(11)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def tone(freq, dur, decay, attack=.004, partials=((1, 1),)):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * (m - 1) * 3) for m, a in partials)
    return s * env(n, attack, decay)


def sweep(f0, f1, dur, decay, attack=.002):
    n = int(dur * SR)
    f = np.geomspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, attack, decay)


def noise(dur, smooth=1):
    x = rng.standard_normal(int(dur * SR))
    for _ in range(smooth):
        x = np.convolve(x, np.ones(6) / 6, mode="same")
    return x


def highpass(x):
    return np.diff(x, prepend=0)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def bell(m, dur=2.2, decay=.8):
    return tone(midi(m), dur, decay, partials=((1, 1), (2.76, .22), (5.4, .07)))


def arp(notes, gap, gain=.22, **kw):
    parts = [bell(m, **kw) for m in notes]
    out = np.zeros(int(gap * SR * len(notes)) + max(len(p) for p in parts))
    for i, p in enumerate(parts):
        o = int(i * gap * SR)
        out[o:o + len(p)] += gain * p
    return out


def swell(dur=1.6):
    n = int(dur * SR)
    shape = np.sin(np.linspace(0, np.pi, n)) ** 2
    s = sum(np.sin(2 * np.pi * midi(m) * np.arange(n) / SR + k) for k, m in enumerate([62, 69, 74, 76]))
    return .12 * s * shape + .1 * noise(dur, 3) * shape


def shimmer():
    a = arp([72, 79, 84, 88, 91, 96, 100], .045, gain=.13, dur=1.6, decay=.6)
    a[:SR] += .06 * noise(1.0, 1) * np.sin(np.linspace(0, np.pi, SR)) ** 2
    return a


SFX = {
    "pop": lambda: .5 * sweep(900, 320, .12, .045),
    "thud": lambda: .9 * sweep(150, 50, .35, .1) + .2 * noise(.35, 3) * env(int(.35 * SR), .001, .025),
    "whoosh": lambda: .25 * noise(.6, 2) * np.sin(np.linspace(0, np.pi, int(.6 * SR))) ** 2,
    "zip": lambda: .3 * sweep(500, 2200, .25, .12),
    "blip": lambda: .3 * tone(1568, .12, .05, partials=((1, 1), (2, .3))),
    "ding": lambda: .45 * bell(88, 1.4, .5),
    "coin": lambda: .25 * tone(2093, .25, .06) + .2 * tone(2637, .25, .08),
    "chime": lambda: arp([79, 84, 88, 91, 96], .07),
    "sparkle": lambda: arp([91, 96, 100, 103, 108], .05, gain=.12, dur=1.0, decay=.3),
    "shimmer": lambda: shimmer(),
    "swell": swell,
}


def music(total):
    """Slow ambient pads (Dmaj9 - Bm9 - Gmaj9 - A6sus) with sparse bells, 66 bpm."""
    beat = 60 / 66
    bar = 4 * beat
    chords = [(38, [62, 66, 69, 73, 76]), (35, [59, 62, 66, 69, 73]), (31, [59, 62, 66, 69, 74]), (33, [61, 64, 66, 69, 71])]
    n = int((total + 6) * SR)
    out = np.zeros(n)
    t_all = np.arange(int(2 * bar * SR + 2 * SR)) / SR

    def pad(freqs, length):
        tt = t_all[: int(length * SR)]
        s = np.zeros(len(tt))
        for f in freqs:
            for d in (-.6, .6):
                s += np.sin(2 * np.pi * (f + d) * tt + rng.random() * 6)
        a = np.minimum(1, tt / 1.6) * np.minimum(1, (length - tt) / 1.6)
        return s * np.clip(a, 0, 1) / len(freqs)

    t, k = 0.0, 0
    R = np.random.default_rng(5)
    while t < total + 2:
        root, notes = chords[(k // 1) % 4]
        L = 2 * bar + 1.6
        p = pad([midi(m) for m in notes[:4]], L) * .18 + pad([midi(root), midi(root + 12)], L) * .22
        o = int(t * SR)
        seg = out[o:o + len(p)]
        seg += p[: len(seg)]
        # sparse bells
        for j in range(8):
            if R.random() < .55:
                m = notes[R.integers(len(notes))] + 12
                b = bell(m, 2.4, .9) * .05
                oo = int((t + j * beat) * SR)
                if oo < n:
                    s2 = out[oo:oo + len(b)]
                    s2 += b[: len(s2)]
        t += 2 * bar
        k += 1
    nT = int(total * SR)
    fade = np.ones(n)
    fade[: int(3 * SR)] = np.linspace(0, 1, int(3 * SR))
    fo = int(5 * SR)
    fade[nT - fo:nT] = np.linspace(1, 0, fo)
    fade[nT:] = 0
    return out * fade


def resample(x, sr_in):
    t_out = np.arange(int(len(x) * SR / sr_in)) / SR
    return np.interp(t_out, np.arange(len(x)) / sr_in, x)


def main():
    voice, vsr = sf.read(os.path.join(B, "voice.wav"))
    voice = resample(voice, vsr)
    total = len(voice) / SR
    m = music(total)[: len(voice)]
    m = m / np.abs(m).max() * .5

    # duck the music a little while the narrator speaks
    e = np.abs(voice)
    k = int(.2 * SR)
    e = np.convolve(e, np.ones(k) / k, mode="same")
    duck = 1 - .4 * np.clip(e / .04, 0, 1)

    fx = np.zeros(len(voice) + 4 * SR)
    for ev in json.load(open(os.path.join(B, "sfx.json"))):
        s = SFX[ev["type"]]()
        o = int(ev["t"] * SR)
        fx[o:o + len(s)] += ev["gain"] * s
    fx = fx[: len(voice)]

    mix = voice * 1.0 + m * .38 * duck + fx * .45
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    # a touch of width: delay the music/fx slightly in one channel
    d = int(.012 * SR)
    side = np.concatenate([np.zeros(d), (m * .38 * duck + fx * .45)[:-d]]) * .15
    stereo = np.stack([mix + side, mix - side], axis=1).astype(np.float32)
    sf.write(os.path.join(B, "mix.wav"), stereo, SR)
    print("mix", round(total, 2), "s, peak", round(float(np.abs(stereo).max()), 3))


if __name__ == "__main__":
    main()
