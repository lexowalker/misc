"""Build the FCMS lane: district-court Judicial Caseload Profiles (September, every year online).

    PYTHONPATH=. .venv/bin/python -m pipeline.fcms.build

Idempotent: every download goes through pipeline.common.http.fetch (disk cache), and every output
is rewritten from scratch. Outputs (data/processed/fcms/):

  observations.{parquet,csv}                 primary values (own-year profile; FY1999-2003 from the
                                             FY2004 profile's back-columns) + ranks + case-mix
  observations_current_method.{parquet,csv}  criminal-method- and weights-sensitive variables
                                             re-read from the earliest profile on the current method
  national.{parquet,csv}                     the same variables for all district courts combined
  nos_letters.csv                            every nature-of-suit/offense cell, by letter, all years
  nos_legend.csv                             letter -> printed label per profile year, with its source
  vintages.parquet                           every cell of every parsed profile (all six columns)
  revisions.csv                              cells whose value differs between profile vintages
  reconciliation.csv                         national total vs sum of districts, per year
  validation.csv                             arithmetic identity checks that did not hold
  profiles.csv                               one row per September profile found online
  variables.json                             one entry per variable emitted
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd
import pdfplumber

from pipeline.common.districts import BY_ID, IDS, TERRITORIAL
from pipeline.common.http import fetch
from pipeline.common.manifest import DATA, record_gap, register_source, write_observations

from . import LANE
from .crosswalk import NATIONAL, to_id
from .discover import (EXPLANATION_2011_URL, EXPLANATION_CURRENT_URL, SELECTED_TERMS_2016_URL, INDEX_URL,
                       discover)
from .parse import LETTERS, ROW_LABEL, parse_pdf, parse_value
from .variables import (SRH_INCLUDED, CRIMINAL_METHOD_SENSITIVE, DESCENDING_RANK_ROWS, DESCRIPTIONS,
                        HIGHER_MEANS, PCT_VAR, PERIOD_TYPE, RANKED_ROWS, ROW_VARS, WEIGHTS_SENSITIVE,
                        canonical_label, nos_variable, rank_variable)

OUT = DATA / "processed" / LANE
PUBLISHER = "Administrative Office of the U.S. Courts (Statistics Division), via uscourts.gov"
DATASET = "Federal Court Management Statistics: U.S. District Courts Judicial Caseload Profiles"
CURRENT_METHOD_FROM = 2010   # first profile year printed on the post-March-2012 criminal method (regenerated file)
CURRENT_WEIGHTS_FROM = 2015  # first profile year printed with the current case weights

# FY2011 nature-of-suit/offense legend, as printed in the FY2011 "Explanation of the Judicial Caseload
# Profiles for United States District Courts" (verified against that PDF at build time).
LEGEND_2011 = {
    "civil": ["Social Security", "Personal Injury/Product Liability", "Prisoner Petitions",
              "Forfeitures and Penalties", "Real Property", "Labor Suits", "Contracts",
              "Torts (other than personal injury/product liability)", "Copyright, Patent, and Trademark",
              "Civil Rights", "Antitrust", "All Other Civil Cases"],
    "criminal": ["Marijuana", "All Other Drugs", "Immigration", "Firearms and Explosives", "Fraud",
                 "Violent Offenses", "Sex Offenses", "Forgery and Counterfeiting", "Larceny and Theft",
                 "Justice System Offenses", "Regulatory Offenses", "All Other Criminal"],
}


def table_of(var: str) -> str:
    if var.startswith("fcms_rank_"):
        return "observations_ranks"
    if var.startswith("fcms_civil_type_") or var.startswith("fcms_criminal_type_"):
        return "observations_casemix"
    return "observations"


def source_id(year: int) -> str:
    return f"fcms_fy{year}"


def is_scanned(path: Path) -> bool:
    """True when page 2 is a full-page raster image (the FY1997-2003 files)."""
    with pdfplumber.open(path) as pdf:
        p = pdf.pages[1]
        area = p.width * p.height
        return any((i["x1"] - i["x0"]) * (i["bottom"] - i["top"]) > 0.8 * area for i in p.images)


def _parse_job(args):
    year, path = args
    gen, pages = parse_pdf(path)
    return year, gen, pages


def criminal_basis(page) -> str:
    """'defendants' or 'cases', from the profile's own wording."""
    text = (page.notes or "") + " " + (page.nos_title or "")
    return "defendants" if ("count defendants" in text or "Defendant Filings" in text) else "cases"


def verify_legend_2011(path: Path) -> None:
    with pdfplumber.open(path) as pdf:
        text = " ".join((pg.extract_text() or "") for pg in pdf.pages)
    text = re.sub(r"\s+", " ", text.replace("‐", "-").replace("–", "-"))
    for kind, labels in LEGEND_2011.items():
        for letter, label in zip(LETTERS, labels):
            head = " ".join(label.split()[:2])
            if f"{letter} - {head}" not in text:
                raise RuntimeError(f"FY2011 legend check failed: '{letter} - {head}' not in explanation PDF")


