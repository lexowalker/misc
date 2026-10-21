"""Generate the voiceover with Kokoro TTS and write timeline.json (line start/end times)."""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else "voices"
OUT = os.path.join(os.path.dirname(__file__), "build")
VOICE, SPEED, SR = "af_heart", 1.0, 24000
LEAD_IN = 0.6

# (id, spoken text, pause after in seconds). Display captions live in scenes.js.
LINES = [
    ("h1", "You know that feeling?", 0.3),
    ("h2", "A lump in your throat.", 0.25),
    ("h3", "Your eyes start to sting.", 0.25),
    ("h4", "You try to say something... and nothing comes out.", 0.45),
    ("h5", "There's a word for that.", 0.5),
    ("w1", "Verklempt.", 0.5),
    ("w2", "Pronounced, fer. klempt. It's an informal adjective.", 0.5),
    ("d1", "It means overcome with emotion. So moved, you're choked up.", 0.4),
    ("d2", "And it's not only sadness. Joy, pride, nostalgia, gratitude... any feeling big enough to squeeze your throat shut.", 0.6),
    ("e1", "And that squeeze is exactly where the word comes from.", 0.35),
    ("e2", "In German, klemmen means to pinch, or to clamp.", 0.25),
    ("e3", "Verklemmen: to jam something tight.", 0.25),
    ("e4", "So verklemmt means jammed, or squeezed.", 0.35),
    ("e5", "Yiddish speakers made it farklemt: choked with emotion, as if your heart were caught in a clamp.", 0.35),
    ("e6", "And Yiddish-speaking immigrants carried it to America.", 0.6),
    ("g1", "Here's the twist.", 0.25),
    ("g2", "In modern German, verklemmt usually means uptight, or inhibited. Not teary... just tense.", 0.6),
    ("p1", "Then, in the early nineties, Saturday Night Live made it famous.", 0.3),
    ("p2", "In the Coffee Talk sketches, the host would fan her face and announce:", 0.15),
    ("p3", "I'm getting a little verklempt. Talk amongst yourselves!", 0.6),
    ("x0", "So, how do you use it?", 0.35),
    ("x1", "At the wedding, the father of the bride got so verklempt, he couldn't finish his toast.", 0.6),
    ("x2", "She gets verklempt at the end of that movie. Every. Single. Time.", 0.6),
    ("x3", "When the old shelter dog finally got adopted, the whole staff was verklempt.", 0.6),
    ("s1", "Similar words: choked up, misty-eyed, overcome.", 0.3),
    ("s2", "But verklempt comes with a little extra warmth... and a little humor.", 0.6),
    ("o1", "So the next time you're too moved to speak,", 0.15),
    ("o2", "just fan your face, and say it.", 0.45),
    ("o3", "Verklempt.", 1.6),
]

# Phoneme overrides: the English stress (fer-KLEMPT) and the German/Yiddish forms.
IPA = {
    "verklempt": "fəɹklˈɛmpt",
    "Verklempt": "fəɹklˈɛmpt",
    "farklemt": "fɑɹklˈɛmt",
    "verklemmt": "fɛɹklˈɛmt",
    "Verklemmen": "fɛɹklˈɛmən",
    "klemmen": "klˈɛmən",
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
    total = t + 0.8
    chunks.append(np.zeros(int(0.8 * SR), np.float32))
    voice = np.concatenate(chunks)
    voice = voice / max(1e-6, np.abs(voice).max()) * 0.89
    sf.write(os.path.join(OUT, "voice.wav"), voice, SR)
    json.dump({"total": round(total, 3), "lines": timeline}, open(os.path.join(OUT, "timeline.json"), "w"), indent=1)
    with open(os.path.join(OUT, "timeline.js"), "w") as f:
        f.write("window.TL = " + json.dumps({"total": round(total, 3), "lines": timeline}) + ";\n")
    print("total", round(total, 2))

if __name__ == "__main__":
    main()
