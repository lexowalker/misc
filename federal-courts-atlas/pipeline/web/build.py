"""Web lane entry point: `python -m pipeline.web.build` (wired as `make web`).

Reads only data/processed/* and data/sources/*.json (plus the boundaries and courthouses lanes' files already in
public/data/geo/, read-only) and writes, deterministically:

  public/data/variables.json            curated catalog of map variables
  public/data/values/<variable>.json    district x year values, ranks, national, provenance, notes
  public/data/districts.json            registry + population + geography + court size per district
  public/data/judges.json               FJC service records per district (+ judges/<district>.json)
  public/data/cases/<district>.json     recent CourtListener items
  public/data/profiles/<district>.json  distinctive paragraph (with claims), key stats, case mix
  public/data/sources.json              merged source manifest for every source id referenced
  public/data/manifest.json             data version, build date, file hashes
  data/sources/web.json                 series records that group per-file sources for citation chips
  data/gaps/web.json                    gaps this lane surfaces

Running it twice on the same inputs produces byte-identical files.
"""
from __future__ import annotations

import hashlib

import pandas as pd

from pipeline.common.districts import BY_ID, IDS, TERRITORIAL
from pipeline.common.manifest import record_gap

from .catalog import BY_ID as CAT, CATALOG
from .common import (APPROX_POP_DISTRICTS, APPROX_POP_NOTE, GAPS, LANE, PUB, ROOT, SRC, clean_text, lane_sources,
                     num, read_json, table, write_json)
from .profiles import IDB_PRELIM_FROM, all_profiles
from .mdl_caveats import apply as apply_mdl_caveat, national_mdl_caveats
from .values import build_values_file

BUILD_ONLY_KEYS = {"input", "fact", "base"}
MANAGED_DIRS = ("values", "profiles", "cases", "judges")

SERIES = {
    "web_series_fcms": {
        "dataset": "Federal Court Management Statistics, district Judicial Caseload Profiles (September)",
        "vintage": "FY 1999 to FY 2025 values, from the FY 2004 to FY 2025 profiles",
        "publisher": "Administrative Office of the U.S. Courts (Statistics Division), via uscourts.gov",
        "url_from": "fcms_index_page",
        "match": lambda sid: sid.startswith("fcms_fy"),
    },
    "web_series_ussc": {
        "dataset": "Individual Offender datafiles and Statistical Information Packets",
        "vintage": "FY 1995 to FY 2025 (packets to FY 2001, datafiles from FY 2002)",
        "publisher": "U.S. Sentencing Commission",
        "url_from": "ussc_datafiles_index",
        "match": lambda sid: sid.startswith("ussc_"),
    },
    "web_series_census_popest": {
        "dataset": "County population estimates, July 1",
        "vintage": "2000 to 2025 (2000s and 2010s intercensal; Vintage 2025)",
        "publisher": "U.S. Census Bureau",
        "url": "https://www2.census.gov/programs-surveys/popest/datasets/",
        "match": lambda sid: sid.startswith("census_"),
    },
}


def series_for(spec: dict) -> list[str]:
    """Citation-level source ids for a catalog variable (series records or single files)."""
    inp = spec["input"]
    lanes = []
    if "per100k" in inp:
        lanes = [inp["per100k"]["lane"], "population"]
    else:
        lanes = [inp["lane"]]
    out = []
    for lane in lanes:
        if lane == "fcms":
            out.append("web_series_fcms")
        elif lane == "ussc":
            out.append("web_series_ussc")
        elif lane == "population":
            out.append("web_series_census_popest")
        elif lane == "idb":
            var = (inp.get("per100k") or inp)["variable"]
            out.append("idb_criminal_cr96on" if var.startswith("idb_crim") else "idb_civil_cv88on")
        elif lane == "judges":
            out.append("fjc_federal_judicial_service_csv")
    return out


