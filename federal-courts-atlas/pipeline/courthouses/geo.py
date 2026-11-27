"""Point-in-polygon against the boundaries lane's district polygons (and Census county polygons).

District polygons: data/processed/boundaries/districts.parquet (EPSG:4326, Census 1:500k counties dissolved,
with the statutory carve-outs applied: Yellowstone NP -> wyd, Fort Bragg / Camp MacKall and FCI Butner -> nced).
"""
from __future__ import annotations

from functools import lru_cache

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from pyproj import Geod

from pipeline.common.manifest import DATA

from .sources import get

DISTRICTS_PARQUET = DATA / "processed" / "boundaries" / "districts.parquet"
_GEOD = Geod(ellps="WGS84")
NEAREST_MAX_KM = 5.0   # a point outside every polygon is assigned the nearest one only if within this distance


@lru_cache(maxsize=1)
def districts() -> gpd.GeoDataFrame:
    g = gpd.read_parquet(DISTRICTS_PARQUET)[["district_id", "geometry"]]
    return g.reset_index(drop=True)


@lru_cache(maxsize=1)
def counties() -> gpd.GeoDataFrame:
    r = get("census_cb2025_county_500k")
    g = pyogrio.read_dataframe(f"zip://{r.path}", columns=["GEOID", "NAMELSAD", "STUSPS"])
    return g.to_crs(4326).reset_index(drop=True)


def _km(lon, lat, geom) -> float:
    p = shapely.Point(lon, lat)
    q = shapely.ops.nearest_points(p, geom)[1]
    return _GEOD.inv(lon, lat, q.x, q.y)[2] / 1000.0


def locate_points(lon, lat, polys: gpd.GeoDataFrame, id_col: str, nearest: bool = True) -> pd.DataFrame:
    """For each point: the containing polygon id, how it was found ('within' or 'nearest'), and km to it."""
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    pts = gpd.GeoDataFrame({"i": np.arange(len(lon))}, geometry=gpd.points_from_xy(lon, lat), crs=4326)
    j = gpd.sjoin(pts, polys[[id_col, "geometry"]], how="left", predicate="intersects")
    j = j.sort_values(["i", id_col]).groupby("i").agg(ids=(id_col, lambda s: [x for x in s if isinstance(x, str)]))
    out = pd.DataFrame({"id": [None] * len(lon), "how": [None] * len(lon), "km": [0.0] * len(lon),
                        "n_hits": [0] * len(lon)})
    for i, ids in j["ids"].items():
        out.at[i, "n_hits"] = len(ids)
        if ids:
            out.at[i, "id"] = ids[0]
            out.at[i, "how"] = "within"
    if nearest:
        tree = shapely.STRtree(polys.geometry.values)
        for i in out.index[out["id"].isna()]:
            p = shapely.Point(lon[i], lat[i])
            k = tree.nearest(p)
            km = _km(lon[i], lat[i], polys.geometry.iloc[k])
            if km <= NEAREST_MAX_KM:
                out.at[i, "id"] = polys[id_col].iloc[k]
                out.at[i, "how"] = "nearest"
                out.at[i, "km"] = round(km, 3)
            else:
                out.at[i, "how"] = "none"
                out.at[i, "km"] = round(km, 3)
    return out


def district_of(lon, lat) -> pd.DataFrame:
    return locate_points(lon, lat, districts(), "district_id")


def county_of(lon, lat) -> pd.DataFrame:
    return locate_points(lon, lat, counties(), "GEOID")
