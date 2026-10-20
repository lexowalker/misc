"""Generate the voiceover with Kokoro TTS and write timeline.json (line start/end times)."""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else "voices"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
VOICE, SPEED, SR = "af_heart", 0.98, 24000
LEAD_IN = 1.2

# (id, spoken text, pause after in seconds). Display captions live in scenes.js.
LINES = [
    # hook
    ("h1", "Somewhere, right now, there is another you.", 0.5),
    ("h2", "Same memories. Same face. Same favorite song.", 0.4),
    ("h3", "But in their world, a single particle went left, where in yours, it went right.", 0.6),
    ("h4", "This isn't science fiction. According to the physicist David Deutsch, it's what our best theory of physics is telling us, if only we take it seriously.", 0.4),
    ("h5", "In his book, The Beginning of Infinity, he calls it the multiverse. So let's build one, piece by piece.", 3.2),
    # fungibility
    ("f1", "Deutsch starts with a piece of fiction. Imagine the universe came in two copies, identical down to the very last atom.", 0.35),
    ("f2", "Two Earths. Two of every star. Two of you, reading this sentence in perfect unison.", 0.45),
    ("f3", "Would anything be different? Nothing at all. No experiment, even in principle, could tell the copies apart.", 0.45),
    ("f4", "Deutsch has a word for things like this. Fungible.", 0.5),
    ("f5", "It comes from economics. If you have a hundred dollars in the bank, it makes no sense to ask which dollar is which.", 0.3),
    ("f6", "They're not just similar. There is simply no fact of the matter that distinguishes them.", 0.4),
    ("f7", "Two fungible universes are like that. As long as they stay identical, they behave as one.", 0.9),
    # differentiation
    ("d1", "Now, add one ingredient: a tiny event whose outcome can be different in the two copies.", 0.3),
    ("d2", "Picture a single particle striking a detector. In one universe, it lights a red lamp. In the other, a blue one.", 0.4),
    ("d3", "In that instant, the universes are no longer fungible. They have differentiated.", 0.4),
    ("d4", "And the difference grows. The scientist who sees red writes red in her notebook. Her doppelgänger writes blue. Their days, and eventually their lives, begin to diverge.", 0.4),
    ("d5", "Each of them sees only one lamp. And each of them is equally real.", 0.9),
    # waves of differentiation
    ("w1", "But here's a subtlety that the movies usually get wrong.", 0.3),
    ("w2", "The universe does not split all at once, like some cosmic photocopier.", 0.4),
    ("w3", "The difference starts at the detector, and spreads outward, one interaction at a time. Carried by light, by air molecules, by sound. Never faster than light.", 0.4),
    ("w4", "A distant galaxy hasn't been touched by the difference yet. Out there, the two histories are still fungible. Still one.", 0.4),
    ("w5", "So differentiation is a local process. A wave, rippling outward through the multiverse.", 0.9),
    # interference
    ("i1", "Now for the truly strange part. What if a difference could be erased, before it spreads?", 0.3),
    ("i2", "Then the two histories become fungible again. They merge. And what happens next can depend on both of them.", 0.4),
    ("i3", "This is called interference. And it happens in laboratories every day.", 0.4),
    ("i4", "Send a single photon at a half-silvered mirror. In some histories, it's reflected. In others, it passes straight through.", 0.3),
    ("i5", "Two more mirrors bring the paths back together, at a second half-silvered mirror.", 0.4),
    ("i6", "If the photon simply took one path or the other, it should end up at each detector half of the time.", 0.4),
    ("i7", "But that's not what happens. Every single time, it arrives at the same detector.", 0.6),
    ("i8", "Now, block one of the paths. Suddenly, photons start arriving at both detectors again.", 0.5),
    ("i9", "Blocking a path the photon supposedly didn't take changed the outcome. So something did take it: the photon's instances in other histories, interfering with ours.", 1.0),
    # decoherence
    ("c1", "So why don't whole worlds interfere? Why doesn't your life merge with your doppelgänger's?", 0.3),
    ("c2", "Because to merge, two histories must become exactly identical again. Every single atom.", 0.4),
    ("c3", "For one photon in a quiet lab, that's easy. But once a difference has spread into a detector, a notebook, the air, a brain, trillions upon trillions of particles, undoing it is hopeless.", 0.4),
    ("c4", "This is called decoherence. It's why large objects seem to live in one solid, ordinary world. And it's why the other histories stay hidden.", 0.4),
    ("c5", "It's also why you can't visit, or phone, your doppelgänger. Interference is the only channel between histories, and for anything as big as you, it's effectively closed.", 1.0),
    # measure
    ("m1", "There's another way the real multiverse differs from our fiction.", 0.3),
    ("m2", "It doesn't come in neat, countable copies. Fungible histories form a continuum, more like a flowing fluid than a stack of separate things.", 0.4),
    ("m3", "When an outcome differs, the fluid divides. And not always evenly. Perhaps a third of it goes one way, and two thirds the other.", 0.4),
    ("m4", "Deutsch calls this proportion the measure. And it's what probability really means in quantum physics.", 0.3),
    ("m5", "When the theory says an outcome has a two-thirds chance, it's telling you that two thirds of the histories that start here, end up there.", 1.0),
    # structure
    ("s1", "Zoom out, and the multiverse has a rich structure.", 0.3),
    ("s2", "At the scale of people and planets, decoherence carves it into layers that behave almost like separate universes, each one obeying classical physics, to a very good approximation.", 0.4),
    ("s3", "But zoom in, to the scale of atoms, and that picture dissolves. Down here, the multiverse isn't divided into universes at all.", 0.4),
    ("s4", "An electron isn't at one single place. Its fungible instances are spread across a range of positions, constantly interfering. That diversity is what Heisenberg's uncertainty principle is really about.", 0.4),
    ("s5", "And entanglement? It's information about which instances of one particle go with which instances of another.", 0.4),
    ("s6", "So parallel universes are not the fundamental thing. They are emergent. Real, but approximate, like waves on an ocean.", 1.0),
    # why believe it
    ("b1", "So why should anyone believe this?", 0.3),
    ("b2", "Not because it's exciting. Because it explains.", 0.4),
    ("b3", "Hugh Everett first proposed it in nineteen fifty-seven, simply by taking the equations of quantum theory at face value.", 0.4),
    ("b4", "Many physicists preferred to say the theory only predicts the results of experiments, and that asking what is really happening is meaningless. Shut up, and calculate.", 0.4),
    ("b5", "For Deutsch, that's giving up. A good explanation is hard to vary. It tells us what is really out there. And quantum theory, taken seriously, says that what's out there is a multiverse.", 0.4),
    ("b6", "Quantum computers make the point vivid. When one solves a problem by interference, Deutsch asks: where, exactly, was all that computation done?", 1.1),
    # outro
    ("o1", "So, back to that other you.", 0.4),
    ("o2", "Not a fantasy. Not a copy you could ever visit. Just another history of the same reality, flowing right alongside yours.", 0.5),
    ("o3", "And the fact that we can understand any of this, that a lump of matter in one history can explain the structure of them all,", 0.2),
    ("o4", "is, Deutsch would say, exactly what it means to stand at the beginning of infinity.", 4.0),
]