# ------------------------------------------------------------------------------------------------ variables
def variable_entry(spec: dict, vf: dict) -> dict:
    e = {k: v for k, v in spec.items() if k not in BUILD_ONLY_KEYS}
    inp = spec["input"]
    if "per100k" in inp:
        e["lane"] = "web"
        e["lane_inputs"] = [dict(inp["per100k"]), {"lane": "population", "table": "observations", "variable": "population_estimate"}]
    else:
        e["lane"] = inp["lane"]
        e["lane_table"] = inp["table"]
        e["lane_variable"] = inp["variable"]
    e["years"] = vf["years"]
    e["first_year"] = vf["years"][0]
    e["last_year"] = vf["years"][-1]
    e["n_years"] = len(vf["years"])
    e["period_type"] = vf["period_type"]
    e["districts_latest"] = vf["ranked_of"][str(vf["years"][-1])]
    e["source_ids"] = series_for(spec)
    e["derived"] = bool(vf["derived"])
    e["formula"] = spec.get("formula") if (vf["derived"] or spec.get("formula")) else None
    if vf.get("derived_years"):
        e["derived_years"] = vf["derived_years"]
    if vf.get("formula_by_basis"):
        e["formula_by_basis"] = vf["formula_by_basis"]
    if e["lane"] == "idb":
        # IDB years with no published AO cross-check yet; pages label them "preliminary" (data audit 2026-11-27,
        # auditor B: profile sentences and compare gaps showed FY 2026 without the label).
        prelim = [y for y in vf["years"] if y >= IDB_PRELIM_FROM]
        if prelim:
            e["preliminary_years"] = prelim
    e["national_available"] = bool(vf.get("national"))
    e["values_file"] = f"values/{spec['id']}.json"
    e["featured"] = bool(spec.get("featured"))
    e.setdefault("breaks", [])
    e["in_profile_facts"] = bool(spec.get("fact"))
    return e


# ------------------------------------------------------------------------------------------------ districts
def latest_obs(lane: str, var: str, tbl: str = "observations", period_type: str | None = None) -> dict[str, dict]:
    df = table(lane, tbl)
    df = df[df["variable"] == var]
    if period_type:
        df = df[df["period_type"] == period_type]
    out = {}
    for d, g in df.groupby("district_id"):
        r = g.sort_values("period").iloc[-1]
        out[d] = {"value": num(r["value"]), "year": int(r["period"]), "period_type": str(r["period_type"]),
                  "source_id": str(r["source_id"])}
    return out


def build_districts() -> dict:
    div = read_json(PUB / "geo" / "divisions.json")["districts"]
    ch = read_json(PUB / "geo" / "courthouses.json")
    ch_by = {}
    for c in ch:
        ch_by.setdefault(c["district_id"], []).append(c)
    pop = latest_obs("population", "population_estimate", period_type="JUL1_EST")
    cen = table("population", "observations")
    cen = cen[(cen["variable"] == "population_census") & (cen["period"] == 2020)]
    cen = {r.district_id: {"value": num(r.value), "year": 2020, "source_id": str(r.source_id)} for r in cen.itertuples()}
    judgeships = latest_obs("fcms", "fcms_judgeships")
    active = latest_obs("judges", "judges_active")
    senior = latest_obs("judges", "judges_senior")
    out = {}
    n = len(IDS)
    for i, d in enumerate(IDS):
        reg = BY_ID[d]
        g = div.get(d, {})
        rec = reg.to_dict()
        p = pop.get(d)
        if p:
            rec.update({"population": p["value"], "population_year": p["year"], "population_period_type": "JUL1_EST",
                        "population_source_id": p["source_id"], "population_derived": True,
                        "population_formula": "Sum of the Census Bureau's July 1 estimates for the counties assigned to the district"})
        else:
            rec.update({"population": None, "population_year": None, "population_source_id": None,
                        "population_note": "No data: the Census Bureau publishes no annual population estimates for this territory."})
        rec["population_approximate"] = d in APPROX_POP_DISTRICTS
        if d in APPROX_POP_DISTRICTS:
            rec["population_note"] = APPROX_POP_NOTE
        if d in cen:
            rec["population_census_2020"] = {**cen[d], "period_type": "APR1_CENSUS", "derived": True,
                                             "formula": "Sum of the 2020 Census counts for the counties assigned to the district"}
        rec["counties"] = [{"geoid": c["geoid"], "name": c["name"]} for c in g.get("counties", [])]
        rec["has_statutory_divisions"] = bool(g.get("has_statutory_divisions"))
        rec["divisions"] = [
            {"name": dv["name"], "ordinal": dv.get("ordinal"), "statute_section": dv.get("statute_section"),
             "counties": [c["geoid"] for c in dv.get("counties", [])], "places": dv.get("places_of_holding_court", [])}
            for dv in sorted(g.get("divisions", []), key=lambda x: x.get("ordinal") or 0)
        ]
        rec["places_of_holding_court"] = g.get("places_of_holding_court", [])
        rec["statute_sections"] = g.get("statute_sections", [])
        if g.get("partial_counties_included"):
            rec["partial_counties_included"] = [
                {"geoid": c["geoid"], "name": c["name"], "portion": c.get("portion"), "statute": c.get("statute")}
                for c in g["partial_counties_included"]]
        rec["courthouse_ids"] = [c["id"] for c in sorted(ch_by.get(d, []), key=lambda c: (c["kind"], c["id"]))]
        rec["judgeships"] = judgeships.get(d)
        rec["judges_active"] = ({**active[d], "derived": True} if d in active else None)
        rec["judges_senior"] = ({**senior[d], "derived": True} if d in senior else None)
        if d in TERRITORIAL:
            rec["judges_note"] = "No data: territorial judges are not in the FJC directory of Article III judges."
        rec["prev"] = IDS[(i - 1) % n]
        rec["next"] = IDS[(i + 1) % n]
        out[d] = rec
    return out