# ---------------------------------------------------------------------------------------------

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in [DATA / "sources" / f"{LANE}.json", DATA / "gaps" / f"{LANE}.json"]:
        if f.exists():
            f.unlink()   # rebuilt from scratch every run

    # ---- 1. discover + fetch + register ------------------------------------------------------
    periods = discover()
    prof_rows, to_parse, files = [], [], {}
    for per in periods:
        cr = fetch(per.pdf_url)
        scanned = is_scanned(cr.path)
        fname = per.pdf_url.rsplit("/", 1)[-1]
        files[per.year] = fname
        register_source(
            LANE, source_id(per.year), url=per.pdf_url,
            dataset=f"{DATASET}, 12-month period ending September 30, {per.year}",
            publisher=PUBLISHER,
            vintage=f"FY{per.year} (12 months ending {per.year}-09-30); profile also prints FY{per.year - 5}-FY{per.year - 1}",
            cached=cr,
            notes=(f"Linked from {per.page_url} ('{per.page_title}'). "
                   + ("Scanned image with a machine-OCR text layer: NOT parsed (see gaps)." if scanned else
                      "95 pages: national profile + one page per district.")))
        prof_rows.append({"year": per.year, "source_id": source_id(per.year), "page_url": per.page_url,
                          "pdf_url": per.pdf_url, "file": fname, "scanned": scanned})
        if not scanned:
            to_parse.append((per.year, str(cr.path)))
    expl11 = fetch(EXPLANATION_2011_URL)
    register_source(LANE, "fcms_explanation_district_2011", url=EXPLANATION_2011_URL,
                    dataset="Explanation of the Judicial Caseload Profiles for United States District Courts (FY2011)",
                    publisher=PUBLISHER, vintage="September 2011", cached=expl11,
                    notes="Source of the FY2011 nature-of-suit/offense letter legend and variable definitions.")
    verify_legend_2011(expl11.path)
    expl = fetch(EXPLANATION_CURRENT_URL)
    register_source(LANE, "fcms_explanation_district_current", url=EXPLANATION_CURRENT_URL,
                    dataset="Explanation of the Judicial Caseload Profiles for United States District Courts (xlsx)",
                    publisher=PUBLISHER, vintage="linked from FY2017-FY2025 period pages", cached=expl,
                    notes="Variable definitions and ranking rules (numerical standings).")
    terms = fetch(SELECTED_TERMS_2016_URL)
    register_source(LANE, "fcms_selected_terms_2016", url=SELECTED_TERMS_2016_URL,
                    dataset="Explanation of Selected Terms (Federal Court Management Statistics, September 2016)",
                    publisher=PUBLISHER, vintage="September 2016", cached=terms,
                    notes="Documents the March 2012 change to counting criminal defendants / proceeding-date medians and the case weights approved for use after December 2015.")
    index = fetch(INDEX_URL)
    register_source(LANE, "fcms_index_page", url=INDEX_URL, dataset="Federal Court Management Statistics index page",
                    publisher=PUBLISHER, vintage=f"retrieved {index.meta['retrieved_at'][:10]}", cached=index,
                    notes="Lists every period published (1997 onward); used only to discover the September profiles.")

    # ---- 2. parse ------------------------------------------------------------------------------
    parsed: dict[int, tuple[str, list]] = {}
    with ProcessPoolExecutor(max_workers=2) as ex:
        for year, gen, pages in ex.map(_parse_job, to_parse):
            parsed[year] = (gen, pages)
    years_parsed = sorted(parsed)
    earliest = years_parsed[0]
    basis_by_year, gen_by_year = {}, {}
    page_index: dict[int, dict[str, object]] = {}
    for year, (gen, pages) in parsed.items():
        ids = {}
        for p in pages:
            did = NATIONAL if p.is_national else to_id(p.heading)
            if did in ids:
                raise RuntimeError(f"FY{year}: two pages for {did}")
            ids[did] = p
        missing = sorted(set(IDS) - set(ids))
        if missing:
            record_gap(LANE, f"court_absent_fy{year}", description=f"No FCMS profile page for {missing} in FY{year}",
                       districts=missing, periods=[year], reason="court absent from the September profile")
        if NATIONAL not in ids:
            raise RuntimeError(f"FY{year}: no national page")
        page_index[year] = ids
        nat = ids[NATIONAL]
        basis_by_year[year] = criminal_basis(nat)
        gen_by_year[year] = gen
    for r in prof_rows:
        r["parsed"] = r["year"] in parsed
        r["layout"] = gen_by_year.get(r["year"], "scanned")
        r["criminal_basis"] = basis_by_year.get(r["year"], "")
    pd.DataFrame(prof_rows).to_csv(OUT / "profiles.csv", index=False)

    # ---- 3. every cell of every profile (vintages) ------------------------------------------------
    cells = []
    for P, ids in page_index.items():
        for did, p in ids.items():
            for row, vals in p.rows.items():
                for j, (y, raw) in enumerate(zip(p.years, vals)):
                    cells.append({"profile_year": P, "district_id": did, "data_year": y, "row": row,
                                  "col": j, "raw": raw, "value": parse_value(raw), "page": p.page_no,
                                  "heading": p.heading})
    vint = pd.DataFrame(cells)
    vint.to_parquet(OUT / "vintages.parquet", index=False)

    def locator(P, page, heading, what, back=False):
        # file + page + printed row / column labels (the district is the row's district_id)
        s = f"{files[P]} p.{page}: {what}"
        if back:
            s += f" [back-column of FY{P} profile]"
        return s

    def method_of(var, P):
        if var in CRIMINAL_METHOD_SENSITIVE or var.startswith("fcms_criminal_type_"):
            return "crim_defendants" if basis_by_year[P] == "defendants" else "crim_cases"
        if var in WEIGHTS_SENSITIVE:
            return "weights_2015" if P >= CURRENT_WEIGHTS_FROM else "weights_old"
        return ""

    # ---- 4. primary observations ---------------------------------------------------------------
    obs, gaps_cells = [], []
    for P, ids in page_index.items():
        for did, p in ids.items():
            for row, vals in p.rows.items():
                if row.startswith("pct_change"):
                    for j, (y, raw) in enumerate(zip(p.years, vals)):
                        if y == P:
                            continue
                        k = P - y
                        var = PCT_VAR.format(k=k)
                        what = f'"{ROW_LABEL[row]}" / "Sep 30 {y}" (FY{P} over FY{y})'
                        v = parse_value(raw)
                        if v is None:
                            # only the columns the layout prints for this row can be missing data
                            if (row == "pct_change_last" and k != 1) or (row == "pct_change_earlier" and k == 1):
                                continue
                            gaps_cells.append((did, P, var, raw))
                            continue
                        obs.append((did, P, var, v, "percent", P, locator(P, p.page_no, p.heading, what), method_of(var, P)))
                    continue
                var, unit, _ = ROW_VARS[row]
                for j, (y, raw) in enumerate(zip(p.years, vals)):
                    own = (y == P)
                    back = (P == earliest and y < earliest)
                    if not (own or back):
                        continue
                    what = f'"{ROW_LABEL[row]}" / "Sep 30 {y}"'
                    v = parse_value(raw)
                    if v is None:
                        gaps_cells.append((did, y, var, raw))
                        continue
                    obs.append((did, y, var, v, unit, P, locator(P, p.page_no, p.heading, what, back), method_of(var, P)))
            # ranks (own year only)
            for row, (us, ci) in p.ranks.items():
                base = (PCT_VAR.format(k=1) if row in ("pct_change", "pct_change_last") else
                        PCT_VAR.format(k=5) if row == "pct_change_earlier" else ROW_VARS[row][0])
                for scope, raw in (("us", us), ("circuit", ci)):
                    rv = rank_variable(scope, base)
                    margin = "U.S." if scope == "us" else "Circuit"
                    what = f'"{ROW_LABEL[row]}" / Numerical Standing Within "{margin}"'
                    v = parse_value(raw)
                    if v is None:
                        gaps_cells.append((did, P, rv, raw))
                        continue
                    obs.append((did, P, rv, v, "rank", P, locator(P, p.page_no, p.heading, what), method_of(base, P)))
    # nature of suit / offense (own year only)
    legend_rows, letter_rows = [], []
    for P, ids in page_index.items():
        nat = ids[NATIONAL]
        if nat.nos_labels:
            legend = {k: dict(nat.nos_labels[k]) for k in ("civil", "criminal")}
            legend_src = (source_id(P), f"{files[P]} p.{nat.page_no} national profile nature-of-suit list")
        elif P == 2011:
            legend = {k: dict(zip(LETTERS, v)) for k, v in LEGEND_2011.items()}
            legend_src = ("fcms_explanation_district_2011", "Nature of Suit and Offense Categories box")
        else:
            legend, legend_src = None, None
        if legend:
            for kind in ("civil", "criminal"):
                for L in LETTERS:
                    legend_rows.append({"profile_year": P, "kind": kind, "letter": L, "label": legend[kind][L],
                                        "variable": nos_variable(kind, legend[kind][L]),
                                        "legend_source_id": legend_src[0], "legend_locator": legend_src[1],
                                        "letter_prefix_printed": f"{kind}:{L}" not in nat.nos_labels.get("_unprefixed", {})})
        for did, p in ids.items():
            for kind in ("civil", "criminal"):
                row_name = "Civil" if kind == "civil" else "Criminal"
                vals = {L: parse_value(p.nos[kind][L]) for L in ["Total"] + LETTERS}
                # A '-' in this table is a zero: each profile uses either '-' or '0' for empty categories
                # (never both), and the letters sum to the printed total exactly when '-' counts as 0.
                dash_is_zero = (vals["Total"] is not None and
                                sum(v for L, v in vals.items() if L != "Total" and v is not None) == vals["Total"])
                for L in ["Total"] + LETTERS:
                    raw = p.nos[kind][L]
                    v = vals[L]
                    label = legend[kind][L] if (legend and L != "Total") else ("Total" if L == "Total" else "")
                    if nat.nos_labels and did == NATIONAL:
                        what = f'NOS list "{"Total " + row_name if L == "Total" else L + "-" + label}"'
                    else:
                        what = f'NOS table "{row_name}" / "{L}"'
                    loc = locator(P, p.page_no, p.heading, what)
                    if v is None and L != "Total" and dash_is_zero and raw is not None and parse_value(raw) is None \
                            and raw.strip().translate({0xad: 45, 0x2010: 45}) == "-":
                        v = 0.0
                        loc += " ('-' = 0: letters sum to Total)"
                    letter_rows.append({"district_id": did, "period": P, "kind": kind, "letter": L, "raw": raw,
                                        "value": v, "label": label, "source_id": source_id(P), "source_locator": loc,
                                        "criminal_basis": basis_by_year[P] if kind == "criminal" else ""})
                    if L == "Total":
                        var = "fcms_filings_civil" if kind == "civil" else "fcms_filings_criminal_felony"
                    elif legend:
                        var = nos_variable(kind, legend[kind][L])
                        loc += f" ({L} = {label}" + ("" if legend_src[0] == source_id(P) else f"; legend {legend_src[0]}") + ")"
                    else:
                        continue   # letters without a legend stay in nos_letters.csv only
                    if v is None:
                        gaps_cells.append((did, P, var, raw))
                        continue
                    obs.append((did, P, var, v, "cases" if kind == "civil" or basis_by_year[P] == "cases" else "defendants",
                                P, loc, method_of(var, P)))
    pd.DataFrame(legend_rows).to_csv(OUT / "nos_legend.csv", index=False)
    pd.DataFrame(letter_rows).to_csv(OUT / "nos_letters.csv", index=False)

    cols = ["district_id", "period", "variable", "value", "unit", "profile_year", "source_locator", "method"]
    df = pd.DataFrame(obs, columns=cols)
    df["period_type"] = PERIOD_TYPE
    df["source_id"] = df["profile_year"].map(source_id)
    # cell-level caveats on faithfully transcribed but implausible-looking cells (statistics audit, item 6)
    df, caveat_rows, special_reason = apply_cell_caveats(df, vint)
    for did, y, var, raw in special_reason:
        gaps_cells.append((did, y, var, raw))
    pd.DataFrame(caveat_rows, columns=CAVEAT_COLS).to_csv(OUT / "cell_caveats.csv", index=False)
    district = df[df["district_id"] != NATIONAL].copy()
    national = df[df["district_id"] == NATIONAL].drop(columns=["district_id"]).copy()
    # three tables (core / published ranks / case-mix categories) so each CSV stays well under 20 MB
    tbl = district["variable"].map(table_of)
    for name in ("observations", "observations_ranks", "observations_casemix"):
        write_observations(LANE, district[tbl == name].drop(columns=["profile_year"]), name=name)
    national = national[["period", "period_type", "variable", "value", "unit", "source_id", "source_locator",
                         "profile_year", "method"]].sort_values(["variable", "period"]).reset_index(drop=True)
    national.to_parquet(OUT / "national.parquet", index=False)
    national.to_csv(OUT / "national.csv", index=False)

    # ---- 5. current-method series ----------------------------------------------------------------
    cur = []
    sens_rows = {r: v for r, (v, _, _) in ROW_VARS.items() if v in CRIMINAL_METHOD_SENSITIVE | WEIGHTS_SENSITIVE}
    for (did, y, row), g in vint[vint["row"].isin(sens_rows)].groupby(["district_id", "data_year", "row"]):
        var = sens_rows[row]
        if var in WEIGHTS_SENSITIVE:
            ok = g[g["profile_year"] >= max(y, CURRENT_WEIGHTS_FROM)]
            meth = "weights_2015"
        else:
            ok = g[(g["profile_year"] >= y) & g["profile_year"].map(lambda P: basis_by_year[P] == "defendants")]
            meth = "crim_defendants"
        if ok.empty:
            continue
        r = ok.sort_values("profile_year").iloc[0]
        if r["value"] is None or pd.isna(r["value"]):
            continue
        P = int(r["profile_year"])
        what = f'"{ROW_LABEL[row]}" / "Sep 30 {y}"'
        loc = locator(P, int(r["page"]), r["heading"], what)
        if P != y:
            loc += f" [earliest current-method profile printing FY{y}]"
        cur.append((did, y, var, float(r["value"]), ROW_VARS[row][1], P, loc, meth))
    cdf = pd.DataFrame(cur, columns=cols)
    cdf["period_type"] = PERIOD_TYPE
    cdf["source_id"] = cdf["profile_year"].map(source_id)
    cdf_d = cdf[cdf["district_id"] != NATIONAL]
    write_observations(LANE, cdf_d.drop(columns=["profile_year"]), name="observations_current_method")
    cdf_n = cdf[cdf["district_id"] == NATIONAL].drop(columns=["district_id"])
    cdf_n.sort_values(["variable", "period"]).to_csv(OUT / "national_current_method.csv", index=False)

    # ---- 6. revisions ------------------------------------------------------------------------------
    prim = df[["district_id", "period", "variable", "value", "profile_year"]]
    row_of = {v: r for r, (v, _, _) in ROW_VARS.items()}
    prim = prim[prim["variable"].isin(row_of)].copy()
    prim["row"] = prim["variable"].map(row_of)
    m = vint.merge(prim, left_on=["district_id", "data_year", "row"], right_on=["district_id", "period", "row"],
                   suffixes=("_other", "_primary"))
    m = m[(m["profile_year_other"] != m["profile_year_primary"]) & m["value_other"].notna()]
    rev = m[(m["value_other"] - m["value_primary"]).abs() > 1e-9]
    rev = rev.assign(diff=rev["value_other"] - rev["value_primary"])[
        ["district_id", "period", "variable", "profile_year_primary", "value_primary", "profile_year_other",
         "value_other", "diff"]].sort_values(["variable", "district_id", "period", "profile_year_other"])
    rev["method_change"] = [
        ("criminal counting method" if (v in CRIMINAL_METHOD_SENSITIVE and basis_by_year[a] != basis_by_year[b]) else
         "case weights" if (v in WEIGHTS_SENSITIVE and (a >= CURRENT_WEIGHTS_FROM) != (b >= CURRENT_WEIGHTS_FROM)) else "")
        for v, a, b in zip(rev["variable"], rev["profile_year_primary"], rev["profile_year_other"])]
    rev.to_csv(OUT / "revisions.csv", index=False)
    comp = m.assign(differs=(m["value_other"] - m["value_primary"]).abs() > 1e-9)
    comp["method_change"] = [
        (v in CRIMINAL_METHOD_SENSITIVE and basis_by_year[a] != basis_by_year[b]) or
        (v in WEIGHTS_SENSITIVE and (a >= CURRENT_WEIGHTS_FROM) != (b >= CURRENT_WEIGHTS_FROM))
        for v, a, b in zip(comp["variable"], comp["profile_year_primary"], comp["profile_year_other"])]
    comp["differs_method"] = comp["differs"] & comp["method_change"]
    comp["differs_other"] = comp["differs"] & ~comp["method_change"]
    rev_summary = comp.groupby(["variable"]).agg(compared=("differs", "size"), differing=("differs", "sum"),
                                                 differing_method=("differs_method", "sum"),
                                                 differing_other=("differs_other", "sum")).reset_index()
    rev_summary.to_csv(OUT / "revisions_summary.csv", index=False)

    # ---- 7. reconciliation -------------------------------------------------------------------------
    rec = []
    terr = set(TERRITORIAL)
    # integer counts must add up exactly; vacant judgeship months are printed to one decimal per district, so
    # the sum of 94 rounded values may differ from the rounded national value by up to 94 x 0.05 = 4.7
    for var in ["fcms_filings_total", "fcms_terminations_total", "fcms_pending_total", "fcms_judgeships",
                "fcms_civil_over_3yrs_count", "fcms_filings_civil", "fcms_filings_criminal_felony",
                "fcms_vacant_judgeship_months"]:
        d = district[district["variable"] == var]
        n = national[national["variable"] == var].set_index("period")["value"]
        half_unit = 0.05 if var == "fcms_vacant_judgeship_months" else 0.0
        for y, g in d.groupby("period"):
            if y not in n.index:
                continue
            tot = round(float(g["value"].sum()), 1)
            diff = round(tot - float(n[y]), 1)
            bound = round(len(g) * half_unit, 2)
            rec.append({"variable": var, "period": int(y), "national": n[y], "n_districts": len(g),
                        "sum_districts": tot,
                        "sum_article_iii": round(float(g[~g["district_id"].isin(terr)]["value"].sum()), 1),
                        "diff_sum_minus_national": diff, "rounding_bound": bound,
                        "within_rounding": abs(diff) <= bound + 1e-9})
    rec = pd.DataFrame(rec)
    # for a year outside rounding, show the same comparison in every profile vintage that prints that year
    row_of = {v: r for r, (v, _, _) in ROW_VARS.items()}
    notes = []
    for r in rec.itertuples():
        if r.within_rounding or r.variable not in row_of:
            notes.append("")
            continue
        vv = vint[(vint["row"] == row_of[r.variable]) & (vint["data_year"] == r.period)]
        parts = []
        for P, g in vv.groupby("profile_year"):
            n_ = g[g["district_id"] == NATIONAL]["value"]
            d_ = g[g["district_id"] != NATIONAL]["value"]
            if len(n_) and d_.notna().all():
                parts.append(f"FY{P} profile: districts {round(float(d_.sum()), 1):g} vs national {float(n_.iloc[0]):g}")
        notes.append("outside rounding; as printed in each vintage: " + "; ".join(parts))
    rec["note"] = notes
    rec.to_csv(OUT / "reconciliation.csv", index=False)

    # ---- 8. validation (identities) -----------------------------------------------------------------
    val = []
    piv = vint.pivot_table(index=["profile_year", "district_id", "data_year"], columns="row", values="value",
                           aggfunc="first")
    for (P, did, y), r in piv.iterrows():
        J = r.get("judgeships")
        tol = 0.5 if basis_by_year[P] == "defendants" else 2.0
        if J and J > 0:
            for a, b in [("filings_total", "pj_total"), ("pending_total", "pj_pending"),
                         ("terminations_total", "pj_terminations")]:
                if pd.notna(r.get(a)) and pd.notna(r.get(b)):
                    dev = r[a] / J - r[b]
                    if abs(dev) > tol + 1e-9:
                        val.append({"profile_year": P, "district_id": did, "data_year": y,
                                    "check": f"{b} ~ {a}/judgeships (tol {tol})", "lhs": r[b],
                                    "rhs": round(r[a] / J, 3), "deviation": round(dev, 3)})
        parts = [r.get("pj_civil"), r.get("pj_criminal_felony"), r.get("pj_srh")]
        if pd.notna(r.get("pj_total")) and pd.notna(parts[0]) and pd.notna(parts[1]):
            s = sum(x for x in parts if pd.notna(x))
            if abs(s - r["pj_total"]) > 2:
                val.append({"profile_year": P, "district_id": did, "data_year": y,
                            "check": "pj_civil+pj_criminal_felony+pj_srh ~ pj_total (tol 2)",
                            "lhs": r["pj_total"], "rhs": s, "deviation": s - r["pj_total"]})
    nl = pd.DataFrame(letter_rows)
    for (did, P, kind), g in nl.groupby(["district_id", "period", "kind"]):
        tot = g[g["letter"] == "Total"]["value"].iloc[0]
        s = g[g["letter"] != "Total"]["value"].fillna(0).sum()
        if tot is not None and pd.notna(tot) and s != tot:
            val.append({"profile_year": P, "district_id": did, "data_year": P, "check": f"NOS {kind} letters sum to Total",
                        "lhs": tot, "rhs": s, "deviation": s - tot})
    pd.DataFrame(val, columns=["profile_year", "district_id", "data_year", "check", "lhs", "rhs", "deviation"]).to_csv(
        OUT / "validation.csv", index=False)

    # ---- 9. gaps ------------------------------------------------------------------------------------
    scanned_years = sorted(r["year"] for r in prof_rows if r["scanned"])
    if scanned_years:
        first_back = earliest - 5
        record_gap(LANE, "scanned_profiles", description=(
            f"FCMS September profiles for FY{scanned_years[0]}-FY{scanned_years[-1]} are posted only as scanned images "
            f"with a machine-OCR text layer that drops decimal points and misreads characters (e.g. '67' for 6.7, "
            f"'Fihings'). They were not parsed. FY{first_back}-FY{earliest - 1} core values are taken from the "
            f"back-columns of the FY{earliest} profile instead; FY{scanned_years[0] - 5}-FY{first_back - 1} "
            f"(the scans' own years and back-columns) have no machine-readable source. Files: "
            + ", ".join(source_id(y) for y in scanned_years)),
            variables=["all fcms_* variables"], districts="all",
            periods=list(range(scanned_years[0] - 5, first_back)),
            reason="source is a scanned image; transcription would risk wrong numbers")
        record_gap(LANE, "own_year_only_items_fy1999_2003", description=(
            f"Ranks (numerical standings), percent changes in filings, and the nature-of-suit/offense table are printed "
            f"only for a profile's own year, so they are unavailable for FY{first_back}-FY{earliest - 1}, whose own "
            f"profiles are scanned images."),
            variables=["fcms_rank_*", "fcms_pct_change_filings_*", "fcms_filings_civil", "fcms_filings_criminal_felony",
                       "fcms_civil_type_*", "fcms_criminal_type_*"], districts="all",
            periods=list(range(first_back, earliest)), reason="only printed for the profile's own year")
    no_legend = sorted(P for P in page_index if not page_index[P][NATIONAL].nos_labels and P != 2011)
    if no_legend:
        record_gap(LANE, "nos_legend_not_printed", description=(
            f"The FY{no_legend[0]}-FY{no_legend[-1]} profiles print nature-of-suit/offense counts under letters A-L but "
            f"refer to a fold-out legend that is not in the online PDF, and no explanation document is linked from those "
            f"period pages. The letter counts are kept in nos_letters.csv (unlabelled); named fcms_civil_type_* / "
            f"fcms_criminal_type_* variables are not emitted for these years. Totals (fcms_filings_civil, "
            f"fcms_filings_criminal_felony) are emitted."),
            variables=["fcms_civil_type_*", "fcms_criminal_type_*"], districts="all", periods=no_legend,
            reason="category legend not published with the file")
    record_gap(LANE, "srh_count_not_published", description=(
        "The profiles print supervised release hearings only per authorized judgeship "
        "(fcms_filings_per_judgeship_supervised_release_hearings); an absolute count is not printed, so "
        "fcms_filings_supervised_release_hearings is not emitted (it is not derived from rounded per-judgeship values)."),
        variables=["fcms_filings_supervised_release_hearings"], districts="all", periods="all",
        reason="not published in the profile")
    record_by_design_gaps(district)
    # any district-year still missing in a year the variable is published for (e.g. a rank whose value cell is
    # blank prints no standing at all) is logged as a blank cell
    logged = {(d, int(y), v) for d, y, v, _ in gaps_cells}
    have = set(zip(district["district_id"], district["period"].astype(int), district["variable"]))
    for var, g in district.groupby("variable"):
        for y in sorted(g["period"].unique()):
            for did in IDS:
                if int(y) in page_index and did not in page_index[int(y)]:
                    continue   # court absent that year: covered by its court_absent record
                if (did, int(y), var) not in have and (did, int(y), var) not in logged:
                    gaps_cells.append((did, int(y), var, None))
    # cell-level gaps, grouped by (variable, reason, district)
    filings = vint[vint["row"] == "filings_total"].set_index(["profile_year", "district_id", "data_year"])["value"]
    blank_value_cells = {(d, int(y), v) for d, y, v, r in gaps_cells if not v.startswith("fcms_rank_") and
                         (r is None or (isinstance(r, float) and pd.isna(r)) or (isinstance(r, str) and not r.strip()))}
    grouped = defaultdict(list)
    for did, y, var, raw in gaps_cells:
        if did == NATIONAL and var.startswith("fcms_rank_"):
            continue   # the national page has no standings
        key_d = "national" if did == NATIONAL else did
        if (did, y, var, raw) in special_reason:
            reason = special_reason[(did, y, var, raw)]
        elif var.startswith("fcms_rank_circuit") and did == "dcd":
            reason = "not applicable: the D.C. Circuit has a single district, so no within-circuit standing is printed"
        elif var.startswith("fcms_rank_"):
            reason = ("rank printed as '-' (not ranked)" if raw else
                      "rank cell blank in source (no standing printed; the value cell is blank too)"
                      if (did, int(y), rank_base(var)) in blank_value_cells else "rank cell blank in source")
        elif var.startswith("fcms_median"):
            reason = ("printed '-': the AO does not compute a median when the district had fewer than 10 "
                      "terminations (disposition medians) or fewer than 10 civil trials (trial median)")
        elif var == "fcms_weighted_filings_per_judgeship" and did in TERRITORIAL:
            reason = "weighted filings are not printed for the territorial courts ('-' through FY2024, blank in FY2025)"
        elif var == "fcms_filings_per_judgeship_supervised_release_hearings" and y < 2002:
            reason = ("printed '-': supervised release hearings were added to the profiles beginning with FY2002 "
                      "(Explanation of Selected Terms)")
        elif var.startswith("fcms_pct_change_filings_") and raw is None:
            k = int(var.rsplit("_", 1)[1][:-2])
            try:
                cur_f, old_f = filings[(y, did, y)], filings[(y, did, y - k)]
                implied = (cur_f - old_f) / old_f * 100
            except KeyError:
                implied = None
            if implied is not None and abs(implied) < 0.05:
                reason = ("cell blank in source; the filings printed in the same profile imply a change that rounds "
                          "to 0.0% (not filled in)")
            else:
                reason = "cell blank in source"
        elif raw is None:
            reason = "cell blank in source"
        else:
            reason = f"printed as '{raw}' (no data) in source"
        grouped[(var, reason, key_d)].append(int(y))
    by_var_reason = defaultdict(list)
    for (var, reason, d), ys in grouped.items():
        by_var_reason[(var, reason)].append((d, sorted(set(ys))))
    for (var, reason), lst in sorted(by_var_reason.items()):
        n_cells = sum(len(ys) for _, ys in lst)
        detail = "; ".join(f"{d}: {','.join(map(str, ys))}" for d, ys in sorted(lst))
        gid = f"cells:{var}:{re.sub(r'[^a-z]+', '_', reason[:40].lower()).strip('_')}"
        record_gap(LANE, gid, description=f"{n_cells} values of {var} not published ({detail}).",
                   variables=[var], districts=sorted(d for d, _ in lst),
                   periods=sorted({y for _, ys in lst for y in ys}), reason=reason)

    # ---- 10. variables.json ------------------------------------------------------------------------
    write_variables(district, rev_summary)
    print(f"fcms: {len(district)} district observations, {len(national)} national, "
          f"{district['variable'].nunique()} variables, FY{district['period'].min()}-FY{district['period'].max()}; "
          f"current-method rows {len(cdf_d)}; revisions {len(rev)}; validation exceptions {len(val)}")


