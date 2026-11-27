"""USSC district codes -> atlas district ids.

The USSC Individual Offender datafiles code the sentencing court in ``DISTRICT``
(numeric, 00-96; codes 21, 59 and 92 are unused). The code list is printed in
Appendix A of the codebook (``USSC_Public_Release_Codebook_FY99_FY25.pdf``, "DISTRICT").
The same 94 codes are used in every fiscal year FY2002-FY2025 (verified against each
year's file in ``tests/pipeline/test_ussc_crosswalk.py``).

The USSC's Statistical Information Packets name districts differently again:
file names such as ``vae25.pdf`` (state postal + n/s/e/w/m/c) and table row labels
such as "Virginia" followed by an indented "Eastern". Helpers for both live here.
"""
from __future__ import annotations

import re

from pipeline.common.districts import BY_ID, DISTRICTS, STATES

# USSC DISTRICT code -> (codebook label, district_id)
USSC_DISTRICT: dict[int, tuple[str, str]] = {
    0: ("Maine", "med"), 1: ("Massachusetts", "mad"), 2: ("New Hampshire", "nhd"),
    3: ("Rhode Island", "rid"), 4: ("Puerto Rico", "prd"), 5: ("Connecticut", "ctd"),
    6: ("New York North", "nynd"), 7: ("New York East", "nyed"), 8: ("New York South", "nysd"),
    9: ("New York West", "nywd"), 10: ("Vermont", "vtd"), 11: ("Delaware", "ded"),
    12: ("New Jersey", "njd"), 13: ("Penn. East", "paed"), 14: ("Penn. Mid", "pamd"),
    15: ("Penn. West", "pawd"), 16: ("Maryland", "mdd"), 17: ("N Carolina East", "nced"),
    18: ("N Carolina Mid", "ncmd"), 19: ("N Carolina West", "ncwd"), 20: ("South Carolina", "scd"),
    22: ("Virginia East", "vaed"), 23: ("Virginia West", "vawd"), 24: ("W Virginia North", "wvnd"),
    25: ("W Virginia South", "wvsd"), 26: ("Alabama North", "alnd"), 27: ("Alabama Mid", "almd"),
    28: ("Alabama South", "alsd"), 29: ("Florida North", "flnd"), 30: ("Florida Mid", "flmd"),
    31: ("Florida South", "flsd"), 32: ("Georgia North", "gand"), 33: ("Georgia Mid", "gamd"),
    34: ("Georgia South", "gasd"), 35: ("Louisiana East", "laed"), 36: ("Louisiana West", "lawd"),
    37: ("Mississippi North", "msnd"), 38: ("Mississippi South", "mssd"), 39: ("Texas North", "txnd"),
    40: ("Texas East", "txed"), 41: ("Texas South", "txsd"), 42: ("Texas West", "txwd"),
    43: ("Kentucky East", "kyed"), 44: ("Kentucky West", "kywd"), 45: ("Michigan East", "mied"),
    46: ("Michigan West", "miwd"), 47: ("Ohio North", "ohnd"), 48: ("Ohio South", "ohsd"),
    49: ("Tennessee East", "tned"), 50: ("Tennessee Mid", "tnmd"), 51: ("Tennessee West", "tnwd"),
    52: ("Illinois North", "ilnd"), 53: ("Illinois Cent", "ilcd"), 54: ("Illinois South", "ilsd"),
    55: ("Indiana North", "innd"), 56: ("Indiana South", "insd"), 57: ("Wisconsin East", "wied"),
    58: ("Wisconsin West", "wiwd"), 60: ("Arkansas East", "ared"), 61: ("Arkansas West", "arwd"),
    62: ("Iowa North", "iand"), 63: ("Iowa South", "iasd"), 64: ("Minnesota", "mnd"),
    65: ("Missouri East", "moed"), 66: ("Missouri West", "mowd"), 67: ("Nebraska", "ned"),
    68: ("North Dakota", "ndd"), 69: ("South Dakota", "sdd"), 70: ("Arizona", "azd"),
    71: ("California North", "cand"), 72: ("California East", "caed"),
    73: ("California Central", "cacd"), 74: ("California South", "casd"), 75: ("Hawaii", "hid"),
    76: ("Idaho", "idd"), 77: ("Montana", "mtd"), 78: ("Nevada", "nvd"), 79: ("Oregon", "ord"),
    80: ("Washington East", "waed"), 81: ("Washington West", "wawd"), 82: ("Colorado", "cod"),
    83: ("Kansas", "ksd"), 84: ("New Mexico", "nmd"), 85: ("Oklahoma North", "oknd"),
    86: ("Oklahoma East", "oked"), 87: ("Oklahoma West", "okwd"), 88: ("Utah", "utd"),
    89: ("Wyoming", "wyd"), 90: ("Dist of Columbia", "dcd"), 91: ("Virgin Islands", "vid"),
    93: ("Guam", "gud"), 94: ("N Mariana Islands", "nmid"), 95: ("Alaska", "akd"),
    96: ("Louisiana Middle", "lamd"),
}
CODE_TO_ID: dict[int, str] = {k: v[1] for k, v in USSC_DISTRICT.items()}
ID_TO_CODE: dict[str, int] = {v: k for k, v in CODE_TO_ID.items()}

