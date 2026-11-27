"""Build the IDB lane: ``python -m pipeline.idb.build``.

Steps (idempotent; downloads cached by pipeline.common.http.fetch, extracts cached by source sha256):
  1. Discover the civil (SY1988-present) and criminal (FY1996-present) dataset pages on fjc.gov, download the
     cumulative tab-delimited files and the codebooks, and register them. Also register the code lists used
     (JS 44 NOS headings, NOS descriptions, the D2 offense-code labels from the FJC interactive view).
  2. Stream the needed columns out of each zip into a Parquet extract (data/raw/idb_extract/).
  3. Civil: filing cohort (one record per case) and termination cohort -> district x FY components.
  4. Criminal: per-snapshot count flags -> district x FY components.
  5. Variables -> observations (contract table) with numerator/denominator columns; detail tables.
  6. Fetch AO Judicial Business tables (C-1, C-4, D-1, D-2, D-4) and the FCMS lane output; reconcile.
  7. Write variables.json, gaps, crosswalk and code tables.
  8. Civil cases by MDL docket (pipeline/idb/mdl.py; also runs on its own as ``python -m pipeline.idb.mdl``).
"""
from __future__ import annotations

import gc
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from bs4 import BeautifulSoup

from pipeline.common.districts import BY_ID, IDS
from pipeline.common.http import PROJECT_ROOT, FetchError, fetch
from pipeline.common.manifest import DATA, record_gap, register_source, write_observations

from . import LANE, civil, criminal, jb, mdl, reconcile
from .codes import (CIVIL_DISP_GROUP_LABEL, CRIM_DISP_GROUP_LABEL, NOS_GROUP_LABEL, NOS_GROUPS,
                    OFFENSE_CATEGORIES, d2_category)
from .crosswalk import IDB_DISTRICT, ID_TO_CODE, circuit_code
from .extract import extract_civil, extract_criminal
from .variables import SPECS, Spec

OUT = DATA / "processed" / LANE
FJC = "https://www.fjc.gov"
FJC_PUB = "Federal Judicial Center"
CIVIL_PAGE = FJC + "/research/idb/civil-cases-filed-terminated-and-pending-sy-1988-present"
CRIM_PAGE = FJC + "/research/idb/criminal-defendants-filed-terminated-and-pending-fy-1996-present"
D2_PAGE = FJC + "/research/idb/interactive/24/IDB-criminal-since-1996"
GUIDE_URL = FJC + "/sites/default/files/IDB-Research-Guide.pdf"
JS44_PAGE = "https://www.uscourts.gov/forms-rules/forms/civil-cover-sheet"
FALLBACK = {
    "civil_zip": FJC + "/sites/default/files/idb/textfiles/cv88on_0.zip",
    "civil_codebook": FJC + "/sites/default/files/idb/codebooks/Civil%20Codebook%201988%20Forward%2010252023.pdf",
    "crim_zip": FJC + "/sites/default/files/idb/textfiles/cr96on_0.zip",
    "crim_codebook": FJC + "/sites/default/files/idb/codebooks/Criminal%20Code%20Book%201996%20Forward.pdf",
    "js44": "https://www.uscourts.gov/sites/default/files/js_044_-_civil_cover_sheet_1.pdf",
    "nos": "https://www.uscourts.gov/sites/default/files/document/nos_code_descriptions.pdf",
}
D2_TABLE_YEARS_STEP = 5   # each D-2 table prints five fiscal years


def log(*a):
    print("[idb]", *a, flush=True)


def _abs(href: str, base: str = FJC) -> str:
    return href if href.startswith("http") else base + href


