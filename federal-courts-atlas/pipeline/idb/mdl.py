"""Civil cases by multidistrict litigation (MDL) docket: ``python -m pipeline.idb.mdl``.

A cheap, separate entry point (about 40 seconds): it reads the civil Parquet extract that the IDB build already
made from the cached FJC file (``data/raw/idb_extract/``; nothing is downloaded again) and counts, for every
district and federal fiscal year, the civil cases that carry each MDL docket number:

* ``filed``: the IDB lane's filing cohort (one record per case, fiscal year of FDATEUSE; same de-duplication as
  ``idb_civil_filed``, so ``total`` equals that variable exactly);
* ``terminated``: the termination cohort (fiscal year of TDATEUSE; ``total`` equals ``idb_civil_terminated``).

MDLDOCK is the codebook's "MULTIDISTRICT LITIGATION DOCKET NUMBER (MDLDOCK): A 4-digit multi district
litigation docket number" (civil codebook). Only 4-digit values count; "-8" (missing) and the few 1- to 3-character
values are left out. The docket is read from the record the lane keeps for each case (its latest record).

Output ``data/processed/idb/civil_mdl_dockets.{parquet,csv}``: one row per district x FY x cohort x docket where the
docket holds at least ``MIN_COUNT`` cases and at least ``MIN_SHARE`` percent of the district's civil cases in that
cohort and year, plus ``_national`` rows for the same docket, year and cohort. ``share`` is 100 x count / total.

Docket names: ``civil_mdl_docket_names.csv``. A name is used only when a GovInfo "United States Courts Opinions"
(USCOURTS) record for the transferee court is found whose MODS metadata gives a case number ending in the docket
number (``md-0NNNN`` / ``mn-0NNNN``) and whose author is that district court. The package ids tried are listed in
``NAME_CANDIDATES`` (typed in; each is verified against the record, never trusted on its own). A docket without a
verified record is shown by number only.
"""
from __future__ import annotations

import html
import json
import re
import sys
from collections import Counter

import pandas as pd

from pipeline.common.districts import BY_ID, IDS
from pipeline.common.http import FetchError, fetch
from pipeline.common.manifest import DATA, record_gap, register_source

from . import LANE, civil
from .crosswalk import to_district_id
from .extract import extract_civil

OUT = DATA / "processed" / LANE
SOURCE_ID = "idb_civil_cv88on"
MIN_COUNT = 100
MIN_SHARE = 5.0
DOCKET_RE = r"\d{4}"

# docket -> (transferee district, GovInfo USCOURTS package id to try). Verified against the record before use.
NAME_CANDIDATES: dict[str, tuple[str, str]] = {
    "2885": ("flnd", "USCOURTS-flnd-3_19-md-02885"),
    "3140": ("flnd", "USCOURTS-flnd-3_25-md-03140"),
    "3081": ("azd", "USCOURTS-azd-2_23-md-03081"),
    "2738": ("njd", "USCOURTS-njd-3_16-md-02738"),
    "2666": ("mnd", "USCOURTS-mnd-0_15-md-02666"),
    "2873": ("scd", "USCOURTS-scd-2_18-mn-02873"),
    "3092": ("ohnd", "USCOURTS-ohnd-1_24-md-03092"),
    "2740": ("laed", "USCOURTS-laed-2_16-md-02740"),
    "2753": ("nhd", "USCOURTS-nhd-1_16-md-02753"),
}
GOVINFO_MODS = "https://www.govinfo.gov/metadata/pkg/{pkg}/mods.xml"
GOVINFO_DETAILS = "https://www.govinfo.gov/app/details/{pkg}"
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "re", "the", "to"}


def log(*a):
    print("[idb.mdl]", *a, flush=True)


def civil_extract():
    """The cached civil extract (the zip comes from the HTTP cache; the extract is keyed by its sha256)."""
    src = json.loads((DATA / "sources" / f"{LANE}.json").read_text())[SOURCE_ID]
    r = fetch(src["url"], timeout=300)  # cached: returns the file already on disk
    return extract_civil(r.path, r.meta["sha256"], log=log)


def load(extract) -> pd.DataFrame:
    cols = list(dict.fromkeys(civil.LOAD_COLS + ["MDLDOCK"]))
    df = pd.read_parquet(extract, columns=cols)
    codes = df["DISTRICT"].astype("category")
    df["district_id"] = codes.map({c: to_district_id(c) for c in codes.cat.categories}).astype(object)
    df["FFY"] = civil.fiscal_year(df["FDATEUSE"])
    df["TFY"] = civil.fiscal_year(df["TDATEUSE"])
    return df


def docket_counts(d: pd.DataFrame, fy_col: str, cohort: str) -> pd.DataFrame:
    """All district x FY x docket counts for one cohort, with the district (and national) totals."""
    valid = d["MDLDOCK"].str.fullmatch(DOCKET_RE, na=False) & (d["MDLDOCK"] != "0000")
    out = []
    for dd in (d, d.assign(district_id="_national")):
        tot = dd.groupby(["district_id", fy_col]).size().rename("total")
        c = dd[valid].groupby(["district_id", fy_col, "MDLDOCK"]).size().rename("count").reset_index()
        out.append(c.merge(tot.reset_index(), on=["district_id", fy_col]))
    t = pd.concat(out, ignore_index=True).rename(columns={fy_col: "period", "MDLDOCK": "mdl_docket"})
    t["cohort"] = cohort
    t["share"] = 100.0 * t["count"] / t["total"]
    return t


