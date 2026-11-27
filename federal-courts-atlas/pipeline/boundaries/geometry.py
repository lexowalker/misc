"""District geometry: statutory carve-outs, dissolves, GeoParquet and TopoJSON (via mapshaper)."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

from pipeline.common.districts import BY_ID, STATES
from pipeline.common.http import PROJECT_ROOT

EQUAL_AREA = 5070            # NAD83 / Conus Albers, used only for areas and sliver tests
MIN_PART_KM2 = 0.1           # polygon parts of a carve-out smaller than this are treated as resolution artefacts
MIN_COUNTY_OVERLAP_KM2 = 1.0  # a county is carved only if the special area covers at least this much of it
SNAP_DEG = 0.0005            # ~50 m: snap tolerance between full-resolution special areas and 1:500k county lines
MAPSHAPER = ["npx", "-y", "mapshaper@0.6"]
WORK = PROJECT_ROOT / "data" / "raw" / "boundaries_build"


def load_counties(path) -> gpd.GeoDataFrame:
    g = gpd.read_file(path)
    # Census cartographic files are NAD83 lon/lat. NAD83 and WGS84 differ by < 2 m in the conterminous US;
    # coordinates are carried over unchanged and labelled WGS84 for the web.
    g = g.set_crs(4326, allow_override=True)
    return g[["GEOID", "STATEFP", "STUSPS", "NAME", "NAMELSAD", "LSAD", "ALAND", "AWATER", "geometry"]]


def _polys(geom) -> list[Polygon]:
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [p for g in getattr(geom, "geoms", []) for p in _polys(g)]


def _km2(geom) -> float:
    return float(gpd.GeoSeries([geom], crs=4326).to_crs(EQUAL_AREA).area.iloc[0] / 1e6)


def _drop_small_parts(geom):
    keep = [p for p in _polys(geom) if _km2(p) >= MIN_PART_KM2]
    return unary_union(keep) if keep else Polygon()


def carve(county, special):
    """Split ``county`` into (inside special area, rest) without resolution artefacts.

    The TIGER/Line special-area polygon is full resolution while the county is the 1:500k generalisation, so
    where the special area follows a county line its edge wanders back and forth across the generalised line.
    1. Snap the special area's vertices to the county's boundary within SNAP_DEG (about 50 m).
    2. Drop parts of the intersection smaller than MIN_PART_KM2 (they stay with the county remainder).
    3. Remainder parts smaller than MIN_PART_KM2 that touch the carved piece are slivers between the two
       lines; they are given to the carved piece. Every other remainder part (e.g. an island) is kept.
    The two pieces always union back to the county polygon.
    """
    snapped = shapely.make_valid(shapely.snap(special, county.boundary, SNAP_DEG))
    inter = _drop_small_parts(shapely.make_valid(county.intersection(snapped)))
    if inter.is_empty:
        return inter, county
    rest = shapely.make_valid(county.difference(inter))
    near = inter.buffer(SNAP_DEG)
    slivers = [p for p in _polys(rest) if _km2(p) < MIN_PART_KM2 and p.intersects(near)]
    if slivers:
        inter = shapely.make_valid(unary_union([inter] + slivers))
        rest = shapely.make_valid(county.difference(inter))
    return unary_union(_polys(inter)), unary_union(_polys(rest))


def special_areas(get) -> dict[str, dict]:
    """Polygons for the statute's special areas, from TIGER/Line 2025 (NAD83 lon/lat)."""
    parts = []
    for st in ("16", "30", "56"):
        lm = gpd.read_file(get(f"census_tl2025_arealm_{st}"))
        hit = lm[(lm.FULLNAME == "Yellowstone Natl Pk") & (lm.MTFCC == "K2181")]
        if len(hit) != 1:
            raise ValueError(f"Yellowstone not found exactly once in AREALM {st}: {len(hit)}")
        parts.append(hit)
    ynp = pd.concat(parts)
    if ynp.AREAID.nunique() != 1:
        raise ValueError("Yellowstone parts carry different AREAIDs")
    # close hairline gaps between the three state parts (1 m buffer in metres, then back)
    whole = gpd.GeoSeries([unary_union(ynp.to_crs(EQUAL_AREA).geometry)], crs=EQUAL_AREA)
    whole = whole.buffer(1).buffer(-1).to_crs(4326).iloc[0]

    mil = gpd.read_file(get("census_tl2025_mil"))
    fb = mil[mil.FULLNAME.isin(["Fort Bragg", "Camp MacKall"]) & (mil.MTFCC == "G6500")]
    if sorted(fb.FULLNAME) != ["Camp MacKall", "Fort Bragg"]:
        raise ValueError(f"Fort Bragg / Camp MacKall not found: {list(fb.FULLNAME)}")
    lm37 = gpd.read_file(get("census_tl2025_arealm_37"))
    bt = lm37[(lm37.FULLNAME == "Butner Federal Correctional Complx") & (lm37.MTFCC == "K1237")]
    if bt.empty:
        raise ValueError("Butner Federal Correctional Complex not found in AREALM 37")
    return {
        "yellowstone": {"geometry": whole, "to": "wyd", "source_ids": ["census_tl2025_arealm_16",
                                                                       "census_tl2025_arealm_30",
                                                                       "census_tl2025_arealm_56"],
                        "feature": "TIGER/Line 2025 area landmark 'Yellowstone Natl Pk' (MTFCC K2181, AREAID "
                                   f"{ynp.AREAID.iloc[0]}), union of the ID, MT and WY parts",
                        "statute": "28 U.S.C. §§ 92, 106, 131"},
        "fort_bragg_camp_mackall": {"geometry": unary_union(fb.set_crs(4326, allow_override=True).geometry),
                                    "to": "nced", "source_ids": ["census_tl2025_mil"],
                                    "feature": "TIGER/Line 2025 military installations 'Fort Bragg' and "
                                               "'Camp MacKall' (MTFCC G6500)",
                                    "statute": "28 U.S.C. § 113(a), (b)"},
        "fci_butner": {"geometry": unary_union(bt.set_crs(4326, allow_override=True).geometry), "to": "nced",
                       "source_ids": ["census_tl2025_arealm_37"],
                       "feature": "TIGER/Line 2025 area landmark 'Butner Federal Correctional Complx' (MTFCC K1237; "
                                  f"{len(bt)} polygons) used as the extent of 'the Federal Correctional Institution, "
                                  "Butner'",
                       "statute": "28 U.S.C. § 113(a), (b)"},
    }