# ------------------------------------------------------------------------------------------ sources
def discover_dataset(page_url: str, zip_pat: str, cb_pat: str) -> dict:
    page = fetch(page_url)
    soup = BeautifulSoup(page.text, "lxml")
    info = {"page": page_url, "zip": None, "codebook": None, "zip_label": "", "codebook_label": ""}
    for a in soup.find_all("a"):
        h = a.get("href") or ""
        if re.search(zip_pat, h) and not info["zip"]:
            info["zip"] = _abs(h)
            sib = a.find_parent().get_text(" ", strip=True) if a.find_parent() else ""
            info["zip_label"] = sib
        if re.search(cb_pat, h) and not info["codebook"]:
            info["codebook"] = _abs(h)
            info["codebook_label"] = a.get_text(strip=True)
    # the parenthetical coverage note printed under the cumulative-file link
    m = re.search(r"Cumulative File\s*\(([^)]*)\)", soup.get_text(" ", strip=True))
    info["coverage"] = m.group(1).strip() if m else ""
    return info


def acquire() -> dict:
    src = {}
    civ = discover_dataset(CIVIL_PAGE, r"/idb/textfiles/cv88on[^/]*\.zip$", r"/idb/codebooks/Civil.*1988.*\.pdf$")
    crim = discover_dataset(CRIM_PAGE, r"/idb/textfiles/cr96on[^/]*\.zip$", r"/idb/codebooks/Criminal.*1996.*\.pdf$")
    civ["zip"] = civ["zip"] or FALLBACK["civil_zip"]
    civ["codebook"] = civ["codebook"] or FALLBACK["civil_codebook"]
    crim["zip"] = crim["zip"] or FALLBACK["crim_zip"]
    crim["codebook"] = crim["codebook"] or FALLBACK["crim_codebook"]

    r = fetch(civ["zip"], timeout=300)
    register_source(LANE, "idb_civil_cv88on", url=civ["zip"],
                    dataset="FJC Integrated Database (IDB): Civil cases filed, terminated, and pending from SY 1988 "
                            "to present - cumulative tab-delimited file (cv88on.txt)",
                    publisher=FJC_PUB, cached=r,
                    vintage=f"{civ['coverage'] or 'SY1988-present'}; file Last-Modified {r.meta.get('last_modified')}",
                    notes=f"Dataset page: {CIVIL_PAGE}. Unit: civil case record. Codebook: idb_civil_codebook.")
    src["civil_zip"] = r
    r = fetch(crim["zip"], timeout=300)
    register_source(LANE, "idb_criminal_cr96on", url=crim["zip"],
                    dataset="FJC Integrated Database (IDB): Criminal defendants filed, terminated, and pending from "
                            "FY 1996 to present - cumulative snapshot file (cr96on.txt)",
                    publisher=FJC_PUB, cached=r,
                    vintage=f"{crim['coverage'] or 'FY1996-present'}; file Last-Modified {r.meta.get('last_modified')}",
                    notes=f"Dataset page: {CRIM_PAGE}. Unit: defendant per fiscal-year snapshot. Zip uses Deflate64. "
                          "Codebook: idb_criminal_codebook.")
    src["crim_zip"] = r
    for sid, url, ds in [
        ("idb_civil_codebook", civ["codebook"], "FJC IDB Civil Codebook, 1988 forward"),
        ("idb_criminal_codebook", crim["codebook"], "FJC IDB Criminal Code Book, 1996 to present (August 2016)"),
        ("idb_research_guide", GUIDE_URL, "The Integrated Database: A Research Guide (FJC)"),
    ]:
        r = fetch(url)
        register_source(LANE, sid, url=url, dataset=ds, publisher=FJC_PUB, cached=r,
                        vintage=f"Last-Modified {r.meta.get('last_modified')}",
                        notes="Code meanings and file structure for the IDB lane.")
    # JS 44 and NOS descriptions (NOS group headings)
    js44, nos = FALLBACK["js44"], FALLBACK["nos"]
    try:
        soup = BeautifulSoup(fetch(JS44_PAGE).text, "lxml")
        for a in soup.find_all("a"):
            h = a.get("href") or ""
            if re.search(r"js_?044.*\.pdf$", h, re.I):
                js44 = _abs(h, "https://www.uscourts.gov")
            if re.search(r"nos_code_descriptions.*\.pdf$", h, re.I):
                nos = _abs(h, "https://www.uscourts.gov")
    except FetchError:
        pass
    r = fetch(js44)
    register_source(LANE, "ao_js44", url=js44, dataset="Civil Cover Sheet JS 44 (Rev. 03/24), section IV Nature of Suit",
                    publisher=jb.PUBLISHER, cached=r, vintage="Rev. 03/24",
                    notes=f"Found on {JS44_PAGE}. NOS category headings used for civil_nos_mix groups.")
    r = fetch(nos)
    register_source(LANE, "ao_nos_descriptions", url=nos, dataset="Civil Nature of Suit Code Descriptions",
                    publisher=jb.PUBLISHER, cached=r, vintage=f"Last-Modified {r.meta.get('last_modified')}",
                    notes=f"Found on {JS44_PAGE}.")
    # D2 offense code labels (select list on the FJC interactive view)
    r = fetch(D2_PAGE)
    register_source(LANE, "idb_criminal_d2_labels", url=D2_PAGE,
                    dataset="FJC IDB interactive view, Criminal 1996-present: 'Nature of Offense' (D2FOFFCD1) code list",
                    publisher=FJC_PUB, cached=r, vintage=f"retrieved {r.meta.get('retrieved_at')}",
                    notes="HTML page; the <select name='d2foffcd1[]'> options give code - label pairs.")
    src["d2_page"] = r
    return src


