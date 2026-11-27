"""Build the USSC lane: ``python -m pipeline.ussc.build``.

Steps (idempotent; every download is cached by pipeline.common.http.fetch):
  1. Discover the Individual Offender datafile zips (FY2002+) on the USSC datafiles page,
     download and register them, plus the codebook.
  2. Stream the needed columns out of each zip and compute district x FY components.
  3. Turn components into observations (one definition per variable id).
  4. FY1995-FY2001 (no datafiles online): take the same variables from the published
     Statistical Information Packets.
  5. Validate FY2002+ computations against the packets (all districts for the two
     all-district tables every year; district tables for E.D. Va. every year and a sample of
     districts across eras) -> validation.csv.
  6. Write observations, national.csv, components.parquet, variables.json, gaps.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup

from pipeline.common.districts import IDS
from pipeline.common.http import PROJECT_ROOT, fetch
from pipeline.common.manifest import DATA, record_gap, register_source, write_observations

from . import LANE
from .compute import COLUMNS, compute_components, compute_supplemental_components
from .crosswalk import district_packet_code
from .datafile import read_columns
from .fallback import all_district_values, district_values
from .packets import GEO_PAGE, discover_packets, packet_text
from .validate import (SOURCEBOOK_FIG9_URL, Comps, validate_all_district_tables, validate_district_tables,
                       validate_supplemental_national)
from .variables import (DATAFILE_FIRST, LAST, PACKET_FIRST, derived_formula, is_derived,
                        observations_from_components, variable_specs)

INDEX_URL = "https://www.ussc.gov/research/datafiles/commission-datafiles"
SUP_CODEBOOK_URL = "https://www.ussc.gov/sites/default/files/zip/USSC_Supplemental_Codebook_FY14_FY17.pdf"
CODEBOOK_URL = ("https://www.ussc.gov/sites/default/files/pdf/research-and-publications/datafiles/"
                "USSC_Public_Release_Codebook_FY99_FY25.pdf")
OUT = DATA / "processed" / LANE
PUBLISHER = "U.S. Sentencing Commission"

# validation sample (district-level packet tables), spread across eras
SAMPLE_DISTRICTS = ["vaed", "txwd", "ilnd", "cacd", "nysd", "mtd", "flsd", "prd", "gud", "akd", "azd"]
SAMPLE_YEARS = [2002, 2003, 2004, 2005, 2006, 2008, 2010, 2012, 2015, 2017, 2018, 2019, 2021, 2023, 2025]


def log(*a):
    print("[ussc]", *a, flush=True)


def fy_vintage(fy: int) -> str:
    return f"FY{fy} (sentenced Oct 1, {fy - 1} - Sep 30, {fy})"


def discover_supplemental() -> dict[int, str]:
    soup = BeautifulSoup(fetch(INDEX_URL).text, "lxml")
    out: dict[int, str] = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"/ussc_sup_fy(\d{2})\.zip$", a["href"])
        if m:
            out[2000 + int(m.group(1))] = a["href"] if a["href"].startswith("http") else "https://www.ussc.gov" + a["href"]
    return dict(sorted(out.items()))


def discover_datafiles() -> dict[int, str]:
    page = fetch(INDEX_URL)
    register_source(LANE, "ussc_datafiles_index", url=INDEX_URL, dataset="USSC Commission Datafiles index page",
                    publisher=PUBLISHER, vintage="as retrieved", cached=page,
                    notes="Used only to discover the per-year Individual Offender datafile links.")
    soup = BeautifulSoup(page.text, "lxml")
    out: dict[int, str] = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"/opafy(\d{2})-?nid\.zip$", a["href"])
        if m:
            fy = 2000 + int(m.group(1))
            out[fy] = a["href"] if a["href"].startswith("http") else "https://www.ussc.gov" + a["href"]
    return dict(sorted(out.items()))


def register_geo_page(fy: int) -> None:
    url = GEO_PAGE.format(fy=fy)
    register_source(LANE, f"ussc_geography_page_fy{fy}", url=url,
                    dataset=f"USSC 'Federal Sentencing Statistics by State, District & Circuit' page, FY{fy}",
                    publisher=PUBLISHER, vintage=fy_vintage(fy), cached=fetch(url),
                    notes="Used only to discover the per-district packet links.")


def packet_source(fy: int, did: str, url: str) -> tuple[str, Path, str]:
    r = fetch(url)
    code = Path(url).stem.lower()
    sid = f"ussc_packet_fy{fy}_{re.sub(r'[0-9]+$', '', code)}"
    register_source(LANE, sid, url=url, dataset=f"USSC Statistical Information Packet, {did}, fiscal year {fy}",
                    publisher=PUBLISHER, vintage=fy_vintage(fy), cached=r,
                    notes="District packet (PDF), parsed with pdftotext -layout.")
    return sid, r.path, Path(url).name


def main() -> int:
    for p in (DATA / "sources" / f"{LANE}.json", DATA / "gaps" / f"{LANE}.json"):
        if p.exists():
            p.unlink()
    OUT.mkdir(parents=True, exist_ok=True)

    # 1. datafiles -------------------------------------------------------------------------
    urls = discover_datafiles()
    log("datafiles found for FY", list(urls))
    cb = fetch(CODEBOOK_URL)
    register_source(LANE, "ussc_codebook_fy99_fy25", url=CODEBOOK_URL,
                    dataset="USSC Individual Offender Datafiles codebook (FY1999-FY2025)", publisher=PUBLISHER,
                    vintage="Revised April 7, 2026", cached=cb,
                    notes="Variable definitions and value labels (DISTRICT codes: Appendix A).")
    source_for_fy, file_for_fy, parts, zip_for_fy = {}, {}, [], {}
    for fy, url in urls.items():
        r = fetch(url, timeout=900)
        sid = f"ussc_opafy{fy}"
        register_source(LANE, sid, url=url, dataset=f"USSC Individual Offender Datafile, fiscal year {fy} "
                        "(fixed-width .dat with SAS/SPSS input programs)", publisher=PUBLISHER,
                        vintage=fy_vintage(fy), cached=r,
                        notes="Columns read: " + ", ".join(COLUMNS) + " (those present in the year's layout).")
        source_for_fy[fy] = sid
        zip_for_fy[fy] = r.path
        file_for_fy[fy] = Path(url).name.replace(".zip", ".dat").replace("-nid", "nid")
        raw = read_columns(r.path, COLUMNS)
        parts.append(compute_components(fy, raw))
        log(f"FY{fy}: {len(raw):,} records")
    # FY2014-FY2017 supplemental files (FY2018-methodology SENTRNGE), joined on USSCIDN
    sup_source_for_fy, sup_file_for_fy = {}, {}
    sup_urls = discover_supplemental()
    if sup_urls:
        cbs = fetch(SUP_CODEBOOK_URL)
        register_source(LANE, "ussc_sup_codebook_fy14_fy17", url=SUP_CODEBOOK_URL,
                        dataset="USSC Supplemental Research Data codebook, FY2014-FY2017", publisher=PUBLISHER,
                        vintage="Revised October 21, 2019", cached=cbs)
    for fy, url in sup_urls.items():
        if fy not in zip_for_fy:
            continue
        r = fetch(url, timeout=900)
        sid = f"ussc_sup_fy{fy}"
        register_source(LANE, sid, url=url, dataset=f"USSC Individual Offender supplemental datafile, fiscal year {fy} "
                        "(FY2018-methodology variables SENTRNGE, OFFGUIDE, SENSPCAP keyed by USSCIDN)",
                        publisher=PUBLISHER, vintage=fy_vintage(fy), cached=r,
                        notes=f"Joined on USSCIDN to ussc_opafy{fy} to obtain DISTRICT.")
        ids = read_columns(zip_for_fy[fy], ["USSCIDN", "DISTRICT"])
        sup = read_columns(r.path, ["USSCIDN", "OFFGUIDE", "SENTRNGE", "SENSPCAP"])
        parts.append(compute_supplemental_components(fy, ids, sup))
        sup_source_for_fy[fy] = sid
        sup_file_for_fy[fy] = Path(url).name.replace(".zip", ".dat")
        log(f"FY{fy}: supplemental file joined ({len(sup):,} of {len(ids):,} records)")
    comps = pd.concat(parts, ignore_index=True)
    comps.to_parquet(OUT / "components.parquet", index=False)

    # 2. observations from datafiles ----------------------------------------------------------
    obs = observations_from_components(comps, source_for_fy, file_for_fy, sup_source_for_fy, sup_file_for_fy)

    # 3. FY1995-FY2001 from packets -------------------------------------------------------------
    fb_rows: list[dict] = []
    fb_problems: list[tuple] = []
    missing_packets: dict[int, list[str]] = {}
    for fy in range(PACKET_FIRST, DATAFILE_FIRST):
        pk = discover_packets(fy)
        register_geo_page(fy)
        missing_packets[fy] = sorted(set(IDS) - set(pk))
        sid, path, fname = packet_source(fy, "vaed", pk["vaed"])
        text = packet_text(path)
        fb_rows += all_district_values(fy, text, sid, fname)
        fb_rows += district_values(fy, "vaed", text, sid, fname, national=True)
        for did, url in sorted(pk.items()):
            sid, path, fname = packet_source(fy, did, url)
            fb_rows += district_values(fy, did, packet_text(path), sid, fname, problems=fb_problems)
        log(f"FY{fy}: packets parsed for {len(pk)} districts")
    fb = pd.DataFrame(fb_rows)
    allobs = pd.concat([obs, fb], ignore_index=True)
    # DATA_CONTRACT rule 3: every row this lane computed (rather than a figure the USSC printed) is
    # flagged derived; the formula for each basis is in variables.json (derived_formula_by_basis).
    allobs["derived"] = allobs["basis"].map(is_derived).astype(bool)

    # 4. validation ------------------------------------------------------------------------------
    vrows: list[dict] = []
    for fy in range(DATAFILE_FIRST, LAST + 1):
        if fy not in urls:
            continue
        pk = discover_packets(fy)
        register_geo_page(fy)
        c = Comps(comps[comps["fy"] == fy])
        targets = ["vaed"] + ([d for d in SAMPLE_DISTRICTS if d != "vaed"] if fy in SAMPLE_YEARS else [])
        for did in targets:
            if did not in pk:
                continue
            sid, path, fname = packet_source(fy, did, pk[did])
            text = packet_text(path)
            if did == "vaed":
                vrows += validate_all_district_tables(fy, text, c, sid)
            vrows += validate_district_tables(fy, did, text, c, sid)
        log(f"FY{fy}: validated against {len(targets)} packet(s)")
    if sup_source_for_fy:
        r = fetch(SOURCEBOOK_FIG9_URL)
        register_source(LANE, "ussc_sourcebook_fy2025_figure09", url=SOURCEBOOK_FIG9_URL,
                        dataset="USSC 2025 Sourcebook of Federal Sentencing Statistics, Figure 9 (sentence imposed "
                        "relative to the guideline range over time, FY2016-FY2025)", publisher=PUBLISHER,
                        vintage="FY2016-FY2025", cached=r, notes="Used to validate FY2016-FY2017 supplemental values.")
        vrows += validate_supplemental_national(comps, "ussc_sourcebook_fy2025_figure09")
    val = pd.DataFrame(vrows)
    val.to_csv(OUT / "validation.csv", index=False)
    summary = {
        "comparisons": int(len(val)), "matches": int(val["match"].sum()),
        "mismatches": int((~val["match"]).sum()),
        "district_years_checked_district_tables": int(
            val[~val["table"].str.contains("by district") & (val["district_id"] != "US")][["fy", "district_id"]]
            .drop_duplicates().shape[0]),
        "by_table": {k: {"n": int(len(g)), "mismatches": int((~g["match"]).sum())}
                     for k, g in val.groupby("table")},
        "mismatch_rows": val[~val["match"]].to_dict("records"),
    }
    (OUT / "validation_summary.json").write_text(json.dumps(summary, indent=1, default=str))
    log(f"validation: {summary['matches']}/{summary['comparisons']} published values reproduced")

    # 5. write ----------------------------------------------------------------------------------
    nat = allobs[allobs["district_id"] == "US"].copy()
    nat.sort_values(["variable", "period"]).to_csv(OUT / "national.csv", index=False)
    dist = allobs[allobs["district_id"] != "US"].copy()
    recon = packet_reconciliation(dist, nat)
    recon.to_csv(OUT / "packet_reconciliation.csv", index=False)
    dist["numerator"] = pd.to_numeric(dist["numerator"], errors="coerce")
    dist["n_basis"] = pd.to_numeric(dist["n_basis"], errors="coerce")
    write_observations(LANE, dist)

    specs = variable_specs()
    emitted = set(dist["variable"])
    vj = []
    for s in specs:
        if s["id"] not in emitted:
            continue
        sub = dist[dist["variable"] == s["id"]]
        s = dict(s)
        s["source_ids"] = sorted(sub["source_id"].unique().tolist())   # every id; per-row ids are in observations
        s.pop("eras", None)
        s["first_period"] = int(sub["period"].min())
        s["last_period"] = int(sub["period"].max())
        s["n_districts_by_year"] = {int(k): int(v) for k, v in sub.groupby("period")["district_id"].nunique().items()}
        s["basis_by_year"] = {int(k): sorted(v.unique().tolist()) for k, v in sub.groupby("period")["basis"]}
        der = sub[sub["derived"]]
        if s["derived"] and not sub["derived"].all():
            raise RuntimeError(f"{s['id']} is marked derived but has rows with a published basis")
        # years in which (some) values are this lane's computations, not USSC-printed figures
        s["derived_years"] = sorted(int(x) for x in der["period"].unique())
        s["derived_formula_by_basis"] = {b: derived_formula(s, b) for b in sorted(der["basis"].unique())}
        vj.append(s)
    (OUT / "variables.json").write_text(json.dumps(vj, indent=1))
    missing_specs = emitted - {s["id"] for s in specs}
    if missing_specs:
        raise RuntimeError(f"variables emitted without spec: {missing_specs}")

    record_gaps(dist, missing_packets, fb_problems, recon)
    log(f"wrote {len(dist):,} observations for {dist['variable'].nunique()} variables")
    return 0


RECON_VARS = ["ussc_cases_total", "ussc_cases_range_known", "ussc_cases_offense_known",
              "ussc_count_offense_drug_trafficking", "ussc_count_offense_immigration", "ussc_count_offense_firearms",
              "ussc_count_offense_fraud", "ussc_count_offense_other", "ussc_cases_prison_term"]


def packet_reconciliation(dist: pd.DataFrame, nat: pd.DataFrame) -> pd.DataFrame:
    """FY1995-FY2001 (packet years): sum of the district values vs the national packet figure, per count
    variable. The district packets and the national columns are separate USSC prints; in FY1995-FY1999
    they do not reconcile even when all 94 districts are present (a source inconsistency, reproduced by an
    independent re-read in the statistics audit). FY2002+ values come from one datafile and add up exactly
    (tested)."""
    rows = []
    for fy in range(PACKET_FIRST, DATAFILE_FIRST):
        for var in RECON_VARS:
            d = dist[(dist["period"] == fy) & (dist["variable"] == var)]
            n = nat[(nat["period"] == fy) & (nat["variable"] == var)]["value"]
            if d.empty or n.empty:
                continue
            missing = sorted(set(IDS) - set(d["district_id"]))
            tot, natv = float(d["value"].sum()), float(n.iloc[0])
            rows.append({"fy": fy, "variable": var, "n_districts": int(d["district_id"].nunique()),
                         "districts_missing": " ".join(missing), "district_sum": tot, "national": natv,
                         "difference": tot - natv, "reconciles": tot == natv,
                         "national_source_locator": nat[(nat["period"] == fy) & (nat["variable"] == var)]
                         ["source_locator"].iloc[0]})
    return pd.DataFrame(rows)


ITEM_VARS = {
    "ussc_cases_total": ["ussc_cases_total"],
    "offense mix (Table 1)": ["ussc_cases_offense_known", "ussc_pct_offense_*", "ussc_count_offense_*"],
    "imprisonment length (Table 7)": ["ussc_mean_prison_months", "ussc_median_prison_months",
                                      "ussc_cases_prison_term"],
}


def record_gaps(dist: pd.DataFrame, missing_packets: dict[int, list[str]], fb_problems: list[tuple],
                recon: pd.DataFrame | None = None) -> None:
    pre = list(range(PACKET_FIRST, DATAFILE_FIRST))
    if recon is not None and not recon.empty:
        bad = recon[~recon["reconciles"]]
        full = bad[bad["n_districts"] == len(IDS)]
        part = bad[bad["n_districts"] < len(IDS)]
        if not bad.empty:
            record_gap(LANE, "ussc_fy1995_1999_packets_do_not_sum_to_national",
                       description="FY1995-FY1999 district packet counts do not always add up to the national "
                       "packet figures. With all 94 districts present: "
                       + ("; ".join(f"FY{r.fy} {r.variable} districts {r.district_sum:,.0f} vs national "
                                    f"{r.national:,.0f} ({r.difference:+,.0f})" for r in full.itertuples())
                          or "none")
                       + f". In {len(part)} other variable-years a shortfall remains where district-years are "
                       "missing (packet not posted or failing a safety check); there it cannot be told apart from "
                       "the missing districts' own counts, and the missing values are NOT filled from the "
                       "residual. Each district value is as printed in its own packet; the national value is the "
                       "packet's national column. Do not present FY1995-FY1999 district counts as summing to the "
                       "nation. FY2000-FY2001 reconcile exactly; FY2002+ come from one datafile and add up exactly. "
                       "Full table: data/processed/ussc/packet_reconciliation.csv.",
                       variables=sorted(bad["variable"].unique().tolist()), districts="all",
                       periods=sorted(int(x) for x in bad["fy"].unique()),
                       reason="separately printed USSC district packets vs their national columns (source "
                       "inconsistency where all districts are present; not a parse error: the statistics audit's "
                       "independent re-read reproduces every district value)")
    record_gap(LANE, "ussc_before_fy1995",
               description="No USSC district statistics before FY1995 in this atlas: the USSC posts district "
               "Statistical Information Packets from FY1995 and Individual Offender datafiles from FY2002 only.",
               variables=["ussc_*"], districts="all", periods="<=1994",
               reason="Not published on ussc.gov (older datafiles are distributed elsewhere, e.g. ICPSR, outside "
               "this project's allowed sources).")
    record_gap(LANE, "ussc_fy1995_2001_datafile_only_measures",
               description="FY1995-FY2001 come from published packets, which do not print the inputs for these "
               "measures (fine-only counts; probation-as-zero sentence lengths; §5K3.1; four-way range grouping; "
               "child pornography).",
               variables=["ussc_pct_prison", "ussc_mean_sentence_months", "ussc_median_sentence_months",
                          "ussc_pct_early_disposition_5k3"], districts="all", periods=pre,
               reason="Individual Offender datafiles for FY1995-FY2001 are not posted on ussc.gov.")
    record_gap(LANE, "ussc_four_category_not_published_pre2006",
               description="Within/above/government-sponsored-below/non-government-sponsored-below grouping not "
               "published by the USSC before FY2006 (pre-Booker departure categories; FY2005 split into "
               "pre-/post-Booker periods). Above/govt/non-govt shares are omitted for these years; within-range "
               "and §5K1.1 are provided.",
               variables=["ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range",
                          "ussc_pct_non_govt_sponsored_below_range"], districts="all",
               periods=list(range(PACKET_FIRST, 2006)), reason="definitional break (Booker)")
    record_gap(LANE, "ussc_four_category_not_published_fy2018_on",
               description="From FY2018 the USSC reports sentences relative to the range as departures vs variances "
               "(SENTRNGE) and no longer publishes the four-way grouping. The FY2006-FY2017 ids are not "
               "continued; the same grouping rebuilt from the SENTRNGE components (published FY2018+; USSC "
               "supplemental files FY2014-FY2017) is provided under *_2018scheme ids, marked derived. In the "
               "FY2014-FY2017 overlap the two are identical for every district.",
               variables=["ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range",
                          "ussc_pct_non_govt_sponsored_below_range"], districts="all",
               periods=list(range(2018, LAST + 1)), reason="definitional break (USSC FY2018 methodology)")
    record_gap(LANE, "ussc_5k3_not_separate_pre2006",
               description="§5K3.1 early-disposition departures were not published separately by district before "
               "FY2006 (folded into 'government initiated departure' FY2003-FY2005; program began April 2003).",
               variables=["ussc_pct_early_disposition_5k3"], districts="all", periods=list(range(PACKET_FIRST, 2006)),
               reason="not published separately")
    record_gap(LANE, "ussc_child_pornography_pre2010",
               description="Child pornography was not a separate primary-offense category before FY2010 (USSC grouped "
               "it in 'Pornography/Prostitution', OFFTYPE2 code 28).",
               variables=["ussc_pct_offense_child_pornography", "ussc_count_offense_child_pornography"],
               districts="all", periods=list(range(PACKET_FIRST, 2010)), reason="category not published")
    record_gap(LANE, "ussc_fraud_category_break_2018",
               description="'Fraud' (statute-based, FY1995-FY2017) and 'Fraud/Theft/Embezzlement' (guideline-based, "
               "FY2018+) are different categories; each id covers only its own years.",
               variables=["ussc_pct_offense_fraud", "ussc_count_offense_fraud",
                          "ussc_pct_offense_fraud_theft_embezzlement", "ussc_count_offense_fraud_theft_embezzlement"],
               districts="all", periods="fraud: 2018+; fraud_theft_embezzlement: <=2017",
               reason="definitional break (OFFGUIDE)")
    record_gap(LANE, "ussc_sentrnge_components_pre2018",
               description="Departure/variance components (upward departure, government-motion variance, etc.) exist "
               "only in the USSC's SENTRNGE scheme: published from FY2018; FY2014-FY2017 available from the USSC "
               "supplemental datafiles; nothing earlier.",
               variables=["ussc_pct_upward_departure", "ussc_pct_other_govt_motion_departure",
                          "ussc_pct_non_govt_downward_departure", "ussc_pct_upward_variance",
                          "ussc_pct_govt_motion_downward_variance", "ussc_pct_non_govt_downward_variance",
                          "ussc_pct_variance", "ussc_pct_above_range_2018scheme",
                          "ussc_pct_govt_sponsored_below_range_2018scheme",
                          "ussc_pct_non_govt_sponsored_below_range_2018scheme"],
               districts="all", periods="<=2013", reason="scheme introduced FY2018 (back-filled by USSC to FY2014)")
    for fy, miss in missing_packets.items():
        if miss:
            record_gap(LANE, f"ussc_packet_missing_fy{fy}",
                       description=f"No FY{fy} district packet linked on the USSC geography page for {', '.join(miss)}; "
                       "district-specific packet values (cases total, offense mix, imprisonment length) are absent. "
                       "Within-range/§5K1.1 shares still come from the all-district table.",
                       variables=["ussc_cases_total", "ussc_cases_offense_known", "ussc_pct_offense_*",
                                  "ussc_count_offense_*", "ussc_mean_prison_months", "ussc_median_prison_months",
                                  "ussc_cases_prison_term"], districts=miss, periods=[fy],
                       reason="packet not published")
    by_item: dict[str, list[tuple]] = {}
    for fy, did, item, why in fb_problems:
        by_item.setdefault(item, []).append((fy, did, why))
    for item, lst in by_item.items():
        key = re.sub(r"[^a-z0-9]+", "_", item.lower()).strip("_")
        record_gap(LANE, f"ussc_packet_fallback_skipped_{key}",
                   description=f"FY1995-FY2001 packet values for {item} not used for {len(lst)} district-years "
                   "because a safety check failed (see reason).",
                   variables=ITEM_VARS.get(item, [item]), districts=sorted({d for _, d, _ in lst}),
                   periods=sorted({f for f, _, _ in lst}),
                   reason="; ".join(f"{d} FY{f}: {w}" for f, d, w in lst))
    # any district-year-variable within a variable's span that is still missing
    specs = {s["id"]: s for s in variable_specs()}
    have = set(zip(dist["variable"], dist["district_id"], dist["period"]))
    holes: dict[str, list] = {}
    for vid, s in specs.items():
        sub = dist[dist["variable"] == vid]
        if sub.empty:
            continue
        for fy in range(int(sub["period"].min()), int(sub["period"].max()) + 1):
            for did in IDS:
                if (vid, did, fy) not in have:
                    holes.setdefault(vid, []).append(f"{did}:{fy}")
    for vid, items in holes.items():
        record_gap(LANE, f"ussc_missing_cells_{vid}",
                   description=f"{len(items)} district-year cells without a value inside the variable's span "
                   "(zero denominator, unpublished packet cell, or packet not posted).",
                   variables=[vid], districts=sorted({x.split(':')[0] for x in items}),
                   periods=sorted({int(x.split(':')[1]) for x in items}),
                   reason="; ".join(items[:40]) + (" ..." if len(items) > 40 else ""))


if __name__ == "__main__":
    sys.exit(main())
