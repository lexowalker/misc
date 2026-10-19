"""Synthesize the music bed and sound effects, then mix them under the voiceover -> build/mix.wav."""
import json, os
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")
SR = 48000
rng = np.random.default_rng(3)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def tone(freq, dur, decay, attack=.004, partials=((1, 1),)):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * (m - 1) * 4) for m, a in partials)
    return s * env(n, attack, decay)


def sweep(f0, f1, dur, decay):
    n = int(dur * SR)
    f = np.geomspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, decay)


def noise(dur, smooth=1):
    x = rng.standard_normal(int(dur * SR))
    for _ in range(smooth):
        x = np.convolve(x, np.ones(6) / 6, mode="same")
    return x


def highpass(x):
    return np.diff(x, prepend=0)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


SFX = {
    "tick": lambda: .5 * tone(2600, .06, .012) + .25 * highpass(noise(.06)) * env(int(.06 * SR), .0005, .004),
    "pop": lambda: .55 * sweep(950, 330, .12, .045),
    "thump": lambda: .9 * sweep(150, 55, .3, .09) + .2 * noise(.3, 3) * env(int(.3 * SR), .001, .02),
    "thud": lambda: .6 * sweep(220, 90, .22, .06) + .25 * noise(.22, 4) * env(int(.22 * SR), .001, .03),
    "whoosh": lambda: .22 * noise(.45, 2) * np.sin(np.linspace(0, np.pi, int(.45 * SR))) ** 2,
    "bubble": lambda: .45 * sweep(480, 1250, .11, .05),
    "snap": lambda: .45 * highpass(noise(.05)) * env(int(.05 * SR), .0005, .008) + .4 * tone(1800, .05, .02),
    "swipe": lambda: .12 * highpass(noise(.35, 1)) * np.sin(np.linspace(0, np.pi, int(.35 * SR))),
    "chime": None,
}


def chime():
    out = np.zeros(int(2.6 * SR))
    for i, m in enumerate([84, 88, 91, 96]):
        s = tone(midi(m), 2.2, .7, partials=((1, 1), (2.76, .25), (5.4, .08)))
        o = int(i * .07 * SR)
        out[o:o + len(s)] += .22 * s
    return out


def music(total):
    """Soft marimba arpeggios over Cmaj7 - Am7 - Fmaj7 - G6, 96 bpm, with a quiet clock tick."""
    beat = 60 / 96
    chords = [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (41, [57, 60, 65, 69]), (43, [59, 62, 67, 64])]
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    out = np.zeros(int((total + 3) * SR))
    marimba = ((1, 1), (4, .18), (9.2, .04))

    def add(s, t, g):
        o = int(t * SR)
        if o >= len(out):
            return
        s = s[: len(out) - o]
        out[o:o + len(s)] += g * s

    t, bar = 0.0, 0
    while t < total + 1:
        root, notes = chords[(bar // 2) % 4]
        add(tone(midi(root), 2.4, .9, attack=.01, partials=((1, 1), (2, .2))), t, .2)
        add(tone(midi(root + 7), 1.8, .7, attack=.01), t + 2 * beat, .1)
        for k, idx in enumerate(pattern):
            m = notes[idx] + (12 if (bar % 2 and k in (3, 6)) else 0)
            accent = 1.0 if k % 2 == 0 else .7
            add(tone(midi(m), .9, .28, partials=marimba), t + k * beat / 2, .11 * accent)
        for k in range(4):
            add(highpass(noise(.03)) * env(int(.03 * SR), .0005, .004), t + k * beat, .05 if k else .08)
        t += 4 * beat
        bar += 1
    n = int(total * SR)
    fade = np.ones(len(out))
    fade[: int(1.2 * SR)] = np.linspace(0, 1, int(1.2 * SR))
    fo = int(2.5 * SR)
    fade[n - fo:n] = np.linspace(1, 0, fo)
    fade[n:] = 0
    return out * fade


def resample(x, sr_in):
    t_out = np.arange(int(len(x) * SR / sr_in)) / SR
    return np.interp(t_out, np.arange(len(x)) / sr_in, x)


def main():
    voice, vsr = sf.read(os.path.join(B, "voice.wav"))
    voice = resample(voice, vsr)
    total = len(voice) / SR
    m = music(total)[: len(voice)]

    # duck the music a little while the narrator speaks
    e = np.abs(voice)
    k = int(.15 * SR)
    e = np.convolve(e, np.ones(k) / k, mode="same")
    duck = 1 - .45 * np.clip(e / .04, 0, 1)

    fx = np.zeros(len(voice) + 3 * SR)
    for ev in json.load(open(os.path.join(B, "sfx.json"))):
        s = chime() if ev["type"] == "chime" else SFX[ev["type"]]()
        o = int(ev["t"] * SR)
        fx[o:o + len(s)] += ev["gain"] * s
    fx = fx[: len(voice)]

    mix = voice * 1.0 + m * .55 * duck + fx * .5
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    stereo = np.stack([mix, mix], axis=1).astype(np.float32)
    sf.write(os.path.join(B, "mix.wav"), stereo, SR)
    print("mix", round(total, 2), "s, peak", round(float(np.abs(mix).max()), 3))


if __name__ == "__main__":
    main()