def select(t: pd.DataFrame) -> pd.DataFrame:
    dist = t[(t["district_id"] != "_national") & (t["count"] >= MIN_COUNT) & (t["share"] >= MIN_SHARE)]
    keys = dist[["period", "cohort", "mdl_docket"]].drop_duplicates()
    nat = t[t["district_id"] == "_national"].merge(keys, on=["period", "cohort", "mdl_docket"])
    out = pd.concat([dist, nat], ignore_index=True)
    out["period"] = out["period"].astype(int)
    out["period_type"] = "FY_SEP30"
    out["source_id"] = SOURCE_ID
    fy = {"filed": "FDATEUSE", "terminated": "TDATEUSE"}
    out["source_locator"] = [
        f"cv88on.txt: {'all districts' if did == '_national' else 'district ' + did}, {fy[co]} in FY{p}, "
        f"{'filing cohort (one record per case)' if co == 'filed' else 'termination records (TAPEYEAR != 2099)'}, "
        f"MDLDOCK = '{dk}'"
        for did, p, co, dk in zip(out["district_id"], out["period"], out["cohort"], out["mdl_docket"])]
    cols = ["district_id", "period", "period_type", "cohort", "mdl_docket", "count", "total", "share", "source_id",
            "source_locator"]
    return out[cols].sort_values(["district_id", "period", "cohort", "count", "mdl_docket"],
                                 ascending=[True, True, True, False, True]).reset_index(drop=True)


def display_title(raw: str) -> str:
    """GovInfo prints some titles in capitals; show them in title case (words with digits kept as printed)."""
    t = re.sub(r"^in re:\s*", "In re: ", html.unescape(raw).strip(), flags=re.I)
    body = t[len("In re: "):] if t.startswith("In re: ") else t
    if body != body.upper():  # already in mixed case: keep as printed
        return t
    words = []
    for i, w in enumerate(t.split()):
        pre, core, post = re.fullmatch(r"([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)", w).groups()
        if any(ch.isdigit() for ch in core):
            words.append(w)
            continue
        lc = core.lower()
        core = lc if (i > 0 and lc in SMALL_WORDS) else "-".join(p.capitalize() for p in lc.split("-"))
        words.append(pre + core + post)
    return " ".join(words)


def verify_name(docket: str, district_id: str, pkg: str) -> dict | None:
    url = GOVINFO_MODS.format(pkg=pkg)
    try:
        r = fetch(url, timeout=120)
    except FetchError as e:
        log(f"  {docket}: {pkg} not available ({e})")
        return None
    text = r.text
    numbers = set(re.findall(r"<caseNumber>([^<]*)</caseNumber>", text))
    court = BY_ID[district_id].name
    authors = set(re.findall(r"<namePart>United States District Court ([^<]*)</namePart>", text))
    titles = Counter(re.findall(r"<title>([^<]*)</title>", text))
    ok_number = any(re.search(rf"-(md|mn)-0?{docket}$", n) for n in numbers)
    ok_court = court in authors
    if not (ok_number and ok_court and titles):
        log(f"  {docket}: {pkg} does not verify (case numbers {sorted(numbers)[:3]}, courts {sorted(authors)[:2]})")
        return None
    raw = titles.most_common(1)[0][0]
    sid = "govinfo_" + pkg.lower().replace("-", "_")
    register_source(LANE, sid, url=url,
                    dataset=f"GovInfo, United States Courts Opinions (USCOURTS): {html.unescape(raw)}, "
                            f"case {sorted(numbers)[0]} ({court}), MODS metadata",
                    publisher="U.S. Government Publishing Office (Administrative Office of the U.S. Courts)",
                    cached=r, vintage=f"retrieved {r.meta.get('retrieved_at')}",
                    notes=f"Used only for the litigation name and case number of MDL docket {docket}. "
                          f"Package page: {GOVINFO_DETAILS.format(pkg=pkg)}.")
    return {"mdl_docket": docket, "district_id": district_id, "case_number": sorted(numbers)[0],
            "title_as_printed": html.unescape(raw), "title": display_title(raw), "source_id": sid,
            "govinfo_package": pkg}


def names(dockets: set[str]) -> pd.DataFrame:
    rows, missing = [], []
    for dk in sorted(dockets):
        cand = NAME_CANDIDATES.get(dk)
        got = verify_name(dk, *cand) if cand else None
        if got:
            rows.append(got)
        else:
            missing.append(dk)
    if missing:
        record_gap(LANE, "civil_mdl_docket_names_unverified",
                   description="No GovInfo court record could be matched to these MDL docket numbers, so the atlas "
                               "names them by number only: " + ", ".join(f"MDL {d}" for d in missing) + ".",
                   reason="litigation name not verified from an allowed source")
    cols = ["mdl_docket", "district_id", "case_number", "title_as_printed", "title", "source_id", "govinfo_package"]
    return pd.DataFrame(rows, columns=cols)


def build(extract=None) -> pd.DataFrame:
    extract = extract or civil_extract()
    df = load(extract)
    fil = civil.filings(df)
    term = civil.terminations(df)
    t = pd.concat([docket_counts(fil, "FFY", "filed"), docket_counts(term, "TFY", "terminated")], ignore_index=True)
    del df, fil, term
    out = select(t)
    OUT.mkdir(parents=True, exist_ok=True)
    out.to_parquet(OUT / "civil_mdl_dockets.parquet", index=False)
    out.to_csv(OUT / "civil_mdl_dockets.csv", index=False)
    # Names for the dockets that make up more than a quarter of a district's civil cases in the latest two years.
    last = int(out["period"].max())
    big = out[(out["district_id"] != "_national") & (out["period"] >= last - 1) & (out["share"] > 25)]
    nm = names(set(big["mdl_docket"]))
    nm.to_csv(OUT / "civil_mdl_docket_names.csv", index=False)
    log(f"{len(out):,} rows ({out['mdl_docket'].nunique()} dockets, {out['district_id'].nunique() - 1} districts); "
        f"{len(nm)} docket names verified")
    return out


def main() -> int:
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
