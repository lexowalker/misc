"""USSC Statistical Information Packets: discovery, download, and table parsing.

Each fiscal year has one packet (PDF) per district, state and circuit, linked from
``https://www.ussc.gov/research/data-reports/geography/<FY>-federal-sentencing-statistics``.
A district packet holds district-level tables (offense mix, sentence type, sentence
length, sentence relative to the guideline range) next to the national figures, plus
two tables listing *every* district (guilty pleas/trials by circuit and district, and the
departure / guideline-range table by circuit and district).

This lane uses packets only to VALIDATE its datafile computations (and documents the
published values it compared against in ``data/processed/ussc/validation.csv``).
Text is extracted with poppler's ``pdftotext -layout``.
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from bs4 import BeautifulSoup

from pipeline.common.http import fetch

from .crosswalk import direction_word, packet_code_to_district, table_district, table_state

GEO_PAGE = "https://www.ussc.gov/research/data-reports/geography/{fy}-federal-sentencing-statistics"
USSC = "https://www.ussc.gov"

NUM_RE = re.compile(r"^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$")


def discover_packets(fy: int) -> dict[str, str]:
    """{district_id: absolute packet URL} for one fiscal year, from the geography page."""
    page = fetch(GEO_PAGE.format(fy=fy))
    soup = BeautifulSoup(page.text, "lxml")
    out: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        h = a["href"]
        if "state-district-circuit" not in h or not h.lower().endswith(".pdf"):
            continue
        stem = Path(h).stem.lower()
        m = re.match(r"^([a-z]+?)(\d{2})$", stem)
        if not m or int(m.group(2)) != fy % 100:
            continue
        did = packet_code_to_district(m.group(1))
        if did:
            out[did] = h if h.startswith("http") else USSC + h
    return out


def packet_text(path: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, check=True)
    return r.stdout.decode("utf-8", errors="replace")


def num(tok: str) -> float | None:
    if tok in ("--", "-", "—"):
        return None
    return float(tok.replace(",", ""))


def split_numbers(line: str) -> tuple[str, list[str]]:
    """Split a table row into (label, numeric tokens). '--' counts as a numeric token."""
    toks = line.split()
    i = 0
    while i < len(toks) and not (NUM_RE.match(toks[i]) or toks[i] == "--"):
        i += 1
    label = " ".join(toks[:i])
    nums = toks[i:]
    if not all(NUM_RE.match(t) or t == "--" for t in nums):
        # a label word after numbers (rare): treat whole line as label
        return line.strip(), []
    return label, nums


@dataclass
class Table:
    number: int
    period: str            # "full", "pre_blakely", "post_blakely", "pre_booker", "post_booker"
    lines: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(self.lines)


_TABLE_HEAD = re.compile(r"^\s*Table\s+(\d+)\s*(?:\(cont\.?\))?\s*$")


def _period_of(block: list[str]) -> str:
    head = " ".join(block[:12]).lower()
    if "pre-blakely" in head:
        return "pre_blakely"
    if "post-blakely" in head:
        return "post_blakely"
    if "pre-booker" in head:
        return "pre_booker"
    if "post-booker" in head:
        return "post_booker"
    return "full"


def split_tables(text: str) -> list[Table]:
    """Cut packet text into tables at each centred 'Table N' heading line.

    The table-of-contents lines ('Table 1   Distribution ...') are not headings because a
    heading line holds nothing but 'Table N'.
    """
    lines = text.splitlines()
    heads = [(i, int(m.group(1))) for i, ln in enumerate(lines) if (m := _TABLE_HEAD.match(ln))]
    out: list[Table] = []
    for k, (i, n) in enumerate(heads):
        j = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        block = lines[i:j]
        period = _period_of(block)
        cont = "cont" in lines[i].lower()
        if period == "full" and out and out[-1].number == n and (cont or out[-1].period != "full"):
            period = out[-1].period  # continuation page ("Table 8 (cont.)") keeps its section
        out.append(Table(n, period, block))
    return out


def find_table(tables: list[Table], number: int, period: str = "full") -> Table | None:
    """First table with this number and period (tables continued on later pages are merged)."""
    hits = [t for t in tables if t.number == number and t.period == period]
    if not hits:
        return None
    merged = Table(number, period, [])
    for t in hits:
        merged.lines.extend(t.lines)
    return merged


@dataclass
class DistrictRow:
    district_id: str        # registry id, or "US" for the national TOTAL row
    numbers: list[float | None]
    page_header: str        # header words above the row (distinguishes split table halves)


def all_district_rows(table: Table) -> list[DistrictRow]:
    """Rows of a 'by circuit and district' table, resolved to district ids.

    Handles state header lines ('New York') followed by indented direction rows
    ('  Eastern  604 ...'), single-district states ('Maine 144 ...'), circuit rows
    (skipped) and the national TOTAL row (id 'US').
    """
    rows: list[DistrictRow] = []
    state: str | None = None
    header: list[str] = []
    for ln in table.lines:
        if not ln.strip():
            continue
        label, toks = split_numbers(ln)
        low = label.lower()
        if not toks:
            st = table_state(label)
            if st:
                state = st
                continue
            if label and not re.match(r"^\d+$", label):
                if "circuit" in low and "district" not in low and len(label) < 40:
                    continue
                # header / footnote text: header words accumulate until data rows begin
                header.append(label)
            continue
        nums = [num(t) for t in toks]
        if low.startswith("total"):
            rows.append(DistrictRow("US", nums, " ".join(header[-6:])))
            continue
        if "circuit" in low:
            state = None
            continue
        st = table_state(label)
        if st:
            did = table_district(st, None)
            if did:
                rows.append(DistrictRow(did, nums, " ".join(header[-6:])))
            state = None if did else st
            continue
        if state and direction_word(label):
            did = table_district(state, label)
            if did:
                rows.append(DistrictRow(did, nums, " ".join(header[-6:])))
            continue
        # a page number or footnote line with numbers: ignore
    return rows


def labelled_rows(table: Table) -> list[tuple[str, list[float | None]]]:
    """(label, numbers) for every row of a district-level table. A row whose numbers sit on the
    following line (footnote marker wrap) is joined with that line."""
    out: list[tuple[str, list[float | None]]] = []
    pending: str | None = None
    for ln in table.lines:
        if not ln.strip():
            continue
        label, toks = split_numbers(ln)
        if label and len(toks) <= 1 and not out_is_numeric_only(label):
            # label alone (possibly with a footnote digit): numbers may follow on the next line
            pending = label
            continue
        if not label and pending and len(toks) >= 2:
            out.append((pending, [num(t) for t in toks]))
            pending = None
            continue
        if label and toks:
            out.append((label, [num(t) for t in toks]))
            pending = None
    return out


def out_is_numeric_only(label: str) -> bool:
    return bool(NUM_RE.match(label))


def norm_label(s: str) -> str:
    """Lower-case letters only, footnote digits stripped ('Upward Departure2' -> 'upwarddeparture')."""
    s = re.sub(r"(?<=[A-Za-z])\d+\b", "", s)
    return re.sub(r"[^a-z0-9§.]", "", s.lower().replace("§", "§"))


def int_from_words(s: str) -> int | None:
    s = s.strip().lower().replace(",", "")
    if s.isdigit():
        return int(s)
    words = {"no": 0, "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
             "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}
    return words.get(s)
