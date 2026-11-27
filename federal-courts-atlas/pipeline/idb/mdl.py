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

Docket names: ``civil_mdl_docket_names.csv``, for every docket that is above 25% of a district's civil cases filed
or closed in any year from ``FIRST_CODED_FY``. A name is used only when a GovInfo "United States Courts Opinions"
(USCOURTS) record for the transferee court is found whose MODS metadata gives a case number ending in the docket
number with a multidistrict case type (``md-0NNNN``, ``mn-0NNNN`` in D.S.C. or ``ml-0NNNN`` in S.D. Ind.) and whose
author is that district court. The package ids tried are listed in ``NAME_CANDIDATES`` (typed in, several per docket
where the first did not verify; each is verified against the record, never trusted on its own). A docket without a
verified record is shown by number only, and the gap record lists every id tried for it.

Coverage: ``civil_mdl_coverage.csv`` counts, for every termination fiscal year, the civil termination records and
those carrying a 4-digit docket number. Almost no record closed before FY 2010 carries one, so docket counts are
complete only from ``FIRST_CODED_FY`` (filings of a year are complete once every case filed that year closed in a
coded year or is still pending). ``civil_mdl_meta.json`` records that year.
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
NAME_SHARE = 25.0      # dockets above this share of a district's civil cases in a coded year get a name lookup
CODED_MIN = 1000       # a termination year counts as coded when at least this many records carry a docket number
CASE_TYPES = "md|mn|ml"  # multidistrict case types in the transferee court's case number

