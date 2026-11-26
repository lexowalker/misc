"""Raw batch results -> data/summary.json (and a copy in chart/ for the page).

  python aggregate.py

Shares are over parseable answers: YES + NO + DECLINE = 100%.
TRUNCATED and ERROR are counted separately and never counted as declines.
"""
import collections
import json
import re
import shutil

from common import CFG, ROOT, load_batches, load_questions, read_jsonl

LABELS = ("YES", "NO", "DECLINE")


def split(recs):
    c = collections.Counter(r["canonical"] for r in recs)
    n = sum(c[k] for k in LABELS)
    out = {f"n_{k.lower()}": c[k] for k in LABELS}
    out.update(n=n, n_truncated=c["TRUNCATED"], n_error=c["ERROR"])
    for k in LABELS:
        out[f"pct_{k.lower()}"] = round(100 * c[k] / n, 2) if n else None
    return out


def wording_split(recs):
    s = split(recs)
    raw = collections.Counter(r["label"] for r in recs)
    s["raw_pct_yes"] = round(100 * raw["YES"] / s["n"], 2) if s["n"] else None
    return s


def consistency(a, b):
    """1 - total variation distance between the canonical splits of the two wordings.
    1.0: the same canonical answer whichever way the question is put.
    Low: the answer follows the wording (e.g. saying yes to both)."""
    if not a["n"] or not b["n"]:
        return None
    tvd = sum(abs(a[f"pct_{k.lower()}"] - b[f"pct_{k.lower()}"]) for k in LABELS) / 200
    return round(1 - tvd, 3)


def summarise(row, recs, is_control):
    by_w = {w: wording_split([r for r in recs if r["wording"] == w]) for w in "ab"}
    pooled = split(recs)
    item = {
        "id": row["id"],
        "topic": row["topic"],
        "wording_a": row["wording_a"],
        "wording_b": row["wording_b"],
        "canonical_yes_means": row["canonical_yes_means"],
        **pooled,
        "net_yes": (round(pooled["pct_yes"] - pooled["pct_no"], 2)
                    if pooled["n"] else None),
        "by_wording": by_w,
        "polarity_consistency": consistency(by_w["a"], by_w["b"]),
    }
    if is_control:
        item["expected_canonical"] = row["expected_canonical"]
        if pooled["n"]:
            top = max(LABELS, key=lambda k: pooled[f"n_{k.lower()}"])
            item["majority"] = top
            item["pass"] = top.lower() == row["expected_canonical"].lower()
    else:
        item["event_year"] = row.get("event_year")
        b = row.get("human_baseline_pct_yes", "").strip()
        item["baseline"] = {
            "pct_yes": float(b) if b else None,
            "source": row.get("baseline_source") or None,
            "year": row.get("baseline_year") or None,
            "url": row.get("baseline_url") or None,
            "note": row.get("baseline_note") or None,
        }
    return item


def norm_text(t):
    return re.sub(r"\s+", " ", t.strip()).lower()[:200]


def main():
    questions, controls = load_questions()
    recs = []
    for b in load_batches():
        if b.get("kind") == "full" and b.get("results_file"):
            recs.extend(read_jsonl(ROOT / b["results_file"]))
    if not recs:
        print("No downloaded batch results yet. Nothing to aggregate.")
        return

    models = {}
    for model in sorted({r["request"]["model"] for r in recs}):
        mrecs = [r for r in recs if r["request"]["model"] == model]
        by_topic = collections.defaultdict(list)
        for r in mrecs:
            by_topic[r["topic_id"]].append(r)
        declines = [r for r in mrecs if r["label"] == "DECLINE"]
        models[model] = {
            "served_models": sorted({r["model"] for r in mrecs if r.get("model")}),
            "n_calls": len(mrecs),
            "spend_usd": round(sum(r["cost_usd"] for r in mrecs), 4),
            "topics": [summarise(q, by_topic[q["id"]], False) for q in questions],
            "controls": [summarise(c, by_topic[c["id"]], True) for c in controls],
            "top_declines": [
                {"text": t, "count": n}
                for t, n in collections.Counter(norm_text(r["text"]) for r in declines)
                .most_common(10)
            ],
            "refusal_categories": dict(collections.Counter(
                r["refusal_category"] or "none" for r in declines
                if r.get("stop_reason") == "refusal")),
        }

    stamps = sorted(r["timestamp"] for r in recs)
    summary = {
        "meta": {
            "prompt_template": CFG["prompt_template"],
            "samples_per_wording": CFG["samples_per_wording"],
            "max_tokens": CFG["max_tokens"],
            "effort": CFG["effort"],
            "thinking": f"adaptive, display {CFG['thinking_display']}",
            "system_prompt": None,
            "tools": None,
            "first_result": stamps[0],
            "last_result": stamps[-1],
        },
        "models": models,
    }
    out = ROOT / "data" / "summary.json"
    out.write_text(json.dumps(summary, indent=1) + "\n")
    (ROOT / "chart").mkdir(exist_ok=True)
    shutil.copy(out, ROOT / "chart" / "summary.json")

    for model, m in models.items():
        print(f"\n{model} (served as {', '.join(m['served_models'])}): "
              f"{m['n_calls']} calls, ${m['spend_usd']:.4f}")
        print(f"{'topic':<20} {'yes':>6} {'no':>6} {'decl':>6} {'net':>7} {'cons':>5} "
              f"{'trunc':>5} {'err':>4}  baseline")
        for t in sorted(m["topics"], key=lambda t: -(t["net_yes"] or 0)):
            base = t["baseline"]["pct_yes"]
            print(f"{t['id']:<20} {t['pct_yes'] or 0:>6.1f} {t['pct_no'] or 0:>6.1f} "
                  f"{t['pct_decline'] or 0:>6.1f} {t['net_yes'] or 0:>7.1f} "
                  f"{t['polarity_consistency'] or 0:>5.2f} {t['n_truncated']:>5} "
                  f"{t['n_error']:>4}  {'' if base is None else base}")
        print("controls:", ", ".join(
            f"{c['id']} {c.get('majority')} ({'pass' if c.get('pass') else 'FAIL'})"
            for c in m["controls"]))
        if m["top_declines"]:
            print("top declines:")
            for d in m["top_declines"][:5]:
                print(f"  {d['count']:>4}  {d['text'][:100]!r}")
    print(f"\nWrote {out.relative_to(ROOT)} and chart/summary.json")


if __name__ == "__main__":
    main()
