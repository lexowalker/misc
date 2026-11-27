"""Parse the official USLM XML of 28 U.S.C. §§ 81-131 and the territorial-court sections of title 48.

Output: one ``Unit`` per district, or per statutory division where the statute divides a district. Each unit
keeps the raw sentence text it came from, the county-type items the statute lists (as written), and the
places of holding court. Special geographic clauses (Yellowstone, Fort Bragg/Camp Mackall, FCI Butner,
New York concurrent waters, Tennessee River waters, Hawaii's outlying islands, Virginia's city rule) are
recorded as ``specials``; ``geography.py`` and ``assign.py`` decide what to do with each one.

Every non-mechanical reading of the text (a missing comma, a typo) is listed in ``TEXT_FIXES`` /
``PLACE_FIXES`` with a reason, and ``parse_*`` fails loudly on anything it does not recognise.
"""
from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field, asdict

from lxml import etree

from pipeline.common.districts import BY_ID, STATES, by_state

NS = {"u": "http://xml.house.gov/schemas/uslm/1.0"}
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
         "ten": 10, "eleven": 11, "3": 3}
NAME_TO_POSTAL = {v[0]: k for k, v in STATES.items()}

# Names that legitimately contain " and " (so a 2-item list split must not break them).
AND_NAMES = {"King and Queen", "Lake and Peninsula"}

# County-list readings that are not mechanical. key: (section, token as split from the text)
TEXT_FIXES: dict[tuple[str, str], tuple[list[str], str]] = {
    ("116", "Le Flore Love"): (["Le Flore", "Love"],
                               "Comma missing between two county names in the official text ('Le Flore Love'); "
                               "Le Flore (40079) and Love (40085) are both Oklahoma counties that appear nowhere "
                               "else in § 116, and every other Oklahoma county is listed once."),
}

# Where the statute's stated number of divisions differs from the divisions it actually lists.
# key: (section, district_id) -> (stated, listed, explanation)
DIVISION_COUNT_DISCREPANCIES: dict[tuple[str, str], tuple[int, int, str]] = {
    ("124", "txed"): (7, 6, "§ 124(c) still says 'seven divisions' but lists six. The OLRC amendment note records "
                           "that Pub. L. 108-157 (2003) struck former par. (4) (the Paris Division: Delta, Fannin, "
                           "Hopkins, Lamar, Red River), moving those counties to the Sherman and Texarkana "
                           "Divisions, without changing the count. The six listed divisions are used."),
}