# ------------------------------------------------------------------------------------------------ judges
def _display_name(r) -> str:
    parts = [r.first_name, r.middle_name, r.last_name]
    name = " ".join(str(p).strip() for p in parts if isinstance(p, str) and p.strip())
    if isinstance(r.suffix, str) and r.suffix.strip():
        name = f"{name} {r.suffix.strip()}"
    return name or str(r.judge_name)


def _initials(r) -> str:
    f = str(r.first_name).strip() if isinstance(r.first_name, str) else ""
    last = str(r.last_name).strip() if isinstance(r.last_name, str) else ""
    if not f and not last:
        return ""
    return (f[:1] + last[:1]).upper()


def _date(x):
    if x is None or (isinstance(x, float) and pd.isna(x)) or x is pd.NaT:
        return None
    s = str(x)
    if s in ("", "None", "NaT", "nan"):
        return None
    return s[:10]


def build_judges() -> dict[str, list[dict]]:
    df = table("judges", "district_judges").copy()
    df = df.sort_values(["district_id", "service_start_date", "fjc_nid", "fjc_sequence"], na_position="last")
    out: dict[str, list[dict]] = {d: [] for d in IDS}
    for r in df.itertuples(index=False):
        rec = {
            "id": f"{int(r.fjc_nid)}-{int(r.fjc_sequence)}",
            "nid": int(r.fjc_nid),
            "name": _display_name(r),
            "sort_name": str(r.judge_name),
            "initials": _initials(r),
            "appointing_president": r.appointing_president if isinstance(r.appointing_president, str) else None,
            "appointing_party": r.appointing_party if isinstance(r.appointing_party, str) else None,
            "party_of_appointing_president": r.resolved_appointing_party if isinstance(r.resolved_appointing_party, str) else None,
            "appointment_kind": r.appointment_kind,
            "commission_date": _date(r.commission_date),
            "recess_appointment_date": _date(r.recess_appointment_date),
            "service_start_date": _date(r.service_start_date),
            "senior_status_date": _date(r.senior_status_date),
            "service_end_date": _date(r.termination_date),
            "termination_reason": r.termination_reason if isinstance(r.termination_reason, str) else None,
            "active_service_end_date": _date(r.active_service_end_date),
            "seat_id": r.seat_id if isinstance(r.seat_id, str) else None,
        }
        eff = _date(r.effective_senior_status_date)
        if eff and eff != rec["senior_status_date"]:
            rec["effective_senior_status_date"] = eff
        if (isinstance(r.resolved_appointing_president, str)
                and r.resolved_appointing_president != rec["appointing_president"]):
            rec["president_of_record"] = r.resolved_appointing_president
        if isinstance(r.party_resolution, str) and r.party_resolution.startswith("from_prior_record"):
            rec["reassignment"] = True
            rec["party_note"] = ("FJC lists this record as a statutory reassignment or assignment; the appointing "
                                 "president and party shown are from the judge's earlier FJC service record.")
        if isinstance(r.reappointing_president, str) and r.reappointing_president:
            rec["reappointing_president"] = r.reappointing_president
        if bool(r.before_current_incarnation):
            rec["before_current_incarnation"] = True
        out[r.district_id].append({k: v for k, v in rec.items() if v is not None})
    return out


