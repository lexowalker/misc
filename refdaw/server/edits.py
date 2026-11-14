"""Deterministic note-editing operations.

Each op takes (project, **args), mutates the project in place and returns a short
human-readable description. The same registry backs the UI buttons (/api/edit) and the
agent's tools, so the agent's edits are exact and reproducible.
"""
from __future__ import annotations

import random

import numpy as np

from . import core
from .core import Tempo

OPS: dict[str, dict] = {}


def op(name: str, description: str, properties: dict, required: list[str] | None = None):
    def deco(fn):
        OPS[name] = {"fn": fn, "description": description,
                     "schema": {"type": "object", "properties": properties, "required": required or []}}
        return fn
    return deco


# ---------------------------------------------------------------- helpers

TRACKS = {"type": "array", "items": {"type": "string"},
          "description": "Track ids. Omit to apply to all tracks."}
START = {"type": "number", "description": "Region start in beats (inclusive). Omit for the start of the song."}
END = {"type": "number", "description": "Region end in beats (exclusive). Omit for the end of the song."}
TRACK = {"type": "string", "description": "Track id"}


def _tracks(project, track_ids=None):
    if not track_ids:
        return project["tracks"]
    ids = set(track_ids)
    found = [t for t in project["tracks"] if t["id"] in ids or t["name"] in ids]
    if not found:
        raise ValueError(f"No tracks match {track_ids}")
    return found


def _track(project, track_id):
    return _tracks(project, [track_id])[0]


def _in(n, start, end):
    return (start is None or n["s"] >= start - 1e-6) and (end is None or n["s"] < end - 1e-6)


def _region(t, start, end):
    return [n for n in t["notes"] if _in(n, start, end)]


def _where(start, end):
    if start is None and end is None:
        return "whole song"
    return f"beats {start if start is not None else 0}–{end if end is not None else 'end'}"


# ---------------------------------------------------------------- pitch ops

@op("transpose", "Shift notes by a number of semitones (chromatic).",
    {"semitones": {"type": "integer"}, "track_ids": TRACKS, "start_beat": START, "end_beat": END},
    ["semitones"])
def transpose(project, semitones, track_ids=None, start_beat=None, end_beat=None):
    c = 0
    for t in _tracks(project, track_ids):
        for n in _region(t, start_beat, end_beat):
            n["p"] = core.clamp(n["p"] + int(semitones), 0, 127)
            c += 1
    if not track_ids and start_beat is None and end_beat is None:
        k = project["key"]
        k["tonic"] = core.NOTE_NAMES[(core.NAME_TO_PC[k["tonic"]] + int(semitones)) % 12]
    return f"Transposed {c} notes by {semitones:+d} semitones ({_where(start_beat, end_beat)})"


@op("change_key", "Move the music to a new key and/or mode (e.g. C minor → E major). Diatonic notes map scale "
    "degree to scale degree; the tonic moves by the smallest interval unless `direction` is given.",
    {"tonic": {"type": "string", "description": "e.g. 'E', 'F#', 'Bb'"},
     "mode": {"type": "string", "enum": list(core.MODES)},
     "direction": {"type": "string", "enum": ["nearest", "up", "down"]},
     "track_ids": TRACKS},
    ["tonic"])
def change_key(project, tonic, mode=None, direction="nearest", track_ids=None):
    old = project["key"]
    mode = mode or old["mode"]
    old_t, new_t = core.NAME_TO_PC[old["tonic"]], core.NAME_TO_PC[tonic]
    shift = (new_t - old_t) % 12
    if direction == "down" or (direction == "nearest" and shift > 6):
        shift -= 12
    old_sc, new_sc = core.MODES[old["mode"]], core.MODES[mode]
    for t in _tracks(project, track_ids):
        for n in t["notes"]:
            rel = (n["p"] - old_t) % 12
            base = n["p"] - rel
            if rel in old_sc:
                newrel = new_sc[old_sc.index(rel)]
            else:  # chromatic note: keep its offset from the scale degree below
                below = max(d for d in old_sc if d < rel) if rel > 0 else 0
                newrel = new_sc[old_sc.index(below)] + (rel - below)
            n["p"] = core.clamp(base + newrel + shift, 0, 127)
    project["key"] = {"tonic": core.NOTE_NAMES[new_t], "mode": mode}
    return f"Changed key {old['tonic']} {old['mode']} → {core.NOTE_NAMES[new_t]} {mode} ({shift:+d} semitones)"