def build_pieces(counties: gpd.GeoDataFrame, assignment: pd.DataFrame, areas: dict[str, dict],
                 nc_partial_geoids: list[str], durham_geoid: str) -> tuple[gpd.GeoDataFrame, list[dict]]:
    """Split counties by the statutory carve-outs. Returns (pieces, split_records)."""
    dist = assignment.set_index("geoid")["district_id"]
    g = counties.merge(assignment[["geoid", "district_id"]], left_on="GEOID", right_on="geoid")
    g = g[g.district_id != ""].copy()          # American Samoa: no district, not drawn
    targets: list[tuple[str, str]] = []        # (geoid, area key)
    ynp = areas["yellowstone"]["geometry"]
    for _, r in g[g.STUSPS.isin(["MT", "ID"])].iterrows():
        if r.geometry.intersects(ynp) and _km2(r.geometry.intersection(ynp)) >= MIN_COUNTY_OVERLAP_KM2:
            targets.append((r.GEOID, "yellowstone"))
    for geoid in nc_partial_geoids:
        targets.append((geoid, "fci_butner" if geoid == durham_geoid else "fort_bragg_camp_mackall"))

    pieces = []
    splits = []
    carved = {t[0]: t[1] for t in targets}
    for _, r in g.iterrows():
        base = {"geoid": r.GEOID, "county_name": r.NAMELSAD, "state": r.STUSPS, "county_district": r.district_id}
        if r.GEOID not in carved:
            pieces.append({**base, "district_id": r.district_id, "piece": "county", "geometry": r.geometry})
            continue
        key = carved[r.GEOID]
        area = areas[key]
        inter, rest = carve(r.geometry, area["geometry"])
        if inter.is_empty:
            raise ValueError(f"carve-out {key} does not cover any of {r.GEOID}")
        pieces.append({**base, "district_id": r.district_id, "piece": "county_remainder",
                       "geometry": unary_union(_polys(rest))})
        pieces.append({**base, "district_id": area["to"], "piece": key, "geometry": unary_union(_polys(inter))})
        splits.append({"geoid": r.GEOID, "county_name": r.NAMELSAD, "state": r.STUSPS,
                       "county_district": r.district_id, "carved_to": area["to"], "area": key,
                       "carved_km2": round(_km2(inter), 3), "remainder_km2": round(_km2(rest), 3),
                       "statute": area["statute"], "feature": area["feature"]})
    out = gpd.GeoDataFrame(pieces, geometry="geometry", crs=4326)
    if (dist == "").sum() and set(out.geoid) & set(dist[dist == ""].index):
        raise ValueError("unassigned county drawn")
    return out, splits