# ------------------------------------------------------------------------------------------------ cases
CASE_FIELDS = ("case_name", "url", "date_filed", "date_terminated", "docket_number", "docket_type", "nature_of_suit",
               "cause", "court_id", "opinion_status", "source_id", "item_type")


def build_cases() -> dict[str, dict]:
    out = {}
    for d in IDS:
        p = ROOT / "data" / "processed" / "cases" / f"{d}.json"
        raw = read_json(p) if p.exists() else {"items": []}
        items = []
        for it in raw.get("items", []):
            rec = {k: it.get(k) for k in CASE_FIELDS if it.get(k) is not None}
            rec["id"] = it.get("courtlistener_id")
            rec["kind"] = "opinion" if it.get("item_type") == "opinion" else "docket"
            items.append({k: clean_text(v) if isinstance(v, str) else v for k, v in rec.items()})
        rec = {
            "district_id": d,
            "district_name": BY_ID[d].name,
            "retrieved_at": raw.get("retrieved_at"),
            "selection": raw.get("selection"),
            "items": items,
            "source_ids": sorted({i["source_id"] for i in items if i.get("source_id")}),
            "publisher": "Free Law Project (CourtListener)",
        }
        if not items:
            rec["note"] = ("No recent cases yet. CourtListener’s free daily limit ran out before this district’s cases "
                           "were requested. The atlas will try again in a later update.")
        elif len(items) < 3:
            rec["note"] = "Fewer than three recent cases passed the screening rules."
        out[d] = rec
    return out