@op("limit_range", "Narrow a track's melodic range to at most `max_semitones` (e.g. 12 = one octave). "
    "'compress' scales intervals around the centre and snaps to the key (keeps contour, flatter); "
    "'fold' moves out-of-range notes by octaves (keeps exact pitch classes).",
    {"track_id": TRACK, "max_semitones": {"type": "integer", "minimum": 1},
     "method": {"type": "string", "enum": ["compress", "fold"]},
     "center": {"type": "string", "description": "Optional centre pitch like 'G4' (default: median)."},
     "start_beat": START, "end_beat": END},
    ["track_id", "max_semitones"])
def limit_range(project, track_id, max_semitones, method="compress", center=None, start_beat=None, end_beat=None):
    t = _track(project, track_id)
    ns = _region(t, start_beat, end_beat)
    if not ns:
        return "No notes in range"
    ps = np.array([n["p"] for n in ns])
    before = int(ps.max() - ps.min())
    c = core.parse_pitch(center) if center else float(np.median(ps))
    lo, hi = c - max_semitones / 2, c + max_semitones / 2
    pcs = core.scale_pcs(project["key"])
    if method == "fold":
        for n in ns:
            while n["p"] > hi and n["p"] - 12 >= lo - 0.01:
                n["p"] -= 12
            while n["p"] < lo and n["p"] + 12 <= hi + 0.01:
                n["p"] += 12
            n["p"] = int(core.clamp(n["p"], np.floor(lo), np.ceil(hi)))
    else:
        cur_lo, cur_hi = float(ps.min()), float(ps.max())
        span = max(cur_hi - cur_lo, 1)
        f = min(1.0, max_semitones / span)
        mid = (cur_hi + cur_lo) / 2
        ilo, ihi = int(np.ceil(lo)), int(np.floor(hi))
        for n in ns:
            q = c + (n["p"] - mid) * f
            p = int(round(core.clamp(q, ilo, ihi)))
            # snap to the key, but never outside the window
            sp = core.snap_to_scale(p, pcs, prefer=-1 if p >= c else 1)
            n["p"] = sp if ilo <= sp <= ihi else p
    after = max(n["p"] for n in ns) - min(n["p"] for n in ns)
    return f"{t['name']}: range {before} → {after} semitones ({method}, {_where(start_beat, end_beat)})"


@op("octave", "Move notes up or down by whole octaves.",
    {"octaves": {"type": "integer"}, "track_ids": TRACKS, "start_beat": START, "end_beat": END}, ["octaves"])
def octave(project, octaves, track_ids=None, start_beat=None, end_beat=None):
    return transpose(project, 12 * int(octaves), track_ids or [t["id"] for t in project["tracks"]], start_beat, end_beat)


@op("invert", "Melodic inversion around an axis pitch, snapped to the key (classic fugue/variation device).",
    {"track_id": TRACK, "axis": {"type": "string", "description": "Axis pitch, e.g. 'C5'. Default: first note."},
     "start_beat": START, "end_beat": END}, ["track_id"])
def invert(project, track_id, axis=None, start_beat=None, end_beat=None):
    t = _track(project, track_id)
    ns = _region(t, start_beat, end_beat)
    if not ns:
        return "No notes"
    ax = core.parse_pitch(axis) if axis else ns[0]["p"]
    pcs = core.scale_pcs(project["key"])
    for n in ns:
        n["p"] = core.snap_to_scale(int(core.clamp(2 * ax - n["p"], 0, 127)), pcs)
    return f"Inverted {len(ns)} notes of {t['name']} around {core.pitch_name(ax)}"


