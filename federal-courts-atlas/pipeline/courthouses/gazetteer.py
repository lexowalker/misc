"""Census place / county-subdivision internal points (Gazetteer 2026; TIGER 2025 for the island areas).

Every point here is the Census Bureau's *internal point* (INTPTLAT/INTPTLONG): a point inside the entity's
boundary, at or near its geographic centre. It is not a courthouse address.
"""
from __future__ import annotations

import re
import unicodedata
import zipfile

import pandas as pd
import pyogrio

from .sources import get

ISLAND_FIPS = {"66": "GU", "69": "MP", "78": "VI"}

# Legal/statistical-area descriptions Census appends to names (LSAD text), longest first.
_SUFFIXES = [
    "city and borough", "consolidated government (balance)", "unified government (balance)",
    "metropolitan government (balance)", "metro government (balance)", "consolidated government",
    "unified government", "metropolitan government", "metro government", "urban county", "charter township",
    "zona urbana", "comunidad", "municipality", "plantation", "township", "borough", "village", "city", "town",
    "CDP", "CCD", "(balance)", "gore", "grant", "location", "purchase", "unorganized territory", "UT",
    "district", "subdistrict", "municipio", "barrio", "barrio-pueblo", "estate", "island",
]
_SUFFIX_RE = re.compile(r"\s+(" + "|".join(re.escape(s) for s in _SUFFIXES) + r")$")


def base_name(name: str) -> str:
    """'Abbeville city' -> 'Abbeville'; 'Nashville-Davidson metropolitan government (balance)' -> 'Nashville-Davidson'."""
    n = name.strip()
    for _ in range(3):
        m = _SUFFIX_RE.search(n)
        if not m or m.start() == 0:
            break
        n = n[: m.start()].strip()
    return n


def norm(s: str) -> str:
    """Comparison key: accents, case, periods, apostrophes, Saint/St./Ste., hyphens and spacing ignored."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = s.replace("’", "'").replace("'", "").replace(".", " ").replace("-", " ").replace("/", " ")
    s = re.sub(r"\bsainte\b", "ste", s)
    s = re.sub(r"\bsaint\b", "st", s)
    s = re.sub(r"\bfort\b", "ft", s)
    s = re.sub(r"\bmount\b", "mt", s)
    return re.sub(r"\s+", " ", s).strip()


def _read_gaz(source_id: str) -> pd.DataFrame:
    r = get(source_id)
    with zipfile.ZipFile(r.path) as z:
        name = [n for n in z.namelist() if n.endswith(".txt")][0]
        with z.open(name) as f:
            df = pd.read_csv(f, sep="|", dtype=str, encoding="utf-8")
    df.columns = [c.strip() for c in df.columns]
    df["lat"] = df["INTPTLAT"].astype(float)
    df["lon"] = df["INTPTLONG"].astype(float)
    return df


def _read_tiger_attrs(source_id: str, layer_kind: str) -> pd.DataFrame:
    r = get(source_id)
    df = pyogrio.read_dataframe(f"zip://{r.path}", read_geometry=False)
    out = pd.DataFrame({
        "USPS": df["STATEFP"].map(ISLAND_FIPS),
        "GEOID": df["GEOID"],
        "NAME": df["NAMELSAD"] if "NAMELSAD" in df else df["NAME"],
        "LSAD": df.get("LSAD"),
        "FUNCSTAT": df.get("FUNCSTAT"),
        "lat": df["INTPTLAT"].astype(float),
        "lon": df["INTPTLON"].astype(float),
        "layer": layer_kind,
        "source_id": source_id,
    })
    return out


def places() -> pd.DataFrame:
    """Gazetteer 2026 places (50 states, DC, PR) + TIGER 2025 places of GU, MP, VI."""
    g = _read_gaz("census_gaz2026_place")
    g = g[["USPS", "GEOID", "NAME", "LSAD", "FUNCSTAT", "lat", "lon"]].assign(layer="place",
                                                                            source_id="census_gaz2026_place")
    isl = pd.concat([_read_tiger_attrs(f"census_tl2025_place_{fp}", "place") for fp in ISLAND_FIPS],
                    ignore_index=True)
    df = pd.concat([g, isl], ignore_index=True)
    df["base"] = df["NAME"].map(base_name)
    df["key"] = df["base"].map(norm)
    return df


def cousubs() -> pd.DataFrame:
    """Gazetteer 2026 county subdivisions + TIGER 2025 county subdivisions of GU, MP, VI."""
    g = _read_gaz("census_gaz2026_cousub")
    g = g[["USPS", "GEOID", "NAME", "FUNCSTAT", "lat", "lon"]].assign(LSAD=None, layer="cousub",
                                                                      source_id="census_gaz2026_cousub")
    isl = pd.concat([_read_tiger_attrs(f"census_tl2025_cousub_{fp}", "cousub") for fp in ISLAND_FIPS],
                    ignore_index=True)
    df = pd.concat([g, isl], ignore_index=True)
    df["base"] = df["NAME"].map(base_name)
    df["key"] = df["base"].map(norm)
    return df


def tiger_county_points() -> pd.DataFrame:
    """INTPT of every TIGER 2025 county-equivalent (used for Saipan Municipality, 69110)."""
    r = get("census_tl2025_county")
    df = pyogrio.read_dataframe(f"zip://{r.path}", read_geometry=False, columns=["GEOID", "NAMELSAD", "STATEFP",
                                                                                 "INTPTLAT", "INTPTLON"])
    return pd.DataFrame({"GEOID": df["GEOID"], "NAME": df["NAMELSAD"], "STATEFP": df["STATEFP"],
                         "lat": df["INTPTLAT"].astype(float), "lon": df["INTPTLON"].astype(float)})
