"""Build the population lane: Census county populations -> the 94 districts.

    PYTHONPATH=. .venv/bin/python -m pipeline.population.build

Idempotent (cached downloads via pipeline.common.http.fetch). Reads the boundaries lane's
data/processed/boundaries/county_district.csv and legacy_geoids.csv (read-only).

Series (all integers as published):
  JUL1_EST     2000-2009  2000-2010 intercensal county + PR municipio files
               2010-2019  2010-2020 intercensal county + PR municipio files
               2020-2025  Vintage 2025 county file + PR municipio file
  APR1_CENSUS  2000       Census 2000 Demographic Profile (all states + PR)
               2010       2010 Census Demographic Profile Summary File (one file per state + PR)
               2020       2020 Census P.L. 94-171 Redistricting Summary File (one file per state + PR)
               Island Areas (Guam, USVI, CNMI): 2000/2010 from the 2010 Census press tables, 2020 from the
               2020 Island Areas population-count tables. No annual estimates exist for them.

Outputs (data/processed/population/):
  county_population.parquet     every county-equivalent value used, with its district and source cell
  observations.{parquet,csv}    district totals: population_estimate (JUL1_EST), population_census (APR1_CENSUS)
  reconciliation.csv            per year: sum of districts vs published U.S. (50 states + DC) and PR totals
  state_reconciliation.csv      per state-year: sum of counties vs the published state total (where printed)
  cross_checks.csv              independent comparisons between Census products (informational + asserted)
  carveout_blocks_2020.csv      derived: 2020 Census population inside the eight statutory carve-outs
  variables.json, build_summary.json
"""
from __future__ import annotations

import json
from datetime import date

import pandas as pd

from pipeline.common.districts import BY_ID, IDS, STATES, TERRITORIAL
from pipeline.common.manifest import DATA, record_gap, register_source, write_observations

from . import LANE
from . import carveouts
from . import parse as P
from .sources import (C2000_ALL, C2000_PR, C2010_DP, C2010_DP_SF1GEOS, C2010_DP_US, RejectedError, C2020_PL, C2020_PL_US, ESTIMATES, IA2010,
                      IA2010_FILES, IA2020, IA2020_FILES, LAYOUTS, PUBLISHER, STATE_POSTALS, get, state_dir)

OUT = DATA / "processed" / LANE
BOUNDARIES = DATA / "processed" / "boundaries"
FIPS_TO_POSTAL = {f: p for p, (_, f) in STATES.items()}
TERRITORY_FIPS = {"66", "69", "78"}


def fname(url: str) -> str:
    return url.rsplit("/", 1)[-1]


