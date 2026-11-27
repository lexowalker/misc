"""AO "Judicial Business of the United States Courts" tables used to reconcile the IDB aggregates.

Discovery: ``https://www.uscourts.gov/data-news/data-tables/<FY>/09/30/judicial-business/<table>`` links one
PDF (FY1997-2016) or a PDF plus an xlsx (FY2017+). The xlsx is preferred when present. Tables used:

* C-1  Civil cases commenced (filed), terminated and pending, by district.           FY1997-2025
* C-4  Civil cases terminated, by action taken (national "during or after trial").     FY1997-2025
* D-1  Criminal defendants commenced, terminated, pending (including transfers), by district.  FY1997-2025
* D-2  Criminal defendants commenced (excluding transfers), by offense; 5 years per table.  FY2005-2025
* D-4  Criminal defendants disposed of, by type of disposition (excluding transfers), national.  FY1997-2025

Parsing is structural, not positional, wherever the layout changed over time:
* C-1: the TOTAL row has 12 numbers (pending start, commenced, terminated, pending end, x3 groups) through
  FY2016 and 9 (filed, terminated, pending, x3) from FY2017; every district row must have the same count.
* D-1: "total commenced" is the first index i where row[i] = row[i+1] + reopens + transfers and
  row[i+1] = felony + misdemeanor + other (original proceedings); "total terminated" is the next such index.
* D-4: the TOTAL row must satisfy total = not convicted + convicted, not convicted = dismissed + acquitted
  (court) + acquitted (jury), convicted = plea of guilty [+ nolo contendere] + court + jury.
* C-4: "during or after trial" total is the first index i with row[i] = row[i+1] + row[i+2] (non-jury +
  jury) after the "court action" columns, on the "Total" row.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup

from pipeline.common.districts import DISTRICTS
from pipeline.common.http import FetchError, fetch
from pipeline.common.manifest import register_source

BASE = "https://www.uscourts.gov"
PAGE = BASE + "/data-news/data-tables/{fy}/09/30/judicial-business/{tbl}"
PUBLISHER = "Administrative Office of the U.S. Courts"
TITLES = {
    "c-1": "Table C-1. U.S. District Courts - Civil Cases Commenced, Terminated, and Pending",
    "c-4": "Table C-4. U.S. District Courts - Civil Cases Terminated, by Nature of Suit and Action Taken",
    "d-1": "Table D-1. U.S. District Courts - Criminal Defendants Commenced, Terminated, and Pending",
    "d-2": "Table D-2. U.S. District Courts - Criminal Defendants Commenced (Excluding Transfers), by Offense",
    "d-4": "Table D-4. U.S. District Courts - Criminal Defendants Disposed Of, by Type of Disposition and Offense",
}

_DIV = {"Northern": "N", "Southern": "S", "Eastern": "E", "Western": "W", "Middle": "M", "Central": "C"}


def _label_map() -> dict[str, str]:
    m = {}
    for d in DISTRICTS:
        div = d.name.split(" District")[0] if " District of " in d.name and d.name.split()[0] in _DIV else None
        if d.id == "dcd":
            m["DC"] = d.id
        elif d.id == "gud":
            m["GU"] = m["GUAM"] = d.id
        elif d.id == "nmid":
            m["NMI"] = m["MP"] = d.id
        elif div:
            m[f"{d.state},{_DIV[div]}"] = d.id
        else:
            m[d.state] = d.id
    return m


LABEL_TO_ID = _label_map()
assert len(set(LABEL_TO_ID.values())) == 94


def source_id(tbl: str, fy: int) -> str:
    return f"ao_jb_{tbl.replace('-', '')}_{fy}"


def get_table(lane: str, tbl: str, fy: int) -> tuple[Path, str] | None:
    """Fetch (cached) the table file for one year; returns (path, 'xlsx'|'pdf') or None if not online."""
    try:
        page = fetch(PAGE.format(fy=fy, tbl=tbl))
    except FetchError:
        return None
    soup = BeautifulSoup(page.text, "lxml")
    links = [a.get("href") for a in soup.find_all("a") if a.get("href")]
    files = [h for h in links if re.search(r"\.(xlsx|pdf)$", h, re.I) and "guide-vol" not in h]
    xl = [h for h in files if h.lower().endswith(".xlsx")]
    pick = (xl or [h for h in files if h.lower().endswith(".pdf")] or [None])[0]
    if not pick:
        return None
    url = pick if pick.startswith("http") else BASE + pick
    r = fetch(url)
    register_source(lane, source_id(tbl, fy), url=url, dataset=f"{TITLES[tbl]} (Judicial Business, FY{fy})",
                    publisher=PUBLISHER, vintage=f"FY{fy} (12 months ending Sep 30, {fy})", cached=r,
                    notes=f"Found on {PAGE.format(fy=fy, tbl=tbl)}. Used only for reconciliation.")
    return r.path, ("xlsx" if url.lower().endswith(".xlsx") else "pdf")


# ------------------------------------------------------------------------------------------ row reader
_NUM = re.compile(r"^\(?-?[\d,]*\.?\d+\)?$")
_FOOTNOTE_AFTER_LABEL = re.compile(r"^(\s*(?:[A-Z]{2,5}(?:,[A-Z])?))\s[1-9](?=\s{2,})")


def _tok(t: str):
    t = t.strip().rstrip("¹²³⁴⁵*").replace("‐", "-").replace("–", "-").replace("\u2014", "-")
    if t in {"-", "--", "\u2014", "–"}:
        return 0
    if _NUM.match(t):
        t = t.replace(",", "").strip("()")
        return float(t) if "." in t else int(t)
    return None


def rows(path: Path, kind: str) -> list[tuple[str, list]]:
    out = []
    if kind == "xlsx":
        x = pd.read_excel(path, header=None, dtype=object)
        for _, r in x.iterrows():
            cells = [c for c in r.tolist()]
            label = None
            nums = []
            for c in cells:
                if c is None or (isinstance(c, float) and pd.isna(c)):
                    continue
                if label is None and isinstance(c, str) and _tok(c) is None:
                    label = c.strip()
                    continue
                v = _tok(str(c)) if isinstance(c, str) else c
                if v is not None and label is not None:
                    nums.append(int(v) if isinstance(v, float) and float(v).is_integer() else v)
            if label is not None:
                out.append((label, nums))
        return out
    text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True,
                          check=True).stdout
    for line in text.replace("\t", " ").splitlines():
        # a footnote digit printed one space after a district label ("NY,S 4      4,472 ...") is not data
        line = _FOOTNOTE_AFTER_LABEL.sub(r"\1", line)
        parts = line.split()
        if not parts:
            continue
        nums = []
        while parts and _tok(parts[-1]) is not None:
            nums.insert(0, _tok(parts.pop()))
        if parts and nums:
            out.append((" ".join(parts), nums))
    return out


def _norm_label(lab: str) -> str:
    lab = re.sub(r"[¹²³⁴⁵*]+$", "", lab.strip())
    lab = re.sub(r"(?<=[A-Z])\d$", "", lab)   # footnote digit glued to a district label (e.g. "WV,S1")
    return lab.upper().replace(" ", "")


def district_rows(rs, concat: bool = False) -> dict[str, list]:
    """{district_id or '_national': numbers} from a district table.

    Rows without numbers (headers) are skipped. By default the first numeric occurrence of each label is
    kept; with ``concat`` every occurrence is appended in document order (PDF tables whose columns continue
    on a second page repeat the row labels there).
    """
    out: dict[str, list] = {}
    for lab, nums in rs:
        if not nums:
            continue
        n = _norm_label(lab)
        key = "_national" if n == "TOTAL" else LABEL_TO_ID.get(n)
        if not key:
            continue
        if key not in out:
            out[key] = list(nums)
        elif concat:
            out[key].extend(nums)
    return out


# ------------------------------------------------------------------------------------------ tables
def parse_c1(path: Path, kind: str) -> pd.DataFrame:
    d = district_rows(rows(path, kind))
    n = len(d["_national"])
    if n == 12:
        fi, ti = 1, 2
    elif n == 9:
        fi, ti = 0, 1
    else:
        raise ValueError(f"C-1: unexpected TOTAL row width {n}")
    recs = []
    for k, nums in d.items():
        if len(nums) != n:
            raise ValueError(f"C-1: row {k} has {len(nums)} numbers, TOTAL has {n}")
        recs.append({"district_id": k, "filed": nums[fi], "terminated": nums[ti]})
    df = pd.DataFrame(recs)
    if len(df) != 95:
        raise ValueError(f"C-1: {len(df)} rows (expected 94 districts + total)")
    return df


def _d1_index(nums, start=0):
    for i in range(start, len(nums) - 6):
        a = nums[i:i + 7]
        if a[0] == a[1] + a[5] + a[6] and a[1] == a[2] + a[3] + a[4] and a[0] > 0:
            return i
    return None


def parse_d1(path: Path, kind: str) -> pd.DataFrame:
    d = district_rows(rows(path, kind), concat=True)
    tot = d["_national"]
    ci = _d1_index(tot)
    ti = _d1_index(tot, ci + 7) if ci is not None else None
    if ci is None or ti is None:
        raise ValueError("D-1: could not locate commenced/terminated column groups")
    recs = []
    for k, nums in d.items():
        if len(nums) != len(tot):
            raise ValueError(f"D-1: row {k} width {len(nums)} != {len(tot)}")
        recs.append({"district_id": k, "commenced_incl_transfers": nums[ci], "terminated_incl_transfers": nums[ti],
                     "commenced_transfers": nums[ci + 6], "terminated_transfers": nums[ti + 6]})
    df = pd.DataFrame(recs)
    if len(df) != 95:
        raise ValueError(f"D-1: {len(df)} rows")
    return df


def parse_d4(path: Path, kind: str) -> dict:
    for lab, nums in rows(path, kind):
        if _norm_label(lab) != "TOTAL":
            continue
        if len(nums) == 10:
            t, nc, dis, ac, aj, c, p, nolo, cc, cj = nums
            plea = p + nolo
        elif len(nums) == 9:
            t, nc, dis, ac, aj, c, plea, cc, cj = nums
        else:
            continue
        if t == nc + c and nc == dis + ac + aj and c == plea + cc + cj:
            return {"terminated": t, "not_convicted": nc, "dismissed": dis, "acquitted_bench": ac,
                    "acquitted_jury": aj, "convicted": c, "plea": plea, "convicted_bench": cc,
                    "convicted_jury": cj}
    raise ValueError("D-4: no TOTAL row satisfying the disposition identities")


_D2_CATS = [
    ("violent", r"VIOLENT OFFENSES"), ("property", r"PROPERTY OFFENSES"), ("fraud", r"FRAUD"),
    ("drugs", r"DRUG OFFENSES"), ("firearms_explosives", r"FIREARMS AND EXPLOSIVES"),
    ("sex", r"SEX OFFENSES"), ("justice_system", r"JUSTICE SYSTEM OFFENSES"),
    ("immigration", r"IMMIGRATION OFFENSES"), ("general", r"GENERAL OFFENSES"),
    ("regulatory", r"REGULATORY OFFENSES"), ("traffic", r"TRAFFIC OFFENSES"),
]


def parse_d2(path: Path, kind: str, table_fy: int) -> pd.DataFrame:
    """Five fiscal years of national totals by top-level offense category (plus fraud)."""
    years = list(range(table_fy - 4, table_fy + 1))
    found = {}
    for lab, nums in rows(path, kind):
        u = re.sub(r"\s+", " ", lab.upper()).strip()
        if len(nums) < 5:
            continue
        vals = nums[:5]
        if u == "TOTAL" and "total" not in found:
            found["total"] = vals
            continue
        for cat, pat in _D2_CATS:
            if cat not in found and re.match(pat + r".*,\s*TOTAL$", u):
                found[cat] = vals
    missing = ({"total"} | {c for c, _ in _D2_CATS}) - set(found)
    if missing:
        raise ValueError(f"D-2 FY{table_fy}: missing rows {sorted(missing)}")
    recs = []
    for cat, vals in found.items():
        for y, v in zip(years, vals):
            recs.append({"period": y, "category": cat, "count": v})
    df = pd.DataFrame(recs)
    piv = df.pivot(index="period", columns="category", values="count")
    piv["property_other"] = piv["property"] - piv["fraud"]
    # identity check: categories sum to the total
    cats = ["violent", "property", "drugs", "firearms_explosives", "sex", "justice_system", "immigration",
            "general", "regulatory", "traffic"]
    bad = piv[piv[cats].sum(axis=1) != piv["total"]]
    if len(bad):
        raise ValueError(f"D-2 FY{table_fy}: categories do not sum to total for {list(bad.index)}")
    out = piv.drop(columns=["property"]).reset_index().melt(id_vars="period", var_name="category",
                                                            value_name="count")
    out["table_fy"] = table_fy
    return out


def parse_c4(path: Path, kind: str) -> dict:
    """National civil terminations and 'during or after trial' (total, non-jury, jury)."""
    for lab, nums in rows(path, kind):
        u = _norm_label(lab)
        if u not in {"TOTAL", "TOTALCASES"} or len(nums) < 6:
            continue
        total = nums[0]
        # trials total = non-jury + jury, searching from the right (percent column may follow)
        for i in range(len(nums) - 3, 0, -1):
            a, b, c = nums[i], nums[i + 1], nums[i + 2]
            if all(isinstance(v, int) for v in (a, b, c)) and a == b + c and a > 0 and a < total:
                return {"terminated": total, "trials": a, "trials_nonjury": b, "trials_jury": c}
    raise ValueError("C-4: no total row with trials = non-jury + jury")