# Changes to which district a county (or part of one) belongs to, enacted since 1980, as recorded in the OLRC
# 'Amendments' notes. Each entry quotes the note text it rests on; tests assert the quote is in the notes.
DISTRICT_CHANGES_SINCE_1980: list[dict] = [
    {"section": "113", "year": 1980, "law": "Pub. L. 96-462", "from": "ncmd", "to": "nced",
     "what": "the portion of Durham County encompassing FCI Butner",
     "quote": "added that portion of Durham County encompassing the Federal Correctional Institution, Butner, "
              "North Carolina to the Eastern District"},
    {"section": "113", "year": 1980, "law": "Pub. L. 96-462", "from": "ncmd", "to": "ncwd",
     "what": "Alleghany, Ashe, Watauga and Wilkes counties",
     "quote": "added Alleghany, Ashe, Watauga, and Wilkes counties to the Western District"},
    {"section": "129", "year": 1983, "law": "Pub. L. 97-471", "from": "wvnd", "to": "wvsd",
     "what": "Wirt and Wood counties",
     "quote": "inserted references to Parkersburg, Wirt, and Wood counties"},
    {"section": "129", "year": 1983, "law": "Pub. L. 97-471", "from": "wvsd", "to": "wvnd",
     "what": "Braxton, Pocahontas and Webster counties",
     "quote": "inserted references to Braxton, Pocahontas, and Webster counties"},
    {"section": "89", "year": 1988, "law": "Pub. L. 100-702", "from": "flsd", "to": "flmd",
     "what": "Collier, Glades and Hendry counties",
     "quote": "added Collier, Glades, and Hendry to the counties comprising the Middle District"},
    {"section": "127", "year": 1991, "law": "Pub. L. 102-200", "from": "vaed", "to": "vawd",
     "what": "Culpeper, Louisa and Orange counties (and, by § 127(c), no city)",
     "quote": "inserted reference to Culpeper, Louisa, and Orange counties"},
    {"section": "118", "year": 1998, "law": "Pub. L. 105-277", "from": "paed", "to": "pamd",
     "what": "Schuylkill County",
     "quote": "substituted “and Philadelphia” for “Philadelphia, and Schuylkill”"},
    {"section": "113", "year": 2021, "law": "Pub. L. 117-26", "from": "ncmd", "to": "nced",
     "what": "the portions of Hoke, Moore, Scotland and Richmond counties encompassing Fort Bragg and Camp Mackall",
     "quote": "substituted “Wilson, those portions of Hoke, Moore, Scotland, and Richmond counties encompassing the "
              "Fort Bragg Military Reservation and Camp Mackall, and” for “and Wilson and”"},
]
# Amendments that replaced whole subsections without quoting the earlier county lists, so a move between
# districts can be neither confirmed nor ruled out from this source.
UNVERIFIABLE_REWRITES: list[dict] = [
    {"section": "104", "years": [2012, 2013], "laws": "Pub. L. 112-188; Pub. L. 113-61",
     "note": "§ 104(a) and (b) (N.D. and S.D. Miss.) were replaced wholesale; the notes do not quote the former "
             "county lists."},
]

# Place-of-holding-court readings that need a rule. key: (section, exact remainder after 'held at')
# value: list of (place, place_kind, note)
PLACE_FIXES: dict[tuple[str, str], list[tuple[str, str, str]]] = {
    ("84", "a suitable site in the city of Riverside, the city of San Bernardino, or not more than 5 miles from "
           "the boundary of either such city"): [
        ("Riverside", "city", "Statute: 'a suitable site in the city of Riverside, the city of San Bernardino, or "
                              "not more than 5 miles from the boundary of either such city'."),
        ("San Bernardino", "city", "Same clause as Riverside.")],
    ("100", "a suitable site in Montgomery or Prince George’s County not more than five miles from the boundary "
            "of Montgomery and Prince George’s Counties"): [
        ("Montgomery County or Prince George's County (site within five miles of their common boundary)",
         "described_site", "The statute names no city for the Southern Division of D. Md.")],
    ("112", "New York, White Plains, and in the Middletown-Wallkill area of Orange County or such nearby location "
            "as may be deemed appropriate"): [
        ("New York", "city", ""), ("White Plains", "city", ""),
        ("Middletown-Wallkill area of Orange County", "described_site",
         "Statute: 'in the Middletown-Wallkill area of Orange County or such nearby location as may be deemed "
         "appropriate'.")],
    ("112", "Brooklyn, Hauppauge, Hempstead (including the village of Uniondale), and Central Islip"): [
        ("Brooklyn", "city", ""), ("Hauppauge", "city", ""),
        ("Hempstead", "city", "Statute: 'Hempstead (including the village of Uniondale)'."),
        ("Central Islip", "city", "")],
    ("115", "Columbus St. Clairsville, and Steubenville"): [
        ("Columbus", "city", "OLRC footnote: 'So in original. Probably should be followed by a comma.'"),
        ("St. Clairsville", "city", "See Columbus."), ("Steubenville", "city", "")],
    ("117", "Coquille, Eugene or Springfield, Klamath Falls, Medford, Pendleton, and Portland"): [
        ("Coquille", "city", ""),
        ("Eugene", "city", "Statute: 'Eugene or Springfield' (alternatives)."),
        ("Springfield", "city", "Statute: 'Eugene or Springfield' (alternatives)."),
        ("Klamath Falls", "city", ""), ("Medford", "city", ""), ("Pendleton", "city", ""), ("Portland", "city", "")],
    ("93", "Champaign/Urbana, Danville, Peoria, Quincy, Rock Island, and Springfield"): [
        ("Champaign", "city", "Statute: 'Champaign/Urbana'."), ("Urbana", "city", "Statute: 'Champaign/Urbana'."),
        ("Danville", "city", ""), ("Peoria", "city", ""), ("Quincy", "city", ""), ("Rock Island", "city", ""),
        ("Springfield", "city", "")],
    ("124", "Midland. Court may be held, in the discretion of the court, in Odessa, when courtroom facilities are "
            "made available at no expense to the Government"): [
        ("Midland", "city", ""),
        ("Odessa", "discretionary", "Statute: court 'may be held, in the discretion of the court, in Odessa, when "
                                    "courtroom facilities are made available at no expense to the Government'.")],
    ("124", "Texarkana, and may be held anywhere within the Federal courthouse in Texarkana that is located astride "
            "the State line between Texas and Arkansas"): [
        ("Texarkana", "city", "Statute: court may be held anywhere within the Federal courthouse in Texarkana that "
                              "is located astride the State line between Texas and Arkansas.")],
    ("83", "Texarkana, and may be held anywhere within the Federal courthouse in Texarkana that is located astride "
           "the State line between Texas and Arkansas"): [
        ("Texarkana", "city", "Statute: court may be held anywhere within the Federal courthouse in Texarkana that "
                              "is located astride the State line between Texas and Arkansas.")],
    ("116", "Ada, Ardmore, Durant, Hugo, Muskogee, Okmulgee, Poteau, and S. McAlester"): [
        ("Ada", "city", ""), ("Ardmore", "city", ""), ("Durant", "city", ""), ("Hugo", "city", ""),
        ("Muskogee", "city", ""), ("Okmulgee", "city", ""), ("Poteau", "city", ""),
        ("S. McAlester", "city", "Written 'S. McAlester' in the statute (South McAlester). Geocoders will not "
                                 "find that name; treating it as present-day McAlester is an interpretation "
                                 "(unverified here) left to the courthouses lane.")],
}


