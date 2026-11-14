"""RefDAW local server: serves the web app and runs the audio/ML/agent work."""
from __future__ import annotations

import json
import logging
import os
import pathlib
import shutil
import threading
import time
import traceback
import uuid

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from . import core, edits

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
PROJECTS = pathlib.Path(os.environ.get("REFDAW_PROJECTS", ROOT / "projects"))
CACHE = ROOT / "cache"
PROJECTS.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)


def _load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("refdaw")
app = FastAPI(title="RefDAW")

# ---------------------------------------------------------------- storage


def pdir(pid: str) -> pathlib.Path:
    if not pid or "/" in pid or ".." in pid:
        raise HTTPException(400, "bad project id")
    d = PROJECTS / pid
    if not d.exists():
        raise HTTPException(404, "project not found")
    return d


def load(pid: str) -> dict:
    return json.loads((pdir(pid) / "project.json").read_text())


def save(project: dict) -> None:
    d = PROJECTS / project["id"]
    d.mkdir(parents=True, exist_ok=True)
    tmp = d / "project.json.tmp"
    tmp.write_text(json.dumps(project))
    tmp.replace(d / "project.json")


# ---------------------------------------------------------------- background jobs

JOBS: dict[str, dict] = {}


def start_job(fn, *args, **kwargs) -> str:
    jid = uuid.uuid4().hex[:10]
    job = {"id": jid, "status": "running", "message": "Starting", "progress": 0.0, "result": None, "error": None}
    JOBS[jid] = job

    def progress(msg, frac):
        job["message"], job["progress"] = msg, float(frac)

    def run():
        try:
            job["result"] = fn(*args, progress=progress, **kwargs)
            job["status"] = "done"
            job["progress"] = 1.0
        except Exception as e:
            log.error("job failed: %s", traceback.format_exc())
            job["status"], job["error"] = "error", str(e)

    threading.Thread(target=run, daemon=True).start()
    return jid


@app.get("/api/jobs/{jid}")
def job_status(jid: str):
    if jid not in JOBS:
        raise HTTPException(404)
    return JOBS[jid]


# ---------------------------------------------------------------- projects


@app.get("/api/config")
def config():
    def has(k):
        return bool(os.environ.get(k))
    try:
        import demucs  # noqa: F401
        demucs_ok = True
    except ImportError:
        demucs_ok = False
    return {"anthropic": has("ANTHROPIC_API_KEY") or has("ANTHROPIC_AUTH_TOKEN"), "elevenlabs": has("ELEVENLABS_API_KEY"),
            "fal": has("FAL_KEY"), "demucs": demucs_ok, "ensembles": list(core.ENSEMBLES), "gm": core.GM,
            "modes": list(core.MODES)}


@app.get("/api/projects")
def list_projects():
    out = []
    for d in sorted(PROJECTS.iterdir(), key=lambda p: -p.stat().st_mtime):
        f = d / "project.json"
        if f.exists():
            try:
                p = json.loads(f.read_text())
                out.append({"id": p["id"], "name": p["name"], "tracks": len(p["tracks"]),
                            "modified": f.stat().st_mtime})
            except Exception:
                pass
    return out


@app.post("/api/projects")
async def create_project(req: Request):
    body = await req.json() if req.headers.get("content-length") not in (None, "0") else {}
    p = core.new_project(body.get("name") or "Untitled")
    save(p)
    return p


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    return load(pid)


@app.put("/api/projects/{pid}")
async def put_project(pid: str, req: Request):
    p = await req.json()
    if p.get("id") != pid:
        raise HTTPException(400, "id mismatch")
    pdir(pid)
    save(p)
    return {"ok": True}


@app.delete("/api/projects/{pid}")
def delete_project(pid: str):
    shutil.rmtree(pdir(pid))
    return {"ok": True}


@app.get("/api/projects/{pid}/files/{name}")
def project_file(pid: str, name: str):
    f = pdir(pid) / pathlib.Path(name).name
    if not f.exists():
        raise HTTPException(404)
    return FileResponse(f)


@app.get("/api/projects/{pid}/files")
def project_files(pid: str):
    d = pdir(pid)
    return [{"name": f.name, "size": f.stat().st_size, "modified": f.stat().st_mtime}
            for f in sorted(d.iterdir(), key=lambda p: -p.stat().st_mtime) if f.name != "project.json"]