def d2_labels(page) -> pd.DataFrame:
    soup = BeautifulSoup(page.text, "lxml")
    sel = soup.find("select", attrs={"name": "d2foffcd1[]"})
    rows = []
    for o in sel.find_all("option") if sel else []:
        code = (o.get("value") or "").strip()
        lab = o.get_text(strip=True)
        lab = re.sub(rf"^{re.escape(code)}\s*-\s*", "", lab)
        rows.append({"d2_code": code, "label": lab, "offense_category": d2_category(code)})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------ observations
def _value(spec: Spec, comps: dict, key):
    num = comps[spec.numerator].get(key)
    if spec.denominator is None:
        return num, num, None
    if spec.denominator.startswith("_national:"):
        den = comps[spec.denominator.split(":", 1)[1]].get(("_national", key[1]))
    else:
        den = comps[spec.denominator].get(key)
    if den is None or den == 0:
        return None, num, den
    return 100.0 * num / den, num, den


def observations(specs: list[Spec], comps: dict, years: list[int], source_id: str) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    rows, nat_rows, gaps = [], [], {}
    for s in specs:
        for fy in years:
            if s.min_fy and fy < s.min_fy:
                continue
            for did in IDS + ["_national"]:
                key = (did, fy)
                val, num, den = _value(s, comps, key)
                if s.coverage:
                    cov_num = comps[s.coverage[0]].get(key)
                    cov_den = comps[s.coverage[1]].get(key)
                    if not cov_den or cov_num / cov_den < s.coverage[2]:
                        gaps.setdefault(s.id, []).append((did, fy, "coverage"))
                        continue
                if val is None:
                    gaps.setdefault(s.id, []).append((did, fy, "zero denominator"))
                    continue
                code = ID_TO_CODE.get(did, "*all*")
                loc = s.locator.format(code=code, fy=fy).replace("DISTRICT='*all*', ", "all districts, ") + s.condition
                rec = {"district_id": did, "period": fy, "period_type": "FY_SEP30", "variable": s.id,
                       "value": float(val), "unit": s.unit, "source_id": source_id, "source_locator": loc,
                       "numerator": float(num) if s.denominator else np.nan,
                       "denominator": float(den) if (s.denominator and den is not None) else np.nan}
                (nat_rows if did == "_national" else rows).append(rec)
    return pd.DataFrame(rows), pd.DataFrame(nat_rows), gaps