# ------------------------------------------------------------------ cell caveats ----------
CAVEAT_COLS = ["district_id", "period", "variable", "value", "us_value", "code", "caveat", "action",
               "source_id", "source_locator"]
DISPOSITION_MEDIANS = ["fcms_median_months_civil_filing_to_disposition",
                       "fcms_median_months_criminal_felony_filing_to_disposition",
                       "fcms_median_months_civil_filing_to_trial"]
LOW_MEDIAN_RATIO = 1 / 8     # flag a median below one eighth of the U.S. median for the same year


def rank_base(var: str) -> str:
    """'fcms_rank_us_median_months_civil_...' -> 'fcms_median_months_civil_...'."""
    return "fcms_" + var.split("_", 3)[3]


def apply_cell_caveats(df: pd.DataFrame, vint: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], dict]:
    """Flag faithfully transcribed source cells that would mislead on a map, without changing any value.

    * A disposition/trial median printed as 0.0, or below one eighth of the same year's U.S. median, gets a
      ``caveat`` (S.D. Fla. FY2023 civil 0.0; E.D. Pa. FY2004-06 civil 1.0; ...). Its published ranks get the
      same caveat.
    * Jurors 'Avg. Present for Jury Selection' printed as 0 means no jury selection was held (an average over
      selections that took place cannot be 0); the paired 'Percent Not Selected or Challenged' is then 0 of 0.
      Both cells are not measurements, so they are left out of the observations and logged as gaps with the
      printed value (D.N.M.I. FY2024, where the same page leaves Trials Completed blank).

    Returns (df with a ``caveat`` column, caveat rows for cell_caveats.csv, {(did, y, var, raw): gap reason}).
    """
    df = df.copy()
    df["caveat"] = ""
    rows: list[dict] = []
    special: dict[tuple, str] = {}
    us = df[df["district_id"] == NATIONAL].set_index(["period", "variable"])["value"]
    dist = df["district_id"] != NATIONAL
    flagged: dict[tuple, str] = {}
    for i in df.index[dist & df["variable"].isin(DISPOSITION_MEDIANS)]:
        r = df.loc[i]
        u = us.get((r["period"], r["variable"]))
        if u is None or pd.isna(u) or u <= 0:
            continue
        if r["value"] == 0:
            code = "printed_zero_median"
            text = (f"Printed as 0.0 months (U.S. median {u:g} that year). Taken literally, half of the cases were "
                    "disposed of within about 1.5 days of filing. Transcribed exactly as printed; the profile gives "
                    "no explanation. Treat with caution on maps and in rankings.")
        elif r["value"] < LOW_MEDIAN_RATIO * u:
            code = "extreme_low_median"
            text = (f"Printed {r['value']:.1f} months, less than one eighth of the U.S. median ({u:g}) that year. "
                    "Transcribed exactly as printed; the profile gives no explanation. Treat with caution on maps "
                    "and in rankings.")
        else:
            continue
        df.at[i, "caveat"] = text
        flagged[(r["district_id"], r["period"], r["variable"])] = text
        rows.append({"district_id": r["district_id"], "period": int(r["period"]), "variable": r["variable"],
                     "value": r["value"], "us_value": u, "code": code, "caveat": text, "action": "kept, flagged",
                     "source_id": r["source_id"], "source_locator": r["source_locator"]})
    is_rank = dist & df["variable"].str.startswith("fcms_rank_")
    for i in df.index[is_rank]:
        r = df.loc[i]
        t = flagged.get((r["district_id"], r["period"], rank_base(r["variable"])))
        if t:
            df.at[i, "caveat"] = f"Published rank of a flagged value ({rank_base(r['variable'])}): {t}"
    # jurors: 0 present = no jury selection held
    jur = ["fcms_jurors_avg_present", "fcms_jurors_pct_not_selected"]
    row_of = {v: r for r, (v, _, _) in ROW_VARS.items()}
    zero = df[dist & (df["variable"] == "fcms_jurors_avg_present") & (df["value"] == 0)]
    drop = []
    for _, z in zero.iterrows():
        for var in jur:
            m = dist & (df["district_id"] == z["district_id"]) & (df["period"] == z["period"]) & (df["variable"] == var)
            for i in df.index[m]:
                r = df.loc[i]
                rv = vint[(vint["profile_year"] == r["profile_year"]) & (vint["district_id"] == r["district_id"])
                          & (vint["data_year"] == r["period"]) & (vint["row"] == row_of[var])]["raw"]
                raw = str(rv.iloc[0]) if len(rv) else f"{r['value']:g}"
                text = (f"Printed as '{raw}'. No jury selection was held that year (an average over selections that "
                        "took place cannot be 0 jurors present; the percent not selected is then 0 of 0), so this is "
                        "not a measured zero. Left out of the observations; shown as 'no jury selections'.")
                rows.append({"district_id": r["district_id"], "period": int(r["period"]), "variable": var,
                             "value": r["value"], "us_value": us.get((r["period"], var)), "code": "no_jury_selections",
                             "caveat": text, "action": "omitted from observations, logged as gap",
                             "source_id": r["source_id"], "source_locator": r["source_locator"]})
                special[(r["district_id"], int(r["period"]), var, raw)] = (
                    "printed '0' but no jury selection was held (0 jurors present); not a measured value")
                drop.append(i)
    df = df.drop(index=drop)
    return df, rows, special


