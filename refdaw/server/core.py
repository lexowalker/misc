"""Shared project model helpers: tempo mapping, ids, instruments, music analysis.

A project is a plain JSON-able dict:

{
  "id": str, "name": str,
  "bpm": float,                     # nominal tempo
  "timeSig": [4, 4],
  "key": {"tonic": "C", "mode": "minor"},
  "tempoMap": [[beat, sec], ...] | None,   # optional, from a reference recording
  "targetSeconds": float | None,    # desired length (e.g. 167 for 2:47)
  "reference": {"file": "reference.mp3", "synced": bool} | None,
  "sections": [{"name", "start", "end"}],   # beats
  "chords":   [{"start", "dur", "name"}],   # beats
  "tracks": [{"id", "name", "program", "color", "volume", "pan", "mute", "solo",
              "notes": [{"id", "p", "s", "d", "v"}]}]   # pitch, start beat, dur beats, velocity 1-127
}
"""
from __future__ import annotations

import itertools
import math
import random
import string

import numpy as np

NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
NAME_TO_PC = {n: i for i, n in enumerate(NOTE_NAMES)}
NAME_TO_PC.update({"Db": 1, "D#": 3, "Gb": 6, "G#": 8, "A#": 10, "Cb": 11, "B#": 0, "E#": 5, "Fb": 4})

MODES = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
}

TRACK_COLORS = ["#e8a33d", "#5fb3b3", "#c678dd", "#7fb069", "#e06c75", "#61afef", "#d19a66", "#98c379"]

# General MIDI program names (0-based program numbers).
GM = [
    "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano",
    "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavinet", "Celesta", "Glockenspiel",
    "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer", "Drawbar Organ",
    "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica",
    "Tango Accordion", "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)",
    "Electric Guitar (clean)", "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar",
    "Guitar Harmonics", "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)",
    "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2", "Violin", "Viola",
    "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
    "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2", "Choir Aahs",
    "Voice Oohs", "Synth Choir", "Orchestra Hit", "Trumpet", "Trombone", "Tuba", "Muted Trumpet",
    "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2", "Soprano Sax", "Alto Sax",
    "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet", "Piccolo", "Flute",
    "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina", "Lead 1 (square)",
    "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)",
    "Lead 7 (fifths)", "Lead 8 (bass + lead)", "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)",
    "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
    "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)",
    "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)", "Sitar", "Banjo", "Shamisen", "Koto",
    "Kalimba", "Bagpipe", "Fiddle", "Shanai", "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock",
    "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal", "Guitar Fret Noise", "Breath Noise",
    "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot",
]

# Ensemble presets used when transcribing audio: (track name, GM program, nominal low, high)
ENSEMBLES = {
    "sax_quartet": [("Soprano Sax", 64, 56, 87), ("Alto Sax", 65, 49, 80), ("Tenor Sax", 66, 44, 75), ("Baritone Sax", 67, 36, 68)],
    "string_quartet": [("Violin I", 40, 55, 100), ("Violin II", 40, 55, 93), ("Viola", 41, 48, 84), ("Cello", 42, 36, 72)],
    "strings": [("Violins", 48, 55, 100), ("Violas", 48, 48, 84), ("Cellos", 48, 36, 72), ("Basses", 43, 28, 60)],
    "piano": [("Piano RH", 0, 55, 108), ("Piano LH", 0, 21, 66)],
    "organ": [("Organ RH", 19, 55, 96), ("Organ LH", 19, 36, 66), ("Organ Pedal", 19, 24, 50)],
    "orchestra": [("Flutes / Violins", 48, 62, 100), ("Horns / Violas", 60, 50, 80), ("Clarinets / Cellos", 71, 42, 72), ("Low Brass / Basses", 58, 28, 58)],
    "band": [("Lead", 80, 60, 96), ("Keys", 4, 48, 84), ("Bass", 33, 28, 55)],
    "generic": [("High", 0, 64, 108), ("Middle", 0, 50, 76), ("Low", 0, 21, 60)],
}

ENSEMBLE_KEYWORDS = [
    ("sax", "sax_quartet"), ("string quartet", "string_quartet"), ("quartet", "string_quartet"),
    ("strings", "strings"), ("violin", "string_quartet"), ("cello", "string_quartet"),
    ("orchestra", "orchestra"), ("symphon", "orchestra"), ("film", "orchestra"),
    ("piano", "piano"), ("organ", "organ"), ("band", "band"),
]


def guess_ensemble(filename: str) -> str:
    low = filename.lower().replace("_", " ").replace("-", " ")
    for kw, ens in ENSEMBLE_KEYWORDS:
        if kw in low:
            return ens
    return "generic"


