"""Stories lane entry point: `python -m pipeline.stories.build`.

Reads only data/processed/* (and data/sources/*.json for citations) and writes, deterministically:

  public/data/stories/<slug>.json   numbers (value, display text, sources, how computed, formula when derived),
                                    chart series, map layers and source records for one story
  public/data/stories/index.json    the headline numbers each story's dek uses, plus thumbnail map data
  data/gaps/stories.json            candidate stories not written, and any value a story needed that is not in
                                    the processed tables (rewritten each run)

The prose lives in src/content/stories.ts and refers to numbers by key ({key}); the page fills them in at
runtime from these files. tests/pipeline/test_stories.py recomputes every number independently.
Running it twice on the same inputs gives byte-identical files.
"""
from __future__ import annotations

import json

from pipeline.common.manifest import DATA, record_gap

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
    first_fy = json.loads((DATA / "processed" / "idb" / "civil_mdl_meta.json").read_text())["first_coded_fy"]
    gaps = DATA / "gaps" / f"{LANE}.json"
    gaps.unlink(missing_ok=True)  # rewritten from scratch each run, so a gap that no longer applies does not linger
    record_gap(
        LANE, "mass_tort_story_not_written",
        description=("A candidate story on N.D. Fla.'s mass-tort docket (multidistrict litigation docket 2885) was "
                     "not written; the atlas has five stories. No data is missing for it: the IDB lane publishes "
                     "civil case counts by MDL docket, district and fiscal year (data/processed/idb/"
                     "civil_mdl_dockets), and the district profiles show them instead, in a note on each district "
                     "where one docket made up more than a quarter of its civil cases filed or closed in a fiscal "
                     f"year from FY {first_fy} on (MDL 2885 on N.D. Fla.'s page). The docket's national effects are "
                     "noted as caveats in the Rocket Docket and Where Trials Went stories and on the measures it "
                     "affects."),
        variables=["idb civil_mdl_dockets"], districts=["flnd"],
        reason="Story not written; the counts it would use are shown on district profiles.",
    )
    n = sum(len(s.numbers) for s in stories.values())
    print(f"stories: wrote {len(stories)} stories ({n} numbers) to {OUT.relative_to(OUT.parents[2])}")


if __name__ == "__main__":
    main()