# ------------------------------------------------------------------------------------------------ sources
def collect_ids(obj, acc: set[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("source_id", "population_source_id") and isinstance(v, str):
                acc.add(v)
            elif k in ("source_ids",) and isinstance(v, list):
                acc.update(x for x in v if isinstance(x, str))
            elif k == "provenance" and isinstance(v, dict):
                acc.update(v.keys())
            elif k in ("source_by_year", "national_source_by_year") and isinstance(v, dict):
                for x in v.values():
                    acc.update([x] if isinstance(x, str) else x)
            elif k == "cell_sources" and isinstance(v, dict):
                for row in v.values():
                    for x in row.values():
                        acc.update(x)
            else:
                collect_ids(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            collect_ids(x, acc)


def build_series_records(used: set[str]) -> dict[str, dict]:
    srcs = lane_sources()
    out = {}
    for sid, spec in SERIES.items():
        members = sorted(s for s in used if spec["match"](s) and s in srcs)
        if not members:
            continue
        url = spec.get("url") or srcs[spec["url_from"]]["url"]
        retrieved = max(srcs[m]["retrieved_at"] for m in members if srcs[m].get("retrieved_at"))
        out[sid] = {
            "lane": LANE, "kind": "series", "url": url, "dataset": spec["dataset"], "publisher": spec["publisher"],
            "vintage": f"{spec['vintage']}; {len(members)} files", "retrieved_at": retrieved, "local_path": None,
            "sha256": None, "members": members,
            "notes": ("Citation record that groups the per-file sources listed in members. It is not a download. "
                      "Each value's file-level source is in its values file (provenance, source_by_year, cell_sources)."),
        }
    return out


def public_source(sid: str, rec: dict) -> dict:
    out = {k: rec.get(k) for k in ("lane", "url", "dataset", "publisher", "vintage", "retrieved_at")}
    if rec.get("kind") == "series":
        out["kind"] = "series"
        out["members"] = rec["members"]
    return out


# ------------------------------------------------------------------------------------------------ gaps
def write_gaps(vfs: dict[str, dict], cases: dict[str, dict]) -> None:
    p = GAPS / f"{LANE}.json"
    if p.exists():
        p.unlink()
    per_capita = [s["id"] for s in CATALOG if "per100k" in s["input"]]
    record_gap(LANE, "per_capita_territories_no_population",
               description="Per-capita rates are No data for D. Guam, D.N. Mar. I. and D.V.I.: the Census Bureau publishes no annual population estimates for the Island Areas.",
               variables=per_capita, districts=sorted(TERRITORIAL), periods="all",
               reason="See data/gaps/population.json island_areas_no_annual_estimates.")
    record_gap(LANE, "per_capita_population_approximate",
               description="Per-capita rates for these five districts use an approximate population: counties split by statute (Yellowstone NP, Fort Bragg / Camp MacKall, FCI Butner) are counted whole in one district. Values are shown with a cell note.",
               variables=per_capita, districts=list(APPROX_POP_DISTRICTS), periods="all",
               reason="See data/gaps/boundaries.json split_counties_whole_in_county_tables.")
    record_gap(LANE, "per_capita_no_national_rate",
               description="No national per-capita rate is shown: national FCMS and IDB totals include the territorial courts, which have no population estimate, so numerator and denominator would not match.",
               variables=per_capita, periods="all", reason="Not computed rather than mismatched.")
    record_gap(LANE, "fcms_method_sensitive_years_before_current_method",
               description="For FCMS measures affected by the March 2012 change from counting criminal cases to counting defendants, the web series start in FY 2005 (FY 2010 for weighted filings, current case weights). Earlier own-year values exist in the FCMS lane on the old method but are not mixed into these series.",
               variables=[s["id"] for s in CATALOG if s["input"].get("table") == "observations_current_method"],
               periods=list(range(1999, 2005)), reason="Avoids splicing two counting methods into one series.")
    record_gap(LANE, "ussc_four_way_grouping_scheme_split",
               description="The USSC four-way grouping (within, above, government-sponsored below, non-government-sponsored below) is shown as two series: the USSC's printed FY 2006 to 2017 grouping and the same grouping rebuilt from the FY 2018 method for FY 2014 to 2025. Neither exists for FY 1995 to 2005 (before Booker the categories were departures only).",
               variables=["above_range_pct", "govt_below_range_pct", "nongovt_below_range_pct",
                          "above_range_pct_2006", "govt_below_range_pct_2006", "nongovt_below_range_pct_2006"],
               periods=list(range(1995, 2006)), reason="USSC methodology; see data/gaps/ussc.json.")
    record_gap(LANE, "judges_counts_national_not_summed",
               description="No national figure is shown for active or senior judges: judges assigned to two districts are counted in each, so district counts do not add up to a national head count.",
               variables=["active_judges", "senior_judges"], periods="all", reason="Avoids double counting.")
    empty = sorted(d for d, c in cases.items() if not c["items"])
    if empty:
        record_gap(LANE, "cases_none_published",
                   description="These districts' public/data/cases files have no items (the profile shows a note). The cases lane logs the cause.",
                   districts=empty, reason="See data/gaps/cases.json (CourtListener free-tier quota).")
    missing_latest = {}
    for s in CATALOG:
        vf = vfs[s["id"]]
        y = str(vf["years"][-1])
        miss = sorted(d for d in IDS if y not in vf["values"].get(d, {}))
        if miss:
            missing_latest[s["id"]] = (int(y), miss)
    for vid, (y, miss) in sorted(missing_latest.items()):
        record_gap(LANE, f"no_value_latest_year:{vid}",
                   description=f"{CAT[vid]['label']}: No data in FY/period {y} for {len(miss)} district(s). The producing lane logs the reason.",
                   variables=[vid], districts=miss, periods=[y],
                   reason="Not published or not applicable at the source (see the producing lane's gap log).")


# ------------------------------------------------------------------------------------------------ main
def remove_stale(keep: set[str]) -> None:
    """Delete files in this lane's folders that the current build did not write."""
    for sub in MANAGED_DIRS:
        d = PUB / sub
        if d.exists():
            for f in d.glob("*.json"):
                if f.relative_to(PUB).as_posix() not in keep:
                    f.unlink()


def main() -> None:
    # Build everything in memory first; write only after all checks pass.
    vfs: dict[str, dict] = {}
    cells: dict[str, dict] = {}
    for spec in CATALOG:
        vf, c = build_values_file(spec)
        vfs[spec["id"]] = vf
        cells[spec["id"]] = c
    mdl_cav = national_mdl_caveats()  # MDL 2885 caveats on the measures it touches (counts from the IDB lane)
    variables = [apply_mdl_caveat(variable_entry(spec, vfs[spec["id"]]), mdl_cav) for spec in CATALOG]
    districts = build_districts()
    judges = build_judges()
    cases = build_cases()
    profiles = all_profiles(vfs, cells)

    files: dict[str, object] = {"variables.json": variables, "districts.json": districts}
    judges_doc = {"_meta": {"source_ids": ["fjc_federal_judicial_service_csv", "fjc_demographics_csv"],
                            "note": ("Public biographical fields from the FJC Biographical Directory of Article III "
                                     "Federal Judges. No photographs and no judge-level performance statistics. The "
                                     "territorial courts' judges are not Article III judges and are not listed."),
                            "fields": {"president_of_record": "Appointing president taken from the judge's earlier FJC record, shown only for statutory reassignments",
                                       "party_of_appointing_president": "Party of the appointing president; for statutory reassignments, from the judge's earlier FJC record",
                                       "appointing_party": "Party exactly as the FJC gives it (for example 'None (reassignment)')"},
                            "biography_url_template": "https://www.fjc.gov/node/{nid}"},
                  **judges}
    files["judges.json"] = judges_doc
    for d in IDS:
        files[f"judges/{d}.json"] = {"district_id": d, "source_ids": judges_doc["_meta"]["source_ids"],
                                     "note": judges_doc["_meta"]["note"],
                                     "biography_url_template": judges_doc["_meta"]["biography_url_template"],
                                     "judges": [{**j, "district_id": d} for j in judges[d]]}
        files[f"cases/{d}.json"] = cases[d]
        files[f"profiles/{d}.json"] = profiles[d]
    for vid, vf in vfs.items():
        files[f"values/{vid}.json"] = vf

    used: set[str] = set()
    collect_ids(files, used)
    for gp in ("geo/courthouses.json", "geo/divisions.json"):
        collect_ids(read_json(PUB / gp), used)
    srcs = lane_sources()
    series = build_series_records(used)
    used_files = sorted(s for s in used if s in srcs)
    unknown = sorted(s for s in used if s not in srcs and s not in series)
    if unknown:
        raise SystemExit(f"source ids referenced but not registered: {unknown[:10]}")
    # data/sources/web.json: the series records (written fresh)
    write_json(SRC / f"{LANE}.json", series, indent=1)
    sources_pub = {sid: public_source(sid, srcs[sid]) for sid in used_files}
    sources_pub.update({sid: public_source(sid, rec) for sid, rec in series.items()})
    files["sources.json"] = sources_pub

    for rel, obj in files.items():
        indent = 1 if rel in ("variables.json",) else None
        write_json(PUB / rel, obj, indent=indent)
    remove_stale(set(files))
    write_gaps(vfs, cases)

    # manifest: every file under public/data except itself
    entries = {}
    for f in sorted(PUB.rglob("*.json")):
        rel = f.relative_to(PUB).as_posix()
        if rel == "manifest.json":
            continue
        b = f.read_bytes()
        entries[rel] = {"sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}
    digest = hashlib.sha256("".join(f"{k}:{v['sha256']}\n" for k, v in entries.items()).encode()).hexdigest()
    as_of = max((srcs[s].get("retrieved_at") or "") for s in used_files)[:10]
    manifest = {
        "version": digest[:10],
        "build_date": as_of,
        "build_date_note": "The date of the newest source retrieval behind the published files, so that a rebuild of the same inputs is byte-identical.",
        "generator": "python -m pipeline.web.build",
        "variables": len(variables),
        "districts": len(districts),
        "sources": len(sources_pub),
        "files": entries,
        "total_bytes": sum(v["bytes"] for v in entries.values()),
    }
    write_json(PUB / "manifest.json", manifest, indent=1)
    print(f"web: {len(variables)} variables, {len(vfs)} values files, {len(districts)} districts, "
          f"{sum(len(v) for v in judges.values())} judge records, {len(sources_pub)} sources, "
          f"{manifest['total_bytes'] / 1e6:.1f} MB in public/data (incl. geo/search)")


if __name__ == "__main__":
    main()
