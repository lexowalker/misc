"""Check recorded batches; download finished ones to data/raw/, then aggregate.

  python fetch.py

Safe to re-run: a batch whose results are already on disk is skipped.
Errored requests are logged as ERROR and not resubmitted (no retry loops).
"""
import json

import anthropic

import aggregate
from common import (CFG, RAW, ROOT, error_record, load_batches, now_iso,
                    parse_custom_id, read_jsonl, record_from_response, save_batches)


def download(client, entry, batch):
    requests = {r["custom_id"]: r["params"] for r in read_jsonl(ROOT / entry["requests_file"])}
    ended = batch.ended_at.isoformat() if batch.ended_at else now_iso()
    out_path = RAW / f"batch-{entry['batch_id']}.jsonl"
    counts = {}
    spend = 0.0
    with open(out_path, "w") as out:
        for result in client.messages.batches.results(entry["batch_id"]):
            topic_id, wording, sample = parse_custom_id(result.custom_id)
            base = {
                "custom_id": result.custom_id,
                "batch_id": entry["batch_id"],
                "topic_id": topic_id,
                "wording": wording,
                "sample": int(sample),
                "timestamp": ended,
                "request": requests[result.custom_id],
            }
            if result.result.type == "succeeded":
                rec = record_from_response(base, result.result.message.model_dump(mode="json"),
                                           discount=CFG["batch_discount"])
            else:
                detail = result.result.type
                if result.result.type == "errored":
                    detail += f": {result.result.error.model_dump(mode='json')}"
                rec = error_record(base, detail)
            spend += rec["cost_usd"]
            counts[rec["label"]] = counts.get(rec["label"], 0) + 1
            out.write(json.dumps(rec) + "\n")
    return out_path, counts, spend


def main():
    batches = load_batches()
    if not batches:
        print("No batches recorded in data/batches.json. Run `python run.py --submit --confirm`.")
        return
    client = anthropic.Anthropic(max_retries=1)
    downloaded_any = False
    for entry in batches:
        if entry.get("results_file"):
            print(f"{entry['batch_id']} ({entry['model']}): already downloaded "
                  f"-> {entry['results_file']}, ${entry.get('actual_usd', 0):.4f}")
            continue
        batch = client.messages.batches.retrieve(entry["batch_id"])
        entry["status"] = batch.processing_status
        entry["request_counts"] = batch.request_counts.model_dump(mode="json")
        print(f"{entry['batch_id']} ({entry['model']}): {batch.processing_status} "
              f"{entry['request_counts']}")
        if batch.processing_status != "ended":
            continue
        out_path, counts, spend = download(client, entry, batch)
        entry["results_file"] = str(out_path.relative_to(ROOT))
        entry["label_counts"] = counts
        entry["actual_usd"] = round(spend, 4)
        entry["downloaded_at"] = now_iso()
        downloaded_any = True
        print(f"  downloaded -> {entry['results_file']}")
        print(f"  labels {counts}; spend ${spend:.4f} "
              f"(projected ${entry.get('projected_usd', 0):.2f})")
    save_batches(batches)
    if downloaded_any:
        aggregate.main()


if __name__ == "__main__":
    main()
