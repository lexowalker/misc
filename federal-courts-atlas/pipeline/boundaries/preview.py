"""Render a verification PNG of the 94 districts from the TopoJSON files the web will load."""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from shapely.geometry import box  # noqa: E402

from .geometry import topo_to_gdf  # noqa: E402

# Reference categorical palette (dataviz skill, light mode), first five slots; districts are told apart by
# their printed ids, the colours only keep neighbours distinct (greedy graph colouring).
PALETTE = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#6a4ce2"]
TEXT = "#191919"
STATE_LINE = "#333333"

ALBERS_AK = "+proj=aea +lat_1=55 +lat_2=65 +lat_0=50 +lon_0=-154 +datum=WGS84 +units=m"
ALBERS_HI = "+proj=aea +lat_1=8 +lat_2=18 +lat_0=13 +lon_0=-157 +datum=WGS84 +units=m"


def _colour(gdf: gpd.GeoDataFrame) -> dict[str, str]:
    proj = gdf.to_crs(5070)
    order = proj.assign(a=proj.area).sort_values("a", ascending=False).id.tolist()
    geoms = dict(zip(proj.id, proj.geometry.buffer(2000)))
    col: dict[str, int] = {}
    for i in order:
        used = {col[j] for j in col if geoms[i].intersects(geoms[j])}
        col[i] = next(k for k in range(len(PALETTE)) if k not in used)
    return {i: PALETTE[k] for i, k in col.items()}


def _draw(ax, d, s, colours, crs, bbox_lonlat=None, label=True, fontsize=6, counties=None, extra=None):
    dd, ss = d, s
    if bbox_lonlat is not None:
        clip = box(*bbox_lonlat)
        d = d.assign(geometry=d.geometry.make_valid())
        s = s.assign(geometry=s.geometry.make_valid())
        dd = d[d.intersects(clip)].copy()
        dd["geometry"] = dd.geometry.intersection(clip)
        ss = s[s.intersects(clip)].copy()
        ss["geometry"] = ss.geometry.intersection(clip)
        if counties is not None:
            counties = counties.assign(geometry=counties.geometry.make_valid())
            counties = counties[counties.intersects(clip)].copy()
            counties["geometry"] = counties.geometry.intersection(clip)
    dd = dd.to_crs(crs)
    ss = ss.to_crs(crs)
    dd.plot(ax=ax, color=[colours[i] for i in dd.id], alpha=0.55, edgecolor="white", linewidth=0.6)
    if counties is not None:
        counties.to_crs(crs).boundary.plot(ax=ax, color="#ffffff", linewidth=0.25, alpha=0.9)
    dd.boundary.plot(ax=ax, color="white", linewidth=0.8)
    ss.boundary.plot(ax=ax, color=STATE_LINE, linewidth=0.7)
    if extra is not None:
        for g, kw in extra:
            g.to_crs(crs).boundary.plot(ax=ax, **kw)
    if label:
        for _, r in dd.iterrows():
            if r.geometry.is_empty:
                continue
            p = r.geometry.representative_point()
            ax.annotate(r.id, (p.x, p.y), ha="center", va="center", fontsize=fontsize, color=TEXT,
                        fontweight="bold")
    ax.set_axis_off()


def render(lo_topo: Path, hi_topo: Path, out_png: Path, specials: dict | None = None) -> None:
    d = topo_to_gdf(lo_topo, "districts")
    s = topo_to_gdf(lo_topo, "states")
    dh = topo_to_gdf(hi_topo, "districts")
    sh = topo_to_gdf(hi_topo, "states")
    ch = topo_to_gdf(hi_topo, "counties")
    colours = _colour(dh)

    fig = plt.figure(figsize=(18, 12.5), dpi=110)
    fig.patch.set_facecolor("white")
    main = fig.add_axes([0.0, 0.30, 0.74, 0.66])
    conus = [-125, 24.3, -66.5, 49.6]
    _draw(main, d, s, colours, 5070, conus, fontsize=6.5)
    main.set_title(f"The 94 federal judicial districts: {len(d)} district polygons (low-res topology); "
                   "insets from the same file; zooms from the high-res topology", fontsize=11, color=TEXT,
                   loc="left")

    ak = fig.add_axes([0.0, 0.02, 0.20, 0.27])
    _draw(ak, d, s, colours, ALBERS_AK, [-180, 50, -129, 72], fontsize=7)
    ak.set_title("Alaska (incl. Aleutians W of 180° drawn separately)", fontsize=8, loc="left")
    ak2 = fig.add_axes([0.20, 0.02, 0.06, 0.10])
    _draw(ak2, d, s, colours, ALBERS_AK, [172, 50, 180, 54], label=False)
    ak2.set_title("Aleutians >180°", fontsize=7, loc="left")
    hi = fig.add_axes([0.20, 0.13, 0.13, 0.14])
    _draw(hi, d, s, colours, ALBERS_HI, [-161, 18.8, -154.5, 22.4], fontsize=7)
    hi.set_title("Hawaii", fontsize=8, loc="left")
    pr = fig.add_axes([0.34, 0.02, 0.14, 0.12])
    _draw(pr, d, s, colours, "EPSG:32161", [-67.4, 17.6, -64.4, 18.6], fontsize=7)
    pr.set_title("Puerto Rico + U.S. Virgin Islands", fontsize=8, loc="left")
    gu = fig.add_axes([0.49, 0.02, 0.07, 0.25])
    _draw(gu, d, s, colours, "EPSG:32655", [144.5, 13.1, 146.2, 20.7], fontsize=7)
    gu.set_title("Guam + N. Mariana Is.", fontsize=8, loc="left")

    # zooms (high-res topology, county lines in white)
    extra_y = extra_nc = None
    if specials:
        extra_y = [(specials["yellowstone"], dict(color="#6a4ce2", linewidth=1.2, linestyle="--"))]
        extra_nc = [(specials["fort_bragg_camp_mackall"], dict(color="#6a4ce2", linewidth=1.0, linestyle="--")),
                    (specials["fci_butner"], dict(color="#ec4647", linewidth=1.2))]
    z1 = fig.add_axes([0.75, 0.66, 0.24, 0.30])
    _draw(z1, dh, sh, colours, 5070, [-112.2, 43.6, -109.3, 45.4], fontsize=8, counties=ch, extra=extra_y)
    z1.set_title("Yellowstone: MT and ID portions in wyd (dashed = TIGER park outline)", fontsize=8, loc="left")
    z2 = fig.add_axes([0.75, 0.34, 0.24, 0.30])
    _draw(z2, dh, sh, colours, 5070, [-80.0, 34.6, -78.4, 36.4], fontsize=8, counties=ch, extra=extra_nc)
    z2.set_title("N.C.: Fort Bragg/Camp MacKall and FCI Butner portions in nced", fontsize=8, loc="left")
    z3 = fig.add_axes([0.58, 0.02, 0.20, 0.27])
    _draw(z3, dh, sh, colours, 5070, [-74.35, 40.45, -73.6, 41.0], fontsize=8, counties=ch)
    z3.set_title("New York City: boroughs (nysd / nyed)", fontsize=8, loc="left")
    z4 = fig.add_axes([0.79, 0.02, 0.20, 0.30])
    _draw(z4, dh, sh, colours, 5070, [-77.6, 36.5, -75.8, 37.6], fontsize=7, counties=ch)
    z4.set_title("Hampton Roads independent cities (vaed)", fontsize=8, loc="left")
    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=110, facecolor="white")
    plt.close(fig)
