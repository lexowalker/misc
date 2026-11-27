"""Reader-facing copy rules (client brief and copy audit), checked on the published files.

* No em-dash (U+2014) in any string in public/data, in any lane's data/processed/<lane>/variables.json, or in
  the story and glossary prose under src/content.
* No pipeline vocabulary ("lane", "parquet", "n_basis", "observations table", "pipeline") in reader-facing
  fields: labels, explainers, caveats, notes, formulas, "how" texts, story text and profile sentences.

Run after `make stories web` (the files under public/data are what the site shows).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public" / "data"
PROC = ROOT / "data" / "processed"
CONTENT = ROOT / "src" / "content"
EM_DASH = chr(0x2014)  # written this way so this file contains no em-dash

if not (PUB / "variables.json").exists():
    pytest.skip("public/data not built; run `make web`", allow_module_level=True)

# Keys whose string values (at any depth below them) reach readers: variable copy, values-file notes and
# formulas, story numbers/charts/layers, profile sentences, district and judge notes, case-file notes.
READER_KEYS = {
    "label", "short_label", "explainer", "caveats", "higher_means", "note", "notes", "national_note",
    "cell_notes", "formula", "formula_by_basis", "title", "text", "how", "paragraph", "method", "context",
    "sentences", "distinctive", "breaks", "description", "party_note", "population_note", "population_formula",
    "rank_method", "selection", "caption", "captions", "dek", "reference",
}
# Raw lane fields that are copied through but never rendered (kept for provenance). They are the producing
# lanes' own wording and are not reader-facing; listed here so the exclusion is explicit.
NOT_RENDERED = {"statute_note", "source", "source_locator", "lane", "lane_table", "lane_variable", "lane_inputs"}
BANNED = re.compile(r"\blanes?\b|\bparquet\b|\bn_basis\b|observations table|\bpipeline\b", re.IGNORECASE)

PUBLIC_JSON = sorted(p for p in PUB.rglob("*.json") if "search" not in p.relative_to(PUB).parts)


def _strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _strings(v)


def _reader_strings(obj, path=()):
    """(path, string) for every string under a reader-facing key."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in NOT_RENDERED:
                continue
            if k in READER_KEYS:
                for s in _strings(v):
                    yield path + (k,), s
            else:
                yield from _reader_strings(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _reader_strings(v, path + (i,))


def test_reader_key_walk_finds_the_copy():
    """Guard against a vacuous pass: the walk must reach explainers, caveats, story how texts and profiles."""
    v = json.loads((PUB / "variables.json").read_text())
    got = [p for p, _ in _reader_strings(v)]
    assert any(p[-1] == "explainer" for p in got) and any(p[-1] == "caveats" for p in got)
    story = json.loads((PUB / "stories" / "after-booker.json").read_text())
    assert any(p[-1] == "how" for p, _ in _reader_strings(story))
    prof = json.loads(next((PUB / "profiles").glob("*.json")).read_text())
    assert any("distinctive" in p for p, _ in _reader_strings(prof))


def test_no_em_dash_in_any_published_or_variables_string():
    files = PUBLIC_JSON + sorted(PUB.glob("search/*.json")) + sorted(PROC.glob("*/variables.json"))
    assert len(files) > 300
    for f in files:
        for s in _strings(json.loads(f.read_text())):
            assert EM_DASH not in s, f"em-dash in {f.relative_to(ROOT)}: {s[:120]}"


@pytest.mark.parametrize("rel", [str(p.relative_to(PUB)) for p in PUBLIC_JSON])
def test_no_pipeline_vocabulary_in_reader_facing_fields(rel):
    obj = json.loads((PUB / rel).read_text())
    bad = [f"{'/'.join(map(str, p))}: {s[:140]}" for p, s in _reader_strings(obj) if BANNED.search(s)]
    assert not bad, "pipeline vocabulary in reader-facing text:\n" + "\n".join(bad[:20])


def _ts_string_literals(text: str) -> list[str]:
    """Single-quoted and template string literals in a TypeScript file, comments removed."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("//"))
    return re.findall(r"'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`", text)


@pytest.mark.parametrize("name", ["stories.ts", "glossary.ts", "events.ts"])
def test_story_and_glossary_prose(name):
    text = (CONTENT / name).read_text()
    assert EM_DASH not in text, name
    lits = ["".join(t) for t in _ts_string_literals(text)]
    assert len(lits) > 10
    bad = [s[:140] for s in lits if BANNED.search(s)]
    assert not bad, f"pipeline vocabulary in {name}:\n" + "\n".join(bad)
