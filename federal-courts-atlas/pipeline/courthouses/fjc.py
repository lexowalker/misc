"""Parse the FJC "Historic Federal Courthouses" detailed list (fjc.gov/history/courthouses/descriptions).

Each table row is one building: a heading "City, State (Year)" linking to its FJC page, then paragraphs
holding (optionally) the building's name, the federal courts that used it with their years of use, and notes
(architects, extensions, demolition). A building is *in current use by a district court* when one of its court
lines reads "U.S. District Court for the <district> (YYYY-present)" (or the territorial-court equivalent).

Nothing here is geocoded; see ``locate.py``.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from pipeline.common.districts import DISTRICTS, STATES

from .sources import FJC_PAGES, get

_NAME_TO_ID = {d.name.lower(): d.id for d in DISTRICTS}
_NAME_TO_ID.update({
    "district of columbia": "dcd",
    "district of the canal zone": None,
})
_TERRITORIAL = [  # (pattern, district_id)
    (re.compile(r"^District Court (?:of|for) Guam\b", re.I), "gud"),
    (re.compile(r"^District Court (?:of|for) the Virgin Islands\b", re.I), "vid"),
    (re.compile(r"^District Court (?:of|for) the Northern Mariana Islands\b", re.I), "nmid"),
]
_COURT_RE = re.compile(r"^(?P<court>[^()]*\b(?:Court|Panel)\b[^()]*?)\s*"
                       r"\((?P<years>[^()]*(?:\d{4}|unknown|present)[^()]*)\)\s*$", re.I)
_DC_RE = re.compile(r"^U\.S\. District Court for the (?P<district>.+)$")
_STATE_NAMES = {v[0]: k for k, v in STATES.items()}
_STATE_NAMES.update({"Virgin Islands": "VI", "U.S. Virgin Islands": "VI", "Northern Mariana Islands": "MP",
                     "District of Columbia": "DC"})
_YEAR_RE = re.compile(r"(\d{4})")


def district_for_court(court: str) -> str | None:
    """'U.S. District Court for the Northern District of Alabama' -> 'alnd'; other courts -> None."""
    for pat, did in _TERRITORIAL:
        if pat.search(court):
            return did
    m = _DC_RE.match(court)
    if not m:
        return None
    return _NAME_TO_ID.get(m.group("district").strip().lower(), "UNKNOWN")


def _split_heading(h: str) -> tuple[str, str, int | None]:
    m = re.match(r"^(?P<city>.+?),\s*(?P<state>[^,(]+?)\s*\((?P<year>[^)]*)\)\s*$", h)
    if not m:
        return h, "", None
    y = _YEAR_RE.search(m.group("year"))
    return m.group("city").strip(), m.group("state").strip(), int(y.group(1)) if y else None


def parse_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    out = []
    for td in soup.select("td.courthouse-description"):
        a = td.find("strong").find("a") if td.find("strong") else None
        if a is None:
            continue
        heading = a.get_text(" ", strip=True)
        city, state_name, year = _split_heading(heading)
        lines = []
        for p in td.find_all("p"):
            for part in p.get_text("\n", strip=True).split("\n"):
                part = re.sub(r"\s+", " ", part).strip()
                if part:
                    lines.append(part)
        courts, notes, name = [], [], None
        for i, ln in enumerate(lines):
            m = _COURT_RE.match(ln)
            if m:
                courts.append({"court": m.group("court").strip(), "years": m.group("years").strip()})
                continue
            nm = re.match(r"^Named (?:the )?(?P<n>.+?) in \d{4}\.?$", ln)
            if nm and name is None:
                name = nm.group("n").strip()
                notes.append(ln)
            elif i == 0 and not courts and not ln.startswith(("Architect", "Razed", "Extension", "First ", "Second ",
                                                              "Demolished", "Destroyed", "Burned")):
                name = ln
            else:
                notes.append(ln)
        out.append({"fjc_path": a["href"], "heading": heading, "city": city, "state_name": state_name,
                    "state": _STATE_NAMES.get(state_name, ""), "year": year, "name": name,
                    "courts": courts, "notes": notes})
    return out


def load() -> tuple[list[dict], list[str]]:
    """All FJC building entries (deduplicated by FJC page), and the source_ids used."""
    seen, entries, sids = set(), [], []
    total = None
    for p in range(FJC_PAGES):
        sid = f"fjc_courthouses_p{p:02d}"
        r = get(sid)
        sids.append(sid)
        html = r.text
        if total is None:
            m = re.search(r"Displaying 1 - \d+ of (\d+)", html)
            total = int(m.group(1)) if m else None
        for e in parse_page(html):
            if e["fjc_path"] in seen:
                continue
            seen.add(e["fjc_path"])
            e["source_id"] = sid
            entries.append(e)
    if total is not None and -(-total // 50) != FJC_PAGES:
        raise RuntimeError(f"FJC list now has {total} rows; update FJC_PAGES")
    return entries, sids


def current_district_use(e: dict) -> list[tuple[str, int | None]]:
    """[(district_id, start of current use)] for district-court lines ending in '-present'."""
    out = []
    for c in e["courts"]:
        if not re.search(r"present\s*$", c["years"], re.I):
            continue
        did = district_for_court(c["court"])
        if did:
            # The start of the current period of use: "1858-1864, 1871-present" -> 1871; "unknown-present" -> None.
            y = re.search(r"(\d{4})\s*-\s*present\s*$", c["years"], re.I)
            out.append((did, int(y.group(1)) if y else None))
    return out