@dataclass
class Item:
    name: str               # as written in the statute (after TEXT_FIXES)
    kind: str               # county | parish | city
    partial: str = ""       # "" = whole; otherwise the statutory description of the portion included
    note: str = ""


@dataclass
class Place:
    place: str
    place_kind: str          # city | described_site | discretionary
    statute_text: str        # remainder of the court sentence as written
    note: str = ""


@dataclass
class Unit:
    section: str             # "81"
    title: int               # 28 or 48
    state: str               # postal
    district_id: str
    division: str = ""       # "" when the statute names no division
    division_ordinal: int | None = None
    county_sentence: str = ""
    court_sentence: str = ""
    whole_state: bool = False   # unit covers every county-equivalent of the state (single district, no list)
    items: list[Item] = field(default_factory=list)
    excluded_portions: list[dict] = field(default_factory=list)   # [{county, description}]
    places: list[Place] = field(default_factory=list)
    footnotes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SectionText:
    section: str
    title: int
    heading: str
    state: str
    lines: list[str]
    footnotes: list[str]
    source_credit: str
    amendments: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------------------------------------
# XML -> lines

def _load_tree(zip_path, member: str):
    with zipfile.ZipFile(zip_path) as z:
        with z.open(member) as f:
            return etree.parse(f)


def _amendment_notes(sec) -> list[dict]:
    """All paragraphs of the OLRC 'Amendments' note, each tagged with the year heading it falls under."""
    out, year = [], None
    for note in sec.iter("{%s}note" % NS["u"]):
        if note.get("topic") != "amendments":
            continue
        for p in note.findall("u:p", NS):
            txt = " ".join("".join(p.itertext()).split())
            m = re.match(r"^(\d{4})—", txt)
            if m:
                year = int(m.group(1))
            out.append({"year": year, "text": txt})
    return out