@op("retrograde", "Reverse the order of notes in a region (rhythm reversed too).",
    {"track_id": TRACK, "start_beat": START, "end_beat": END}, ["track_id", "start_beat", "end_beat"])
def retrograde(project, track_id, start_beat, end_beat):
    t = _track(project, track_id)
    for n in _region(t, start_beat, end_beat):
        n["s"] = start_beat + (end_beat - (n["s"] + n["d"]))
    return f"Reversed {t['name']} {_where(start_beat, end_beat)}"


# ---------------------------------------------------------------- time ops

@op("quantize", "Snap note starts (and optionally lengths) to a grid in beats (0.25 = sixteenth, 0.5 = eighth).",
    {"grid": {"type": "number"}, "strength": {"type": "number", "minimum": 0, "maximum": 1},
     "lengths": {"type": "boolean"}, "track_ids": TRACKS, "start_beat": START, "end_beat": END}, ["grid"])
def quantize(project, grid, strength=1.0, lengths=True, track_ids=None, start_beat=None, end_beat=None):
    c = 0
    for t in _tracks(project, track_ids):
        for n in _region(t, start_beat, end_beat):
            q = round(n["s"] / grid) * grid
            n["s"] += (q - n["s"]) * strength
            if lengths:
                qd = max(grid, round(n["d"] / grid) * grid)
                n["d"] += (qd - n["d"]) * strength
            c += 1
    return f"Quantized {c} notes to {grid} beats"


@op("humanize", "Add small random timing and velocity variation.",
    {"timing": {"type": "number", "description": "Max shift in beats, e.g. 0.02"},
     "velocity": {"type": "integer", "description": "Max velocity change, e.g. 8"},
     "track_ids": TRACKS, "seed": {"type": "integer"}})
def humanize(project, timing=0.02, velocity=8, track_ids=None, seed=None):
    rng = random.Random(seed)
    for t in _tracks(project, track_ids):
        for n in t["notes"]:
            n["s"] = max(0, n["s"] + rng.uniform(-timing, timing))
            n["v"] = core.clamp(n["v"] + rng.randint(-velocity, velocity), 1, 127)
    return "Humanized timing and dynamics"


@op("set_tempo", "Set the tempo in BPM. If the project follows a reference recording's tempo map, the map is "
    "scaled so the feel is kept but the whole piece speeds up/slows down.",
    {"bpm": {"type": "number"}}, ["bpm"])
def set_tempo(project, bpm):
    old = project["bpm"]
    f = old / float(bpm)
    if project.get("tempoMap"):
        project["tempoMap"] = [[b, round(s * f, 4)] for b, s in project["tempoMap"]]
        if project.get("reference"):
            project["reference"]["synced"] = abs(f - 1) < 1e-6
    project["bpm"] = round(float(bpm), 3)
    return f"Tempo {old:g} → {float(bpm):g} BPM"


@op("steady_tempo", "Drop the reference recording's tempo map and play at one steady tempo (default: the current "
    "average BPM).", {"bpm": {"type": "number"}})
def steady_tempo(project, bpm=None):
    bpm = float(bpm or project["bpm"])
    project["tempoMap"] = None
    project["bpm"] = round(bpm, 3)
    if project.get("reference"):
        project["reference"]["synced"] = False
    return f"Steady tempo at {bpm:g} BPM"


@op("fit_duration", "Change the tempo so the piece lasts exactly `seconds` (e.g. 167 for 2:47).",
    {"seconds": {"type": "number"}}, ["seconds"])
def fit_duration(project, seconds):
    cur = core.duration_seconds(project)
    if cur <= 0:
        return "Nothing to fit"
    tc = Tempo(project)
    start_sec = float(tc.sec(0))
    playing = cur - start_sec
    target_playing = float(seconds) - start_sec
    f = playing / target_playing
    set_tempo(project, project["bpm"] * f)
    project["targetSeconds"] = float(seconds)
    return f"Fitted to {int(seconds) // 60}:{int(round(seconds)) % 60:02d} (tempo now {project['bpm']:.1f} BPM)"


