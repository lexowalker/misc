"""Hand-off to audio generation models.

Providers:
  - elevenlabs : Eleven Music (official API). Text/structure only: style prompt + sections + exact length.
  - fal_ace    : ACE-Step on fal.ai, audio-to-audio. Our rendered mix is the reference audio.
  - suno       : no official API; we prepare the reference WAV + a prompt to paste into Suno's
                 "Upload audio → Cover" flow.

The request/response shapes of third-party APIs change; the endpoint ids and the
extra arguments are configurable from the Generate dialog (and REFDAW_* env vars).
"""
from __future__ import annotations

import json
import os
import pathlib
import time

import httpx

from . import core


def style_prompt(project: dict, style: str, instruments: str) -> str:
    dur = project.get("targetSeconds") or core.duration_seconds(project)
    inst = instruments or ", ".join(sorted({core.GM[t["program"]] for t in project["tracks"] if not t.get("mute")}))
    parts = [style.strip() if style else "",
             f"Instruments: {inst}." if inst else "",
             f"Key of {project['key']['tonic']} {project['key']['mode']}, about {project['bpm']:.0f} BPM.",
             f"Instrumental, {int(dur) // 60}:{int(round(dur)) % 60:02d} long."]
    return " ".join(p for p in parts if p)


def section_plan(project: dict, total_ms: int, style: str, instruments: str) -> dict:
    """Eleven Music composition plan whose section lengths follow our sections."""
    tc = core.Tempo(project)
    secs = project.get("sections") or [{"name": "Main", "start": 0, "end": core.end_beat(project)}]
    raw = [max(0.0, float(tc.sec(s["end"]) - tc.sec(s["start"]))) for s in secs]
    tot = sum(raw) or 1.0
    durs = [max(3000, int(total_ms * r / tot)) for r in raw]
    durs[-1] += total_ms - sum(durs)
    pos = [p.strip() for p in (style or "").split(",") if p.strip()]
    if instruments:
        pos += [i.strip() for i in instruments.split(",") if i.strip()]
    return {
        "positive_global_styles": pos or ["minimalist", "cinematic", "instrumental"],
        "negative_global_styles": ["vocals", "lyrics", "drums"] if "drum" not in (style or "").lower() else ["vocals"],
        "sections": [{"section_name": s["name"], "positive_local_styles": [], "negative_local_styles": [],
                      "duration_ms": d, "lines": []} for s, d in zip(secs, durs)],
    }


def elevenlabs(project: dict, out_dir: pathlib.Path, style: str, instruments: str, seconds: float,
               use_sections: bool = True, model_id: str | None = None, progress=lambda m, f: None) -> pathlib.Path:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set (add it to refdaw/.env)")
    total_ms = int(round(seconds * 1000))
    body: dict = {"model_id": model_id or os.environ.get("REFDAW_ELEVEN_MODEL", "music_v1")}
    if use_sections:
        body["composition_plan"] = section_plan(project, total_ms, style, instruments)
    else:
        body["prompt"] = style_prompt(project, style, instruments)
        body["music_length_ms"] = total_ms
        body["force_instrumental"] = True
    progress("Composing with Eleven Music", 0.2)
    r = httpx.post("https://api.elevenlabs.io/v1/music", headers={"xi-api-key": key}, json=body,
                   params={"output_format": "mp3_44100_192"}, timeout=600)
    if r.status_code >= 400:
        raise RuntimeError(f"ElevenLabs {r.status_code}: {r.text[:800]}")
    out = out_dir / f"gen_elevenlabs_{int(time.time())}.mp3"
    out.write_bytes(r.content)
    (out.with_suffix(".json")).write_text(json.dumps(body, indent=2))
    return out


ACOUSTIC = "Acoustic instruments only: no drums, no percussion, no synthesizers, no electronic sounds, no vocals."


