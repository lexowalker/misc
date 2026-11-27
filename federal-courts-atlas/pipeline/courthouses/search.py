"""The "find your federal court" search index (public/data/search/).

  places.json      Census places (+ active towns/townships in strong-MCD states, NYC boroughs, island-area
                   villages) -> district by point-in-polygon of the Census internal point; `o` lists other
                   districts the place reaches into (from the 2020 place-by-county file).
  counties.json    every county-equivalent with a district (county_district.csv), split counties flagged.
  zcta.json        2020 ZCTA -> district(s) with land-area shares (2020 ZCTA-to-county relationship file).
  courthouses.json courthouse building names and places of holding court -> district.
"""
from __future__ import annotations

import json

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely

from pipeline.common.districts import BY_ID
from pipeline.common.manifest import DATA

from .geo import counties as county_polys
from .geo import districts as district_polys
from .sources import get

BOUNDARIES = DATA / "processed" / "boundaries"
MCD_STATES = {"CT", "ME", "MA", "MI", "MN", "NH", "NJ", "NY", "PA", "RI", "VT", "WI"}
NYC_BOROUGHS = {"3600508510", "3604710022", "3606144919", "3608160323", "3608570915"}  # Bx, Bk, Mn, Qn, SI
INCORPORATED = {"A", "B", "C", "G", "F"}  # FUNCSTAT: active/partial/consolidated/... (F = fictitious balance)


def county_table() -> pd.DataFrame:
    cd = pd.read_csv(BOUNDARIES / "county_district.csv", dtype=str).fillna("")
    return cd


def county_to_district_2020() -> tuple[dict[str, str], set[str]]:
    """2020-vintage county GEOID -> district (current + legacy GEOIDs), and the set of split counties."""
    cd = county_table()
    m = dict(zip(cd["geoid"], cd["district_id"]))
    leg = pd.read_csv(BOUNDARIES / "legacy_geoids.csv", dtype=str).fillna("")
    for g, d in zip(leg["legacy_geoid"], leg["district_id"]):
        m.setdefault(g, d)
    split = set(cd.loc[cd["split_districts"] != "", "geoid"])
    return m, split


def _r3(x: float) -> float:
    return float(np.round(x, 3))


def place_rows(places: pd.DataFrame, cousubs: pd.DataFrame) -> tuple[list[list], pd.DataFrame]:
    """Rows [name, state, lat, lon, district, other_districts, type] and the full table (for the CSV)."""
    c2d, split = county_to_district_2020()
    pbc = pd.read_csv(get("census_place_by_county2020").path, sep="|", dtype=str, encoding="utf-8-sig")
    pbc["pgeoid"] = pbc["STATEFP"] + pbc["PLACEFP"]
    pbc["cgeoid"] = pbc["STATEFP"] + pbc["COUNTYFP"]
    pbc = pbc[~pbc["cgeoid"].isin(split)]
    pbc["d"] = pbc["cgeoid"].map(c2d)
    reach = pbc.dropna(subset=["d"]).groupby("pgeoid")["d"].agg(lambda s: sorted(set(s)))

    p = places.dropna(subset=["district_id"]).copy()
    p["t"] = np.where(p["USPS"].isin(["GU", "MP", "VI"]), "i",
                      np.where(p["FUNCSTAT"].isin(INCORPORATED), "c", "p"))
    p["other"] = [";".join(x for x in reach.get(g, []) if x != d) for g, d in zip(p["GEOID"], p["district_id"])]

    c = cousubs.dropna(subset=["district_id"]).copy()
    keep = ((c["USPS"].isin(MCD_STATES) & (c["FUNCSTAT"] == "A")) | c["GEOID"].isin(NYC_BOROUGHS)
            | c["USPS"].isin(["GU", "MP", "VI"]))
    c = c[keep & ~c["NAME"].str.contains("not defined", case=False)]
    have = set(zip(p["USPS"], p["key"], p["district_id"]))
    c = c[[(s, k, d) not in have for s, k, d in zip(c["USPS"], c["key"], c["district_id"])]].copy()
    c = c.drop_duplicates(["USPS", "key", "district_id"])
    c["t"] = np.where(c["USPS"].isin(["GU", "MP", "VI"]), "i", "m")
    c["other"] = ""
    allp = pd.concat([p, c], ignore_index=True)
    allp = allp.sort_values(["USPS", "base", "GEOID"]).reset_index(drop=True)
    rows = [[b, s, _r3(la), _r3(lo), d, o, t] for b, s, la, lo, d, o, t in
            zip(allp["base"], allp["USPS"], allp["lat"], allp["lon"], allp["district_id"], allp["other"], allp["t"])]
    return rows, allp


def county_rows() -> tuple[list[list], int]:
    cd = county_table()
    excluded = int((cd["district_id"] == "").sum())
    cd = cd[cd["district_id"] != ""].sort_values("geoid")
    rows = [[g, n, s, d, sp] for g, n, s, d, sp in
            zip(cd["geoid"], cd["county_name"], cd["state"], cd["district_id"], cd["split_districts"])]
    return rows, excluded


