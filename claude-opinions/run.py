"""Pilot and batch submission. See PLAN.md (and its Amendments section).

  python run.py --pilot              one synchronous call per topic, then a summary
  python run.py --pilot --dry-run    build and print the pilot requests, send nothing
  python run.py --submit             estimate from the pilot and check the budget; sends nothing
  python run.py --submit --confirm   the same, then submit the batch and save its ID

Each request is one user message: no system prompt, no tools, no history.
"""
import argparse
import json
import random
import sys

import anthropic

from common import (make_client, CFG, RAW, build_params, custom_id, error_record, load_batches,
                    load_questions, now_iso, read_jsonl, record_from_response,
                    save_batches, stamp)

MARGIN = 1.25


def full_size(questions, controls):
    return (len(questions) + len(controls)) * 2 * CFG["samples_per_wording"]


def pilot(dry_run):
    model = CFG["run_models"][0]
    questions, controls = load_questions()
    rng = random.Random(0)
    picks = [(q, rng.choice("ab")) for q in questions][: CFG["pilot_calls"]]

    if dry_run:
        for q, w in picks:
            print(json.dumps(build_params(model, q[f"wording_{w}"]), indent=1))
        print(f"\n{len(picks)} requests built, nothing sent.")
        return

    client = make_client(1)  # one retry at most
    RAW.mkdir(parents=True, exist_ok=True)
    out_path = RAW / f"pilot-{stamp()}.jsonl"
    total = 0.0
    out_tokens = []
    print(f"{'topic':<20} w  {'raw':<10} {'canon':<9} out_tok  answer")
    with open(out_path, "w") as out:
        for q, w in picks:
            base = {
                "custom_id": f"{q['id']}__{w}__pilot",
                "topic_id": q["id"],
                "wording": w,
                "timestamp": now_iso(),
                "request": build_params(model, q[f"wording_{w}"]),
            }
            try:
                resp = client.messages.create(**base["request"])
            except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
                out.write(json.dumps(error_record(base, f"{type(e).__name__}: {e}")) + "\n")
                print(f"{q['id']:<20} {w}  ERROR      {type(e).__name__}")
                continue
            rec = record_from_response(base, resp.model_dump(mode="json"))
            out.write(json.dumps(rec) + "\n")
            total += rec["cost_usd"]
            out_tokens.append(rec["usage"]["output_tokens"])
            print(f"{q['id']:<20} {w}  {rec['label']:<10} {rec['canonical']:<9} "
                  f"{rec['usage']['output_tokens']:>7}  {rec['text'].strip()[:40]!r}")

    n = len(out_tokens)
    if n:
        mean = total / n
        full = full_size(questions, controls)
        proj = full * mean * CFG["batch_discount"] * MARGIN
        print(f"\nPilot cost: ${total:.4f} for {n} calls "
              f"(mean {sum(out_tokens) / n:.0f} output tokens, ${mean:.5f} per call)")
        print(f"Projected full run ({full} calls incl. controls, batched, +25% margin): "
              f"${proj:.2f} against a budget of ${CFG['budget_usd']:.2f}")
    print(f"Raw log: {out_path}")
    print("Stopping here for Lexo's go-ahead.")


def pilot_mean_cost(model):
    """Mean cost per successful call across all pilot logs for this model."""
    costs = []
    for path in sorted(RAW.glob("pilot-*.jsonl")):
        for rec in read_jsonl(path):
            if rec.get("label") != "ERROR" and rec["request"]["model"] == model:
                costs.append(rec["cost_usd"])
    return (sum(costs) / len(costs), len(costs)) if costs else (None, 0)


def submit(confirm):
    questions, controls = load_questions()
    batches = load_batches()
    for model in CFG["run_models"]:
        live = [b for b in batches if b["model"] == model and b["kind"] == "full"
                and b.get("status") not in ("canceled", "expired")]
        if live:
            print(f"{model}: batch {live[0]['batch_id']} already recorded in "
                  f"data/batches.json (status {live[0].get('status')}). Not resubmitting. "
                  f"Run fetch.py.")
            continue

        mean, n_pilot = pilot_mean_cost(model)
        if mean is None:
            sys.exit(f"{model}: no pilot results found. Run `python run.py --pilot` first.")

        requests = []
        for q in questions + controls:
            for w in "ab":
                for k in range(CFG["samples_per_wording"]):
                    requests.append({
                        "custom_id": custom_id(q["id"], w, k),
                        "params": build_params(model, q[f"wording_{w}"]),
                    })
        proj = len(requests) * mean * CFG["batch_discount"] * MARGIN
        print(f"{model}: {len(requests)} requests "
              f"({len(questions)} topics + {len(controls)} controls x 2 wordings x "
              f"{CFG['samples_per_wording']} samples)")
        print(f"  pilot mean ${mean:.5f}/call over {n_pilot} calls -> projected "
              f"${proj:.2f} (batched, +25% margin); budget ${CFG['budget_usd']:.2f}")
        if proj > CFG["budget_usd"]:
            sys.exit("  Over budget. Not submitting.")
        if not confirm:
            print("  Within budget. Nothing sent; add --confirm to submit.")
            continue

        RAW.mkdir(parents=True, exist_ok=True)
        req_path = RAW / f"requests-{model}-{stamp()}.jsonl"
        with open(req_path, "w") as f:
            for r in requests:
                f.write(json.dumps(r) + "\n")
        client = make_client(1)
        batch = client.messages.batches.create(requests=requests)
        batches.append({
            "batch_id": batch.id,
            "model": model,
            "kind": "full",
            "created_at": now_iso(),
            "n_requests": len(requests),
            "requests_file": str(req_path.relative_to(RAW.parent.parent)),
            "projected_usd": round(proj, 4),
            "status": batch.processing_status,
        })
        save_batches(batches)  # straight away, so a later session can pick it up
        print(f"  Submitted batch {batch.id} ({batch.processing_status}). "
              f"Saved to data/batches.json. Run `python fetch.py` to check on it.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--submit", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--confirm", action="store_true")
    a = ap.parse_args()
    if a.pilot:
        pilot(a.dry_run)
    elif a.submit:
        submit(a.confirm)
    else:
        ap.print_help()