def program_from_name(name: str | int | None, default: int = 0) -> int:
    if name is None:
        return default
    if isinstance(name, int) or (isinstance(name, str) and name.strip().isdigit()):
        return max(0, min(127, int(name)))
    q = name.lower().strip()
    for i, g in enumerate(GM):
        if g.lower() == q:
            return i
    aliases = {"sax": 65, "saxophone": 65, "strings": 48, "string": 48, "piano": 0, "guitar": 24, "bass": 32,
               "harp": 46, "choir": 52, "voice": 53, "horn": 60, "brass": 61, "synth": 81, "pad": 89,
               "organ": 19, "bells": 14, "marimba": 12, "vibes": 11, "double bass": 43, "contrabass": 43}
    if q in aliases:
        return aliases[q]
    for i, g in enumerate(GM):
        if q in g.lower():
            return i
    return default


_id_counter = itertools.count()


def new_id(prefix: str = "n") -> str:
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=7)) + str(next(_id_counter))


def pitch_name(p: int) -> str:
    return f"{NOTE_NAMES[p % 12]}{p // 12 - 1}"


def parse_pitch(s: str | int) -> int:
    if isinstance(s, int):
        return s
    s = s.strip()
    if s.lstrip("-").isdigit():
        return int(s)
    i = 2 if len(s) > 1 and s[1] in "#b" else 1
    return NAME_TO_PC[s[:i]] + 12 * (int(s[i:]) + 1)


# ---------------------------------------------------------------- tempo

class Tempo:
    """Converts between beats and seconds, optionally through a tempo map."""

    def __init__(self, project: dict):
        self.bpm = float(project.get("bpm") or 120)
        tm = project.get("tempoMap")
        if tm and len(tm) >= 2:
            a = np.array(tm, dtype=float)
            self.beats, self.secs = a[:, 0], a[:, 1]
        else:
            self.beats = self.secs = None

    def sec(self, beat):
        beat = np.asarray(beat, dtype=float)
        if self.beats is None:
            return beat * 60.0 / self.bpm
        b, s = self.beats, self.secs
        out = np.interp(beat, b, s)
        lo_slope = (s[1] - s[0]) / (b[1] - b[0])
        hi_slope = (s[-1] - s[-2]) / (b[-1] - b[-2])
        out = np.where(beat < b[0], s[0] + (beat - b[0]) * lo_slope, out)
        out = np.where(beat > b[-1], s[-1] + (beat - b[-1]) * hi_slope, out)
        return out

    def beat(self, sec):
        sec = np.asarray(sec, dtype=float)
        if self.beats is None:
            return sec * self.bpm / 60.0
        b, s = self.beats, self.secs
        out = np.interp(sec, s, b)
        lo = (b[1] - b[0]) / (s[1] - s[0])
        hi = (b[-1] - b[-2]) / (s[-1] - s[-2])
        out = np.where(sec < s[0], b[0] + (sec - s[0]) * lo, out)
        out = np.where(sec > s[-1], b[-1] + (sec - s[-1]) * hi, out)
        return out


def end_beat(project: dict) -> float:
    e = 0.0
    for t in project["tracks"]:
        for n in t["notes"]:
            e = max(e, n["s"] + n["d"])
    return e


def duration_seconds(project: dict) -> float:
    return float(Tempo(project).sec(end_beat(project)))


# ---------------------------------------------------------------- analysis

_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def pc_histogram(notes, start=None, end=None) -> np.ndarray:
    h = np.zeros(12)
    for n in notes:
        s, e = n["s"], n["s"] + n["d"]
        if start is not None:
            s, e = max(s, start), min(e, end)
            if e <= s:
                continue
        h[n["p"] % 12] += (e - s) * (n["v"] / 127.0 + 0.3)
    return h


def detect_key(notes) -> dict:
    h = pc_histogram(notes)
    if h.sum() == 0:
        return {"tonic": "C", "mode": "major"}
    best = None
    for tonic in range(12):
        for mode, prof in (("major", _KS_MAJOR), ("minor", _KS_MINOR)):
            r = np.corrcoef(h, np.roll(prof, tonic))[0, 1]
            if best is None or r > best[0]:
                best = (r, tonic, mode)
    return {"tonic": NOTE_NAMES[best[1]], "mode": best[2]}


