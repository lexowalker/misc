"""Cross-check the OLRC (uscode.house.gov) statute text against Cornell LII's web text, sentence by sentence."""
from __future__ import annotations

import re

from . import sources
from .statute import Unit, lii_text, norm_for_compare


def _strip_markers(s: str) -> str:
    # LII renders OLRC footnote markers inline ("Plattsburgh, 1 Syracuse"); drop "<digit> " after punctuation
    s = re.sub(r"\s*\[\d+\]", "", s)
    return s


def crosscheck(units: list[Unit], metas: list[dict]) -> list[dict]:
    """Return one row per checked sentence: {section, district_id, division, kind, sentence, in_lii}."""
    pages: dict[str, str] = {}
    rows = []
    for u in units:
        key = f"{u.title}/{u.section}"
        if key not in pages:
            pages[key] = norm_for_compare(_strip_markers(lii_text(sources.get(sources.lii_source_id(u.title,
                                                                                               u.section)))))
        txt = pages[key]
        for kind, sent in (("county_sentence", u.county_sentence), ("court_sentence", u.court_sentence)):
            if not sent:
                continue
            ok = norm_for_compare(sent) in txt
            rows.append({"section": f"{u.title} U.S.C. § {u.section}", "district_id": u.district_id,
                         "division": u.division, "kind": kind, "sentence": sent, "in_lii": ok})
    for m in metas:
        sec = m["section"]
        if not sec.isalnum():
            continue
        txt = pages.get(f"28/{sec}")
        if txt is None:
            txt = norm_for_compare(_strip_markers(lii_text(sources.get(sources.lii_source_id(28, sec)))))
            pages[f"28/{sec}"] = txt
        rows.append({"section": f"28 U.S.C. § {sec}", "district_id": "", "division": "", "kind": "intro_sentence",
                     "sentence": m["intro_sentence"], "in_lii": norm_for_compare(m["intro_sentence"]) in txt})
    return rows