_DIR_WORDS = {
    "north": "Northern", "northern": "Northern", "south": "Southern", "southern": "Southern",
    "east": "Eastern", "eastern": "Eastern", "west": "Western", "western": "Western",
    "mid": "Middle", "middle": "Middle", "cent": "Central", "central": "Central",
}
_STATE_ALIASES = {"penn.": "Pennsylvania", "n carolina": "North Carolina", "w virginia": "West Virginia",
                  "dist of columbia": "District of Columbia", "n mariana islands": "Northern Mariana Islands",
                  "virgin islands": "U.S. Virgin Islands"}
_NAME_TO_POSTAL = {name.lower(): postal for postal, (name, _f) in STATES.items()}


def district_from_label(label: str) -> str:
    """Resolve a codebook-style label ("Penn. East", "Illinois Cent", "Guam") to a district id.

    Used by the tests to check the hand-typed crosswalk against the codebook text
    independently of the table above.
    """
    words = label.strip().split()
    direction = None
    if words and words[-1].lower() in _DIR_WORDS:
        direction = _DIR_WORDS[words[-1].lower()]
        words = words[:-1]
    state = " ".join(words)
    state = _STATE_ALIASES.get(state.lower(), state)
    postal = _NAME_TO_POSTAL.get(state.lower())
    if postal is None:
        raise KeyError(f"unknown state in label {label!r}")
    cands = [d for d in DISTRICTS if d.state == postal]
    if direction is None:
        if len(cands) != 1:
            raise KeyError(f"{label!r}: state has {len(cands)} districts but no direction given")
        return cands[0].id
    for d in cands:
        if d.name.startswith(direction + " District"):
            return d.id
    raise KeyError(f"no {direction} district in {state}")


# ---- Statistical Information Packet helpers ---------------------------------------------

_PACKET_DIR = {"n": "Northern", "s": "Southern", "e": "Eastern", "w": "Western", "m": "Middle", "c": "Central"}


def packet_code_to_district(code: str) -> str | None:
    """Map a packet file stem without the year (``vae``, ``az``, ``mp``) to a district id.

    Returns None for state-level packets of multi-district states (``va``) and for circuits.
    """
    code = code.lower()
    if code == "mp":
        return "nmid"
    postal = code[:2].upper()
    if postal not in STATES:
        return None
    cands = [d for d in DISTRICTS if d.state == postal]
    if len(code) == 2:
        return cands[0].id if len(cands) == 1 else None
    if len(code) == 3 and code[2] in _PACKET_DIR:
        word = _PACKET_DIR[code[2]]
        for d in cands:
            if d.name.startswith(word + " District"):
                return d.id
    return None


def district_packet_code(district_id: str) -> str:
    """Inverse of :func:`packet_code_to_district` (``vaed`` -> ``vae``, ``azd`` -> ``az``)."""
    d = BY_ID[district_id]
    if district_id == "nmid":
        return "mp"
    cands = [x for x in DISTRICTS if x.state == d.state]
    if len(cands) == 1:
        return d.state.lower()
    word = d.name.split()[0]
    letter = {v: k for k, v in _PACKET_DIR.items()}[word]
    return d.state.lower() + letter