# ---------------------------------------------------------------- import


def _save_upload(d: pathlib.Path, up: UploadFile, stem: str) -> pathlib.Path:
    ext = pathlib.Path(up.filename or "").suffix.lower() or ".bin"
    for old in d.glob(stem + ".*"):
        old.unlink()
    dest = d / f"{stem}{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(up.file, f)
    return dest


@app.post("/api/projects/{pid}/import-audio")
def import_audio(pid: str, file: UploadFile = File(...), ensemble: str = Form("auto"),
                 sensitivity: float = Form(0.5), sections: int = Form(4), separate: bool = Form(False),
                 transcribe: bool = Form(True)):
    from . import transcribe as tr

    d = pdir(pid)
    dest = _save_upload(d, file, "reference")
    project = load(pid)
    project["reference"] = {"file": dest.name, "name": file.filename, "synced": True}
    project["sourceName"] = file.filename
    if project["name"] in ("Untitled", "") and file.filename:
        project["name"] = pathlib.Path(file.filename).stem.replace("_", " ")[:60]
    if not transcribe:
        save(project)
        return {"project": project}

    def work(progress):
        p = tr.audio_to_project(str(dest), project, ensemble=ensemble, sensitivity=sensitivity,
                                n_sections=sections, separate=separate, progress=progress)
        save(p)
        return p

    return {"job": start_job(work)}


@app.post("/api/projects/{pid}/import-score")
def import_score(pid: str, file: UploadFile = File(...), align: bool = Form(True), mode: str = Form("replace")):
    from . import score as sc

    d = pdir(pid)
    dest = _save_upload(d, file, "score")
    project = load(pid)

    def work(progress):
        progress("Reading score", 0.1)
        tmp = core.new_project()
        sc.score_to_project(str(dest), tmp)
        if mode == "add":
            for t in tmp["tracks"]:
                t["color"] = core.TRACK_COLORS[len(project["tracks"]) % len(core.TRACK_COLORS)]
                project["tracks"].append(t)
        else:
            keep = {k: project.get(k) for k in ("id", "name", "reference", "targetSeconds", "sourceName")}
            project.clear()
            project.update(tmp)
            project.update({k: v for k, v in keep.items() if v is not None})
        ref = project.get("reference")
        if align and ref and (d / ref["file"]).exists():
            progress("Aligning score to the recording", 0.4)
            sc.align_to_audio(project, str(d / ref["file"]))
        elif ref:
            ref["synced"] = False
        core.finalize(project)
        save(project)
        progress("Done", 1)
        return project

    return {"job": start_job(work)}


# ---------------------------------------------------------------- editing


@app.get("/api/ops")
def ops():
    return {k: {"description": v["description"], "schema": v["schema"]} for k, v in edits.OPS.items()}


@app.post("/api/edit")
async def edit(req: Request):
    body = await req.json()
    project = body["project"]
    try:
        msg = edits.apply(project, body["op"], body.get("args") or {})
    except (ValueError, KeyError, TypeError) as e:
        raise HTTPException(400, str(e))
    return {"project": project, "message": msg}


@app.post("/api/analyze")
async def analyze(req: Request):
    project = (await req.json())["project"]
    core.finalize(project)
    return {"project": project, "key": core.detect_key([n for t in project["tracks"] for n in t["notes"]])}


@app.post("/api/agent")
async def agent(req: Request):
    from . import agent as ag

    body = await req.json()
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise HTTPException(400, "ANTHROPIC_API_KEY is not set. Add it to refdaw/.env and restart.")

    def work(progress):
        progress("Thinking", 0.2)
        return ag.run_agent(body["project"], body["message"], body.get("selection"), body.get("history"))

    return {"job": start_job(work)}


@app.post("/api/hum")
def hum(file: UploadFile = File(...), project: str = Form(...), start_beat: float = Form(0.0),
        latency_ms: float = Form(0.0), snap_key: bool = Form(True), grid: float = Form(0.25),
        octave_shift: int = Form(0)):
    from . import hum as hm

    tmp = CACHE / f"hum_{uuid.uuid4().hex[:8]}.wav"
    with tmp.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        notes = hm.hum_to_notes(str(tmp), json.loads(project), start_beat, latency_ms, snap_key,
                                grid if grid > 0 else None, octave_shift)
    finally:
        tmp.unlink(missing_ok=True)
    return {"notes": notes}