def dissolve(pieces: gpd.GeoDataFrame, by: str) -> gpd.GeoDataFrame:
    rows = []
    for key, grp in pieces.groupby(by):
        geom = shapely.union_all(list(grp.geometry))
        geom = shapely.make_valid(geom)
        rows.append({by: key, "geometry": unary_union(_polys(geom))})
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=pieces.crs)


def district_frame(pieces: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    d = dissolve(pieces, "district_id")
    d["name"] = d.district_id.map(lambda i: BY_ID[i].name)
    d["short"] = d.district_id.map(lambda i: BY_ID[i].short)
    d["state"] = d.district_id.map(lambda i: BY_ID[i].state)
    d["circuit"] = d.district_id.map(lambda i: BY_ID[i].circuit)
    d["article"] = d.district_id.map(lambda i: BY_ID[i].article)
    proj = d.to_crs(EQUAL_AREA)
    d["area_km2"] = (proj.area / 1e6).round(1)
    order = {i: n for n, i in enumerate(BY_ID)}
    d = d.sort_values("district_id", key=lambda s: s.map(order)).reset_index(drop=True)
    return d[["district_id", "name", "short", "state", "circuit", "article", "area_km2", "geometry"]]


# ---------------------------------------------------------------------------------------------------------
# TopoJSON

def _run_mapshaper(args: list[str]) -> None:
    if shutil.which("npx") is None:
        raise RuntimeError("npx not found: Node.js is needed to run mapshaper")
    cmd = MAPSHAPER + args
    WORK.mkdir(parents=True, exist_ok=True)
    # run outside the project root so npx never touches the project package.json / node_modules
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, cwd=WORK)
    if res.returncode != 0:
        raise RuntimeError(f"mapshaper failed ({res.returncode}): {' '.join(cmd)}\n{res.stderr[-3000:]}")