def _section_lines(sec) -> tuple[list[str], list[str], str]:
    """Flatten one <section> into text lines (one per <p>/<chapeau>/<paragraph>), minus notes/footnotes."""
    sec = etree.fromstring(etree.tostring(sec))  # private copy
    credit = ""
    for el in list(sec.iter("{%s}sourceCredit" % NS["u"])):
        credit = " ".join("".join(el.itertext()).split())
        el.getparent().remove(el)
    for el in list(sec.iter("{%s}notes" % NS["u"])):
        el.getparent().remove(el)
    footnotes = []
    for el in list(sec.iter("{%s}note" % NS["u"])):
        if el.get("type") == "footnote":
            footnotes.append(" ".join("".join(el.itertext()).split()))
            _drop_keep_tail(el)
    for el in list(sec.iter("{%s}ref" % NS["u"])):
        if el.get("class") == "footnoteRef":
            _drop_keep_tail(el)
    for tag in ("num", "heading"):
        el = sec.find("u:%s" % tag, NS)
        if el is not None:
            _drop_keep_tail(el)
    for el in sec.iter():
        if not isinstance(el.tag, str):
            continue
        local = etree.QName(el).localname
        if local in ("p", "chapeau", "paragraph", "subsection", "continuation"):
            el.text = "\n" + (el.text or "")
            el.tail = "\n" + (el.tail or "")
        elif local == "heading":     # subsection headings run into text; keep them separated
            el.tail = " " + (el.tail or "")
    text = "".join(sec.itertext())
    lines = [" ".join(l.split()) for l in text.split("\n")]
    return [l for l in lines if l], footnotes, credit


def _drop_keep_tail(el) -> None:
    parent = el.getparent()
    tail = el.tail or ""
    prev = el.getprevious()
    if prev is not None:
        prev.tail = (prev.tail or "") + tail
    else:
        parent.text = (parent.text or "") + tail
    parent.remove(el)


def load_sections(usc28_zip, usc48_zip) -> list[SectionText]:
    out = []
    t28 = _load_tree(usc28_zip, "usc28.xml").getroot()
    for n in ["81", "81A"] + [str(i) for i in range(82, 132)]:   # § 81A is Alaska
        secs = t28.xpath(f'//u:section[@identifier="/us/usc/t28/s{n}"]', namespaces=NS)
        if len(secs) != 1:
            raise ValueError(f"28 U.S.C. § {n}: expected exactly one section, found {len(secs)}")
        sec = secs[0]
        if sec.get("status") not in (None, ""):
            raise ValueError(f"28 U.S.C. § {n} has status={sec.get('status')}")
        heading = " ".join("".join(sec.find("u:heading", NS).itertext()).split())
        state = NAME_TO_POSTAL[heading]
        lines, fns, credit = _section_lines(sec)
        out.append(SectionText(str(n), 28, heading, state, lines, fns, credit, _amendment_notes(sec)))
    t48 = _load_tree(usc48_zip, "usc48.xml").getroot()
    for n, st in (("1424", "GU"), ("1611", "VI"), ("1615", "VI"), ("1821", "MP")):
        sec = t48.xpath(f'//u:section[@identifier="/us/usc/t48/s{n}"]', namespaces=NS)[0]
        heading = " ".join("".join(sec.find("u:heading", NS).itertext()).split())
        lines, fns, credit = _section_lines(sec)
        out.append(SectionText(n, 48, heading, st, lines, fns, credit))
    return out


# ---------------------------------------------------------------------------------------------------------
# list parsing

def split_list(s: str) -> list[str]:
    """Split 'A, B, C, and D' / 'A and B' / 'A' into names (keeps names such as 'King and Queen')."""
    s = s.strip().rstrip(".").strip()
    parts = [p.strip() for p in s.split(",")] if "," in s else [s]
    out = []
    for p in parts:
        if p.startswith("and "):
            p = p[4:].strip()
        if p:
            out.append(p)
    if len(out) == 1 and " and " in out[0] and out[0] not in AND_NAMES:
        out = [x.strip() for x in out[0].split(" and ")]
    if len(out) > 1:   # last element of an Oxford-comma-less list: 'A, B and C'
        last = out[-1]
        if " and " in last and last not in AND_NAMES:
            out = out[:-1] + [x.strip() for x in last.split(" and ")]
    return out


