"""The editing agent: Claude with tool use over the project's note-editing operations."""
from __future__ import annotations

import copy
import json
import os

from . import core, edits

MODEL = os.environ.get("REFDAW_MODEL", "claude-opus-5-5")

SYSTEM = """You are the composing assistant inside RefDAW, a minimal DAW. The user is reworking a reference piece \
(often minimalist / film music) into their own composition and asks for edits by voice or text.

How to work:
- Make the edit with the tools. Every tool edits the project directly; the user can undo everything you do in one step.
- Positions are in beats (quarter notes), starting at 0. A bar is timeSig[0] beats. Pitches are MIDI numbers or names like 'Eb4' (C4 = 60).
- Use get_notes to look at the music before rewriting it. For large tracks, read only the region you need.
- Prefer the exact operations (transpose, change_key, limit_range, quantize, fit_duration, copy_region, invert, vary…) \
when one fits. For creative rewriting (new melody, a variation on a phrase, counterpoint, a fugue-like entry), read the \
notes, then compose with replace_notes or add_notes, staying in the key and the style of the existing material.
- "Subtle" means change little: keep the rhythm and harmony, and alter a small share of the notes.
- If the user's selection is given, treat "this", "here" and "it" as that selection.
- When a request is ambiguous, make a sensible musical choice and say what you chose. Don't ask a question unless you can't act at all.
- Finish with one or two short sentences saying what changed (which tracks, which bars). No lists, no preamble."""


def _bar_beat(project, beat):
    bpb = project["timeSig"][0] * 4 / project["timeSig"][1]
    return f"bar {int(beat // bpb) + 1}"


def project_brief(project: dict, selection: dict | None) -> str:
    dur = core.duration_seconds(project)
    bpb = project["timeSig"][0] * 4 / project["timeSig"][1]
    lines = [
        f"Project: {project['name']}",
        f"Key: {project['key']['tonic']} {project['key']['mode']} | Tempo: {project['bpm']:.1f} BPM"
        f"{' (follows reference tempo map)' if project.get('tempoMap') else ''} | Time signature: {project['timeSig'][0]}/{project['timeSig'][1]}",
        f"Length: {core.end_beat(project):.1f} beats ≈ {int(dur) // 60}:{int(dur) % 60:02d}"
        + (f" | Target length: {project['targetSeconds']:.0f} s" if project.get("targetSeconds") else ""),
        "Tracks:",
    ]
    for t in project["tracks"]:
        lines.append("  " + json.dumps(core.track_summary(t)))
    if project.get("sections"):
        lines.append("Sections: " + "; ".join(
            f"{s['name']} beats {s['start']:g}-{s['end']:g} (bars {int(s['start'] // bpb) + 1}-{int(s['end'] // bpb)})"
            for s in project["sections"]))
    if project.get("chords"):
        ch = project["chords"][:96]
        lines.append("Detected chords (beat:name): " + " ".join(f"{c['start']:g}:{c['name']}" for c in ch)
                     + (" …" if len(project["chords"]) > 96 else ""))
    if selection:
        lines.append("Current selection: " + json.dumps(selection))
    return "\n".join(lines)


GET_NOTES = {
    "name": "get_notes",
    "description": "Read the notes of a track in a region. Returns lines of 'start_beat pitch duration velocity'.",
    "input_schema": {"type": "object", "properties": {
        "track_id": {"type": "string"},
        "start_beat": {"type": "number"}, "end_beat": {"type": "number"}}, "required": ["track_id"]},
}


def _get_notes(project, track_id, start_beat=None, end_beat=None):
    t = edits._track(project, track_id)
    ns = edits._region(t, start_beat, end_beat)
    if len(ns) > 600:
        ns = ns[:600]
        tail = "\n… truncated at 600 notes; read a smaller region"
    else:
        tail = ""
    return f"{t['name']} ({len(ns)} notes)\n" + "\n".join(
        f"{n['s']:g} {core.pitch_name(n['p'])} {n['d']:g} {n['v']}" for n in ns) + tail


def tools():
    out = [GET_NOTES]
    for name, o in edits.OPS.items():
        out.append({"name": name, "description": o["description"], "input_schema": o["schema"]})
    return out


def run_agent(project: dict, message: str, selection: dict | None = None, history: list | None = None,
              max_steps: int = 24) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    work = copy.deepcopy(project)
    log = []
    messages = []
    for h in (history or [])[-8:]:
        if h.get("role") in ("user", "assistant") and isinstance(h.get("text"), str) and h["text"].strip():
            messages.append({"role": h["role"], "content": h["text"]})
    # The API requires alternating roles starting with user.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    merged = []
    for m in messages:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] += "\n" + m["content"]
        else:
            merged.append(m)
    messages = merged
    user_text = f"<project>\n{project_brief(work, selection)}\n</project>\n\n{message}"
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n\n" + user_text
    else:
        messages.append({"role": "user", "content": user_text})

    reply = ""
    for _ in range(max_steps):
        resp = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=SYSTEM,
            tools=tools(),
            messages=messages,
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if resp.stop_reason == "refusal":
            reply = "The model declined this request."
            break
        messages.append({"role": "assistant", "content": resp.content})
        texts = [b.text for b in resp.content if b.type == "text"]
        if texts:
            reply = "\n".join(texts).strip()
        uses = [b for b in resp.content if b.type == "tool_use"]
        if resp.stop_reason == "max_tokens" and not uses:
            break
        if not uses:
            break
        results = []
        for u in uses:
            args = u.input if isinstance(u.input, dict) else {}
            try:
                if u.name == "get_notes":
                    out = _get_notes(work, **args)
                else:
                    out = edits.apply(work, u.name, args)
                    log.append(out)
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": out})
            except Exception as e:  # report bad arguments back so the model can fix them
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": f"Error: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    core.finalize(work)
    return {"project": work, "reply": reply or ("Done: " + "; ".join(log) if log else "No changes."), "log": log}