# Phoneme overrides.
IPA = {
    "doppelgänger": "dˈɑːpəlɡˌæŋɚ",
}


def segments(audio, frame=0.01, min_gap=0.08):
    """Spoken chunks separated by short silences, so visuals can hit individual phrases."""
    n = int(frame * SR)
    rms = np.sqrt(np.mean(audio[: len(audio) // n * n].reshape(-1, n) ** 2, axis=1))
    on = rms > rms.max() * 0.04
    segs, start, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * frame >= min_gap:
                segs.append((start * frame, (i - quiet + 1) * frame))
                start, quiet = None, 0
    if start is not None:
        segs.append((start * frame, len(on) * frame))
    return segs


def main():
    k = Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"), os.path.join(MODEL_DIR, "voices-v1.0.bin"))
    chunks = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    timeline = {}
    for lid, text, pause in LINES:
        ph = k.tokenizer.phonemize(text, "en-us")
        for w, ipa in IPA.items():
            if w in text:
                src = k.tokenizer.phonemize(w, "en-us")
                assert src in ph, (w, src, ph)
                ph = ph.replace(src, ipa)
        audio, sr = k.create(ph, voice=VOICE, speed=SPEED, is_phonemes=True)
        assert sr == SR
        dur = len(audio) / SR
        timeline[lid] = {"start": round(t, 3), "end": round(t + dur, 3), "text": text,
                         "seg": [[round(t + a, 3), round(t + b, 3)] for a, b in segments(audio)]}
        chunks += [audio.astype(np.float32), np.zeros(int(pause * SR), np.float32)]
        t += dur + pause
        print(f"{lid:3s} {timeline[lid]['start']:6.2f} {dur:5.2f}  {text}")
    total = t
    voice = np.concatenate(chunks)
    voice = voice / max(1e-6, np.abs(voice).max()) * 0.89
    os.makedirs(OUT, exist_ok=True)
    sf.write(os.path.join(OUT, "voice.wav"), voice, SR)
    data = {"total": round(total, 3), "lines": timeline}
    json.dump(data, open(os.path.join(OUT, "timeline.json"), "w"), indent=1)
    with open(os.path.join(OUT, "timeline.js"), "w") as f:
        f.write("window.TL = " + json.dumps(data) + ";\n")
    print("total", round(total, 2))


if __name__ == "__main__":
    main()