def _fal_run(endpoint: str, args: dict, out_dir: pathlib.Path, tag: str, progress) -> pathlib.Path:
    import fal_client

    progress(f"Generating with {endpoint} (usually 30 s – 3 min)", 0.3)
    result = fal_client.subscribe(endpoint, arguments=args, with_logs=False)
    audio = result.get("audio") or (result.get("audios") or [None])[0] or result.get("audio_file")
    audio_url = audio["url"] if isinstance(audio, dict) else audio
    if not audio_url:
        raise RuntimeError(f"Unexpected fal response: {json.dumps(result)[:800]}")
    progress("Downloading result", 0.9)
    data = httpx.get(audio_url, timeout=300, follow_redirects=True).content
    ext = pathlib.Path(audio_url.split("?")[0]).suffix or ".wav"
    out = out_dir / f"gen_{tag}_{int(time.time())}{ext}"
    out.write_bytes(data)
    (out.with_suffix(".json")).write_text(json.dumps({"endpoint": endpoint, "seed": result.get("seed"),
                                                      "args": {**args, "audio_url": "<your rendered mix>"}}, indent=2))
    return out


def _fal_upload(ref_wav: pathlib.Path, progress) -> str:
    if not os.environ.get("FAL_KEY"):
        raise RuntimeError("FAL_KEY is not set (add it to refdaw/.env and restart)")
    import fal_client

    progress("Uploading your mix to fal", 0.1)
    return fal_client.upload_file(str(ref_wav))


def fal_stable_audio(project: dict, out_dir: pathlib.Path, ref_wav: pathlib.Path, style: str, instruments: str,
                     seconds: float, strength: float = 0.45, acoustic: bool = True, extra: dict | None = None,
                     progress=lambda m, f: None) -> pathlib.Path:
    """Stable Audio 2.5 audio-to-audio: re-renders the reference with real-sounding instruments.

    `strength` is how far it may move from the reference: ~0.3 keeps notes and timing very close,
    ~0.6 lets it reinterpret more freely.
    """
    url = _fal_upload(ref_wav, progress)
    prompt = style_prompt(project, style, instruments) + (" " + ACOUSTIC if acoustic else "")
    args = {"prompt": prompt, "audio_url": url, "strength": float(max(0.05, min(1.0, strength))),
            "total_seconds": int(max(1, min(190, round(seconds))))}
    args.update(extra or {})
    return _fal_run("fal-ai/stable-audio-25/audio-to-audio", args, out_dir, f"stable{int(args['strength'] * 100)}", progress)


def fal_ace(project: dict, out_dir: pathlib.Path, ref_wav: pathlib.Path, style: str, instruments: str,
            seconds: float, endpoint: str | None = None, extra: dict | None = None, acoustic: bool = True,
            progress=lambda m, f: None) -> pathlib.Path:
    """ACE-Step audio-to-audio remix. Keeps the reference's length; restyles it with tags."""
    url = _fal_upload(ref_wav, progress)
    endpoint = endpoint or os.environ.get("REFDAW_FAL_ENDPOINT", "fal-ai/ace-step/audio-to-audio")
    tags = style_prompt(project, style, instruments) + (" " + ACOUSTIC if acoustic else "")
    inst = instruments or ", ".join(sorted({core.GM[t["program"]] for t in project["tracks"] if not t.get("mute")}))
    args = {"audio_url": url, "edit_mode": "remix", "tags": tags,
            "original_tags": f"{inst}, MIDI rendering, synthetic, instrumental",
            "lyrics": "[inst]", "original_lyrics": "[inst]"}
    args.update(extra or {})
    return _fal_run(endpoint, args, out_dir, "ace", progress)


def suno_brief(project: dict, style: str, instruments: str, seconds: float) -> str:
    return (
        "SUNO (no public API) — steps:\n"
        "1. In Suno, Create → Upload audio, and upload the reference WAV exported from RefDAW (mix.wav).\n"
        "2. Choose Cover (keeps melody/harmony) and set Instrumental.\n"
        f"3. Style prompt:\n   {style_prompt(project, style, instruments)}\n"
        f"4. Target length {int(seconds) // 60}:{int(round(seconds)) % 60:02d}: Suno doesn't take an exact length. "
        "Generate, then use Edit → Crop / Extend to land on the exact length, or trim in RefDAW's Fit tool beforehand "
        "so the reference is already the right length.\n"
    )
