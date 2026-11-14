"""Hummed / sung melody → notes (monophonic pitch tracking with pYIN)."""
from __future__ import annotations

import numpy as np

from . import core


def hum_to_notes(wav_path: str, project: dict, start_beat: float = 0.0, latency_ms: float = 0.0,
                 snap_key: bool = True, grid: float | None = 0.25, octave_shift: int = 0) -> list[dict]:
    import librosa

    sr = 16000
    y, _ = librosa.load(wav_path, sr=sr, mono=True)
    if len(y) < sr * 0.2:
        return []
    hop = 160  # 10 ms
    f0, voiced, prob = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C6"),
                                    sr=sr, frame_length=1024, hop_length=hop)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    n = min(len(f0), len(rms))
    f0, voiced, rms = f0[:n], voiced[:n], rms[:n]
    gate = max(0.01, np.percentile(rms, 30) * 1.5)
    midi = np.where(voiced & (rms > gate), librosa.hz_to_midi(np.nan_to_num(f0, nan=1.0)), np.nan)

    dt = hop / sr
    segs = []  # (start_sec, end_sec, pitch_float, loudness)
    cur = []
    i0 = 0
    for i, m in enumerate(midi):
        if np.isnan(m):
            if cur:
                segs.append((i0, i, cur))
                cur = []
            continue
        if cur and abs(m - np.median(cur[-5:])) > 0.8:
            # pitch jump: start a new note if the new pitch holds for 40 ms
            ahead = midi[i:i + 4]
            if np.all(~np.isnan(ahead)) and np.all(np.abs(ahead - m) < 0.8):
                segs.append((i0, i, cur))
                cur = []
        if not cur:
            i0 = i
        cur.append(m)
    if cur:
        segs.append((i0, len(midi), cur))

    tc = core.Tempo(project)
    t0 = float(tc.sec(start_beat)) - latency_ms / 1000.0
    pcs = core.scale_pcs(project["key"])
    out = []
    for a, b, vals in segs:
        if (b - a) * dt < 0.08:
            continue
        med = float(np.median(vals))
        p = int(round(med))
        if snap_key:
            p = core.snap_to_scale(p, pcs, prefer=1 if med > p else -1)
        p += 12 * octave_shift
        loud = float(np.mean(rms[a:b]))
        s = float(tc.beat(t0 + a * dt))
        e = float(tc.beat(t0 + b * dt))
        out.append({"p": p, "s": s, "d": max(0.06, e - s), "loud": loud})
    if not out:
        return []
    lmax = max(o["loud"] for o in out)
    notes = []
    for o in out:
        s, d = o["s"], o["d"]
        if grid:
            s2 = round(s / grid) * grid
            d = max(grid, round((s + d) / grid) * grid - s2)
            s = s2
        notes.append({"id": core.new_id(), "p": o["p"], "s": max(0.0, s), "d": d,
                      "v": int(55 + 60 * o["loud"] / lmax)})
    # remove overlaps created by quantizing
    notes.sort(key=lambda n: n["s"])
    dedup = []
    for nn in notes:
        if dedup and nn["s"] < dedup[-1]["s"] + 1e-6:
            continue
        if dedup and dedup[-1]["s"] + dedup[-1]["d"] > nn["s"]:
            dedup[-1]["d"] = nn["s"] - dedup[-1]["s"]
        dedup.append(nn)
    return dedup