# ------------------------------------------------------------------------------------------ AO tables
def ao_tables(last_fy: int) -> tuple[dict, pd.DataFrame]:
    tables: dict = {"c-1": {}, "d-1": {}, "d-4": {}, "c-4": {}}
    parsers = {"c-1": jb.parse_c1, "d-1": jb.parse_d1, "d-4": jb.parse_d4, "c-4": jb.parse_c4}
    problems = []
    for fy in range(1997, last_fy + 1):
        for tbl, fn in parsers.items():
            got = jb.get_table(LANE, tbl, fy)
            if not got:
                problems.append((tbl, fy, "not online"))
                continue
            try:
                tables[tbl][fy] = (fn(*got), jb.source_id(tbl, fy))
            except Exception as e:  # noqa: BLE001 - parse failure is logged as a gap, not hidden
                problems.append((tbl, fy, f"parse error: {e}"))
    d2_parts = []
    # D-2 tables: the latest year, then every 5th year back to FY2009 (covers FY2005 onward)
    d2_years = sorted({last_fy} | set(range(2009, last_fy + 1, D2_TABLE_YEARS_STEP)) | {last_fy - 1})
    for fy in d2_years:
        got = jb.get_table(LANE, "d-2", fy)
        if not got:
            problems.append(("d-2", fy, "not online"))
            continue
        try:
            t = jb.parse_d2(*got, fy)
            t["source_id"] = jb.source_id("d-2", fy)
            d2_parts.append(t)
        except Exception as e:  # noqa: BLE001
            problems.append(("d-2", fy, f"parse error: {e}"))
    for tbl, fy, why in problems:
        why_txt = "not online at retrieval (not yet published)" if why == "not online" else why
        record_gap(LANE, f"{jb.source_id(tbl, fy)}_unavailable", description=f"AO Judicial Business Table "
                   f"{tbl.upper()} for FY{fy} could not be used for reconciliation: {why_txt}. IDB values for FY{fy} "
                   "are published without an AO cross-check.", periods=[fy], reason=why_txt)
    return tables, (pd.concat(d2_parts, ignore_index=True) if d2_parts else pd.DataFrame())


def load_fcms() -> pd.DataFrame | None:
    p = DATA / "processed" / "fcms" / "observations.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, usecols=lambda c: c in {"district_id", "period", "variable", "value", "source_id", "method"})
    return df[df["variable"].isin(["fcms_filings_civil", "fcms_filings_criminal_felony"])]


