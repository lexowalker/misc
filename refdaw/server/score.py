"""Score (MusicXML / MXL / MIDI) import and alignment to a reference recording."""
from __future__ import annotations

import logging

import numpy as np

from . import core

log = logging.getLogger("refdaw.score")


def score_to_project(path: str, project: dict) -> dict:
    import music21 as m21

    s = m21.converter.parse(path)
    # Scores for transposing instruments (saxes, clarinets, horns...) are usually written at
    # written pitch; the DAW needs sounding pitch.
    try:
        s = s.toSoundingPitch()
    except Exception as e:
        log.info("toSoundingPitch failed (%s); using pitches as written", e)
    try:
        s = s.expandRepeats()
    except Exception as e:  # malformed repeat marks are common in community scores
        log.info("expandRepeats failed (%s); using written order", e)
    s = s.stripTies()

    ts = s.recurse().getElementsByClass(m21.meter.TimeSignature).first()
    if ts:
        project["timeSig"] = [ts.numerator, ts.denominator]
    mm = s.recurse().getElementsByClass(m21.tempo.MetronomeMark).first()
    if mm and mm.getQuarterBPM():
        project["bpm"] = round(float(mm.getQuarterBPM()), 2)

    tracks = []
    for part in s.parts:
        inst = part.getInstrument(returnDefault=True)
        name = part.partName or (inst.instrumentName if inst else None) or f"Part {len(tracks) + 1}"
        prog = inst.midiProgram if inst is not None and inst.midiProgram is not None else core.program_from_name(name, 0)
        if inst is not None and getattr(inst, "midiChannel", None) == 9:
            continue  # percussion
        notes = []
        for el in part.flatten().notes:
            vel = el.volume.velocity if el.volume and el.volume.velocity else 88
            pitches = el.pitches if el.isChord else [el.pitch]
            for p in pitches:
                if el.duration.quarterLength <= 0:
                    continue  # grace notes
                notes.append({"id": core.new_id(), "p": int(p.midi), "s": float(el.offset),
                              "d": float(el.duration.quarterLength), "v": int(vel)})
        # music21 offsets on flattened parts are absolute in quarter notes
        if notes:
            tracks.append(core.new_track(name, int(prog), len(tracks), notes))

    project["tracks"] = tracks
    allnotes = [n for t in tracks for n in t["notes"]]
    try:
        k = s.analyze("key")
        project["key"] = {"tonic": core.NOTE_NAMES[k.tonic.pitchClass], "mode": "minor" if k.mode == "minor" else "major"}
    except Exception:
        project["key"] = core.detect_key(allnotes)
    project["tempoMap"] = None
    project["sections"] = _rehearsal_sections(s, project)
    core.finalize(project)
    return project


def _rehearsal_sections(s, project) -> list:
    import music21 as m21

    marks = []
    for el in s.recurse().getElementsByClass((m21.expressions.RehearsalMark,)):
        marks.append((float(el.getOffsetInHierarchy(s)), el.content))
    end = core.end_beat(project)
    if not marks:
        return [{"name": "Whole piece", "start": 0.0, "end": float(np.ceil(end))}]
    marks.sort()
    if marks[0][0] > 0:
        marks.insert(0, (0.0, "Intro"))
    out = []
    seen: dict[str, int] = {}
    for i, (st, nm) in enumerate(marks):
        en = marks[i + 1][0] if i + 1 < len(marks) else end
        nm = str(nm)
        seen[nm] = seen.get(nm, 0) + 1
        label = nm if seen[nm] == 1 else f"{nm} (repeat {seen[nm] - 1})" if seen[nm] > 2 else f"{nm} (repeat)"
        out.append({"name": label, "start": st, "end": float(en)})
    return out


def align_to_audio(project: dict, audio_path: str) -> dict:
    """Dynamic-time-warp the score's chroma against the recording and store a tempo map.

    After this, beats keep the score's notes and rhythms while playback follows the
    recording's timing (rubato, tempo changes), so the reference can play in sync.
    """
    import librosa

    sr, hop = 22050, 1024
    y, _ = librosa.load(audio_path, sr=sr, mono=True)
    a_chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    frame_t = hop / sr

    # score chroma on a uniform beat grid
    end = core.end_beat(project)
    bpm = project["bpm"]
    score_frame_beats = frame_t * bpm / 60.0
    n_frames = int(np.ceil(end / score_frame_beats)) + 1
    s_chroma = np.zeros((12, n_frames))
    for t in project["tracks"]:
        for n in t["notes"]:
            a = int(n["s"] / score_frame_beats)
            b = max(a + 1, int((n["s"] + n["d"]) / score_frame_beats))
            s_chroma[n["p"] % 12, a:b] += n["v"] / 127.0
    s_chroma = librosa.util.normalize(s_chroma + 1e-6, norm=2, axis=0)
    a_chroma = librosa.util.normalize(a_chroma + 1e-6, norm=2, axis=0)

    _, wp = librosa.sequence.dtw(X=s_chroma, Y=a_chroma, metric="cosine", subseq=False,
                                 step_sizes_sigma=np.array([[1, 1], [1, 2], [2, 1]]),
                                 weights_add=np.array([0, 0, 0]), weights_mul=np.array([1, 1, 1]))
    wp = wp[::-1]
    s_beats = wp[:, 0] * score_frame_beats
    a_secs = wp[:, 1] * frame_t
    # one anchor per beat, monotone
    anchors = []
    last = -1.0
    for b in range(0, int(np.ceil(end)) + 1):
        idx = np.searchsorted(s_beats, b)
        idx = min(idx, len(a_secs) - 1)
        sec = float(a_secs[idx])
        if sec <= last:
            sec = last + 1e-3
        anchors.append([float(b), sec])
        last = sec
    # smooth with a running median on inter-beat intervals
    secs = np.array([a[1] for a in anchors])
    ibi = np.diff(secs)
    from scipy.ndimage import median_filter

    ibi = np.maximum(median_filter(ibi, size=5, mode="nearest"), 0.05)
    secs = np.concatenate([[secs[0]], secs[0] + np.cumsum(ibi)])
    project["tempoMap"] = [[a[0], round(float(s), 4)] for a, s in zip(anchors, secs)]
    span = secs[-1] - secs[0]
    if span > 0:
        project["bpm"] = round(60.0 * (len(secs) - 1) / span, 2)
    cost = float(np.mean([1 - float(s_chroma[:, i] @ a_chroma[:, j]) for i, j in wp[:: max(1, len(wp) // 400)]]))
    project.setdefault("reference", {})
    if project["reference"] is not None:
        project["reference"]["synced"] = True
        project["reference"]["alignCost"] = round(cost, 3)
    return project
