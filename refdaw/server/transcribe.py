"""Audio → editable multi-track project.

Pipeline:
  1. (optional) stem separation with Demucs when it is installed and asked for
  2. polyphonic note transcription with Spotify Basic Pitch (ONNX runtime, no TensorFlow)
  3. beat tracking → tempo map, so beats line up with the live recording
  4. split notes into instrument voices (ensemble preset)
  5. key, chords and section detection
"""
from __future__ import annotations

import logging
import pathlib
import warnings

import numpy as np

from . import core

log = logging.getLogger("refdaw.transcribe")
warnings.filterwarnings("ignore")

SR = 22050


def _basic_pitch_model():
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import Model

    base = pathlib.Path(ICASSP_2022_MODEL_PATH)
    base = base if base.is_dir() else base.parent
    for cand in ("nmp.onnx", "nmp.mlpackage", "nmp.tflite", "nmp"):
        p = base / cand
        if p.exists():
            try:
                return Model(p)
            except Exception as e:  # backend for this format not installed
                log.info("basic-pitch model %s unavailable: %s", p, e)
    raise RuntimeError("No usable Basic Pitch model backend (install onnxruntime)")


_MODEL = None


def transcribe_notes(path: str, sensitivity: float = 0.5, min_note_ms: float = 90.0,
                     fmin: float | None = None, fmax: float | None = None) -> list[dict]:
    """Return notes in seconds: [{p, start, end, v}]"""
    global _MODEL
    from basic_pitch.inference import predict

    if _MODEL is None:
        _MODEL = _basic_pitch_model()
    onset = float(np.interp(sensitivity, [0, 1], [0.7, 0.3]))
    frame = float(np.interp(sensitivity, [0, 1], [0.45, 0.2]))
    _, _, events = predict(path, _MODEL, onset_threshold=onset, frame_threshold=frame,
                           minimum_note_length=min_note_ms, minimum_frequency=fmin,
                           maximum_frequency=fmax, melodia_trick=True)
    notes = []
    for start, end, pitch, amp, _bends in events:
        notes.append({"p": int(pitch), "start": float(start), "end": float(end),
                      "v": int(np.clip(30 + amp * 110, 20, 127))})
    notes.sort(key=lambda n: (n["start"], n["p"]))
    return _clean(notes)


def _clean(notes: list[dict]) -> list[dict]:
    """Drop ghost notes and merge immediately repeated fragments of the same pitch."""
    out: list[dict] = []
    last_by_pitch: dict[int, dict] = {}
    for n in notes:
        if n["end"] - n["start"] < 0.06 and n["v"] < 45:
            continue
        prev = last_by_pitch.get(n["p"])
        if prev and 0 <= n["start"] - prev["end"] < 0.025 and n["v"] < prev["v"] * 0.8:
            prev["end"] = max(prev["end"], n["end"])
            continue
        out.append(n)
        last_by_pitch[n["p"]] = n
    return out


def track_beats(y: np.ndarray, sr: int = SR) -> tuple[float, np.ndarray]:
    import librosa

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", start_bpm=100, tightness=200)
    tempo = float(np.atleast_1d(tempo)[0])
    beats = np.asarray(beats, dtype=float)
    # fold very fast pulses (e.g. running eighths) to a comfortable beat
    while tempo > 140 and len(beats) > 8:
        tempo /= 2
        beats = beats[::2]
    return tempo, beats


def tempo_map_from_beats(beats: np.ndarray, smooth: int = 5) -> list[list[float]]:
    if len(beats) < 4:
        return None
    ibi = np.diff(beats)
    if smooth > 1 and len(ibi) > smooth:
        from scipy.ndimage import median_filter

        ibi = median_filter(ibi, size=smooth, mode="nearest")
    secs = np.concatenate([[beats[0]], beats[0] + np.cumsum(ibi)])
    # number beats so that audio before the first detected beat still has room (beat 0 ≈ 0 s)
    k = int(np.floor(beats[0] / ibi[0] + 0.25))
    anchors = [[float(i + k), round(float(s), 4)] for i, s in enumerate(secs)]
    return anchors