# docket -> (transferee district, GovInfo USCOURTS package ids to try, in order). Each id is verified against the
# record before use and the first that verifies names the docket. Ids that do not verify (GovInfo answers "Page Not
# Found", or the case number has no multidistrict case type) stay listed so the attempts are on record; a docket with
# none that verifies is shown by number only, and the gap record lists every id tried. GovInfo answers a missing
# package with an HTTP 200 error page, so every attempt is in the HTTP cache and a rebuild fetches nothing again.
# Fix pass (2026-11-27): for the 13 unnamed dockets, up to four more ids each were tried (filing year from the MDL
# number range, division number, zero-padding); 46 fetches, none found.
NAME_CANDIDATES: dict[str, tuple[str, tuple[str, ...]]] = {
    "2885": ("flnd", ("USCOURTS-flnd-3_19-md-02885",)),
    "3140": ("flnd", ("USCOURTS-flnd-3_25-md-03140",)),
    "3081": ("azd", ("USCOURTS-azd-2_23-md-03081",)),
    "2738": ("njd", ("USCOURTS-njd-3_16-md-02738",)),
    "2666": ("mnd", ("USCOURTS-mnd-0_15-md-02666",)),
    "2873": ("scd", ("USCOURTS-scd-2_18-mn-02873", "USCOURTS-scd-2_18-md-02873", "USCOURTS-scd-2_19-mn-02873",
                     "USCOURTS-scd-2_18-mn-2873", "USCOURTS-scd-2_19-md-02873")),
    "3092": ("ohnd", ("USCOURTS-ohnd-1_24-md-03092",)),
    "2740": ("laed", ("USCOURTS-laed-2_16-md-02740",)),
    "2753": ("nhd", ("USCOURTS-nhd-1_16-md-02753", "USCOURTS-nhd-1_16-md-2753", "USCOURTS-nhd-1_17-md-02753",
                     "USCOURTS-nhd-1_17-md-2753", "USCOURTS-nhd-1_18-md-02753")),
    # Added for the earlier-year notes (polish pass, 2026-11-27).
    "0875": ("paed", ("USCOURTS-paed-2_01-md-00875",)),
    "1507": ("ared", ("USCOURTS-ared-4_03-cv-01507",    # civil (cv) case number: does not verify
                      "USCOURTS-ared-4_03-md-01507", "USCOURTS-ared-4_03-md-1507", "USCOURTS-ared-4_02-md-01507",
                      "USCOURTS-ared-4_04-md-01507")),
    "1657": ("laed", ("USCOURTS-laed-2_05-md-01657",)),
    "1842": ("rid", ("USCOURTS-rid-1_07-md-01842",)),
    "1943": ("mnd", ("USCOURTS-mnd-0_08-md-01943",)),
    "1964": ("moed", ("USCOURTS-moed-4_08-md-01964",)),
    "2179": ("laed", ("USCOURTS-laed-2_10-md-02179",)),
    "2197": ("ohnd", ("USCOURTS-ohnd-1_10-md-02197", "USCOURTS-ohnd-3_10-md-02197", "USCOURTS-ohnd-1_10-md-2197",
                      "USCOURTS-ohnd-3_10-md-2197", "USCOURTS-ohnd-5_10-md-02197")),
    "2244": ("txnd", ("USCOURTS-txnd-3_11-md-02244",)),
    "2299": ("lawd", ("USCOURTS-lawd-6_11-md-02299", "USCOURTS-lawd-6_11-md-2299", "USCOURTS-lawd-6_12-md-02299",
                      "USCOURTS-lawd-6_12-md-2299", "USCOURTS-lawd-2_11-md-02299")),
    "2325": ("wvsd", ("USCOURTS-wvsd-2_12-md-02325", "USCOURTS-wvsd-2_12-md-2325", "USCOURTS-wvsd-2_11-md-02325",
                      "USCOURTS-wvsd-3_12-md-02325")),
    "2326": ("wvsd", ("USCOURTS-wvsd-2_12-md-02326", "USCOURTS-wvsd-2_12-md-2326", "USCOURTS-wvsd-2_11-md-02326",
                      "USCOURTS-wvsd-3_12-md-02326")),
    "2327": ("wvsd", ("USCOURTS-wvsd-2_12-md-02327", "USCOURTS-wvsd-2_12-md-2327", "USCOURTS-wvsd-2_11-md-02327",
                      "USCOURTS-wvsd-3_12-md-02327")),
    "2391": ("innd", ("USCOURTS-innd-3_12-md-02391", "USCOURTS-innd-3_12-md-2391", "USCOURTS-innd-3_13-md-02391",
                      "USCOURTS-innd-1_12-md-02391", "USCOURTS-innd-2_12-md-02391")),
    "2428": ("mad", ("USCOURTS-mad-1_13-md-02428",)),
    "2433": ("ohsd", ("USCOURTS-ohsd-2_13-md-02433",)),
    "2441": ("mnd", ("USCOURTS-mnd-0_13-md-02441",)),
    "2502": ("scd", ("USCOURTS-scd-2_14-mn-02502", "USCOURTS-scd-2_14-md-02502", "USCOURTS-scd-2_13-mn-02502",
                     "USCOURTS-scd-2_14-mn-2502", "USCOURTS-scd-3_14-mn-02502")),
    "2545": ("ilnd", ("USCOURTS-ilnd-1_14-cv-01748",    # civil (cv) case number: does not verify
                      "USCOURTS-ilnd-1_14-md-02545", "USCOURTS-ilnd-1_14-md-2545", "USCOURTS-ilnd-1_15-md-02545")),
    "2570": ("insd", ("USCOURTS-insd-1_14-ml-02570",)),
    "2591": ("ksd", ("USCOURTS-ksd-2_14-md-02591",)),
    "2592": ("laed", ("USCOURTS-laed-2_14-md-02592",)),
    "2641": ("azd", ("USCOURTS-azd-2_15-md-02641",)),
    "2734": ("flnd", ("USCOURTS-flnd-3_16-md-02734",)),
    "2782": ("gand", ("USCOURTS-gand-1_17-md-02782", "USCOURTS-gand-1_17-md-2782", "USCOURTS-gand-1_18-md-02782",
                      "USCOURTS-gand-1_16-md-02782")),
    "2789": ("njd", ("USCOURTS-njd-2_17-md-02789",)),
    "2804": ("ohnd", ("USCOURTS-ohnd-1_17-md-02804",)),
    "2846": ("ohsd", ("USCOURTS-ohsd-2_18-md-02846",)),
    "2924": ("flsd", ("USCOURTS-flsd-9_20-md-02924",)),
    "3060": ("ilnd", ("USCOURTS-ilnd-1_23-cv-00818",    # civil (cv) case number: does not verify
                      "USCOURTS-ilnd-1_23-md-03060", "USCOURTS-ilnd-1_23-md-3060", "USCOURTS-ilnd-1_22-md-03060")),
}
GOVINFO_MODS = "https://www.govinfo.gov/metadata/pkg/{pkg}/mods.xml"
GOVINFO_DETAILS = "https://www.govinfo.gov/app/details/{pkg}"
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "re", "the", "to"}
KEEP_CAPS = {"ABG", "AFFF", "AG", "IVC"}   # acronyms in printed titles, kept in capitals by display_title
ROMAN_RE = re.compile(r"[IVX]{1,5}")
NOTE_RE = re.compile(r"\s*\*\*[^*]*\*\*\s*$")   # a docketing note appended to a title ("**COUNSEL: ...**")


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
    """GovInfo prints some titles in capitals; show them in title case (words with digits, Roman numerals and a few
    acronyms kept as printed). A docketing note appended in double asterisks is dropped from the display title."""
    t = re.sub(r"^in re:\s*", "In re: ", NOTE_RE.sub("", html.unescape(raw).strip()), flags=re.I)
    body = t[len("In re: "):] if t.startswith("In re: ") else t
    letters = [ch for ch in body if ch.isalpha()]
    if letters and sum(ch.isupper() for ch in letters) < 0.9 * len(letters):  # mixed case: keep as printed
        return t
    words = []
    for i, w in enumerate(t.split()):
        pre, core, post = re.fullmatch(r"([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)", w).groups()
        if any(ch.isdigit() for ch in core) or core in KEEP_CAPS or ROMAN_RE.fullmatch(core):
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
    ok_number = any(re.search(rf"-({CASE_TYPES})-0?{docket}$", n) for n in numbers)
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
    rows, missing = [], {}
    for dk in sorted(dockets):
        did, pkgs = NAME_CANDIDATES.get(dk, ("", ()))
        got = None
        for pkg in pkgs:
            got = verify_name(dk, did, pkg)
            if got:
                break
        if got:
            rows.append(got)
        else:
            missing[dk] = (did, pkgs)
    if missing:
        tried = "; ".join(f"MDL {dk} ({BY_ID[did].short if did else 'no transferee court'}): "
                          + (", ".join(pkgs) if pkgs else "none")
                          for dk, (did, pkgs) in missing.items())
        record_gap(LANE, "civil_mdl_docket_names_unverified",
                   description="No GovInfo court record could be matched to these MDL docket numbers, so the atlas "
                               "names them by number only: " + ", ".join(f"MDL {d}" for d in missing) + ". "
                               "GovInfo USCOURTS package ids tried for each (none is a record of the transferee "
                               "court with a multidistrict case number for the docket): " + tried + ".",
                   districts=sorted({did for did, _ in missing.values() if did}),
                   reason="litigation name not verified from an allowed source")
    cols = ["mdl_docket", "district_id", "case_number", "title_as_printed", "title", "source_id", "govinfo_package"]
    return pd.DataFrame(rows, columns=cols)