@app.post("/api/stt")
def stt(file: UploadFile = File(...)):
    import httpx

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(400, "Server speech-to-text needs ELEVENLABS_API_KEY; the browser's own speech recognition is used otherwise.")
    r = httpx.post("https://api.elevenlabs.io/v1/speech-to-text", headers={"xi-api-key": key},
                   data={"model_id": os.environ.get("REFDAW_STT_MODEL", "scribe_v1")},
                   files={"file": (file.filename or "speech.wav", file.file, file.content_type or "audio/wav")},
                   timeout=120)
    if r.status_code >= 400:
        raise HTTPException(502, f"ElevenLabs STT {r.status_code}: {r.text[:300]}")
    return {"text": r.json().get("text", "")}


# ---------------------------------------------------------------- export


@app.post("/api/export/midi")
async def export_midi(req: Request):
    import mido

    p = (await req.json())["project"]
    tpb = 480
    mid = mido.MidiFile(ticks_per_beat=tpb)
    meta = mido.MidiTrack()
    mid.tracks.append(meta)
    meta.append(mido.MetaMessage("track_name", name=p["name"], time=0))
    meta.append(mido.MetaMessage("time_signature", numerator=p["timeSig"][0], denominator=p["timeSig"][1], time=0))

    # tempo events: one per beat when a tempo map exists, else one
    events = []
    if p.get("tempoMap"):
        tm = p["tempoMap"]
        first = tm[0]
        for (b0, s0), (b1, s1) in zip(tm[:-1], tm[1:]):
            if b1 > b0 and s1 > s0 and b0 >= 0:
                events.append((b0, int(1e6 * (s1 - s0) / (b1 - b0))))
        if first[0] > 0:
            events.insert(0, (0, events[0][1] if events else mido.bpm2tempo(p["bpm"])))
    else:
        events.append((0, mido.bpm2tempo(p["bpm"])))
    last = 0
    for b, us in events:
        tick = int(round(b * tpb))
        meta.append(mido.MetaMessage("set_tempo", tempo=max(1, min(16777215, us)), time=tick - last))
        last = tick
    for ch_i, t in enumerate(p["tracks"][:15]):
        ch = ch_i if ch_i < 9 else ch_i + 1  # skip drum channel
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage("track_name", name=t["name"], time=0))
        tr.append(mido.Message("program_change", channel=ch, program=t["program"], time=0))
        ev = []
        for n in t["notes"]:
            ev.append((int(round(n["s"] * tpb)), 1, n["p"], n["v"]))
            ev.append((int(round((n["s"] + n["d"]) * tpb)), 0, n["p"], 0))
        ev.sort()
        last = 0
        for tick, on, pitch, vel in ev:
            tr.append(mido.Message("note_on" if on else "note_off", channel=ch, note=pitch, velocity=vel, time=tick - last))
            last = tick
    out = CACHE / f"export_{uuid.uuid4().hex[:6]}.mid"
    mid.save(out)
    data = out.read_bytes()
    out.unlink()
    return Response(data, media_type="audio/midi",
                    headers={"Content-Disposition": f'attachment; filename="{_safe(p["name"])}.mid"'})


@app.post("/api/export/musicxml")
async def export_musicxml(req: Request):
    import music21 as m21

    p = (await req.json())["project"]
    s = m21.stream.Score()
    s.insert(0, m21.metadata.Metadata(title=p["name"]))
    for t in p["tracks"]:
        part = m21.stream.Part()
        part.partName = t["name"]
        try:
            part.insert(0, m21.instrument.instrumentFromMidiProgram(t["program"]))
        except Exception:
            pass
        part.insert(0, m21.meter.TimeSignature(f"{p['timeSig'][0]}/{p['timeSig'][1]}"))
        part.insert(0, m21.tempo.MetronomeMark(number=round(p["bpm"])))
        part.insert(0, m21.key.Key(p["key"]["tonic"], "minor" if p["key"]["mode"] == "minor" else "major"))
        for n in t["notes"]:
            # quantize to 16ths for a readable score
            st = round(n["s"] * 4) / 4
            du = max(0.25, round(n["d"] * 4) / 4)
            nn = m21.note.Note(n["p"], quarterLength=du)
            nn.volume.velocity = n["v"]
            part.insert(st, nn)
        s.insert(0, part)
    out = CACHE / f"export_{uuid.uuid4().hex[:6]}.musicxml"
    s.makeNotation(inPlace=True)
    s.write("musicxml", fp=str(out))
    data = out.read_bytes()
    out.unlink()
    return Response(data, media_type="application/vnd.recordare.musicxml+xml",
                    headers={"Content-Disposition": f'attachment; filename="{_safe(p["name"])}.musicxml"'})