@op("stretch_region", "Time-stretch a region by a factor (2 = half speed / augmentation, 0.5 = diminution); "
    "later notes shift accordingly.",
    {"factor": {"type": "number"}, "start_beat": START, "end_beat": END, "track_ids": TRACKS},
    ["factor", "start_beat", "end_beat"])
def stretch_region(project, factor, start_beat, end_beat, track_ids=None):
    delta = (end_beat - start_beat) * (factor - 1)
    for t in _tracks(project, track_ids):
        for n in t["notes"]:
            if _in(n, start_beat, end_beat):
                n["s"] = start_beat + (n["s"] - start_beat) * factor
                n["d"] *= factor
            elif n["s"] >= end_beat:
                n["s"] += delta
    return f"Stretched {_where(start_beat, end_beat)} by ×{factor}"


@op("copy_region", "Copy notes from one region to another position (e.g. repeat a phrase). mode 'replace' clears "
    "the destination first; 'merge' layers on top.",
    {"start_beat": START, "end_beat": END, "dest_beat": {"type": "number"},
     "mode": {"type": "string", "enum": ["replace", "merge"]}, "track_ids": TRACKS,
     "dest_track_id": {"type": "string", "description": "Copy into this track instead (single source track)."}},
    ["start_beat", "end_beat", "dest_beat"])
def copy_region(project, start_beat, end_beat, dest_beat, mode="replace", track_ids=None, dest_track_id=None):
    L = end_beat - start_beat
    c = 0
    for t in _tracks(project, track_ids):
        src = [dict(n) for n in _region(t, start_beat, end_beat)]
        dst = _track(project, dest_track_id) if dest_track_id else t
        if mode == "replace":
            dst["notes"] = [n for n in dst["notes"] if not _in(n, dest_beat, dest_beat + L)]
        for n in src:
            n["id"] = core.new_id()
            n["s"] = n["s"] - start_beat + dest_beat
            dst["notes"].append(n)
            c += 1
    return f"Copied {c} notes from {_where(start_beat, end_beat)} to beat {dest_beat}"


@op("delete_region", "Remove a span of time entirely and pull later notes earlier (shortens the piece).",
    {"start_beat": START, "end_beat": END}, ["start_beat", "end_beat"])
def delete_region(project, start_beat, end_beat):
    L = end_beat - start_beat
    for t in project["tracks"]:
        keep = []
        for n in t["notes"]:
            if _in(n, start_beat, end_beat):
                continue
            if n["s"] >= end_beat:
                n["s"] -= L
            keep.append(n)
        t["notes"] = keep
    for s in project.get("sections", []):
        for k in ("start", "end"):
            if s[k] >= end_beat:
                s[k] -= L
            elif s[k] > start_beat:
                s[k] = start_beat
    project["sections"] = [s for s in project.get("sections", []) if s["end"] > s["start"]]
    if project.get("reference"):
        project["reference"]["synced"] = False
    return f"Deleted {_where(start_beat, end_beat)} ({L:g} beats)"


# ---------------------------------------------------------------- note content

NOTE_ITEMS = {"type": "array", "items": {"type": "object", "properties": {
    "pitch": {"type": ["integer", "string"], "description": "MIDI number or name like 'Eb4'"},
    "start": {"type": "number", "description": "Absolute start in beats"},
    "duration": {"type": "number", "description": "Length in beats"},
    "velocity": {"type": "integer", "description": "1-127, default 90"}},
    "required": ["pitch", "start", "duration"]}}


def _mk(n):
    return {"id": core.new_id(), "p": core.parse_pitch(n["pitch"]), "s": float(n["start"]),
            "d": float(n["duration"]), "v": int(n.get("velocity", 90))}


@op("replace_notes", "Replace all notes of a track inside [start_beat, end_beat) with the given notes. Use this to "
    "write new melodies, variations, counterpoint or rewritten passages.",
    {"track_id": TRACK, "start_beat": START, "end_beat": END, "notes": NOTE_ITEMS},
    ["track_id", "start_beat", "end_beat", "notes"])