def parse_county_list(rest: str, section: str) -> tuple[list[Item], list[dict], list[dict]]:
    """Parse the text after 'comprises'. Returns (items, excluded_portions, specials)."""
    s = rest.strip().rstrip(".").strip()
    specials: list[dict] = []
    excluded: list[dict] = []
    items: list[Item] = []

    m = re.search(r"\s+and concurrently with the (\w+) District, (the waters within .+)$", s)
    if m:
        specials.append({"type": "concurrent_waters", "text": m.group(0).strip(),
                         "concurrent_with": m.group(1), "description": m.group(2)})
        s = s[:m.start()]

    m = re.search(r",\s*and that portion of ([A-Z][\w ]+?) County encompassing (.+)$", s)
    if m:
        items.append(Item(m.group(1), "county", partial=f"that portion of {m.group(1)} County encompassing "
                                                           f"{m.group(2)}"))
        specials.append({"type": "partial_county_inclusion", "text": m.group(0).lstrip(", ").strip(),
                         "counties": [m.group(1)], "area": m.group(2)})
        s = s[:m.start()]
    m = re.search(r",\s*those portions of (.+?) counties encompassing (.+)$", s)
    if m:
        names = split_list(m.group(1))
        for nm in names:
            items.append(Item(nm, "county", partial=f"that portion of {nm} County encompassing {m.group(2)}"))
        specials.append({"type": "partial_county_inclusion", "text": m.group(0).lstrip(", ").strip(),
                         "counties": names, "area": m.group(2)})
        s = s[:m.start()]

    for m in re.finditer(r"([A-Z][\w’' ]*?) \((excluding ([^()]*))\)", s):
        excluded.append({"county": m.group(1).strip(), "description": m.group(3).strip()})
    s = re.sub(r"\s*\(excluding [^()]*\)", "", s)

    city = None
    m = re.search(r",?\s*and the [Cc]ity of ([A-Z][\w ]+)$", s)
    if m:
        city = m.group(1).strip()
        s = s[:m.start()]

    m = re.match(r"^the (counties|Counties|parishes|county|parish) of (.+)$", s)
    if m:
        kind = "parish" if m.group(1).lower().startswith("parish") else "county"
        body = m.group(2)
    else:
        m = re.match(r"^([A-Z][\w ]+) County$", s)
        if not m:
            raise ValueError(f"§ {section}: unrecognised county list: {rest!r}")
        kind, body = "county", m.group(1)

    whole = []
    for tok in split_list(body):
        fix = TEXT_FIXES.get((section, tok))
        if fix:
            for nm in fix[0]:
                whole.append(Item(nm, kind, note=fix[1]))
        else:
            if not re.fullmatch(r"[A-Z][A-Za-z’'.\- ]+", tok) or len(tok.split()) > 5:
                raise ValueError(f"§ {section}: suspicious county token {tok!r} in {rest!r}")
            whole.append(Item(tok, kind))
    if city:
        whole.append(Item(city, "city"))
    return whole + items, excluded, specials


def parse_places(rest: str, section: str) -> list[Place]:
    text = rest.strip()
    if text.endswith(".."):
        text = text[:-1]
    text = text.rstrip(".").strip()
    fix = PLACE_FIXES.get((section, text))
    if fix:
        return [Place(p, k, text, n) for p, k, n in fix]
    out = []
    seen = set()
    for tok in split_list(text):
        if len(tok.split()) > 4 or re.search(r"suitable|may be|area|discretion|\(|\)", tok):
            raise ValueError(f"§ {section}: place token needs an explicit rule: {tok!r} in {rest!r}")
        if tok in seen:   # e.g. 'Plattsburgh' appears twice in § 112(a) (OLRC: 'So in original')
            continue
        seen.add(tok)
        out.append(Place(tok, "city", text))
    return out


