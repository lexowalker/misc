"""Crosswalk from the district headings printed on FCMS profile pages to registry ids.

FCMS prints each district as "<STATE NAME> <DIVISION>" in capitals (e.g. "VIRGINIA EASTERN",
"NEW YORK SOUTHERN"), the state name alone for single-district states ("COLORADO"), and
"DISTRICT OF COLUMBIA", "PUERTO RICO", "VIRGIN ISLANDS", "GUAM", "NORTHERN MARIANAS" for the
others. Some vintages abbreviate ("NO. CAROLINA EASTERN", "W. VIRGINIA NORTHERN"). The national
page is headed "ALL DISTRICT COURTS" (or carries no district heading).
"""
from __future__ import annotations

import re

from pipeline.common.districts import DISTRICTS

NATIONAL = "US"  # pseudo-id used for the national ("all district courts") page

_ABBREV = [
    (r"^NO\.\s*", "NORTH "), (r"^SO\.\s*", "SOUTH "), (r"^W\.\s*", "WEST "),
    (r"\bN\.\s*MARIANA?S?\b", "NORTHERN MARIANAS"),
]

_SPECIAL = {
    "DISTRICT OF COLUMBIA": "dcd",
    "PUERTO RICO": "prd",
    "VIRGIN ISLANDS": "vid",
    "GUAM": "gud",
    "NORTHERN MARIANAS": "nmid",
    "NORTHERN MARIANA ISLANDS": "nmid",
    "ALL DISTRICT COURTS": NATIONAL,
}


def _key_table() -> dict[str, str]:
    table = dict(_SPECIAL)
    for d in DISTRICTS:
        if d.id in table.values():
            continue
        state = d.state_name.upper()
        # division word = first word of "Eastern District of Virginia"; None for single-district states
        div = d.name.split(" District of ")[0].upper() if " District of " in d.name and not d.name.startswith("District") else None
        table[f"{state} {div}" if div else state] = d.id
    return table


KEYS = _key_table()


def normalize(name: str) -> str:
    s = re.sub(r"\s+", " ", name.strip().upper())
    for pat, rep in _ABBREV:
        s = re.sub(pat, rep, s)
    return re.sub(r"\s+", " ", s).strip()


def to_id(name: str) -> str:
    """Return the registry id (or ``NATIONAL``) for an FCMS heading; raise KeyError if unknown."""
    n = normalize(name)
    if n in KEYS:
        return KEYS[n]
    raise KeyError(f"unrecognised FCMS district heading: {name!r} (normalised {n!r})")