# ------------------------------------------------------------------------------------------ main
def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    # fresh gap fragment each build (the fragment is entirely this lane's)
    gp = DATA / "gaps" / f"{LANE}.json"
    if gp.exists():
        gp.unlink()
    log("acquiring sources")
    src = acquire()
    log("extracting (cached by sha256)")
    civ_x = extract_civil(src["civil_zip"].path, src["civil_zip"].meta["sha256"], log=log)
    crim_x = extract_criminal(src["crim_zip"].path, src["crim_zip"].meta["sha256"], log=log)

    # ---------------------------------------------------------------- civil
    log("civil: loading extract")
    cdf = civil.load(civ_x)
    unknown = sorted(set(cdf.loc[cdf["district_id"].isna(), "DISTRICT"].dropna().unique()))
    if unknown:
        raise ValueError(f"civil: DISTRICT codes not in crosswalk: {unknown}")
    dstats = civil.dedup_stats(cdf)
    fil = civil.filings(cdf)
    term = civil.terminations(cdf)
    civ_last = civil.last_fy(cdf)
    civ_years = list(range(civil.FIRST_FY, civ_last + 1))
    tfy_check = term[term["TAPEYEAR"] >= 1993]
    tfy_mismatch = int((tfy_check["TFY"] != tfy_check["TAPEYEAR"]).sum())
    log(f"civil: {len(cdf):,} records, {len(fil):,} filed cases FY{civil.FIRST_FY}-{civ_last}, {len(term):,} terminations; "
        f"TDATEUSE-FY != TAPEYEAR on {tfy_mismatch} FY1993+ records")
    comps_civ = civil.civil_components(fil, term, IDS, civ_years)
    comps_civ["patent830_835"] = comps_civ["patent830"] + comps_civ["patent835"]
    nos_grp, nos_code = civil.nos_mix(fil, IDS, civ_years)
    nos_grp["nos_group_label"] = nos_grp["nos_group"].map(NOS_GROUP_LABEL)
    disp_civ = civil.disposition_mix(term)
    disp_civ["disp_group_label"] = disp_civ["disp_group"].map(CIVIL_DISP_GROUP_LABEL)
    pq = civil.patent_quarterly(fil, IDS)
    unlisted = nos_code[(nos_code["nos_group"] == "unlisted_code") & (nos_code["district_id"] == "_national")]
    unlisted_codes = unlisted.groupby("nos")["count"].sum().sort_values(ascending=False)
    nos835_first = fil.loc[fil["NOS"] == 835, "FDATEUSE"].min()
    del cdf, fil, term, tfy_check
    gc.collect()

    # ---------------------------------------------------------------- criminal
    log("criminal: loading extract")
    kdf = criminal.load(crim_x)
    unknown = sorted(set(kdf.loc[kdf["district_id"].isna(), "DISTRICT"].dropna().unique()))
    if unknown:
        raise ValueError(f"criminal: DISTRICT codes not in crosswalk: {unknown}")
    crim_last = criminal.last_fy(kdf)
    crim_years = list(range(criminal.FIRST_FY, crim_last + 1))
    comps_crim = criminal.criminal_components(kdf, IDS, crim_years)
    off_mix = criminal.offense_mix(kdf, IDS, crim_years)
    disp_crim = criminal.disposition_mix(kdf)
    disp_crim["disp_group_label"] = disp_crim["disp_group"].map(CRIM_DISP_GROUP_LABEL)
    d2_counts = criminal.d2_code_counts(kdf)
    crim_rows = len(kdf)
    del kdf
    gc.collect()

    # ---------------------------------------------------------------- observations
    civ_specs = [s for s in SPECS if s.lane_family == "civil"]
    crim_specs = [s for s in SPECS if s.lane_family == "criminal"]
    o1, n1, g1 = observations(civ_specs, comps_civ, civ_years, "idb_civil_cv88on")
    o2, n2, g2 = observations(crim_specs, comps_crim, crim_years, "idb_criminal_cr96on")
    obs = pd.concat([o1, o2], ignore_index=True)
    nat = pd.concat([n1, n2], ignore_index=True)
    write_observations(LANE, obs)
    nat = nat.sort_values(["variable", "period"]).reset_index(drop=True)
    nat.to_csv(OUT / "national.csv", index=False)
    nat.to_parquet(OUT / "national.parquet", index=False)
    log(f"observations: {len(obs):,} district rows, {len(nat):,} national rows")

    # ---------------------------------------------------------------- detail tables
    def _wr(df: pd.DataFrame, name: str, csv: bool = False):
        df = df.reset_index(drop=True)
        df.to_parquet(OUT / f"{name}.parquet", index=False)
        if csv:
            df.to_csv(OUT / f"{name}.csv", index=False)

    nos_grp["period_type"] = "FY_SEP30"
    nos_grp["source_id"] = "idb_civil_cv88on"
    _wr(nos_grp[["district_id", "period", "period_type", "nos_group", "nos_group_label", "count", "share",
                 "filed_total", "source_id"]].sort_values(["district_id", "period", "nos_group"]), "civil_nos_mix", csv=True)
    nos_code["period_type"] = "FY_SEP30"
    _wr(nos_code.sort_values(["district_id", "period", "nos"]), "civil_nos_codes")
    disp_civ["period_type"] = "FY_SEP30"
    disp_civ["source_id"] = "idb_civil_cv88on"
    _wr(disp_civ[["district_id", "period", "period_type", "disp", "disp_label", "disp_group", "disp_group_label",
                  "count", "share", "terminated_total", "source_id"]].sort_values(["district_id", "period", "disp"]),
        "civil_disposition_mix", csv=True)
    off_mix["period_type"] = "FY_SEP30"
    off_mix["source_id"] = "idb_criminal_cr96on"
    _wr(off_mix[["district_id", "period", "period_type", "offense_category", "offense_label", "count", "share",
                 "filed_total", "count_felony", "source_id"]].sort_values(["district_id", "period", "offense_category"]),
        "criminal_offense_mix", csv=True)
    disp_crim["period_type"] = "FY_SEP30"
    disp_crim["source_id"] = "idb_criminal_cr96on"
    _wr(disp_crim[["district_id", "period", "period_type", "disp", "disp_label", "disp_group", "disp_group_label",
                   "count", "share", "terminated_total", "source_id"]].sort_values(["district_id", "period", "disp"]),
        "criminal_disposition_mix", csv=True)
    pq["source_id"] = "idb_civil_cv88on"
    pq.to_csv(OUT / "patent_quarterly.csv", index=False)

    # code tables and crosswalk
    labels = d2_labels(src["d2_page"])
    seen = d2_counts.groupby("d2_code")["count"].sum()
    labels["defendants_filed_fy1996_on"] = labels["d2_code"].map(seen).fillna(0).astype(int)
    extra = sorted(set(seen.index) - set(labels["d2_code"]))
    if extra:
        labels = pd.concat([labels, pd.DataFrame({"d2_code": extra, "label": "(not in FJC list)",
                                                  "offense_category": [d2_category(c) for c in extra],
                                                  "defendants_filed_fy1996_on": [int(seen[c]) for c in extra]})])
    labels.to_csv(OUT / "d2_offense_codes.csv", index=False)
    nos_rows = [{"nos": c, "nos_group": g, "nos_group_label": NOS_GROUP_LABEL[g]} for g, (_, cs) in NOS_GROUPS.items() for c in cs]
    pd.DataFrame(nos_rows).sort_values("nos").to_csv(OUT / "nos_groups.csv", index=False)
    pd.DataFrame([{"idb_district_code": c, "codebook_label": lab, "district_id": d, "district_name": BY_ID[d].name,
                   "circuit_code": circuit_code(d)} for c, (lab, d) in IDB_DISTRICT.items()]).to_csv(
        OUT / "district_crosswalk.csv", index=False)

    # ---------------------------------------------------------------- reconciliation
    log("reconciliation: AO Judicial Business tables + FCMS")
    tables, d2 = ao_tables(min(civ_last, crim_last))
    fcms = load_fcms()
    rec = reconcile.build(comps_civ, comps_crim, tables, d2, fcms)
    rec = rec.sort_values(["check", "level", "district_id", "period"]).reset_index(drop=True)
    rec.to_csv(OUT / "reconciliation.csv", index=False)
    summ = reconcile.summarize(rec)
    summ.to_csv(OUT / "reconciliation_summary.csv", index=False)
    if len(d2):
        chk = rec[rec["check"].str.startswith("crim_offense_")].copy()
        chk["category"] = chk["check"].str.replace("crim_offense_", "").str.replace("_vs_ao_d2", "")
        chk[["period", "category", "idb_value", "reference_value", "diff", "pct_diff", "reference_source"]].to_csv(
            OUT / "offense_mapping_check.csv", index=False)
    if fcms is None:
        record_gap(LANE, "reconcile_fcms_missing", description="FCMS observations not found; district-level FCMS "
                   "reconciliation skipped.", reason="data/processed/fcms/observations.csv absent")

    # ---------------------------------------------------------------- gaps
    record_gap(LANE, "civil_before_fy1988", description="IDB civil variables before FY1988 are not produced: the "
               "SY1988-present file holds only cases terminated from July 1, 1987, so earlier fiscal years are "
               "incomplete. (The separate 1970-1987 civil file was not processed.)",
               variables=[s.id for s in civ_specs], districts="all", periods="<1988", reason="incomplete cohort")
    record_gap(LANE, "criminal_before_fy1996", description="IDB criminal variables before FY1996 are not produced: "
               "the FY1996-present NewSTATS file starts with FY1996; the 1970-FY1995 file uses different codes and "
               "was not processed.", variables=[s.id for s in crim_specs], districts="all", periods="<1996",
               reason="out of file scope")
    for vid in ["idb_civil_pct_pro_se", "idb_civil_pct_pro_se_plaintiff"]:
        record_gap(LANE, f"{vid}_before_fy1999", description=f"{vid} not produced for FY1988-1998: the PROSE field is "
                   "blank on every record of IDB tape years 1988-1995 and 1998.", variables=[vid], districts="all",
                   periods=list(range(1988, 1999)), reason="field not reported")
    for vid, items in {**g1, **g2}.items():
        dist = [(d, y, why) for d, y, why in items if d != "_national"]
        if not dist:
            continue
        record_gap(LANE, f"{vid}_omitted_cells", description=f"{vid}: {len(dist)} district-year cells omitted "
                   f"({', '.join(sorted({w for *_, w in dist}))}): " +
                   "; ".join(f"{d} FY{y}" for d, y, _ in dist[:60]) + (" ..." if len(dist) > 60 else ""),
                   variables=[vid], districts=sorted({d for d, _, _ in dist}), periods=sorted({y for _, y, _ in dist}),
                   reason="denominator below coverage threshold or zero")

    # ---------------------------------------------------------------- variables.json
    vj = []
    for s in SPECS:
        sub = obs[obs["variable"] == s.id]
        srcs = [sub["source_id"].iloc[0]] if len(sub) else []
        srcs += ["idb_civil_codebook"] if s.lane_family == "civil" else ["idb_criminal_codebook"]
        if s.id.startswith("idb_crim_pct_") and s.numerator.startswith("offense_"):
            srcs += ["idb_criminal_d2_labels"]
        vj.append({
            "id": s.id, "label": s.label, "unit": s.unit, "period_type": "FY_SEP30", "description": s.description,
            "source_ids": srcs, "caveats": s.caveats, "higher_means": s.higher_means, "derived": s.derived,
            "formula": s.formula, "cohort": "filing" if "FDATEUSE" in s.locator or "CTFIL" in s.locator else "termination",
            "first_period": int(sub["period"].min()) if len(sub) else None,
            "last_period": int(sub["period"].max()) if len(sub) else None,
            "n_periods": int(sub["period"].nunique()), "n_districts": int(sub["district_id"].nunique()),
            "n_rows": int(len(sub)), "table": "observations",
        })
    (OUT / "variables.json").write_text(json.dumps(vj, indent=1))

    meta = {
        "civil": {**dstats, "last_fy": civ_last, "first_fy": civil.FIRST_FY, "tdateuse_fy_ne_tapeyear_fy1993_on": tfy_mismatch,
                  "nos835_first_filing": str(nos835_first.date()) if pd.notna(nos835_first) else None,
                  "unlisted_nos_codes": {int(k): int(v) for k, v in unlisted_codes.items()}},
        "criminal": {"records": crim_rows, "first_fy": criminal.FIRST_FY, "last_fy": crim_last},
    }
    (OUT / "build_meta.json").write_text(json.dumps(meta, indent=1))

    # ---------------------------------------------------------------- MDL dockets (also: python -m pipeline.idb.mdl)
    log("civil: cases by MDL docket")
    mdl.build(civ_x)
    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