# ------------------------------------------------------------------------------------------ acquire
def acquire() -> dict:
    got = {}

    def reg(sid, url, dataset, vintage, notes=""):
        r = get(url)
        lm = r.meta.get("last_modified")
        register_source(LANE, sid, url=url, dataset=dataset, publisher=PUBLISHER,
                        vintage=vintage + (f"; file Last-Modified {lm}" if lm else ""), cached=r, notes=notes)
        got[sid] = r
        return r

    for sid, (url, ds, vint) in ESTIMATES.items():
        reg(sid, url, ds, vint)
    for sid, (url, ds) in LAYOUTS.items():
        reg(sid, url, ds, "documentation", notes="Defines the columns / codes read from the data file.")
    reg("census2000_dp_all_states", C2000_ALL, "Census 2000 Demographic Profiles (DP-1), all states: 2khxx.csv",
        "Census 2000 (April 1, 2000)")
    reg("census2000_dp_pr", C2000_PR, "Census 2000 Demographic Profiles (DP-1), Puerto Rico: 2kh72.csv",
        "Census 2000 (April 1, 2000)")
    reg("census2010_dp_us", C2010_DP_US, "2010 Census Demographic Profile Summary File, National (us2010.dp)",
        "2010 Census (April 1, 2010)", notes="United States total (SUMLEV 010) only.")
    reg("census2020_pl_us", C2020_PL_US, "2020 Census P.L. 94-171 Redistricting Summary File, National (us2020.npl)",
        "2020 Census (April 1, 2020)", notes="United States total (SUMLEV 010) only.")
    for st in STATE_POSTALS:
        name = STATES[st][0]
        try:
            reg(f"census2010_dp_{st.lower()}", C2010_DP.format(dir=state_dir(st), st=st.lower()),
                f"2010 Census Demographic Profile Summary File, {name} ({st.lower()}2010.dp)", "2010 Census (April 1, 2010)")
        except RejectedError:
            reg(f"census2010_dp_{st.lower()}", C2010_DP_SF1GEOS.format(dir=state_dir(st), st=st.lower()),
                f"2010 Census Demographic Profile Summary File with SF1 geographies, {name} ({st.lower()}20101.dp)",
                "2010 Census (April 1, 2010)",
                notes=f"The Census CDN answered every request for {C2010_DP.format(dir=state_dir(st), st=st.lower())} "
                      "with a 'Request Rejected' page, so the same Demographic Profile tables were read from the "
                      "'with SF1 geographies' release.")
        reg(f"census2020_pl_{st.lower()}", C2020_PL.format(dir=state_dir(st), st=st.lower()),
            f"2020 Census P.L. 94-171 Redistricting Summary File, {name} ({st.lower()}2020.pl)", "2020 Census (April 1, 2020)")
    for st, (d, stem) in IA2020_FILES.items():
        reg(f"census2020_ia_{st.lower()}_phc01", IA2020.format(dir=d, stem=stem),
            f"2020 Census of {STATES[st][0]}: Population of {STATES[st][0]}, 2010 and 2020 (Table 1)",
            "2020 and 2010 Island Areas Censuses")
    for st, fn in IA2010_FILES.items():
        reg(f"census2010_ia_{st.lower()}_{fn.split('-')[0]}", IA2010.format(fn=fn),
            f"2010 Census press table {fn.split('-')[0].upper()}: Population of {STATES[st][0]}, 2000 and 2010",
            "Census 2000 and 2010 Census (Island Areas)")
    return got


# ------------------------------------------------------------------------------------------ mapping
def load_mapping() -> pd.DataFrame:
    cd = pd.read_csv(BOUNDARIES / "county_district.csv", dtype=str, keep_default_na=False)
    lg = pd.read_csv(BOUNDARIES / "legacy_geoids.csv", dtype=str, keep_default_na=False)
    a = pd.DataFrame({"geoid": cd["geoid"], "district_id": cd["district_id"], "geoid_status": "current",
                      "map_county_name": cd["county_name"], "split_districts": cd["split_districts"]})
    shares = lg["district_shares"].map(lambda s: sorted({x.split(":")[0].strip() for x in s.split(";") if x.strip()}))
    b = pd.DataFrame({"geoid": lg["legacy_geoid"], "district_id": lg["district_id"], "geoid_status": "legacy",
                      "map_county_name": lg["legacy_name"], "split_districts": "",
                      "legacy_single_district": shares.map(len) == 1})
    m = pd.concat([a, b], ignore_index=True)
    if m["geoid"].duplicated().any():
        raise RuntimeError(f"GEOID in both county_district.csv and legacy_geoids.csv: {m[m.geoid.duplicated()].geoid.tolist()}")
    m["legacy_single_district"] = m["legacy_single_district"].fillna(True).astype(bool)
    return m