def replace_notes(project, track_id, start_beat, end_beat, notes):
    t = _track(project, track_id)
    removed = len(_region(t, start_beat, end_beat))
    t["notes"] = [n for n in t["notes"] if not _in(n, start_beat, end_beat)] + [_mk(n) for n in notes]
    return f"{t['name']}: replaced {removed} notes with {len(notes)} ({_where(start_beat, end_beat)})"


@op("add_notes", "Add notes to a track without removing anything.",
    {"track_id": TRACK, "notes": NOTE_ITEMS}, ["track_id", "notes"])
def add_notes(project, track_id, notes):
    t = _track(project, track_id)
    t["notes"] += [_mk(n) for n in notes]
    return f"{t['name']}: added {len(notes)} notes"


@op("delete_notes", "Delete notes in a region, optionally only within a pitch range.",
    {"track_ids": TRACKS, "start_beat": START, "end_beat": END,
     "pitch_min": {"type": ["integer", "string"]}, "pitch_max": {"type": ["integer", "string"]}})
def delete_notes(project, track_ids=None, start_beat=None, end_beat=None, pitch_min=None, pitch_max=None):
    lo = core.parse_pitch(pitch_min) if pitch_min is not None else 0
    hi = core.parse_pitch(pitch_max) if pitch_max is not None else 127
    c = 0
    for t in _tracks(project, track_ids):
        before = len(t["notes"])
        t["notes"] = [n for n in t["notes"] if not (_in(n, start_beat, end_beat) and lo <= n["p"] <= hi)]
        c += before - len(t["notes"])
    return f"Deleted {c} notes"


@op("vary", "Make subtle, musical variations: neighbour-tone substitutions, octave displacements, splitting notes "
    "into repeated pairs, or dropping weak-beat notes; all in key. `amount` 0.05–0.3 is subtle.",
    {"track_id": TRACK, "amount": {"type": "number", "minimum": 0, "maximum": 1},
     "kinds": {"type": "array", "items": {"type": "string", "enum": ["neighbor", "octave", "split", "omit", "rhythm"]}},
     "start_beat": START, "end_beat": END, "seed": {"type": "integer"}},
    ["track_id"])
def vary(project, track_id, amount=0.15, kinds=None, start_beat=None, end_beat=None, seed=None):
    rng = random.Random(seed)
    kinds = kinds or ["neighbor", "split", "rhythm", "omit"]
    pcs = core.scale_pcs(project["key"])
    t = _track(project, track_id)
    ns = _region(t, start_beat, end_beat)
    changed, add, drop = 0, [], set()
    for n in ns:
        if rng.random() > amount:
            continue
        k = rng.choice(kinds)
        if k == "neighbor":
            step = rng.choice([-2, -1, 1, 2])
            n["p"] = core.snap_to_scale(n["p"] + step, pcs, prefer=step)
        elif k == "octave":
            n["p"] += rng.choice([-12, 12])
        elif k == "split" and n["d"] >= 0.5:
            half = n["d"] / 2
            n["d"] = half
            add.append({"id": core.new_id(), "p": n["p"], "s": n["s"] + half, "d": half, "v": max(1, n["v"] - 10)})
        elif k == "rhythm" and n["d"] >= 0.5:
            sh = rng.choice([-0.25, 0.25]) * min(1, n["d"])
            n["s"] = max(0, n["s"] + sh)
        elif k == "omit" and (n["s"] % 1) > 0.01:
            drop.add(n["id"])
        else:
            continue
        changed += 1
    t["notes"] = [n for n in t["notes"] if n["id"] not in drop] + add
    return f"{t['name']}: varied {changed} of {len(ns)} notes ({', '.join(kinds)})"


@op("scale_velocity", "Scale dynamics (velocity) by a factor, or set a crescendo/decrescendo across the region.",
    {"factor": {"type": "number"}, "end_factor": {"type": "number", "description": "If given, ramps factor→end_factor"},
     "track_ids": TRACKS, "start_beat": START, "end_beat": END})