def coverage(term: pd.DataFrame) -> pd.DataFrame:
    """Civil termination records per termination fiscal year, and how many carry a 4-digit docket number."""
    valid = term["MDLDOCK"].str.fullmatch(DOCKET_RE, na=False) & (term["MDLDOCK"] != "0000")
    c = (term.assign(_v=valid).groupby("TFY")
         .agg(records=("_v", "size"), records_with_docket=("_v", "sum")).reset_index()
         .rename(columns={"TFY": "period"}))
    c["period"] = c["period"].astype(int)
    c["records_with_docket"] = c["records_with_docket"].astype(int)
    c["coded"] = c["records_with_docket"] >= CODED_MIN
    return c


def first_coded_year(cov: pd.DataFrame) -> int:
    """The first termination year from which every year is coded (at least CODED_MIN records with a docket)."""
    years = cov.sort_values("period")
    first = None
    for y, ok in zip(years["period"], years["coded"]):
        if ok and first is None:
            first = int(y)
        elif not ok:
            first = None
    if first is None:
        raise RuntimeError("no coded termination years in the civil file")
    return first


def build(extract=None) -> pd.DataFrame:
    extract = extract or civil_extract()
    df = load(extract)
    fil = civil.filings(df)
    term = civil.terminations(df)
    t = pd.concat([docket_counts(fil, "FFY", "filed"), docket_counts(term, "TFY", "terminated")], ignore_index=True)
    cov = coverage(term)
    del df, fil, term
    out = select(t)
    OUT.mkdir(parents=True, exist_ok=True)
    out.to_parquet(OUT / "civil_mdl_dockets.parquet", index=False)
    out.to_csv(OUT / "civil_mdl_dockets.csv", index=False)
    first = first_coded_year(cov)
    cov.to_csv(OUT / "civil_mdl_coverage.csv", index=False)
    before = cov[cov["period"] < first]
    (OUT / "civil_mdl_meta.json").write_text(json.dumps({
        "first_coded_fy": first, "coded_min_records": CODED_MIN, "name_share_pct": NAME_SHARE,
        "records_before_first_coded_fy": int(before["records"].sum()),
        "records_with_docket_before_first_coded_fy": int(before["records_with_docket"].sum()),
        "source_id": SOURCE_ID, "table": "civil_mdl_coverage.csv",
    }, indent=1, sort_keys=True) + "\n")
    record_gap(LANE, "civil_mdl_docket_not_coded_early_years",
               description=(f"MDL docket numbers are almost never filled in for civil cases closed before FY {first}: "
                            f"{int(before['records_with_docket'].sum()):,} of {int(before['records'].sum()):,} "
                            f"termination records for FY {int(before['period'].min())} to {first - 1} carry one "
                            f"(civil_mdl_coverage.csv). MDL notes on district pages therefore start in FY {first}."),
               periods=sorted(int(y) for y in before["period"]),
               reason="field not coded in the source for those years")
    # Names for every docket above a quarter of a district's civil cases filed or closed in a coded year.
    big = out[(out["district_id"] != "_national") & (out["period"] >= first) & (out["share"] > NAME_SHARE)]
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