# ------------------------------------------------------------------------------------------ parse
def parse_all(got: dict) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    C, PUB, checks = [], [], []
    p = lambda sid: got[sid].path  # noqa: E731
    f = lambda sid: fname(got[sid].meta["url"])  # noqa: E731

    # JUL1 2000-2009
    c, pub = P.co_est_wide(p("census_co_est00int_tot"), "census_co_est00int_tot", f("census_co_est00int_tot"), range(2000, 2010))
    C.append(c); PUB.append(pub)
    C.append(P.prm_est00int(p("census_prm_est00int_agesex_5yr"), "census_prm_est00int_agesex_5yr",
                            f("census_prm_est00int_agesex_5yr"), range(2000, 2010)))
    PUB.append(P.st_est00int(p("census_st_est00int_alldata"), "census_st_est00int_alldata", f("census_st_est00int_alldata"), range(2000, 2010)))
    PUB.append(P.prc_est00int(p("census_prc_est00int_agesex"), "census_prc_est00int_agesex", f("census_prc_est00int_agesex"), range(2000, 2010)))
    # JUL1 2010-2019 (YEAR 2..11 = 7/1/2010..7/1/2019 per the CC-EST2020INT-AGESEX layout)
    ym = {k: 2008 + k for k in range(2, 12)}
    C.append(P.cc_est_long(p("census_cc_est2020int_agesex_all"), "census_cc_est2020int_agesex_all",
                           f("census_cc_est2020int_agesex_all"), ym, pr=False))
    C.append(P.cc_est_long(p("census_cc_est2020int_agesex_72"), "census_cc_est2020int_agesex_72",
                           f("census_cc_est2020int_agesex_72"), ym, pr=True))
    PUB.append(P.nc_est2020int(p("census_nc_est2020int_agesex_res"), "census_nc_est2020int_agesex_res",
                               f("census_nc_est2020int_agesex_res"), range(2010, 2020)))
    # JUL1 2020-2025 (YEAR 2..7 = 7/1/2020..7/1/2025 per the CC-EST2025-AGESEX layout)
    c, pub = P.co_est_wide(p("census_co_est2025_alldata"), "census_co_est2025_alldata", f("census_co_est2025_alldata"), range(2020, 2026))
    C.append(c); PUB.append(pub)
    C.append(P.cc_est_long(p("census_cc_est2025_agesex_72"), "census_cc_est2025_agesex_72",
                           f("census_cc_est2025_agesex_72"), {k: 2018 + k for k in range(2, 8)}, pr=True))
    PUB.append(P.nst_est2025(p("census_nst_est2025_alldata"), "census_nst_est2025_alldata", f("census_nst_est2025_alldata"), range(2020, 2026)))

    # APR1 2000
    c1, p1 = P.census2000_dp(p("census2000_dp_all_states"), "census2000_dp_all_states", f("census2000_dp_all_states"))
    c2, p2 = P.census2000_dp(p("census2000_dp_pr"), "census2000_dp_pr", f("census2000_dp_pr"))
    if (c1["geoid"].str[:2] == "72").any() or (p1["level"] == "pr").any():
        raise RuntimeError("2khxx unexpectedly contains Puerto Rico; de-duplicate before summing")
    C += [c1, c2]; PUB += [p1, p2[p2["level"] != "us"]]
    # APR1 2010 / 2020
    for st in STATE_POSTALS:
        sid = f"census2010_dp_{st.lower()}"
        c, pub = P.census2010_dp(p(sid), sid, f(sid))
        C.append(c); PUB.append(pub[pub["level"] != "us"])
        sid = f"census2020_pl_{st.lower()}"
        c, pub = P.census2020_pl(p(sid), sid, f(sid))
        C.append(c); PUB.append(pub[pub["level"] != "us"])
    _, pub = P.census2010_dp(p("census2010_dp_us"), "census2010_dp_us", f("census2010_dp_us"))
    PUB.append(pub[pub["level"] == "us"])
    _, pub = P.census2020_pl(p("census2020_pl_us"), "census2020_pl_us", f("census2020_pl_us"))
    PUB.append(pub[pub["level"] == "us"])

    # Island Areas
    cdm = pd.read_csv(BOUNDARIES / "county_district.csv", dtype=str, keep_default_na=False)
    for st, fips in [("GU", "66"), ("VI", "78"), ("MP", "69")]:
        members = dict(zip(cdm.loc[cdm["state"] == st, "county_name"], cdm.loc[cdm["state"] == st, "geoid"]))
        s20 = f"census2020_ia_{st.lower()}_phc01"
        c20, p20 = P.island_2020_phc(p(s20), s20, f(s20), st, members)
        s10 = [k for k in got if k.startswith(f"census2010_ia_{st.lower()}_")][0]
        c10, p10 = P.island_2010_cb(p(s10), s10, f(s10), st, members)
        # 2010 appears in both tables: they must agree
        a = c20[c20["period"] == 2010].set_index("geoid")["value"].sort_index()
        b = c10[c10["period"] == 2010].set_index("geoid")["value"].sort_index()
        ta = int(p20.loc[p20["period"] == 2010, "value"].iloc[0])
        tb = int(p10.loc[p10["period"] == 2010, "value"].iloc[0])
        ok = a.equals(b) and ta == tb
        checks.append({"check": f"{st} 2010 Census count: 2020 table vs 2010 press table", "a_source": s20,
                       "b_source": s10, "a": ta, "b": tb, "n_units": len(a), "units_differing": int((a != b).sum()),
                       "result": "match" if ok else "MISMATCH"})
        if not ok:
            raise RuntimeError(f"{st}: 2010 Island Area counts differ between {s20} and {s10}")
        C += [c10, c20[c20["period"] == 2020]]
        PUB += [p10, p20[p20["period"] == 2020]]

    counties = pd.concat(C, ignore_index=True)
    published = pd.concat(PUB, ignore_index=True)
    return counties, published, checks