def write_topojson(pieces: gpd.GeoDataFrame, out_path: Path, *, intervals: dict[str, float], with_counties: bool,
                   quantization: int) -> dict:
    """Simplify the county pieces once and derive counties/districts/states layers from the same arcs.

    intervals: simplification interval in metres: {"default": m, "PR,HI": m, "GU,MP,VI": m}. The small
    territories and Hawaii are drawn as magnified insets, so they keep more detail.
    Steps: explode multipart pieces (keep-shapes then protects every island, not just one ring per feature)
    -> simplify -> clean pieces -> dissolve to districts / states (/ counties) -> clean those layers -> output.
    """
    WORK.mkdir(parents=True, exist_ok=True)
    src = WORK / "pieces.geojson"
    pieces[["geoid", "county_name", "state", "county_district", "district_id", "piece", "geometry"]].to_file(
        src, driver="GeoJSON")
    raw = WORK / (out_path.stem + ".raw.json")
    expr = str(intervals["default"])
    for states, m in intervals.items():
        if states != "default":
            expr = f"'{states}'.split(',').indexOf(state) > -1 ? {m} : ({expr})"
    args = ["-i", str(src), "snap", "name=pieces", "-explode",
            "-simplify", "variable", f"interval={expr}", "keep-shapes",
            "-clean", "target=pieces",
            "-dissolve", "district_id", "target=pieces", "+", "name=districts",
            "-dissolve", "state", "target=pieces", "+", "name=states"]
    targets = ["districts", "states"]
    if with_counties:
        args += ["-dissolve", "geoid", "copy-fields=county_name,state,county_district", "target=pieces", "+",
                 "name=counties"]
        targets.append("counties")
    # -clean on the derived layers repairs the few self-intersections that simplification leaves at pinch points
    # (e.g. where the Camp MacKall exclave narrows at the Moore/Richmond county line); arcs stay shared.
    args += ["-clean", f"target={','.join(targets)}",
             "-o", str(raw), "format=topojson", f"target={','.join(targets)}", f"quantization={quantization}"]
    _run_mapshaper(args)
    topo = json.loads(raw.read_text())
    return _finish_topology(topo, out_path, with_counties)


def _finish_topology(topo: dict, out_path: Path, with_counties: bool) -> dict:
    """Set ids/properties exactly as the data contract specifies and write compact JSON."""
    objs = topo["objects"]
    for g in objs["districts"]["geometries"]:
        did = g["properties"]["district_id"]
        d = BY_ID[did]
        g["id"] = did
        g["properties"] = {"name": d.name, "short": d.short, "state": d.state, "circuit": d.circuit}
    postal_name = {k: v[0] for k, v in STATES.items()}
    for g in objs["states"]["geometries"]:
        st = g["properties"]["state"]
        g["id"] = st
        g["properties"] = {"name": postal_name[st], "fips": STATES[st][1]}
    if with_counties:
        for g in objs["counties"]["geometries"]:
            p = g["properties"]
            g["id"] = p["geoid"]
            g["properties"] = {"name": p["county_name"], "district_id": p["county_district"], "state": p["state"]}
    for name in list(objs):
        objs[name]["geometries"].sort(key=lambda x: x["id"])
    topo.pop("bbox", None)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(topo, separators=(",", ":")))
    rel = out_path.relative_to(PROJECT_ROOT) if out_path.is_relative_to(PROJECT_ROOT) else out_path
    validity = {}
    for name in objs:
        g = topo_to_gdf(out_path, name)
        bad = g[~g.geometry.is_valid]
        validity[name] = {"features": len(g), "invalid": [str(i) for i in bad["id"]]}
    return {"path": str(rel), "bytes": out_path.stat().st_size,
            "objects": {k: len(v["geometries"]) for k, v in objs.items()}, "validity": validity}


def topo_to_gdf(path: Path, obj: str) -> gpd.GeoDataFrame:
    """Read one object of a TopoJSON file back (used by tests and the preview)."""
    import topojson  # noqa: F401  (ensures the dependency is present)
    from shapely.geometry import shape
    topo = json.loads(Path(path).read_text())
    tr = topo.get("transform")
    arcs = []
    for arc in topo["arcs"]:
        if tr:
            x = y = 0
            pts = []
            for dx, dy in arc:
                x += dx
                y += dy
                pts.append((x * tr["scale"][0] + tr["translate"][0], y * tr["scale"][1] + tr["translate"][1]))
        else:
            pts = [tuple(p) for p in arc]
        arcs.append(pts)

    def ring(idxs):
        pts = []
        for i in idxs:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    rows = []
    for g in topo["objects"][obj]["geometries"]:
        if g["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": [ring(r) for r in g["arcs"]]}
        elif g["type"] == "MultiPolygon":
            geom = {"type": "MultiPolygon", "coordinates": [[ring(r) for r in p] for p in g["arcs"]]}
        else:
            continue
        rows.append({"id": g.get("id"), **g.get("properties", {}), "geometry": shape(geom)})
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=4326)
