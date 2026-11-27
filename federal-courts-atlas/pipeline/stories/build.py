"""Stories lane entry point: `python -m pipeline.stories.build`.

Reads only data/processed/* (and data/sources/*.json for citations) and writes, deterministically:

  public/data/stories/<slug>.json   numbers (value, display text, sources, how computed, formula when derived),
                                    chart series, map layers and source records for one story
  public/data/stories/index.json    the headline numbers each story's dek uses, plus thumbnail map data
  data/gaps/stories.json            values a candidate story needed that are not in the processed tables

The prose lives in src/content/stories.ts and refers to numbers by key ({key}); the page fills them in at
runtime from these files. tests/pipeline/test_stories.py recomputes every number independently.
Running it twice on the same inputs gives byte-identical files.
"""
from __future__ import annotations

from pipeline.common.manifest import record_gap

from . import after_booker, border_districts, patent_capital, rocket_docket, where_trials_went
from .common import LANE, OUT, write_json

MODULES = [rocket_docket, patent_capital, border_districts, after_booker, where_trials_went]


def build_all() -> dict[str, dict]:
    out = {}
    for m in MODULES:
        s = m.build()
        out[s.slug] = s
    return out


def main() -> None:
    stories = build_all()
    OUT.mkdir(parents=True, exist_ok=True)
    index = {}
    for slug, s in stories.items():
        doc = s.to_json()
        write_json(OUT / f"{slug}.json", doc)
        th = s.thumb or {}
        lay = s.layers.get(th.get("layer", ""), {})
        year = str(th.get("year"))
        index[slug] = {
            "build_date": doc["build_date"],
            "numbers": {k: v for k, v in s.numbers.items() if v.get("headline")},
            "thumb": {
                "label": lay.get("label"), "unit": lay.get("unit"), "year": th.get("year"), "focus": th.get("focus", []),
                "values": {d: ys[year] for d, ys in sorted(lay.get("values", {}).items()) if year in ys},
                "source_ids": lay.get("source_ids", []),
            },
        }
    write_json(OUT / "index.json", {"stories": index, "order": list(stories)})
    keep = {f"{slug}.json" for slug in stories} | {"index.json"}
    for p in OUT.glob("*.json"):
        if p.name not in keep:
            p.unlink()
    record_gap(
        LANE, "mass_tort_mdl_counts_not_processed",
        description=("A candidate story on N.D. Fla.'s mass-tort docket needs counts of cases in one multidistrict "
                     "litigation (MDL docket 2885) by fiscal year. The IDB lane does not publish MDL docket counts in "
                     "data/processed, so the story was not built; its national effects are noted as caveats in the "
                     "Rocket Docket and Where Trials Went stories."),
        variables=["idb MDLDOCK counts"], districts=["flnd"], periods="FY 2019 to FY 2025",
        reason="Not in a processed lane table; the stories lane reads data/processed only.",
    )
    n = sum(len(s.numbers) for s in stories.values())
    print(f"stories: wrote {len(stories)} stories ({n} numbers) to {OUT.relative_to(OUT.parents[2])}")


if __name__ == "__main__":
    main()