# ------------------------------------------------------------------------------------------ assemble
def assign(counties: pd.DataFrame, mapping: pd.DataFrame) -> pd.DataFrame:
    df = counties.merge(mapping, on="geoid", how="left", validate="many_to_one")
    unmapped = df[df["district_id"].isna()]
    if not unmapped.empty:
        bad = unmapped[["geoid", "county_name", "period", "source_id"]].drop_duplicates("geoid")
        raise RuntimeError(f"{len(bad)} county GEOIDs not in county_district.csv/legacy_geoids.csv: {bad.to_dict('records')[:10]}")
    blank = df[df["district_id"] == ""]
    if not blank.empty:
        raise RuntimeError(f"county rows with no district (e.g. American Samoa): {blank['geoid'].unique().tolist()}")
    amb = df[~df["legacy_single_district"]]
    if not amb.empty:
        raise RuntimeError(f"legacy GEOIDs spanning two districts used: {amb['geoid'].unique().tolist()}")
    dup = df.duplicated(["geoid", "period", "period_type"], keep=False)
    if dup.any():
        raise RuntimeError(f"duplicate county rows: {df[dup].head().to_dict('records')}")
    df["state_fips"] = df["geoid"].str[:2]
    df["state"] = df["state_fips"].map(FIPS_TO_POSTAL)
    df["split_county"] = df["split_districts"] != ""
    df["value"] = df["value"].astype("int64")
    cols = ["geoid", "state", "state_fips", "county_name", "district_id", "geoid_status", "split_county",
            "split_districts", "period", "period_type", "value", "source_id", "source_locator"]
    return df[cols].sort_values(["period_type", "period", "geoid"]).reset_index(drop=True)


def aggregate(cp: pd.DataFrame, got: dict) -> pd.DataFrame:
    g = cp.groupby(["district_id", "period", "period_type"]).agg(
        value=("value", "sum"), n=("value", "size"), n_src=("source_id", "nunique"), source_id=("source_id", "first"),
        n_legacy=("geoid_status", lambda s: int((s == "legacy").sum()))).reset_index()
    if (g["n_src"] != 1).any():
        raise RuntimeError(f"district-periods drawing on more than one source file: {g[g.n_src != 1].head().to_dict('records')}")
    g["variable"] = g["period_type"].map({"JUL1_EST": "population_estimate", "APR1_CENSUS": "population_census"})
    g["unit"] = "persons"
    col = {"JUL1_EST": "estimate", "APR1_CENSUS": "census count"}

    def loc(r):
        fn = fname(got[r.source_id].meta["url"])
        return (f"{fn}: sum of {r.n} county-equivalent {col[r.period_type]}s for {r.period} assigned to {r.district_id} "
                f"by data/processed/boundaries/county_district.csv"
                + (f" and legacy_geoids.csv ({r.n_legacy} legacy GEOIDs)" if r.n_legacy else "")
                + "; each cell is listed in county_population.parquet")
    g["source_locator"] = g.apply(loc, axis=1)
    g["value"] = g["value"].astype(float)
    return g[["district_id", "period", "period_type", "variable", "value", "unit", "source_id", "source_locator"]]