def _letters(s: str) -> str:
    # pdftotext sometimes splits words after an "l" glyph ("Rhode Isl and"); compare letters only
    return re.sub(r"[^a-z]", "", s.lower())


_TABLE_NAMES: dict[str, str] = {}
for _d in DISTRICTS:
    _TABLE_NAMES[_letters(_d.state_name)] = _d.state
_TABLE_NAMES[_letters("Virgin Islands")] = "VI"
_TABLE_NAMES[_letters("Northern Mariana Islands")] = "MP"
_TABLE_NAMES[_letters("N. Mariana Islands")] = "MP"
_TABLE_NAMES[_letters("Mariana Islands")] = "MP"
_TABLE_NAMES[_letters("North Mariana Islands")] = "MP"
_TABLE_NAMES[_letters("District of Columbia")] = "DC"


def table_state(label: str) -> str | None:
    """Postal code if ``label`` is a state/territory row label in a packet table, else None."""
    return _TABLE_NAMES.get(_letters(label))


def table_district(state_postal: str, sub_label: str | None) -> str | None:
    """District id for a packet table row: state label plus optional indented direction label."""
    cands = [d for d in DISTRICTS if d.state == state_postal]
    if not sub_label:
        return cands[0].id if len(cands) == 1 else None
    word = _DIR_WORDS.get(_letters(sub_label))
    if not word:
        return None
    for d in cands:
        if d.name.startswith(word + " District"):
            return d.id
    return None


def direction_word(label: str) -> str | None:
    return _DIR_WORDS.get(_letters(label))


_HEADER_DIR = re.compile(r"(north|south|east|west|mid|cent)")
_HEADER_DIR_WORD = {"north": "Northern", "south": "Southern", "east": "Eastern", "west": "Western", "mid": "Middle",
                    "cent": "Central"}


def district_from_header(header: str) -> str | None:
    """Resolve the district named in a packet table's column header to an id, or None.

    FY1995-FY2001 district packets print the columns as 'National | <district>', with the
    district spelled in several ways across years: "Louisiana, Middle", "Middle Louisiana",
    "Mississippi South", "Eastern Michigan", "Guam", "Northern Mariana Island". A header naming
    only a multi-district state ("Georgia", "State of California") resolves to None.
    """
    s = _letters(re.sub(r"\bNational\b", " ", header))
    if "mariana" in s:
        return "nmid"
    keys = sorted((k for k in _TABLE_NAMES if k in s), key=len, reverse=True)
    if not keys:
        return None
    rest = s.replace(keys[0], " ", 1)        # "northcarolina" must not supply the direction
    m = _HEADER_DIR.search(rest)
    return table_district(_TABLE_NAMES[keys[0]], _HEADER_DIR_WORD[m.group(1)] if m else None)


def district_from_prose(name: str) -> str | None:
    """Resolve a district named in packet note prose ("District of Alabama, Northern",
    "Eastern District of Virginia", "District of the Northern Mariana Islands") to an id.
    Returns None when the text does not identify exactly one district (e.g. typos)."""
    n = re.sub(r"\s+", " ", name).lower()
    hits = []
    for d in DISTRICTS:
        sname = d.state_name.lower()
        if d.state == "VI":
            ok = "virgin islands" in n
        elif d.state == "MP":
            ok = "mariana" in n
        elif d.state == "DC":
            ok = "columbia" in n
        elif d.state == "VA":
            ok = "virginia" in n and "west virginia" not in n
        else:
            ok = sname in n
        if ok:
            hits.append(d)
    dirs = [w for w in ("northern", "southern", "eastern", "western", "middle", "central") if w in n
            and not (w == "northern" and "northern mariana" in n)]
    if dirs:
        hits = [h for h in hits if h.name.lower().startswith(dirs[0])]
    else:
        hits = [h for h in hits if sum(1 for x in DISTRICTS if x.state == h.state) == 1]
    return hits[0].id if len(hits) == 1 else None