# ---------------------------------------------------------------------------------------------------------
# section -> units

_RE_DIST_LIST = re.compile(r"^\((?P<letter>[a-z])\)\s*(?:(?:\w+) District\.—)?The (?P<word>\w+) [Dd]istrict "
                           r"comprises (?P<rest>.+)$")
_RE_DIV_LIST = re.compile(r"^\((?P<num>\d+)\)\s*The (?P<div>[\w\- ]+? [Dd]ivision) comprises (?P<rest>.+)$")
_RE_COURT = re.compile(r"^Court (?:for (?:the )?(?P<unit>[\w\- ]+? (?:Division|District)) )?"
                       r"(?:shall|will|is to) be held (?:at|on) (?P<rest>.+)$")
_RE_NDIV = re.compile(r"^(?P<n>\w+) divisions\.?$")


def _district_for(state: str, word: str | None) -> str:
    ds = by_state(state)
    if len(ds) == 1:
        return ds[0].id
    word = (word or "").capitalize()
    hits = [d for d in ds if d.name.startswith(word + " ")]
    if len(hits) != 1:
        raise ValueError(f"cannot resolve district {word!r} in {state}")
    return hits[0].id


def _title_div(div: str) -> str:
    return " ".join(w.capitalize() if w.islower() else w for w in div.split())