def detect_sections(y: np.ndarray, sr: int, beats_sec: np.ndarray, beats_per_bar: int, n_sections: int = 5):
    """Rough structural segmentation snapped to bars. Returns boundaries in beat indices."""
    import librosa

    if len(beats_sec) < 16:
        return []
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
    frames = librosa.time_to_frames(beats_sec, sr=sr, hop_length=hop)
    feat = np.vstack([librosa.util.sync(chroma, frames), librosa.util.sync(mfcc, frames) / 50])
    # one feature column per bar
    nb = feat.shape[1] // beats_per_bar
    if nb < n_sections + 1:
        return []
    bars = feat[:, : nb * beats_per_bar].reshape(feat.shape[0], nb, beats_per_bar).mean(axis=2)
    bounds = librosa.segment.agglomerative(bars, n_sections)
    return sorted(set(int(b) * beats_per_bar for b in bounds))


def audio_to_project(path: str, project: dict, ensemble: str = "auto", sensitivity: float = 0.5,
                     n_sections: int = 4, separate: bool = False, progress=lambda msg, f: None) -> dict:
    import librosa

    filename = pathlib.Path(path).name
    if ensemble in (None, "", "auto"):
        ensemble = core.guess_ensemble(project.get("sourceName") or filename)
    voices = core.ENSEMBLES.get(ensemble, core.ENSEMBLES["generic"])

    progress("Loading audio", 0.05)
    y, sr = librosa.load(path, sr=SR, mono=True)

    progress("Tracking tempo & beats", 0.15)
    tempo, beats = track_beats(y, sr)
    tmap = tempo_map_from_beats(beats)
    project["bpm"] = round(tempo, 2)
    project["tempoMap"] = tmap
    tc = core.Tempo(project)

    stems = None
    if separate:
        progress("Separating stems (Demucs)", 0.2)
        stems = separate_stems(path)

    tracks = []
    if stems:
        for i, (stem_name, stem_path) in enumerate(stems.items()):
            if stem_name == "drums":
                continue
            progress(f"Transcribing {stem_name}", 0.3 + 0.5 * i / len(stems))
            raw = transcribe_notes(stem_path, sensitivity)
            notes = _to_beats(raw, tc)
            prog = {"bass": 33, "guitar": 25, "piano": 0, "vocals": 53, "other": 48}.get(stem_name, 0)
            if len(notes) > 0:
                tracks.append(core.new_track(stem_name.title(), prog, len(tracks), notes))
    else:
        progress("Transcribing notes (Basic Pitch)", 0.3)
        raw = transcribe_notes(path, sensitivity)
        notes = _to_beats(raw, tc)
        progress("Splitting into voices", 0.75)
        for i, (vnotes, (name, prog, _lo, _hi)) in enumerate(zip(core.split_voices(notes, voices), voices)):
            tracks.append(core.new_track(name, prog, i, vnotes))

    project["tracks"] = tracks
    allnotes = [n for t in tracks for n in t["notes"]]
    project["key"] = core.detect_key(allnotes)
    progress("Finding sections", 0.85)
    bpb = project["timeSig"][0]
    try:
        bounds = detect_sections(y, sr, beats, bpb, n_sections)
    except Exception as e:  # segmentation is a nicety
        log.warning("section detection failed: %s", e)
        bounds = []
    end = core.end_beat(project)
    edges = [0] + [b for b in bounds if 0 < b < end] + [int(np.ceil(end / bpb) * bpb)]
    project["sections"] = [{"name": f"Part {chr(65 + i)}", "start": float(a), "end": float(b)}
                           for i, (a, b) in enumerate(zip(edges[:-1], edges[1:])) if b > a]
    project["ensemble"] = ensemble
    core.finalize(project)
    progress("Done", 1.0)
    return project


def _to_beats(raw: list[dict], tc: core.Tempo) -> list[dict]:
    if not raw:
        return []
    s = tc.beat([n["start"] for n in raw])
    e = tc.beat([n["end"] for n in raw])
    return [{"id": core.new_id(), "p": n["p"], "s": float(max(0.0, a)), "d": float(max(0.05, b - a)), "v": n["v"]}
            for n, a, b in zip(raw, s, e)]


def separate_stems(path: str) -> dict | None:
    """Run Demucs htdemucs_6s if installed. Returns {stem: wav_path} or None."""
    try:
        import demucs.separate  # noqa: F401
    except ImportError:
        log.warning("demucs not installed; skipping separation")
        return None
    import subprocess
    import sys
    import tempfile

    out = pathlib.Path(tempfile.mkdtemp(prefix="refdaw_stems_"))
    subprocess.run([sys.executable, "-m", "demucs", "-n", "htdemucs_6s", "-o", str(out), path], check=True)
    stem_dir = next(out.glob("htdemucs_6s/*"))
    return {p.stem: str(p) for p in sorted(stem_dir.glob("*.wav"))}