def zcta_table() -> pd.DataFrame:
    """One row per ZCTA x district: land area (m²) and share of the ZCTA's land, with the method used."""
    c2d, split = county_to_district_2020()
    rel = pd.read_csv(get("census_rel2020_zcta_county").path, sep="|", dtype=str,
                      usecols=["GEOID_ZCTA5_20", "AREALAND_ZCTA5_20", "AREAWATER_ZCTA5_20", "GEOID_COUNTY_20",
                               "AREALAND_PART", "AREAWATER_PART"])
    rel = rel[rel["GEOID_ZCTA5_20"].notna() & (rel["GEOID_ZCTA5_20"] != "")].copy()
    for col in ["AREALAND_ZCTA5_20", "AREAWATER_ZCTA5_20", "AREALAND_PART", "AREAWATER_PART"]:
        rel[col] = rel[col].astype(float)
    rel["district_id"] = rel["GEOID_COUNTY_20"].map(c2d)
    if rel["district_id"].isna().any():
        bad = sorted(rel.loc[rel["district_id"].isna(), "GEOID_COUNTY_20"].unique())
        raise RuntimeError(f"rel2020 counties without a district: {bad[:20]}")
    rel["method"] = "county"
    # ZCTA-county parts inside a split county: divide the part between the two districts by polygon area.
    sp = rel[rel["GEOID_COUNTY_20"].isin(split)]
    if len(sp):
        zs = sorted(sp["GEOID_ZCTA5_20"].unique())
        zr = get("census_cb2020_zcta520_500k")
        where = "ZCTA5CE20 IN (" + ",".join(f"'{z}'" for z in zs) + ")"
        zg = pyogrio.read_dataframe(f"zip://{zr.path}", columns=["ZCTA5CE20"], where=where).to_crs(5070)
        zg["geometry"] = shapely.make_valid(zg.geometry.values)
        cg = county_polys()
        cg = cg[cg["GEOID"].isin(split)].to_crs(5070)
        cg["geometry"] = shapely.make_valid(cg.geometry.values)
        dg = district_polys()
        dg = dg[dg.intersects(cg.to_crs(4326).geometry.union_all())].to_crs(5070)
        dg["geometry"] = shapely.make_valid(dg.geometry.values)
        new = []
        for _, r in sp.iterrows():
            z = zg[zg["ZCTA5CE20"] == r["GEOID_ZCTA5_20"]]
            cty = cg[cg["GEOID"] == r["GEOID_COUNTY_20"]]
            piece = z.geometry.union_all().intersection(cty.geometry.union_all()) if len(z) and len(cty) else None
            if piece is None or piece.area <= 0:
                new.append(r.to_dict() | {"method": "county (split county; no polygon overlap at 1:500k)"})
                continue
            tot = piece.area
            for did, geom in zip(dg["district_id"], dg.geometry):
                if not piece.intersects(geom):
                    continue
                a = piece.intersection(geom).area
                if a / tot > 1e-4:
                    d = r.to_dict()
                    d.update(district_id=did, AREALAND_PART=r["AREALAND_PART"] * a / tot,
                             AREAWATER_PART=r["AREAWATER_PART"] * a / tot,
                             method="split county: part divided by 1:500k polygon area")
                    new.append(d)
        rel = pd.concat([rel[~rel["GEOID_COUNTY_20"].isin(split)], pd.DataFrame(new)], ignore_index=True)
    g = rel.groupby(["GEOID_ZCTA5_20", "district_id"], as_index=False).agg(
        land=("AREALAND_PART", "sum"), water=("AREAWATER_PART", "sum"),
        zland=("AREALAND_ZCTA5_20", "first"), zwater=("AREAWATER_ZCTA5_20", "first"),
        method=("method", lambda s: "; ".join(sorted(set(s)))), counties=("GEOID_COUNTY_20", lambda s: ";".join(sorted(set(s)))))
    tot_land = g.groupby("GEOID_ZCTA5_20")["land"].transform("sum")
    tot_all = g.groupby("GEOID_ZCTA5_20")[["land", "water"]].transform("sum").sum(axis=1)
    g["share_basis"] = np.where(tot_land > 0, "land", "land+water")
    g["share"] = np.where(tot_land > 0, g["land"] / tot_land.where(tot_land > 0, 1), (g["land"] + g["water"]) / tot_all)
    g = g.rename(columns={"GEOID_ZCTA5_20": "zcta"})
    return g.sort_values(["zcta", "share"], ascending=[True, False]).reset_index(drop=True)


def zcta_map(zt: pd.DataFrame) -> dict:
    out = {}
    for z, grp in zt.groupby("zcta", sort=True):
        grp = grp[grp["share"] > 0].sort_values("share", ascending=False)
        if len(grp) == 1:
            out[z] = grp["district_id"].iloc[0]
        else:
            out[z] = [[d, round(float(s), 3)] for d, s in zip(grp["district_id"], grp["share"])]
    return out


def write_json(path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(txt + "\n", encoding="utf-8")
    return len(txt.encode("utf-8")) + 1