def parse_title28(sec: SectionText) -> tuple[list[Unit], list[dict], dict]:
    """Return (units, specials, meta) for one of §§ 81-131."""
    st = sec.state
    units: list[Unit] = []
    specials: list[dict] = []
    lines = list(sec.lines)
    first = lines[0]
    meta = {"section": sec.section, "state": st, "heading": sec.heading, "intro_sentence": first,
            "source_credit": sec.source_credit, "footnotes": sec.footnotes, "other_sentences": [],
            "amendment_notes": sec.amendments}

    ndist = len(by_state(st))
    m = re.match(r"^(?P<who>.+?) is divided into (?P<n>\w+) judicial districts", first)
    if m:
        if WORDS[m.group("n")] != ndist:
            raise ValueError(f"§ {sec.section}: statute says {m.group('n')} districts, registry has {ndist}")
    else:
        m = re.match(r"^(?P<who>.+?) constitutes? one judicial district(?P<tail>.*)$", first)
        if not m or ndist != 1:
            raise ValueError(f"§ {sec.section}: unrecognised intro sentence {first!r}")
        who, tail = m.group("who"), m.group("tail")
        if "Yellowstone" in who or "Yellowstone" in tail:
            specials.append({"type": "yellowstone", "section": sec.section, "text": first,
                             "effect": "include_mt_id_portions" if st == "WY" else "exclude_park"})
        if "includes the Midway Islands" in tail:
            specials.append({"type": "outlying_islands", "section": sec.section, "text": first,
                             "islands": split_list(re.search(r"includes the (.+?):", tail).group(1))})

    cur_district = by_state(st)[0].id if ndist == 1 else None
    cur_unit: Unit | None = None
    expected_divs: dict[str, int] = {}
    m = re.search(r"comprising (\w+) divisions", first)
    if m:
        expected_divs[cur_district] = WORDS[m.group(1)]

    for line in lines[1:]:
        if re.fullmatch(r"(Northern|Southern|Eastern|Western|Middle|Central) District", line):
            cur_district = _district_for(st, line.split()[0])
            cur_unit = None
            continue
        m = _RE_DIST_LIST.match(line)
        if m:
            cur_district = _district_for(st, m.group("word"))
            rest = m.group("rest")
            mn = _RE_NDIV.match(rest)
            if mn:
                expected_divs[cur_district] = WORDS[mn.group("n")]
                cur_unit = None
                continue
            items, excl, sp = parse_county_list(rest, sec.section)
            cur_unit = Unit(sec.section, 28, st, cur_district, county_sentence=line, items=items,
                            excluded_portions=excl)
            for s in sp:
                s.update(section=sec.section, district_id=cur_district)
            specials.extend(sp)
            units.append(cur_unit)
            continue
        m = _RE_DIV_LIST.match(line)
        if m:
            if cur_district is None:
                raise ValueError(f"§ {sec.section}: division before district: {line!r}")
            items, excl, sp = parse_county_list(m.group("rest"), sec.section)
            cur_unit = Unit(sec.section, 28, st, cur_district, division=_title_div(m.group("div")),
                            division_ordinal=int(m.group("num")), county_sentence=line, items=items,
                            excluded_portions=excl)
            for s in sp:
                s.update(section=sec.section, district_id=cur_district)
            specials.extend(sp)
            units.append(cur_unit)
            continue
        m = _RE_COURT.match(line)
        if m:
            named = m.group("unit")
            if cur_unit is None:          # single-district state with no county list
                if cur_district is None or named:
                    raise ValueError(f"§ {sec.section}: court sentence without a unit: {line!r}")
                cur_unit = Unit(sec.section, 28, st, cur_district, whole_state=True)
                units.append(cur_unit)
            if named:
                want = cur_unit.division or BY_ID[cur_unit.district_id].name.split(" District")[0] + " District"
                if _title_div(named).split()[0] != want.split()[0]:
                    raise ValueError(f"§ {sec.section}: court sentence for {named!r} under unit {want!r}")
            if cur_unit.court_sentence:
                raise ValueError(f"§ {sec.section}: two court sentences for one unit: {line!r}")
            cur_unit.court_sentence = line
            cur_unit.places = parse_places(m.group("rest"), sec.section)
            continue
        # anything else: a special clause or an informational sentence
        if line.startswith("The Eastern Division also includes the waters of Tennessee River"):
            specials.append({"type": "river_waters", "section": sec.section, "district_id": cur_district,
                             "division": cur_unit.division if cur_unit else "", "text": line})
        elif line.startswith("(c) Cities and incorporated towns are included"):
            specials.append({"type": "virginia_city_rule", "section": sec.section, "text": line})
        else:
            meta["other_sentences"].append(line)

    # whole-state single-district states (no county list at all)
    if ndist == 1 and not units:
        raise ValueError(f"§ {sec.section}: no court sentence found")
    meta["division_count_discrepancies"] = []
    for d, n in expected_divs.items():
        got = len([u for u in units if u.district_id == d and u.division])
        if got != n:
            known = DIVISION_COUNT_DISCREPANCIES.get((sec.section, d))
            if not known or known[0] != n or known[1] != got:
                raise ValueError(f"§ {sec.section}: {d} should have {n} divisions, parsed {got}")
            meta["division_count_discrepancies"].append(
                {"district_id": d, "stated": n, "listed": got, "explanation": known[2]})
    for u in units:
        if not u.court_sentence:
            raise ValueError(f"§ {sec.section}: unit {u.district_id}/{u.division} has no court sentence")
    # attach OLRC footnotes to the unit whose court sentence they annotate
    if sec.footnotes:
        for u in units:
            if sec.section == "112" and u.district_id == "nynd":
                u.footnotes = [f for f in sec.footnotes if "Plattsburgh" in f]
            if sec.section == "115" and u.district_id == "ohsd" and u.division == "Eastern Division":
                u.footnotes = [f for f in sec.footnotes if "comma" in f]
            if sec.section == "125" and u.division == "Central Division":
                u.footnotes = [f for f in sec.footnotes if "So in original" in f and "comma" not in f]
    if ndist > 1:
        missing = {d.id for d in by_state(st)} - {u.district_id for u in units}
        if missing:
            raise ValueError(f"§ {sec.section}: districts without units: {missing}")
    return units, specials, meta