def record_by_design_gaps(district: pd.DataFrame) -> None:
    """Gap records for cells that are empty by design (statistics audit, item 7)."""
    years_of = district.groupby("variable")["period"].agg(lambda s: set(int(x) for x in s))
    cm_years = set().union(*(years_of[v] for v in years_of.index if v.startswith("fcms_civil_type_")))
    cpt, ipr = "fcms_civil_type_copyright_patent_trademark", "fcms_civil_type_intellectual_property_rights"
    for var, other, label_here, label_other in [
            (cpt, ipr, "Copyright, Patent, and Trademark", "Intellectual Property Rights"),
            (ipr, cpt, "Intellectual Property Rights", "Copyright, Patent, and Trademark")]:
        if var not in years_of:
            continue
        missing = sorted(cm_years - years_of[var])
        if missing:
            record_gap(LANE, f"casemix_letter_i_relabel:{var}", description=(
                f"Civil case-mix letter I is printed as '{label_other}' in FY{min(missing)}-FY{max(missing)}, so "
                f"{var} ('{label_here}') has no value in those years; see {other}. The AO relabelled letter I in "
                "FY2021 without stating the two categories are identical, so they are kept apart, not spliced."),
                variables=[var], districts="all", periods=missing, reason="category relabelled (by design)")
    rank_years = set().union(*(years_of[v] for v in years_of.index if v.startswith("fcms_rank_us_")))
    for scope in ("us", "circuit"):
        var = rank_variable(scope, PCT_VAR.format(k=5))
        if var not in years_of:
            continue
        missing = sorted(rank_years - years_of[var])
        if missing:
            record_gap(LANE, f"rank_5yr_change_not_printed:{scope}", description=(
                "The 'Over Earlier Years' numerical standing (rank of the 5-year % change in filings) is printed "
                "only in the FY2004-09 and FY2011 layouts. The regenerated FY2010 file and the FY2012+ layouts "
                "print one standing for the percent-change row, which ranks the 1-year change "
                f"({rank_variable(scope, PCT_VAR.format(k=1))}). The 5-year change itself is still emitted "
                f"({PCT_VAR.format(k=5)})."),
                variables=[var], districts="all", periods=missing, reason="not printed in this layout (by design)")


