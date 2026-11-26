"""Shared pieces for run.py, fetch.py and aggregate.py. See PLAN.md."""
import csv
import datetime as dt
import json
import pathlib
import string

import yaml

ROOT = pathlib.Path(__file__).parent
RAW = ROOT / "data" / "raw"
BATCHES = ROOT / "data" / "batches.json"
CFG = yaml.safe_load((ROOT / "config.yaml").read_text())


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def stamp():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def load_questions():
    with open(ROOT / "questions.csv", newline="") as f:
        rows = list(csv.DictReader(f))
    with open(ROOT / "controls.csv", newline="") as f:
        controls = list(csv.DictReader(f))
    return rows, controls


def build_params(model, question):
    """One user message. No system prompt, no tools, no history, no sampling params,
    no refusal fallbacks (a fallback would let a different model answer)."""
    return {
        "model": model,
        "max_tokens": CFG["max_tokens"],
        "thinking": {"type": "adaptive", "display": CFG["thinking_display"]},
        "output_config": {"effort": CFG["effort"]},
        "messages": [
            {"role": "user", "content": CFG["prompt_template"].format(question=question)}
        ],
    }


def classify(text, stop_reason):
    """YES / NO / DECLINE / TRUNCATED, per PLAN.md and its Amendments."""
    norm = text.strip().strip(string.punctuation + string.whitespace).lower()
    if norm == "yes":
        return "YES"
    if norm == "no":
        return "NO"
    if stop_reason == "max_tokens":
        return "TRUNCATED"
    return "DECLINE"


def canonical(label, wording):
    """Map a raw answer onto the canonical direction (wording B is reversed)."""
    if wording == "b" and label in ("YES", "NO"):
        return "NO" if label == "YES" else "YES"
    return label


def cost_usd(model, usage, discount=1.0):
    p = CFG["models"][model]
    return discount * (usage["input_tokens"] * p["input"]
                       + usage["output_tokens"] * p["output"]) / 1e6


def custom_id(topic_id, wording, sample):
    return f"{topic_id}__{wording}__{sample:02d}"


def parse_custom_id(cid):
    topic_id, wording, sample = cid.rsplit("__", 2)
    return topic_id, wording, sample


def record_from_response(base, body, discount=1.0):
    """Fill a raw-log record from a Message body (dict). `base` already holds
    custom_id, topic_id, wording, timestamp and request."""
    model = base["request"]["model"]
    text = "".join(b.get("text", "") for b in body["content"] if b["type"] == "text")
    thinking = " ".join(
        b.get("thinking", "") or "" for b in body["content"] if b["type"] == "thinking"
    ).strip()
    label = classify(text, body["stop_reason"])
    stop_details = body.get("stop_details") or {}
    rec = dict(base)
    rec.update(
        model=body["model"],
        response=body,
        text=text,
        thinking_summary=thinking,
        stop_reason=body["stop_reason"],
        label=label,
        canonical=canonical(label, base["wording"]),
        # A safety-classifier stop is still a DECLINE; keep why.
        refusal_category=stop_details.get("category") if body["stop_reason"] == "refusal" else None,
        usage=body["usage"],
        cost_usd=cost_usd(model, body["usage"], discount),
    )
    return rec


def error_record(base, message):
    rec = dict(base)
    rec.update(label="ERROR", canonical="ERROR", error=message, cost_usd=0.0)
    return rec


def load_batches():
    if BATCHES.exists():
        return json.loads(BATCHES.read_text())
    return []


def save_batches(batches):
    BATCHES.parent.mkdir(parents=True, exist_ok=True)
    BATCHES.write_text(json.dumps(batches, indent=2) + "\n")


def read_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]
