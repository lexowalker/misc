"""Parsers for the AO's FCMS "U.S. District Court — Judicial Caseload Profile" PDFs.

Each September file has 95 pages: one national page ("all district courts") and one page per
district. Every page reports six 12-month periods ending September 30 (the profile year and the
five before it), a "numerical standing" (rank) within the U.S. and within the circuit for the
profile year, and a table of the profile year's filings by nature of suit / offense (letters A-L).

Two layout generations are text-extractable and handled here:

* ``mono`` (FY2004-FY2009, "Elixir"): the numbers are a fixed-width line-printer overlay
  (every glyph is exactly 7.2 pt wide, font size 81) on top of a form drawn in other fonts.
  Columns run newest-to-oldest. Numbers are cut out by fixed character fields; adjacent fields
  can touch (e.g. ``363,774349,969``), which is why pdftotext output is ambiguous.
* ``words`` (FY2010-present; FY2011 is a variant produced from Excel): proportional fonts,
  columns oldest-to-newest. Numbers are right-aligned, so each value is assigned to the column
  whose right edge it shares.

The FY1997-FY2003 files are scanned images with a machine-OCR text layer (decimal points lost,
letters misread) and are deliberately not parsed (see the lane report).

Parsers return raw strings plus parsed numbers; they never fill in or repair a value.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field

import pdfplumber

# ---------------------------------------------------------------------------- tokens

_DASH_CHARS = "­‐‑‒–—−"
_TR = str.maketrans({**{c: "-" for c in _DASH_CHARS}, " ": " "})
_NUM_RE = re.compile(r"^-?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?$")
NA_TOKENS = {"-", "--", "*", "**", "***", "N/A", "NA", "n/a"}


def norm(s: str) -> str:
    return s.translate(_TR)


def is_value_token(tok: str) -> bool:
    t = norm(tok)
    return t in NA_TOKENS or (bool(_NUM_RE.match(t)) and any(ch.isdigit() for ch in t))


def parse_value(tok: str | None) -> float | None:
    """'4,358' -> 4358.0; '.0' -> 0.0; '-15.3' -> -15.3; '-', '**', '' -> None (not published)."""
    if tok is None:
        return None
    t = norm(tok).strip()
    if t == "" or t in NA_TOKENS:
        return None
    if not (_NUM_RE.match(t) and any(ch.isdigit() for ch in t)):
        raise ValueError(f"not a number: {tok!r}")
    return float(t.replace(",", ""))


# ---------------------------------------------------------------------------- row templates
# Rows of the "Overall caseload / Actions per judgeship / Median time / Other" block, top to bottom.
# (row_id, label keyword that must appear near the row, printed label used in source_locator)
_COMMON_HEAD = [
    ("filings_total", "Filings", "Filings"),
    ("terminations_total", "Terminations", "Terminations"),
    ("pending_total", "Pending", "Pending"),
]
_PCT_ONE = [("pct_change", "Earlier Year", "Percent Change in Total Filings ... Over Earlier Year")]
_PCT_TWO = [
    ("pct_change_last", "Last Year", "Percent Change in Total Filings ... Over Last Year"),
    ("pct_change_earlier", "Earlier Years", "Percent Change in Total Filings ... Over Earlier Years"),
]
_COMMON_TAIL = [
    ("judgeships", "Judgeships", "Number of Judgeships"),
    ("vacant_months", "Vacant", "Vacant Judgeship Months"),
    ("pj_total", "Total", "Per Judgeship: Filings Total"),
    ("pj_civil", "Civil", "Per Judgeship: Filings Civil"),
    ("pj_criminal_felony", "Felony", "Per Judgeship: Filings Criminal Felony"),
    ("pj_srh", "Hearings", "Per Judgeship: Supervised Release Hearings"),
    ("pj_pending", "Pending", "Per Judgeship: Pending Cases"),
    ("pj_weighted", "Weighted", "Per Judgeship: Weighted Filings"),
    ("pj_terminations", "Terminations", "Per Judgeship: Terminations"),
    ("pj_trials", "Trials", "Per Judgeship: Trials Completed"),
    ("median_criminal", "Felony", "Median Months Filing to Disposition: Criminal Felony"),
    ("median_civil", "Civil", "Median Months Filing to Disposition: Civil"),
    ("median_civil_trial", "Trial", "Median Months Filing to Trial (Civil Only)"),
    ("over3_count", "Civil Cases", "Civil Cases Over 3 Years Old: Number"),
    ("over3_pct", "3 Years", "Civil Cases Over 3 Years Old: %"),
    ("avg_defendants", "Defendants", "Average Number of Felony Defendants Filed per Case"),
    ("jurors_present", "Jury Selection", "Jurors: Avg. Present for Jury Selection"),
    ("jurors_not_selected", "Challenged", "Jurors: Percent Not Selected or Challenged"),
]
TEMPLATE_ONE_PCT = _COMMON_HEAD + _PCT_ONE + _COMMON_TAIL    # FY2010, FY2012-present
TEMPLATE_TWO_PCT = _COMMON_HEAD + _PCT_TWO + _COMMON_TAIL    # FY2004-FY2009 (mono), FY2011
ROW_LABEL = {r: lab for r, _, lab in TEMPLATE_ONE_PCT + TEMPLATE_TWO_PCT}

LETTERS = list("ABCDEFGHIJKL")


class ParseError(RuntimeError):
    pass


@dataclass
class Page:
    """One parsed profile page."""
    page_no: int                      # 1-based page index in the PDF
    heading: str                      # district heading as printed ("" on some national pages)
    years: list[int]                  # column years, in the order printed
    rows: dict[str, list[str | None]] = field(default_factory=dict)   # row_id -> raw cell per column
    ranks: dict[str, tuple[str | None, str | None]] = field(default_factory=dict)  # row_id -> (U.S., circuit)
    nos: dict[str, dict[str, str | None]] = field(default_factory=dict)  # 'civil'/'criminal' -> {'Total','A'..'L'}
    nos_labels: dict[str, dict[str, str]] = field(default_factory=dict)  # national list layout: kind -> letter -> label
    nos_title: str = ""               # e.g. "2015 Civil Case and Criminal Felony Defendant Filings by ..."
    notes: str = ""                   # footnote text (used to detect the defendant/case counting basis)
    is_national: bool = False


# ---------------------------------------------------------------------------- mono (FY2004-2009)

_MONO_SIZE = 81.0
_MONO_CELL = 7.2
_MONO_MAIN_Y = [663.8, 639.8, 615.8, 591.8, 579.8, 555.8, 543.8, 519.8, 495.8, 471.8, 447.8, 423.8,
                399.8, 375.8, 351.8, 327.8, 303.8, 279.8, 255.8, 243.8, 219.8, 195.8, 171.8]
_MONO_NOS_Y = [75.8, 51.8]
# character-column spans (inclusive) of the six year fields, newest first, then the two rank fields
_MONO_YEAR_FIELDS = [(25 + 7 * i, 31 + 7 * i) for i in range(6)]
_MONO_RANK_FIELDS = [(67, 73), (74, 78)]
_MONO_NOS_FIELDS = [(13, 18)] + [(19 + 5 * i, 23 + 5 * i) for i in range(12)]


def _mono_lines(page) -> dict[float, str]:
    rows: dict[float, dict[int, str]] = defaultdict(dict)
    for c in page.chars:
        if abs(c["size"] - _MONO_SIZE) < 0.5:
            col = round(c["matrix"][4] / _MONO_CELL)
            rows[round(c["matrix"][5], 1)][col] = c["text"]
    return {y: "".join(r.get(i, " ") for i in range(max(r) + 1)) for y, r in rows.items()}


def _field(line: str, span: tuple[int, int]) -> str | None:
    s = line[span[0]: span[1] + 1].strip() if len(line) > span[0] else ""
    if s == "":
        return None
    if not is_value_token(s):
        raise ParseError(f"mono field {span} is not a value: {s!r} in line {line!r}")
    return s


def _check_mono_line(line: str, spans: list[tuple[int, int]]) -> None:
    """Every non-blank character must fall inside one of the known fields."""
    allowed = set()
    for a, b in spans:
        allowed.update(range(a, b + 1))
    for i, ch in enumerate(line):
        if ch.strip() and i not in allowed:
            raise ParseError(f"mono char {ch!r} at column {i} outside known fields: {line!r}")


def parse_mono_page(page, page_no: int) -> Page:
    lines = _mono_lines(page)
    ys = sorted(lines, reverse=True)
    expected = _MONO_MAIN_Y + _MONO_NOS_Y
    have = [y for y in ys if any(abs(y - e) < 0.5 for e in expected)]
    if len(have) != len(expected):
        raise ParseError(f"page {page_no}: mono rows {ys} do not match template")
    # heading: the size-41 overlay holds the district name
    name_chars = sorted((c for c in page.chars if abs(c["size"] - 41.0) < 0.5), key=lambda c: c["x0"])
    heading = re.sub(r"\s+", " ", "".join(c["text"] for c in name_chars)).strip()
    form = page.filter(lambda o: not (o.get("object_type") == "char" and abs(o.get("size", 0) - _MONO_SIZE) < 0.5
                                      or o.get("object_type") == "char" and abs(o.get("size", 0) - 41.0) < 0.5))
    words = form.extract_words(x_tolerance=1.5, y_tolerance=2)
    years = [int(w["text"]) for w in words if re.fullmatch(r"(19|20)\d\d", w["text"]) and w["top"] < 110]
    if len(years) != 6 or years != sorted(years, reverse=True):
        raise ParseError(f"page {page_no}: header years {years}")
    text = " ".join(w["text"] for w in words)
    out = Page(page_no=page_no, heading=heading, years=years,
               is_national=heading.upper() == "ALL DISTRICT COURTS")
    for (row_id, _, _), y in zip(TEMPLATE_TWO_PCT, _MONO_MAIN_Y):
        line = next(lines[k] for k in lines if abs(k - y) < 0.5)
        _check_mono_line(line, _MONO_YEAR_FIELDS + _MONO_RANK_FIELDS)
        out.rows[row_id] = [_field(line, sp) for sp in _MONO_YEAR_FIELDS]
        us, circ = (_field(line, sp) for sp in _MONO_RANK_FIELDS)
        if us is not None or circ is not None:
            out.ranks[row_id] = (us, circ)
    for kind, y in zip(("civil", "criminal"), _MONO_NOS_Y):
        line = next(lines[k] for k in lines if abs(k - y) < 0.5)
        _check_mono_line(line, _MONO_NOS_FIELDS)
        vals = [_field(line, sp) for sp in _MONO_NOS_FIELDS]
        out.nos[kind] = dict(zip(["Total"] + LETTERS, vals))
    m = re.search(r"((?:19|20)\d\d) CIVIL AND CRIMINAL FELONY [A-Z ]*FILINGS BY NATURE OF SUIT AND OFFENSE", text)
    out.nos_title = m.group(0) if m else ""
    out.notes = text
    return out


# ---------------------------------------------------------------------------- words (FY2010+)

def _lines(words, tol=2.5):
    lines: list[list] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0] - w["top"]) < tol:
            lines[-1][1].append(w)
        else:
            lines.append([w["top"], [w]])
    return [(t, sorted(ws, key=lambda w: w["x0"])) for t, ws in lines]


def _cluster(xs: list[float], gap: float = 12.0) -> list[float]:
    xs = sorted(xs)
    groups: list[list[float]] = []
    for x in xs:
        if groups and x - groups[-1][-1] <= gap:
            groups[-1].append(x)
        else:
            groups.append([x])
    return [sorted(g)[len(g) // 2] for g in groups], [len(g) for g in groups]


def parse_words_page(page, page_no: int) -> Page:
    words = [dict(w, text=norm(w["text"])) for w in page.extract_words(x_tolerance=1.5, y_tolerance=2)]
    lines = _lines(words)
    # --- header years
    hdr = None
    for i, (top, ws) in enumerate(lines):
        yrs = [w for w in ws if re.fullmatch(r"(19|20)\d\d", w["text"])]
        if len(yrs) == 6:
            hdr = (i, top, yrs)
            break
    if hdr is None:
        raise ParseError(f"page {page_no}: no header line with six years")
    hdr_i, hdr_top, yrs = hdr
    years = [int(w["text"]) for w in yrs]
    if years != sorted(years):
        raise ParseError(f"page {page_no}: header years not ascending {years}")
    # --- heading (district name): capitals, left part of the page, above the header row
    heading = ""
    for top, ws in lines[: hdr_i + 1]:
        caps = [w["text"] for w in ws if w["x1"] < yrs[0]["x0"] - 20 and re.fullmatch(r"[A-Z][A-Z.'\-]*", w["text"])]
        if caps and " ".join(caps) not in ("U.S.",):
            heading = " ".join(caps)
            break
    full_text = " ".join(w["text"] for _, ws in lines for w in ws)
    is_national = ("National" in full_text[:300]) or heading in ("", "ALL DISTRICT COURTS")
    # --- where the main block ends: the nature-of-suit title line
    nos_i = next((i for i, (t, ws) in enumerate(lines) if i > hdr_i and
                  "Nature" in " ".join(w["text"] for w in ws) and "Suit" in " ".join(w["text"] for w in ws)
                  and "Offense" in " ".join(w["text"] for w in ws)), None)
    if nos_i is None:
        raise ParseError(f"page {page_no}: no nature-of-suit title")
    band_lo = yrs[0]["x0"] - 45
    band_hi = yrs[-1]["x1"] + 22
    # rank header positions ("U.S." and "Circuit"), if any
    us_hdr = next((w for _, ws in lines[: nos_i] for w in ws if w["text"] == "U.S." and w["x0"] > band_hi - 10), None)
    ci_hdr = next((w for _, ws in lines[: nos_i] for w in ws if w["text"] == "Circuit" and w["x0"] > band_hi - 10), None)
    # --- collect numeric rows
    main = lines[hdr_i + 1: nos_i]
    num_rows = []   # (top, data_tokens, rank_tokens, line_index)
    rank_only = []
    for li, (top, ws) in enumerate(main):
        data = [w for w in ws if band_lo <= w["x0"] and w["x1"] <= band_hi and is_value_token(w["text"])]
        ranks = [w for w in ws if w["x0"] > band_hi - 5 and is_value_token(w["text"])]
        if data:
            num_rows.append([top, data, ranks, li])
        elif ranks:
            rank_only.append((top, ranks, li))
    # A rank pair printed a few points off its values line (FY2017-24 criminal median) belongs to the
    # nearest values line; a rank pair with no values line nearby is a row printed blank (e.g. the
    # FY2025 territorial courts' weighted filings) and becomes a row of empty cells.
    for top, ranks, li in rank_only:
        near = min(num_rows, key=lambda r: abs(r[0] - top)) if num_rows else None
        if near is not None and abs(near[0] - top) <= 6 and not near[2]:
            near[2] = ranks
        else:
            num_rows.append([top, [], ranks, li])
    num_rows.sort(key=lambda r: r[0])
    two_pct = any("Last Year" in " ".join(w["text"] for w in ws) for _, ws in main)
    template = TEMPLATE_TWO_PCT if two_pct else TEMPLATE_ONE_PCT
    if len(num_rows) != len(template):
        raise ParseError(f"page {page_no} ({heading}): {len(num_rows)} numeric rows, template has {len(template)}")
    # --- column anchors from right edges of all data tokens
    anchors, sizes = _cluster([w["x1"] for _, d, _, _ in num_rows for w in d])
    if len(anchors) > 6:  # drop stray singletons only if exactly six well-populated columns remain
        big = [a for a, n in zip(anchors, sizes) if n >= 3]
        if len(big) == 6:
            anchors = big
    if len(anchors) != 6:
        raise ParseError(f"page {page_no} ({heading}): {len(anchors)} column anchors {anchors} {sizes}")
    out = Page(page_no=page_no, heading=heading, years=years, is_national=is_national)
    for k, ((row_id, kw, _), (top, data, ranks, li)) in enumerate(zip(template, num_rows)):
        prev_li = num_rows[k - 1][3] if k else -1
        next_li = num_rows[k + 1][3] if k + 1 < len(num_rows) else len(main)
        window = " ".join(w["text"] for _, ws in main[prev_li + 1: next_li] for w in ws
                          if not (w in data or w in ranks))
        if kw.lower() not in window.lower():
            raise ParseError(f"page {page_no} ({heading}): row {row_id} expected label {kw!r}, saw {window!r}")
        cells: list[str | None] = [None] * 6
        for w in data:
            j = min(range(6), key=lambda j: abs(anchors[j] - w["x1"]))
            if abs(anchors[j] - w["x1"]) > 8:
                raise ParseError(f"page {page_no}: token {w['text']} at x1={w['x1']:.1f} far from anchors {anchors}")
            if cells[j] is not None:
                raise ParseError(f"page {page_no}: two tokens in column {j} of row {row_id}")
            cells[j] = w["text"]
        out.rows[row_id] = cells
        if ranks:
            if us_hdr is None or ci_hdr is None:
                raise ParseError(f"page {page_no}: rank values without rank headers")
            us_c = (us_hdr["x0"] + us_hdr["x1"]) / 2
            ci_c = (ci_hdr["x0"] + ci_hdr["x1"]) / 2
            r_us = r_ci = None
            for w in ranks:
                c = (w["x0"] + w["x1"]) / 2
                if abs(c - us_c) <= abs(c - ci_c):
                    r_us = w["text"]
                else:
                    r_ci = w["text"]
            out.ranks[row_id] = (r_us, r_ci)
    # --- nature of suit / offense
    out.nos_title = " ".join(w["text"] for w in lines[nos_i][1])
    tail = lines[nos_i + 1:]
    out.notes = " ".join(w["text"] for _, ws in tail for w in ws)
    hdr_row = next(((t, ws) for t, ws in tail if [w["text"] for w in ws][-12:] == LETTERS), None)
    if hdr_row is not None:
        for t, ws in tail:
            if not ws:
                continue
            first = ws[0]["text"]
            kind = "civil" if first.startswith("Civil") else "criminal" if first.startswith("Criminal") else None
            if kind is None:
                continue
            vals = [w["text"] for w in ws if is_value_token(w["text"]) and w["x0"] > ws[0]["x1"]]
            if len(vals) != 13:
                raise ParseError(f"page {page_no}: {kind} NOS row has {len(vals)} values: {vals}")
            out.nos[kind] = dict(zip(["Total"] + LETTERS, vals))
    else:  # national list layout: "Total Civil 303,563  Total Criminal¹ 72,790" / "A-Social Security 15,641  A-Marijuana 569"
        split_x = None
        for t, ws in tail:
            txt = [w["text"] for w in ws]
            if "Total" in txt and "Civil" in txt:
                crim = [w for w in ws if w["text"] == "Total" and w["x0"] > page.width * 0.35]
                if crim:
                    split_x = crim[0]["x0"] - 2
                break
        if split_x is None:
            raise ParseError(f"page {page_no}: no NOS row layout or list layout found")
        nos = {"civil": {}, "criminal": {}}
        labels = {"civil": {}, "criminal": {}}
        seq = {"civil": 0, "criminal": 0}
        for t, ws in tail:
            for kind, part in (("civil", [w for w in ws if w["x0"] < split_x]),
                               ("criminal", [w for w in ws if w["x0"] >= split_x])):
                if not part or not is_value_token(part[-1]["text"]):
                    continue
                label = " ".join(w["text"] for w in part[:-1]).strip()
                val = part[-1]["text"]
                if label.startswith("Total"):
                    nos[kind]["Total"] = val
                    continue
                if not label or seq[kind] >= 12:
                    continue
                # Lines are printed in letter order A..L. The letter prefix is checked when printed; the
                # FY2021-22 national pages omit it on one line ("Intellectual Property Rights"), which is
                # then identified by its position between H and J.
                letter = LETTERS[seq[kind]]
                m = re.match(r"^([A-L])\s*-\s*(.+)$", label)
                if m:
                    if m.group(1) != letter:
                        raise ParseError(f"page {page_no}: NOS list letter {m.group(1)} where {letter} expected")
                    label = m.group(2).strip()
                else:
                    labels.setdefault("_unprefixed", {})[f"{kind}:{letter}"] = label
                nos[kind][letter] = val
                labels[kind][letter] = label
                seq[kind] += 1
        for kind in nos:
            if set(nos[kind]) != set(["Total"] + LETTERS):
                raise ParseError(f"page {page_no}: national NOS list incomplete for {kind}: {sorted(nos[kind])}")
        out.nos, out.nos_labels = nos, labels
    return out


# ---------------------------------------------------------------------------- file level

def detect_generation(pdf) -> str:
    p = pdf.pages[1]
    if sum(1 for c in p.chars if abs(c["size"] - _MONO_SIZE) < 0.5) > 500:
        return "mono"
    return "words"


def parse_pdf(path) -> tuple[str, list[Page]]:
    with pdfplumber.open(path) as pdf:
        gen = detect_generation(pdf)
        fn = parse_mono_page if gen == "mono" else parse_words_page
        pages = [fn(p, i + 1) for i, p in enumerate(pdf.pages)]
    return gen, pages