def _safe(name: str) -> str:
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip() or "refdaw"


@app.post("/api/projects/{pid}/upload-render")
def upload_render(pid: str, file: UploadFile = File(...), name: str = Form("mix.wav")):
    d = pdir(pid)
    dest = d / pathlib.Path(name).name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"file": dest.name}


# ---------------------------------------------------------------- generation


@app.post("/api/projects/{pid}/generate")
async def generate(pid: str, req: Request):
    from . import generate as gen

    body = await req.json()
    d = pdir(pid)
    project = body.get("project") or load(pid)
    provider = body.get("provider", "elevenlabs")
    style, inst = body.get("style", ""), body.get("instruments", "")
    seconds = float(body.get("seconds") or project.get("targetSeconds") or core.duration_seconds(project))
    if provider == "suno":
        return {"brief": gen.suno_brief(project, style, inst, seconds)}

    def work(progress):
        if provider == "elevenlabs":
            out = gen.elevenlabs(project, d, style, inst, seconds, bool(body.get("useSections", True)),
                                 body.get("model") or None, progress=progress)
        elif provider == "fal_ace15":
            ref = d / "mix.wav"
            if not ref.exists():
                raise RuntimeError("Render the mix first (Export → Render mix.wav)")
            extra = body.get("extra") or {}
            if isinstance(extra, str):
                extra = json.loads(extra) if extra.strip() else {}
            out = gen.fal_ace15_cover(project, d, ref, style, inst, seconds, float(body.get("strength") or 0.45),
                                      bool(body.get("acoustic", True)), extra, progress=progress)
        elif provider == "fal_stable":
            ref = d / "mix.wav"
            if not ref.exists():
                raise RuntimeError("Render the mix first (Export → Render mix.wav)")
            extra = body.get("extra") or {}
            if isinstance(extra, str):
                extra = json.loads(extra) if extra.strip() else {}
            out = gen.fal_stable_audio(project, d, ref, style, inst, seconds, float(body.get("strength") or 0.45),
                                       bool(body.get("acoustic", True)), extra, progress=progress)
        elif provider == "fal_ace":
            ref = d / "mix.wav"
            if not ref.exists():
                raise RuntimeError("Render the mix first (Export → Render mix.wav)")
            extra = body.get("extra") or {}
            if isinstance(extra, str):
                extra = json.loads(extra) if extra.strip() else {}
            out = gen.fal_ace(project, d, ref, style, inst, seconds, body.get("endpoint") or None, extra,
                              bool(body.get("acoustic", True)), progress=progress)
        else:
            raise RuntimeError(f"Unknown provider {provider}")
        return {"file": out.name}

    return {"job": start_job(work), "prompt": gen.style_prompt(project, style, inst)}


# ---------------------------------------------------------------- soundfonts (cached proxy)

SF_BASE = "https://gleitz.github.io/midi-js-soundfonts/{bank}/{name}-mp3.js"


@app.get("/sf/{bank}/{name}.js")
def soundfont(bank: str, name: str):
    import httpx

    if not name.replace("_", "").isalnum() or bank not in ("FluidR3_GM", "MusyngKite", "FatBoy"):
        raise HTTPException(400)
    f = CACHE / "soundfonts" / bank / f"{name}.js"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        try:
            r = httpx.get(SF_BASE.format(bank=bank, name=name), timeout=60, follow_redirects=True)
            r.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"soundfont download failed: {e}")
        f.write_bytes(r.content)
    return FileResponse(f, media_type="application/javascript", headers={"Cache-Control": "max-age=31536000"})


@app.get("/healthz")
def health():
    return PlainTextResponse("ok")


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")


@app.exception_handler(HTTPException)
async def http_err(_req, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


def main():
    import uvicorn

    port = int(os.environ.get("REFDAW_PORT", "8765"))
    log.info("RefDAW on http://localhost:%d", port)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