def reconcile(cp: pd.DataFrame, obs: pd.DataFrame, pub: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    rows = []
    for (pt, y), sub in cp.groupby(["period_type", "period"]):
        o = obs[(obs["period_type"] == pt) & (obs["period"] == y)]
        st = sub[~sub["state_fips"].isin(TERRITORY_FIPS | {"72"})]
        pr = sub[sub["state_fips"] == "72"]
        terr = sub[sub["state_fips"].isin(TERRITORY_FIPS)]
        pu = pub[(pub["period_type"] == pt) & (pub["period"] == y)]
        us_pub = pu[pu["level"] == "us"]
        pr_pub = pu[pu["level"] == "pr"]
        tp = pu[pu["level"] == "territory"]
        if len(us_pub) != 1 or len(pr_pub) > 1:
            raise RuntimeError(f"{pt} {y}: expected one published U.S. total and at most one PR total")
        d_ex = int(o.loc[~o["district_id"].isin(TERRITORIAL), "value"].sum())
        d_terr = int(o.loc[o["district_id"].isin(TERRITORIAL), "value"].sum())
        r = {
            "period": y, "period_type": pt,
            "n_county_rows_states_dc": len(st), "sum_counties_states_dc": int(st["value"].sum()),
            "published_us_total": int(us_pub["value"].iloc[0]), "us_source_id": us_pub["source_id"].iloc[0],
            "us_source_locator": us_pub["source_locator"].iloc[0],
            "n_municipios_pr": len(pr), "sum_municipios_pr": int(pr["value"].sum()),
            "published_pr_total": int(pr_pub["value"].iloc[0]) if len(pr_pub) else None,
            "pr_source_id": pr_pub["source_id"].iloc[0] if len(pr_pub) else "",
            "pr_source_locator": pr_pub["source_locator"].iloc[0] if len(pr_pub) else
            "no separate Puerto Rico total is published in the 2010-2020 intercensal series; municipio sum used",
            "sum_districts_excl_territories": d_ex,
            "sum_territory_units": int(terr["value"].sum()), "published_territory_total": int(tp["value"].sum()) if len(tp) else None,
            "sum_territorial_districts": d_terr,
        }
        expected = r["published_us_total"] + (r["published_pr_total"] if r["published_pr_total"] is not None else r["sum_municipios_pr"])
        r["us_plus_pr_published"] = expected
        r["diff_districts_minus_published"] = d_ex - expected
        r["diff_counties_minus_us"] = r["sum_counties_states_dc"] - r["published_us_total"]
        r["diff_municipios_minus_pr"] = (r["sum_municipios_pr"] - r["published_pr_total"]) if r["published_pr_total"] is not None else None
        r["diff_territories"] = (r["sum_territory_units"] - r["published_territory_total"]) if len(tp) else None
        rows.append(r)
    rec = pd.DataFrame(rows)
    bad = rec[(rec["diff_districts_minus_published"] != 0) | (rec["diff_counties_minus_us"] != 0)
              | (rec["diff_municipios_minus_pr"].fillna(0) != 0) | (rec["diff_territories"].fillna(0) != 0)
              | (rec["sum_territory_units"] != rec["sum_territorial_districts"])]
    # state level
    srows = []
    sp = pub[pub["level"] == "state"]
    sums = cp.groupby(["period_type", "period", "state_fips"])["value"].sum()
    for r in sp.itertuples(index=False):
        s = int(sums.get((r.period_type, r.period, r.state_fips), 0))
        srows.append({"period": r.period, "period_type": r.period_type, "state_fips": r.state_fips,
                      "state": FIPS_TO_POSTAL.get(r.state_fips, ""), "sum_counties": s, "published_state_total": r.value,
                      "diff": s - r.value, "source_id": r.source_id, "source_locator": r.source_locator})
    srec = pd.DataFrame(srows).sort_values(["period_type", "period", "state_fips", "source_id"]).reset_index(drop=True)
    if not bad.empty or (srec["diff"] != 0).any():
        print(bad.to_string())
        print(srec[srec["diff"] != 0].to_string())
        raise RuntimeError("reconciliation failed (see above)")
    return rec, srec


def cross_checks(got: dict, cp: pd.DataFrame) -> list[dict]:
    """2010 Census counts as carried in the 2000-2010 intercensal files vs the 2010 DP summary files."""
    out = []
    c00 = P._read_csv(got["census_co_est00int_tot"].path, usecols=["SUMLEV", "STATE", "COUNTY", "CENSUS2010POP"])
    c00 = c00[c00["SUMLEV"].str.zfill(3) == "050"]
    a = pd.Series(c00["CENSUS2010POP"].astype(int).values, index=c00["STATE"].str.zfill(2) + c00["COUNTY"].str.zfill(3))
    pr = P._read_csv(got["census_prm_est00int_agesex_5yr"].path)
    pr = pr[(pr["SEX"] == "0") & (pr["AGEGRP"] == "0")]
    a = pd.concat([a, pd.Series(pr["CENSUS2010POP"].astype(int).values, index="72" + pr["MUNICIPIO"].str.zfill(3))])
    b = cp[(cp["period_type"] == "APR1_CENSUS") & (cp["period"] == 2010) & ~cp["state_fips"].isin(TERRITORY_FIPS)]
    b = b.set_index("geoid")["value"]
    common = a.index.intersection(b.index)
    diff = (a[common] != b[common])
    out.append({"check": "2010 Census county counts: CENSUS2010POP in the 2000-2010 intercensal files vs the 2010 DP summary files",
                "a_source": "census_co_est00int_tot + census_prm_est00int_agesex_5yr", "b_source": "census2010_dp_<state>",
                "a": int(a.sum()), "b": int(b.sum()), "n_units": len(common), "units_differing": int(diff.sum()),
                "result": "match" if not diff.any() and len(common) == len(a) == len(b) else
                f"{int(diff.sum())} counties differ: " + ", ".join(f"{g} {a[g]} vs {b[g]}" for g in list(common[diff])[:8])})
    return out


def write_variables(got: dict, carve: pd.DataFrame) -> None:
    est_src = sorted(k for k in ESTIMATES if not k.startswith(("census_nst", "census_nc", "census_prc", "census_st")))
    cen_src = sorted(k for k in got if k.startswith(("census2000_dp", "census2010_dp", "census2020_pl", "census2010_ia",
                                                      "census2020_ia")) and not k.endswith("_us"))
    common = ("Districts are built from whole counties: a county is credited to the district that holds it in "
              "data/processed/boundaries/county_district.csv. Eight counties are cut by statutory carve-outs "
              "(Fort Bragg/Camp MacKall and FCI Butner -> E.D.N.C.; Yellowstone NP parts of MT and ID -> D. Wyo.); "
              "their whole population is counted in M.D.N.C., D. Mont. or D. Idaho, because Census publishes no "
              "county-part figures for these areas (see data gaps). American Samoa is in no judicial district and "
              "is excluded. Size of the effect at the 2020 Census (blocks whose internal point lies in a carve-out, "
              "carveout_blocks_2020.csv): " + "; ".join(f"{r.county_name} {r.carve_out_population_2020:,}"
                                                       for r in carve.itertuples() if r.carve_out_population_2020)
              + "; the other split counties 0.")
    v = [
        {"id": "population_estimate", "label": "Resident population (July 1 estimate)", "unit": "persons",
         "period_type": "JUL1_EST",
         "description": "Census Bureau estimate of the resident population on July 1 of the year, summed over the "
                        "counties (Puerto Rico municipios) in the district.",
         "source_ids": est_src,
         "caveats": common + " 2000-2009 come from the 2000-2010 intercensal series, 2010-2019 from the 2010-2020 "
                    "intercensal series, and 2020-2025 from the Vintage 2025 postcensal series (revised every year "
                    "and replaced by intercensal estimates after the 2030 Census). Series breaks at 2010 and 2020. "
                    "No annual estimates exist for Guam, the U.S. Virgin Islands or the Northern Mariana Islands, so "
                    "D. Guam, D.V.I. and D.N.M.I. have no July 1 values.",
         "higher_means": "more residents", "derived": True,
         "formula": "sum over counties assigned to the district of the county's published July 1 estimate"},
        {"id": "population_census", "label": "Resident population (decennial census, April 1)", "unit": "persons",
         "period_type": "APR1_CENSUS",
         "description": "Decennial census count of the resident population on April 1 of 2000, 2010 and 2020, summed "
                        "over the counties (municipios; islands; municipalities) in the district.",
         "source_ids": cen_src,
         "caveats": common + " Counts are as first tabulated (Census 2000 Demographic Profile, 2010 Demographic "
                    "Profile Summary File, 2020 P.L. 94-171 file); they do not include later Count Question "
                    "Resolution corrections, so they can differ slightly from the April 1 estimates bases. Island "
                    "Areas counts come from the Census Bureau's Island Areas tables.",
         "higher_means": "more residents", "derived": True,
         "formula": "sum over counties assigned to the district of the county's published census count"},
    ]
    (OUT / "variables.json").write_text(json.dumps(v, indent=1))


def record_gaps(cp: pd.DataFrame, carve: pd.DataFrame) -> None:
    years = sorted(cp.loc[cp["period_type"] == "JUL1_EST", "period"].unique().tolist())
    record_gap(LANE, "island_areas_no_annual_estimates",
               description="The Census Bureau publishes no annual (July 1) population estimates for Guam, the U.S. "
                           "Virgin Islands or the Northern Mariana Islands; only decennial census counts (2000, 2010, "
                           "2020) are available for D. Guam, D.V.I. and D.N.M.I.",
               variables=["population_estimate"], districts=sorted(TERRITORIAL), periods=years,
               reason="not produced by the Census Bureau's population estimates program")
    split = cp.loc[cp["split_county"], ["geoid", "county_name", "district_id", "split_districts"]].drop_duplicates("geoid")
    record_gap(LANE, "split_county_carveout_population",
               description="Eight counties are divided between two districts by statutory carve-outs (Fort Bragg / Camp "
                           "MacKall and FCI Butner in Moore, Richmond, Scotland, Hoke and Durham counties NC -> E.D.N.C.; "
                           "the Yellowstone National Park parts of Park and Gallatin MT and Fremont ID -> D. Wyo.). "
                           "Census estimates and the county tables used here have no figures for those county parts, so "
                           "each county's whole population is counted in the district holding the rest of it (M.D.N.C., "
                           "D. Mont., D. Idaho). The carved-out residents are not separated. Counties: "
                           + "; ".join(f"{r.geoid} {r.county_name} ({r.split_districts})" for r in split.itertuples()),
               variables=["population_estimate", "population_census"],
               districts=["ncmd", "nced", "mtd", "idd", "wyd"], periods="all",
               reason="no county-part population published (see boundaries gap split_counties_whole_in_county_tables). "
                      "Magnitude, from 2020 Census blocks whose internal point lies in the carve-out "
                      "(carveout_blocks_2020.csv, derived): "
                      + "; ".join(f"{r.county_name} {r.carve_out_population_2020:,} of {r.county_population_2020:,}"
                                  for r in carve.itertuples())
                      + ". No such block split exists for the annual estimates or for 2000/2010 in this build.")


def main() -> None:
    got = acquire()
    mapping = load_mapping()
    counties, published, checks = parse_all(got)
    cp = assign(counties, mapping)
    obs = aggregate(cp, got)
    rec, srec = reconcile(cp, obs, published)
    checks += cross_checks(got, cp)
    OUT.mkdir(parents=True, exist_ok=True)
    carve = carveouts.build(got, pd.read_csv(BOUNDARIES / "split_counties.csv", dtype=str))
    c20 = cp[(cp["period_type"] == "APR1_CENSUS") & (cp["period"] == 2020)].set_index("geoid")["value"]
    bad = carve[carve["county_population_2020"] != carve["county_geoid"].map(c20)]
    if not bad.empty:  # the block sums must reproduce the county counts used above
        raise RuntimeError(f"block sums differ from county counts: {bad.to_dict('records')}")
    carve.to_csv(OUT / "carveout_blocks_2020.csv", index=False)
    cp.to_parquet(OUT / "county_population.parquet", index=False)
    write_observations(LANE, obs)
    rec.to_csv(OUT / "reconciliation.csv", index=False)
    srec.to_csv(OUT / "state_reconciliation.csv", index=False)
    pd.DataFrame(checks).to_csv(OUT / "cross_checks.csv", index=False)
    write_variables(got, carve)
    record_gaps(cp, carve)
    cov = obs.groupby(["variable", "period_type"]).agg(first=("period", "min"), last=("period", "max"),
                                                        districts=("district_id", "nunique"), rows=("value", "size"))
    summary = {
        "built": date.today().isoformat(),
        "county_rows": int(len(cp)),
        "county_rows_by_series": cp.groupby("source_id").size().to_dict(),
        "legacy_geoids_used": sorted(cp.loc[cp["geoid_status"] == "legacy", "geoid"].unique().tolist()),
        "observation_rows": int(len(obs)),
        "coverage": {f"{k[0]}|{k[1]}": v for k, v in cov.to_dict("index").items()},
        "reconciliation_years": int(len(rec)),
        "state_reconciliation_rows": int(len(srec)),
        "cross_checks": checks,
        "carveout_population_2020": carve.set_index("county_geoid")["carve_out_population_2020"].to_dict(),
    }
    (OUT / "build_summary.json").write_text(json.dumps(summary, indent=1, default=str))
    print(json.dumps({k: v for k, v in summary.items() if k != "county_rows_by_series"}, indent=1, default=str))


if __name__ == "__main__":
    main()