def write_variables(district: pd.DataFrame, rev_summary: pd.DataFrame) -> None:
    label_of = {v: lab for _, (v, _, lab) in ROW_VARS.items()}
    unit_of = district.groupby("variable")["unit"].agg(lambda s: sorted(set(s)))
    legend = pd.read_csv(OUT / "nos_legend.csv")
    nos_label = {r.variable: r.label for r in legend.itertuples()}
    revd = rev_summary.set_index("variable").to_dict("index")
    cm = pd.read_parquet(OUT / "observations_current_method.parquet")
    cm_first = cm.groupby("variable")["period"].min().to_dict()
    cav = pd.read_csv(OUT / "cell_caveats.csv")
    cav_n = cav.groupby("variable").size().to_dict()
    out = []
    for var, g in district.groupby("variable"):
        years = sorted(g["period"].unique())
        caveats = "As published by the AO in the September Judicial Caseload Profile for the year. "
        if years[0] < 2004:
            caveats += ("FY1999-2003 values come from the back-columns of the FY2004 profile (the FY1997-2003 "
                        "profiles online are scanned images). ")
        if var in CRIMINAL_METHOD_SENSITIVE:
            caveats += ("SERIES BREAK: values from the FY2004-09 and FY2011 profiles count criminal felony cases and "
                        "measure criminal medians from the filing date; the FY2010 file (regenerated) and FY2012+ "
                        "profiles count defendants and measure from the proceeding date (AO: 'not comparable'). "
                        "See column `method` and observations_current_method for a consistent FY2005+ series. ")
        if var in SRH_INCLUDED:
            caveats += ("FY1999-2001 values exclude supervised release hearings, which the profiles include in "
                        "filings, terminations and weighted filings beginning with FY2002 (Explanation of Selected Terms). ")
        if var in WEIGHTS_SENSITIVE:
            caveats += ("SERIES BREAK: FY2015+ profiles use the current case weights (approved for use after December "
                        "2015, prior years revised); FY1999-2014 values use earlier weights. See column `method` and "
                        "observations_current_method (FY2010+ on current weights). Territorial courts are blank in FY2025. ")
        if cav_n.get(var):
            caveats += (f"{cav_n[var]} cell(s) carry a cell-level caveat (column `caveat`; cell_caveats.csv), e.g. a "
                        "median printed as 0.0 or far below the U.S. median, or jurors printed 0 where no jury "
                        "selection was held. ")
        if var in revd and revd[var]["differing"]:
            r = revd[var]
            caveats += (f"Other profile vintages print a different value for {r['differing']} of {r['compared']} "
                        f"overlapping cells: {r['differing_method']} across the method change above, "
                        f"{r['differing_other']} ordinary revisions (see revisions.csv). ")
        if var.startswith("fcms_rank_"):
            base = "fcms_" + var.split("_", 3)[3]
            scope = "U.S." if "_rank_us_" in var else "circuit"
            row = next((r for r, (v, _, _) in ROW_VARS.items() if v == base), None)
            desc_order = (row in DESCENDING_RANK_ROWS) if row else True
            label = f"Published rank within {scope}: {label_of.get(base, base)}"
            desc = (f"The district's 'numerical standing' within the {scope} for {base} as printed in the profile margin. "
                    + ("Ranked in descending order (largest value = 1)." if desc_order else
                       "Ranked in ascending order (lowest value / fastest = 1)."))
            if base == PCT_VAR.format(k=5):
                desc += " Printed only in the FY2004-09 and FY2011 layouts ('Over Earlier Years'); verified to rank the 5-year change."
            if base == PCT_VAR.format(k=1):
                desc += " Verified against the printed 1-year changes (ranks the change over the previous year)."
            higher = "lower number = larger value" if desc_order else "lower number = faster / smaller"
            caveats += "Published rank, not computed here. Ties share a rank. Fewer than 94 courts are ranked when data are missing."
        elif var.startswith("fcms_civil_type_") or var.startswith("fcms_criminal_type_"):
            kind = "civil" if "_civil_type_" in var else "criminal"
            lab = nos_label.get(var, var)
            label = f"{'Civil' if kind == 'civil' else 'Criminal felony'} filings: {lab}"
            desc = (f"Profile year's {kind} filings in the AO nature-of-{'suit' if kind == 'civil' else 'offense'} "
                    f"category printed as '{lab}' (one letter A-L of the profile's table).")
            if kind == "criminal":
                desc += " Excludes transfers. Counts defendants (FY2010, FY2012+) or cases (FY2011)."
                caveats += "FY2011 counts cases; FY2010 and FY2012+ count defendants. "
            if var.endswith("copyright_patent_trademark") or var.endswith("intellectual_property_rights"):
                caveats += ("Letter I was printed 'Copyright, Patent, and Trademark' through FY2020 and 'Intellectual "
                            "Property Rights' from FY2021; kept as separate variables because the AO did not state "
                            "the categories are identical. The FY2021-22 national pages omit the 'I-' prefix. ")
            caveats += "FY2004-09 letters have no published legend (see nos_letters.csv and gaps)."
            higher = "more filings in this category"
        else:
            label = label_of.get(var) or {
                "fcms_filings_civil": "Civil filings (nature-of-suit total)",
                "fcms_filings_criminal_felony": "Criminal felony filings, excl. transfers (nature-of-offense total)",
            }.get(var) or ("Percent change in total filings over " + var.split("_")[-1].replace("yr", " year(s)"))
            desc = DESCRIPTIONS[var]
            higher = HIGHER_MEANS.get(var)
            if higher is None:
                higher = ("slower" if var.startswith("fcms_median") else "faster growth in filings" if "pct_change" in var
                          else "heavier workload per judgeship")
            if var.startswith("fcms_median"):
                caveats += "Suppressed medians (fewer than 10 terminations or trials) are omitted and logged as gaps. "
            if var == "fcms_jurors_avg_present":
                caveats += "FY2004-09 profiles print two decimals, later profiles one. "
            if "pct_change" in var:
                caveats += "Printed only for the profile's own year; from the row 'Current Year Over Earlier Year'. "
        out.append({
            "id": var, "label": label, "unit": unit_of[var][0] if len(unit_of[var]) == 1 else "/".join(unit_of[var]),
            "period_type": PERIOD_TYPE, "description": desc,
            "source_ids": sorted(g["source_id"].unique().tolist()),
            "caveats": caveats.strip(), "higher_means": higher, "derived": False,
            "first_period": int(years[0]), "last_period": int(years[-1]), "n_periods": len(years),
            "n_districts": int(g["district_id"].nunique()),
            "method_values": sorted(x for x in g["method"].unique() if x),
            "table": table_of(var),
            # statistics audit item 8: the default table holds each year's own published figure, so method-
            # sensitive variables change counting unit by year; time series should read this table instead
            "method_sensitive": len(set(g["method"]) - {""}) > 1,
            "time_series_table": "observations_current_method" if var in cm_first else table_of(var),
            "current_method_first_period": int(cm_first[var]) if var in cm_first else None,
            "n_cell_caveats": int(cav_n.get(var, 0)),
        })
    (OUT / "variables.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