def scale_velocity(project, factor=1.0, end_factor=None, track_ids=None, start_beat=None, end_beat=None):
    s0 = start_beat or 0
    s1 = end_beat or core.end_beat(project)
    for t in _tracks(project, track_ids):
        for n in _region(t, start_beat, end_beat):
            f = factor if end_factor is None else factor + (end_factor - factor) * (n["s"] - s0) / max(1e-6, s1 - s0)
            n["v"] = core.clamp(int(n["v"] * f), 1, 127)
    return "Adjusted dynamics"


# ---------------------------------------------------------------- tracks

@op("set_track", "Change a track's name, instrument (General MIDI name or program number), volume (0-1), pan (-1..1), "
    "mute or solo.",
    {"track_id": TRACK, "name": {"type": "string"}, "instrument": {"type": ["string", "integer"]},
     "volume": {"type": "number"}, "pan": {"type": "number"}, "mute": {"type": "boolean"}, "solo": {"type": "boolean"}},
    ["track_id"])
def set_track(project, track_id, name=None, instrument=None, volume=None, pan=None, mute=None, solo=None):
    t = _track(project, track_id)
    if name is not None:
        t["name"] = name
    if instrument is not None:
        t["program"] = core.program_from_name(instrument, t["program"])
    for k, v in (("volume", volume), ("pan", pan), ("mute", mute), ("solo", solo)):
        if v is not None:
            t[k] = v
    return f"Updated track {t['name']} ({core.GM[t['program']]})"


@op("add_track", "Create a new empty track. Returns its id.",
    {"name": {"type": "string"}, "instrument": {"type": ["string", "integer"]}}, ["name"])
def add_track(project, name, instrument=None):
    t = core.new_track(name, core.program_from_name(instrument, 0), len(project["tracks"]))
    project["tracks"].append(t)
    return f"Added track '{name}' with id {t['id']}"


@op("duplicate_track", "Copy a track (e.g. to double a melody on another instrument), optionally transposed.",
    {"track_id": TRACK, "name": {"type": "string"}, "instrument": {"type": ["string", "integer"]},
     "semitones": {"type": "integer"}}, ["track_id"])
def duplicate_track(project, track_id, name=None, instrument=None, semitones=0):
    src = _track(project, track_id)
    t = core.new_track(name or src["name"] + " copy", core.program_from_name(instrument, src["program"]),
                       len(project["tracks"]))
    t["notes"] = [{**n, "id": core.new_id(), "p": core.clamp(n["p"] + semitones, 0, 127)} for n in src["notes"]]
    project["tracks"].append(t)
    return f"Duplicated {src['name']} → {t['name']} (id {t['id']})"


@op("delete_track", "Remove a track.", {"track_id": TRACK}, ["track_id"])
def delete_track(project, track_id):
    t = _track(project, track_id)
    project["tracks"] = [x for x in project["tracks"] if x is not t]
    return f"Deleted track {t['name']}"


@op("merge_tracks", "Merge several tracks into the first one.",
    {"track_ids": {"type": "array", "items": {"type": "string"}}}, ["track_ids"])
def merge_tracks(project, track_ids):
    ts = _tracks(project, track_ids)
    for t in ts[1:]:
        ts[0]["notes"] += t["notes"]
    project["tracks"] = [x for x in project["tracks"] if x not in ts[1:]]
    return f"Merged {len(ts)} tracks into {ts[0]['name']}"


@op("set_sections", "Rename or redefine the song sections (beats).",
    {"sections": {"type": "array", "items": {"type": "object", "properties": {
        "name": {"type": "string"}, "start": {"type": "number"}, "end": {"type": "number"}},
        "required": ["name", "start", "end"]}}}, ["sections"])
def set_sections(project, sections):
    project["sections"] = sorted(sections, key=lambda s: s["start"])
    return f"Set {len(sections)} sections"


def apply(project: dict, name: str, args: dict) -> str:
    if name not in OPS:
        raise ValueError(f"Unknown operation {name}")
    args = {k: v for k, v in (args or {}).items() if v is not None}
    msg = OPS[name]["fn"](project, **args)
    core.finalize(project)
    return msg