_CHORD_TEMPLATES = {"": [0, 4, 7], "m": [0, 3, 7], "dim": [0, 3, 6], "7": [0, 4, 7, 10],
                    "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "sus4": [0, 5, 7]}


def detect_chords(project: dict, step: float | None = None) -> list:
    """Template-match chords per half bar from the note content of all tracks."""
    notes = [n for t in project["tracks"] for n in t["notes"]]
    if not notes:
        return []
    bar = project["timeSig"][0] * 4 / project["timeSig"][1]
    step = step or bar / 2
    end = end_beat(project)
    out = []
    t = 0.0
    while t < end:
        h = pc_histogram(notes, t, t + step)
        if h.sum() > 0:
            h = h / h.sum()
            best, bname = -1.0, None
            for root in range(12):
                for q, iv in _CHORD_TEMPLATES.items():
                    tpl = np.zeros(12)
                    tpl[[(root + i) % 12 for i in iv]] = 1
                    score = float(h @ tpl) - 0.15 * len(iv) / 3 * (1 - float(h @ tpl))
                    if q in ("7", "maj7", "m7"):
                        score -= 0.04
                    if score > best:
                        best, bname = score, NOTE_NAMES[root] + q
            if out and out[-1]["name"] == bname and abs(out[-1]["start"] + out[-1]["dur"] - t) < 1e-6:
                out[-1]["dur"] += step
            else:
                out.append({"start": round(t, 4), "dur": step, "name": bname})
        t += step
    return out


def scale_pcs(key: dict) -> list[int]:
    tonic = NAME_TO_PC[key["tonic"]]
    return [(tonic + i) % 12 for i in MODES.get(key["mode"], MODES["major"])]


def snap_to_scale(p: int, pcs: list[int], prefer: int = 0) -> int:
    if p % 12 in pcs:
        return p
    for d in (1, -1, 2, -2):
        dd = d if prefer >= 0 else -d
        if (p + dd) % 12 in pcs:
            return p + dd
    return p


def track_summary(t: dict) -> dict:
    ns = t["notes"]
    if not ns:
        return {"id": t["id"], "name": t["name"], "instrument": GM[t["program"]], "notes": 0}
    ps = [n["p"] for n in ns]
    return {
        "id": t["id"], "name": t["name"], "instrument": GM[t["program"]], "notes": len(ns),
        "range": f"{pitch_name(min(ps))}-{pitch_name(max(ps))} ({max(ps) - min(ps)} semitones)",
        "span_beats": [round(min(n['s'] for n in ns), 2), round(max(n['s'] + n['d'] for n in ns), 2)],
        "muted": t.get("mute", False),
    }


def new_track(name: str, program: int, index: int, notes=None) -> dict:
    return {"id": new_id("t"), "name": name, "program": program, "color": TRACK_COLORS[index % len(TRACK_COLORS)],
            "volume": 0.8, "pan": 0.0, "mute": False, "solo": False, "notes": notes or []}


def new_project(name: str = "Untitled") -> dict:
    return {"id": new_id("p"), "name": name, "bpm": 120.0, "timeSig": [4, 4],
            "key": {"tonic": "C", "mode": "major"}, "tempoMap": None, "targetSeconds": None,
            "reference": None, "sections": [], "chords": [], "tracks": []}


def finalize(project: dict) -> dict:
    """Sort notes, round values, recompute chords."""
    for t in project["tracks"]:
        for n in t["notes"]:
            n["p"] = int(max(0, min(127, round(n["p"]))))
            n["s"] = round(max(0.0, float(n["s"])), 4)
            n["d"] = round(max(0.03, float(n["d"])), 4)
            n["v"] = int(max(1, min(127, round(n.get("v", 90)))))
            n.setdefault("id", new_id())
        t["notes"].sort(key=lambda n: (n["s"], n["p"]))
    project["chords"] = detect_chords(project)
    return project


def split_voices(notes: list[dict], voices: list[tuple]) -> list[list[dict]]:
    """Assign polyphonic notes to N voices (high→low) by tracking each voice's running pitch.

    voices: list of (name, program, low, high), ordered high to low.
    """
    k = len(voices)
    if k == 1 or not notes:
        return [notes] + [[] for _ in range(k - 1)]
    ps = np.array([n["p"] for n in notes])
    qs = np.percentile(ps, np.linspace(100 - 100 / (2 * k), 100 / (2 * k), k))
    means = [float(q) for q in qs]
    busy_until = [-1.0] * k
    out = [[] for _ in range(k)]
    # process chords (same onset) together so ordering high→low is preserved
    notes = sorted(notes, key=lambda n: (round(n["s"] / 0.06), -n["p"]))
    i = 0
    while i < len(notes):
        j = i
        while j < len(notes) and round(notes[j]["s"] / 0.06) == round(notes[i]["s"] / 0.06):
            j += 1
        group = sorted(notes[i:j], key=lambda n: -n["p"])
        used = set()
        for n in group:
            best, bv = None, 0
            for v in range(k):
                if v in used:
                    continue
                cost = abs(n["p"] - means[v])
                if busy_until[v] > n["s"] + 0.02:
                    cost += 7
                lo, hi = voices[v][2], voices[v][3]
                if n["p"] < lo:
                    cost += (lo - n["p"]) * 0.8
                if n["p"] > hi:
                    cost += (n["p"] - hi) * 0.8
                if best is None or cost < best:
                    best, bv = cost, v
            used.add(bv)
            out[bv].append(n)
            means[bv] = 0.8 * means[bv] + 0.2 * n["p"]
            busy_until[bv] = max(busy_until[bv], n["s"] + n["d"])
        i = j
    return out


def rnd(x: float, q: float = 1e-4) -> float:
    return round(x / q) * q if q else x


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def is_finite(x) -> bool:
    try:
        return math.isfinite(float(x))
    except (TypeError, ValueError):
        return False
