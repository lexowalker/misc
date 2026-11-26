"""Pilot and batch submission. See PLAN.md (and its Amendments section).

  python run.py --pilot             20 synchronous calls, then a summary
  python run.py --pilot --dry-run   build and print the requests, send nothing
  python run.py --submit            (Phase 4, not built yet)

Each request is one user message: no system prompt, no tools, no history.
"""
import argparse
import csv
import datetime as dt
import json
import pathlib
import random
import string
import sys

import anthropic
import yaml

ROOT = pathlib.Path(__file__).parent
CFG = yaml.safe_load((ROOT / "config.yaml").read_text())


def load_questions():
    rows = list(csv.DictReader(open(ROOT / "questions.csv", newline="")))
    controls = list(csv.DictReader(open(ROOT / "controls.csv", newline="")))
    return rows, controls


def build_params(model, question):
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
    """YES / NO / DECLINE / TRUNCATED, per PLAN.md."""
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


def cost_usd(model, usage):
    p = CFG["models"][model]
    return (usage["input_tokens"] * p["input"] + usage["output_tokens"] * p["output"]) / 1e6


def pilot(dry_run):
    model = CFG["run_models"][0]
    questions, _ = load_questions()
    rng = random.Random(0)
    picks = [(q, rng.choice("ab")) for q in questions][: CFG["pilot_calls"]]

    if dry_run:
        for q, w in picks:
            print(json.dumps(build_params(model, q[f"wording_{w}"]), indent=1))
        print(f"\n{len(picks)} requests built, nothing sent.")
        return

    client = anthropic.Anthropic(max_retries=1)  # one retry at most
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = ROOT / "data" / "raw" / f"pilot-{stamp}.jsonl"
    total = 0.0
    out_tokens = []
    print(f"{'topic':<20} w  {'raw':<10} {'canon':<9} out_tok  answer")
    with open(out_path, "w") as out:
        for q, w in picks:
            params = build_params(model, q[f"wording_{w}"])
            rec = {
                "custom_id": f"{q['id']}__{w}__pilot",
                "topic_id": q["id"],
                "wording": w,
                "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
                "request": params,
            }
            try:
                resp = client.messages.create(**params)
            except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
                rec.update(label="ERROR", canonical="ERROR", error=f"{type(e).__name__}: {e}")
                out.write(json.dumps(rec) + "\n")
                print(f"{q['id']:<20} {w}  ERROR      {type(e).__name__}")
                continue
            body = resp.model_dump(mode="json")
            text = "".join(b["text"] for b in body["content"] if b["type"] == "text")
            thinking = " ".join(
                b.get("thinking", "") for b in body["content"] if b["type"] == "thinking"
            ).strip()
            label = classify(text, body["stop_reason"])
            c = cost_usd(model, body["usage"])
            total += c
            out_tokens.append(body["usage"]["output_tokens"])
            rec.update(
                model=body["model"], response=body, text=text, thinking_summary=thinking,
                label=label, canonical=canonical(label, w), usage=body["usage"], cost_usd=c,
            )
            out.write(json.dumps(rec) + "\n")
            print(f"{q['id']:<20} {w}  {label:<10} {rec['canonical']:<9} "
                  f"{body['usage']['output_tokens']:>7}  {text.strip()[:40]!r}")

    n = len(out_tokens)
    if n:
        mean = total / n
        full = len(questions) * 2 * CFG["samples_per_wording"]
        proj = full * mean * CFG["batch_discount"] * 1.25
        print(f"\nPilot cost: ${total:.4f} for {n} calls "
              f"(mean {sum(out_tokens) / n:.0f} output tokens, ${mean:.5f} per call)")
        print(f"Projected full run ({full} calls, batched, +25% margin): ${proj:.2f} "
              f"against a budget of ${CFG['budget_usd']:.2f}")
    print(f"Raw log: {out_path}")
    print("Stopping here for Lexo's go-ahead.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--submit", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.pilot:
        pilot(a.dry_run)
    elif a.submit:
        sys.exit("Batch submission is Phase 4 and is not built yet.")
    else:
        ap.print_help()
