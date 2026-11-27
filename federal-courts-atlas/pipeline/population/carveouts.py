"""How many 2020 Census residents live in the statutory carve-outs that split eight counties?

Supplementary, derived table (not an observation). The district series keep whole counties, as the
contract requires. This quantifies the caveat for M.D.N.C./E.D.N.C., D. Mont./D. Idaho/D. Wyo.

Method: every 2020 Census block (P.L. 94-171 geographic header, SUMLEV 750) in the eight split counties is
assigned to the carve-out if its Census internal point (INTPTLAT/INTPTLON) lies inside the TIGER/Line 2025
feature that defines the carve-out: Fort Bragg and Camp MacKall (military installations, MTFCC G6500), the
Butner Federal Correctional Complex (area landmark K1237), or Yellowstone National Park (area landmark K2181).
These are the same features the boundaries lane used. A block that straddles a feature edge goes wholly to the
side holding its internal point, so the figures are exact block sums but approximate at the edges.
"""
from __future__ import annotations

import io
import zipfile

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

from pipeline.common.manifest import register_source

from . import LANE
from .parse import _PL, PL2020_GEO_FIELDS
from .sources import PUBLISHER, get

TIGER = "https://www2.census.gov/geo/tiger/TIGER2025/"
FEATURES = {
    "census_tl2025_mil": (TIGER + "MIL/tl_2025_us_mil.zip", "TIGER/Line Shapefile 2025, Military Installations (tl_2025_us_mil)"),
    "census_tl2025_arealm_37": (TIGER + "AREALM/tl_2025_37_arealm.zip", "TIGER/Line Shapefile 2025, Area Landmarks, North Carolina"),
    "census_tl2025_arealm_30": (TIGER + "AREALM/tl_2025_30_arealm.zip", "TIGER/Line Shapefile 2025, Area Landmarks, Montana"),
    "census_tl2025_arealm_16": (TIGER + "AREALM/tl_2025_16_arealm.zip", "TIGER/Line Shapefile 2025, Area Landmarks, Idaho"),
}
# carve-out key -> (feature source, FULLNAME values, MTFCC)
CARVE = {
    "fort_bragg_camp_mackall": ("census_tl2025_mil", ["Fort Bragg", "Camp MacKall"], "G6500"),
    "fci_butner": ("census_tl2025_arealm_37", ["Butner Federal Correctional Complx"], "K1237"),
    "yellowstone_mt": ("census_tl2025_arealm_30", ["Yellowstone Natl Pk"], "K2181"),
    "yellowstone_id": ("census_tl2025_arealm_16", ["Yellowstone Natl Pk"], "K2181"),
}


def _feature(got, key) -> gpd.GeoDataFrame:
    sid, names, mtfcc = CARVE[key]
    g = gpd.read_file(f"zip://{got[sid].path}")
    g = g[g["FULLNAME"].isin(names) & (g["MTFCC"] == mtfcc)]
    if sorted(set(g["FULLNAME"])) != sorted(names):
        raise RuntimeError(f"{key}: features {names} not found in {sid}")
    return g.to_crs(4269)


def _blocks(path, counties: set[str]) -> pd.DataFrame:
    z = zipfile.ZipFile(path)
    geo = [n for n in z.namelist() if n.endswith("geo2020.pl")][0]
    rows = []
    with z.open(geo) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            head = raw.split("|", 5)
            if head[2] != "750":
                continue
            fld = raw.rstrip("\r\n").split("|")
            if len(fld) != len(PL2020_GEO_FIELDS):
                raise ValueError("unexpected PL geo record width")
            geoid5 = fld[_PL["STATE"]] + fld[_PL["COUNTY"]]
            if geoid5 in counties:
                rows.append((geoid5, fld[_PL["GEOID"]], int(fld[_PL["POP100"]]),
                             float(fld[_PL["INTPTLAT"]]), float(fld[_PL["INTPTLON"]])))
    return pd.DataFrame(rows, columns=["county_geoid", "block_geoid", "pop100", "lat", "lon"])


def build(got_pop: dict, split: pd.DataFrame) -> pd.DataFrame:
    """split: data/processed/boundaries/split_counties.csv. got_pop: the population lane's fetched files."""
    got = {}
    for sid, (url, ds) in FEATURES.items():
        r = get(url)
        register_source(LANE, sid, url=url, dataset=ds, publisher=PUBLISHER, vintage="TIGER/Line 2025", cached=r,
                        notes="Carve-out feature polygons, used only for carveout_blocks_2020.csv.")
        got[sid] = r
    out = []
    for st, sid in [("37", "census2020_pl_nc"), ("30", "census2020_pl_mt"), ("16", "census2020_pl_id")]:
        sp = split[split["geoid"].str[:2] == st]
        blocks = _blocks(got_pop[sid].path, set(sp["geoid"]))
        pts = gpd.GeoDataFrame(blocks, geometry=[Point(xy) for xy in zip(blocks["lon"], blocks["lat"])], crs=4269)
        for r in sp.itertuples(index=False):
            key = r.area if r.area != "yellowstone" else ("yellowstone_mt" if st == "30" else "yellowstone_id")
            feat = _feature(got, key)
            b = pts[pts["county_geoid"] == r.geoid]
            inside = b[b.within(feat.union_all())]
            out.append({
                "county_geoid": r.geoid, "county_name": r.county_name, "county_district": r.county_district,
                "carved_to": r.carved_to, "carve_out": r.area, "feature_source_id": CARVE[key][0],
                "feature_names": "; ".join(CARVE[key][1]),
                "blocks_in_county": len(b), "blocks_in_carve_out": len(inside),
                "county_population_2020": int(b["pop100"].sum()),
                "carve_out_population_2020": int(inside["pop100"].sum()),
                "block_source_id": sid,
                "method": "2020 Census blocks (P.L. 94-171 SUMLEV 750) whose internal point lies in the TIGER/Line "
                          "2025 carve-out feature; derived, approximate at feature edges",
            })
    return pd.DataFrame(out)