def parse_title48(secs: dict[str, SectionText]) -> tuple[list[Unit], list[dict], list[dict]]:
    """Territorial courts. GU and MP: whole territory. VI: two statutory divisions (48 U.S.C. § 1615)."""
    units, specials, metas = [], [], []
    gu = secs["1424"]
    sent = next(l for l in gu.lines if "designated as the “District Court of Guam”" in l)
    units.append(Unit("1424", 48, "GU", "gud", county_sentence=sent, whole_state=True,
                      court_sentence="", places=[]))
    metas.append({"section": "48 U.S.C. § 1424", "state": "GU", "heading": gu.heading, "intro_sentence": sent,
                  "source_credit": gu.source_credit,
                  "note": "The statute names no place of holding court for the District Court of Guam."})

    vi = secs["1615"]
    sent = vi.lines[0]
    m = re.match(r"^The Virgin Islands consists of two judicial divisions; the (Division of Saint Croix), comprising "
                 r"(the island of Saint Croix and adjacent islands and cays), and the (Division of Saint Thomas and "
                 r"Saint John), comprising (the islands of Saint Thomas and Saint John and adjacent islands and "
                 r"cays)\.$", sent)
    if not m:
        raise ValueError(f"48 U.S.C. § 1615 text changed: {sent!r}")
    units.append(Unit("1615", 48, "VI", "vid", division=m.group(1), division_ordinal=1, county_sentence=sent,
                      items=[Item("Saint Croix", "island", note=m.group(2))]))
    units.append(Unit("1615", 48, "VI", "vid", division=m.group(3), division_ordinal=2, county_sentence=sent,
                      items=[Item("Saint Thomas", "island", note=m.group(4)),
                             Item("Saint John", "island", note=m.group(4))]))
    s1611 = secs["1611"]
    metas.append({"section": "48 U.S.C. §§ 1611, 1615", "state": "VI", "heading": s1611.heading,
                  "intro_sentence": next(l for l in s1611.lines if "District Court of the Virgin Islands" in l),
                  "source_credit": vi.source_credit,
                  "note": "No place of holding court is named in title 48 for the District Court of the Virgin "
                          "Islands; the two divisions are defined by island (§ 1615)."})

    mp = secs["1821"]
    est = next(l for l in mp.lines if "There is established for and within the Northern Mariana Islands" in l)
    m = re.search(r"Terms of court shall be held on (\w+) and at such other places", est)
    if not m:
        raise ValueError("48 U.S.C. § 1821(a) text changed")
    units.append(Unit("1821", 48, "MP", "nmid", county_sentence=est, whole_state=True, court_sentence=est,
                      places=[Place(m.group(1), "city", m.group(0),
                                    "Statute: 'Terms of court shall be held on Saipan and at such other places "
                                    "and at such times as the court may designate by rule or order.'")]))
    metas.append({"section": "48 U.S.C. § 1821", "state": "MP", "heading": mp.heading, "intro_sentence": est,
                  "source_credit": mp.source_credit})
    return units, specials, metas


def parse_all(usc28_zip, usc48_zip) -> tuple[list[Unit], list[dict], list[dict], list[SectionText]]:
    secs = load_sections(usc28_zip, usc48_zip)
    units, specials, metas = [], [], []
    for s in secs:
        if s.title == 28:
            u, sp, meta = parse_title28(s)
            units += u
            specials += sp
            metas.append(meta)
    u, sp, m48 = parse_title48({s.section: s for s in secs if s.title == 48})
    units += u
    specials += sp
    metas += m48
    got = {u.district_id for u in units}
    if got != set(BY_ID):
        raise ValueError(f"districts missing from parsed statute: {sorted(set(BY_ID) - got)}")
    return units, specials, metas, secs


def lii_text(html_path) -> str:
    """Section text from a Cornell LII page (tab 1), whitespace-collapsed."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(open(html_path, encoding="utf-8", errors="replace").read(), "lxml")
    d = soup.find(id="tab_default_1")
    if d is None:
        raise ValueError(f"no statute text in {html_path}")
    return " ".join(d.get_text(" ", strip=True).split())


def norm_for_compare(s: str) -> str:
    s = s.replace("’", "'").replace("“", '"').replace("”", '"').replace("—", "-")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,.;:)])", r"\1", s)
    s = re.sub(r"\(\s+", "(", s)
    return s.strip()
