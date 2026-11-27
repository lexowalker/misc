"""Parsers: each returns county-level rows and the totals published in (or alongside) the same file.

County rows:     geoid, county_name, period, period_type, value, source_id, source_locator
Published rows:  level ("us" | "pr" | "state" | "territory"), state_fips, period, period_type, value,
                 source_id, source_locator
All values are integers exactly as printed in the source.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from pathlib import Path

import pandas as pd

COUNTY_COLS = ["geoid", "county_name", "period", "period_type", "value", "source_id", "source_locator"]
PUB_COLS = ["level", "state_fips", "period", "period_type", "value", "source_id", "source_locator"]


def _read_csv(path: Path, **kw) -> pd.DataFrame:
    for enc in ("utf-8", "latin-1"):
        try:
            return pd.read_csv(path, dtype=str, encoding=enc, keep_default_na=False, **kw)
        except UnicodeDecodeError:
            continue
    raise ValueError(path)


def _int(s) -> int:
    s = str(s).strip().replace(",", "")
    if not re.fullmatch(r"-?\d+", s):
        raise ValueError(f"not an integer count: {s!r}")
    return int(s)


def _pub(level, st, year, ptype, value, sid, loc):
    return {"level": level, "state_fips": st, "period": year, "period_type": ptype, "value": _int(value),
            "source_id": sid, "source_locator": loc}


# ------------------------------------------------------------------------------------------ estimates
def co_est_wide(path: Path, sid: str, fname: str, years: range) -> tuple[pd.DataFrame, pd.DataFrame]:
    """CO-EST2025-ALLDATA / CO-EST00INT-TOT: one row per county (SUMLEV 050) and state (040)."""
    cols = ["SUMLEV", "STATE", "COUNTY", "CTYNAME"] + [f"POPESTIMATE{y}" for y in years]
    df = _read_csv(path, usecols=cols)
    df["SUMLEV"] = df["SUMLEV"].str.zfill(3)
    df["STATE"] = df["STATE"].str.zfill(2)
    df["COUNTY"] = df["COUNTY"].str.zfill(3)
    if set(df["SUMLEV"]) - {"040", "050"}:
        raise ValueError(f"{fname}: unexpected SUMLEV {set(df['SUMLEV'])}")
    rows, pub = [], []
    for r in df.itertuples(index=False):
        for y in years:
            v = getattr(r, f"POPESTIMATE{y}")
            loc = f"{fname}: SUMLEV={r.SUMLEV}, STATE={r.STATE}, COUNTY={r.COUNTY}, column POPESTIMATE{y}"
            if r.SUMLEV == "050":
                rows.append([r.STATE + r.COUNTY, r.CTYNAME, y, "JUL1_EST", _int(v), sid, loc])
            else:
                pub.append(_pub("state", r.STATE, y, "JUL1_EST", v, sid, loc))
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)


def cc_est_long(path: Path, sid: str, fname: str, year_map: dict[int, int], pr: bool) -> pd.DataFrame:
    """CC-EST*-AGESEX files: one row per county/municipio per YEAR code; POPESTIMATE = total population."""
    idcols = ["SUMLEV", "MUNICIPIO", "NAME"] if pr else ["SUMLEV", "STATE", "COUNTY", "CTYNAME"]
    df = _read_csv(path, usecols=idcols + ["YEAR", "POPESTIMATE"])
    if set(df["SUMLEV"].str.zfill(3)) != {"050"}:
        raise ValueError(f"{fname}: unexpected SUMLEV")
    codes = set(df["YEAR"].astype(int))
    if not set(year_map) <= codes:
        raise ValueError(f"{fname}: YEAR codes {sorted(codes)} lack {sorted(set(year_map) - codes)}")
    rows = []
    for r in df.itertuples(index=False):
        code = int(r.YEAR)
        if code not in year_map:
            continue
        y = year_map[code]
        if pr:
            geoid, name = "72" + r.MUNICIPIO.zfill(3), r.NAME
            loc = f"{fname}: MUNICIPIO={r.MUNICIPIO.zfill(3)}, YEAR={code} (7/1/{y}), column POPESTIMATE"
        else:
            geoid, name = r.STATE.zfill(2) + r.COUNTY.zfill(3), r.CTYNAME
            loc = f"{fname}: STATE={r.STATE.zfill(2)}, COUNTY={r.COUNTY.zfill(3)}, YEAR={code} (7/1/{y}), column POPESTIMATE"
        rows.append([geoid, name, y, "JUL1_EST", _int(r.POPESTIMATE), sid, loc])
    out = pd.DataFrame(rows, columns=COUNTY_COLS)
    dup = out.duplicated(["geoid", "period"])
    if dup.any():
        raise ValueError(f"{fname}: duplicate county-years")
    return out


def prm_est00int(path: Path, sid: str, fname: str, years: range) -> pd.DataFrame:
    df = _read_csv(path)
    df = df[(df["SEX"] == "0") & (df["AGEGRP"] == "0")]
    rows = []
    for r in df.itertuples(index=False):
        for y in years:
            loc = f"{fname}: MUNICIPIO={r.MUNICIPIO.zfill(3)}, SEX=0, AGEGRP=0, column POPESTIMATE{y}"
            rows.append(["72" + r.MUNICIPIO.zfill(3), r.NAME, y, "JUL1_EST", _int(getattr(r, f"POPESTIMATE{y}")), sid, loc])
    return pd.DataFrame(rows, columns=COUNTY_COLS)


def nst_est2025(path: Path, sid: str, fname: str, years: range) -> pd.DataFrame:
    df = _read_csv(path, usecols=["SUMLEV", "STATE", "NAME"] + [f"POPESTIMATE{y}" for y in years])
    pub = []
    for r in df.itertuples(index=False):
        for y in years:
            v = getattr(r, f"POPESTIMATE{y}")
            loc = f"{fname}: SUMLEV={r.SUMLEV}, STATE={r.STATE} ({r.NAME}), column POPESTIMATE{y}"
            if r.SUMLEV == "010":
                pub.append(_pub("us", "", y, "JUL1_EST", v, sid, loc))
            elif r.SUMLEV == "040" and r.STATE == "72":
                pub.append(_pub("pr", "72", y, "JUL1_EST", v, sid, loc))
            elif r.SUMLEV == "040":
                pub.append(_pub("state", r.STATE, y, "JUL1_EST", v, sid, loc))
    return pd.DataFrame(pub, columns=PUB_COLS)


def nc_est2020int(path: Path, sid: str, fname: str, years: range) -> pd.DataFrame:
    df = _read_csv(path)
    tot = df[(df["SEX"] == "0") & (df["AGE"] == "999")]
    if len(tot) != 1:
        raise ValueError(f"{fname}: expected one SEX=0 AGE=999 row")
    r = tot.iloc[0]
    return pd.DataFrame([_pub("us", "", y, "JUL1_EST", r[f"POPESTIMATE{y}"], sid,
                              f"{fname}: SEX=0, AGE=999 (all ages), column POPESTIMATE{y}") for y in years],
                        columns=PUB_COLS)


def prc_est00int(path: Path, sid: str, fname: str, years: range) -> pd.DataFrame:
    df = _read_csv(path)
    tot = df[(df["SEX"] == "0") & (df["AGE"] == "999")]
    if len(tot) != 1:
        raise ValueError(f"{fname}: expected one SEX=0 AGE=999 row")
    r = tot.iloc[0]
    return pd.DataFrame([_pub("pr", "72", y, "JUL1_EST", r[f"POPESTIMATE{y}"], sid,
                              f"{fname}: STATE=72, SEX=0, AGE=999 (all ages), column POPESTIMATE{y}") for y in years],
                        columns=PUB_COLS)


def st_est00int(path: Path, sid: str, fname: str, years: range) -> pd.DataFrame:
    df = _read_csv(path, usecols=["STATE", "SEX", "ORIGIN", "RACE", "AGEGRP"] + [f"POPESTIMATE{y}" for y in years])
    tot = df[(df["STATE"] == "0") & (df["SEX"] == "0") & (df["ORIGIN"] == "0") & (df["RACE"] == "0") & (df["AGEGRP"] == "0")]
    if len(tot) != 1:
        raise ValueError(f"{fname}: expected one United States total row")
    r = tot.iloc[0]
    return pd.DataFrame([_pub("us", "", y, "JUL1_EST", r[f"POPESTIMATE{y}"], sid,
                              f"{fname}: STATE=0 (United States), SEX=0, ORIGIN=0, RACE=0, AGEGRP=0, column POPESTIMATE{y}")
                         for y in years], columns=PUB_COLS)


# ------------------------------------------------------------------------------------------ decennial
def census2000_dp(path: Path, sid: str, fname: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Census 2000 Demographic Profile CSV (inside a zip). Identification fields per the technical
    documentation: RECTYP, SUMLEV, GEOCOMP, STATE, COUNTY, COUSUB, PLACE, CONCIT, MSACMSA, PMSA, AIANHH,
    ANRC, CD106, FUNCSTAT, NAME; then V01 = Total population."""
    z = zipfile.ZipFile(path)
    (member,) = [n for n in z.namelist() if n.endswith(".csv")]
    rows, pub = [], []
    with z.open(member) as f:
        for rec in csv.reader(io.TextIOWrapper(f, encoding="latin-1")):
            rectyp, sumlev, geocomp, st, co, name, v01 = rec[0], rec[1], rec[2], rec[3], rec[4], rec[14], rec[15]
            if geocomp != "00":
                continue
            loc = f"{fname} ({member}): SUMLEV={sumlev}, STATE={st}, COUNTY={co}, field V01 (Total population)"
            if sumlev == "050":
                rows.append([st + co, name, 2000, "APR1_CENSUS", _int(v01), sid, loc])
            elif sumlev == "040":
                pub.append(_pub("pr" if st == "72" else "state", st, 2000, "APR1_CENSUS", v01, sid, loc))
            elif sumlev == "010":
                pub.append(_pub("us", "", 2000, "APR1_CENSUS", v01, sid, loc))
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)


def census2010_dp(path: Path, sid: str, fname: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """2010 Demographic Profile Summary File: fixed-width geo header (SUMLEV 9-11, GEOCOMP 12-13,
    LOGRECNO 19-25, STATE 28-29, COUNTY 30-32, POP100 319-327, NAME 227-316) + comma-delimited data file
    whose 6th field is DP0010001 (Total population). POP100 must equal DP0010001."""
    z = zipfile.ZipFile(path)
    geo = [n for n in z.namelist() if "geo2010" in n][0]
    dat = [n for n in z.namelist() if re.search(r"0000120101?\.dp$", n)][0]
    data = {}
    for line in z.read(dat).decode("latin-1").splitlines():
        f = line.split(",")
        data[f[4]] = f[5]
    rows, pub = [], []
    for line in z.read(geo).decode("latin-1").splitlines():
        sumlev, geocomp, logrec = line[8:11], line[11:13], line[18:25]
        st, co, pop100, name = line[27:29], line[29:32], line[318:327], line[226:316].strip()
        if geocomp != "00" or sumlev not in ("010", "040", "050"):
            continue
        dp1 = data[logrec]
        if _int(pop100) != _int(dp1):
            raise ValueError(f"{fname}: POP100 {pop100} != DP0010001 {dp1} at LOGRECNO {logrec}")
        loc = f"{fname} ({dat}): LOGRECNO={logrec}, SUMLEV={sumlev}, STATE={st}, COUNTY={co}, DP0010001 (Total population)"
        if sumlev == "050":
            rows.append([st + co, name, 2010, "APR1_CENSUS", _int(dp1), sid, loc])
        elif sumlev == "040":
            pub.append(_pub("pr" if st == "72" else "state", st, 2010, "APR1_CENSUS", dp1, sid, loc))
        else:
            pub.append(_pub("us", "", 2010, "APR1_CENSUS", dp1, sid, loc))
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)


# 2020 P.L. 94-171 geographic header: field order from Figure 2-4 of the technical documentation.
PL2020_GEO_FIELDS = [
    "FILEID", "STUSAB", "SUMLEV", "GEOVAR", "GEOCOMP", "CHARITER", "CIFSN", "LOGRECNO", "GEOID", "GEOCODE",
    "REGION", "DIVISION", "STATE", "STATENS", "COUNTY", "COUNTYCC", "COUNTYNS", "COUSUB", "COUSUBCC", "COUSUBNS",
    "SUBMCD", "SUBMCDCC", "SUBMCDNS", "ESTATE", "ESTATECC", "ESTATENS", "CONCIT", "CONCITCC", "CONCITNS", "PLACE",
    "PLACECC", "PLACENS", "TRACT", "BLKGRP", "BLOCK", "AIANHH", "AIHHTLI", "AIANHHFP", "AIANHHCC", "AIANHHNS",
    "AITS", "AITSFP", "AITSCC", "AITSNS", "TTRACT", "TBLKGRP", "ANRC", "ANRCCC", "ANRCNS", "CBSA", "MEMI", "CSA",
    "METDIV", "NECTA", "NMEMI", "CNECTA", "NECTADIV", "CBSAPCI", "NECTAPCI", "UA", "UATYPE", "UR", "CD116",
    "CD118", "CD119", "CD120", "CD121", "SLDU18", "SLDU22", "SLDU24", "SLDU26", "SLDU28", "SLDL18", "SLDL22",
    "SLDL24", "SLDL26", "SLDL28", "VTD", "VTDI", "ZCTA", "SDELM", "SDSEC", "SDUNI", "PUMA", "AREALAND",
    "AREAWATR", "BASENAME", "NAME", "FUNCSTAT", "GCUNI", "POP100", "HU100", "INTPTLAT", "INTPTLON", "LSADC",
    "PARTFLAG", "UGA",
]
_PL = {k: i for i, k in enumerate(PL2020_GEO_FIELDS)}


def census2020_pl(path: Path, sid: str, fname: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """2020 P.L. 94-171 (legacy format): pipe-delimited geo header + segment 1, whose 6th field is P0010001
    (Total population). POP100 in the geo header must equal P0010001."""
    z = zipfile.ZipFile(path)
    geo = [n for n in z.namelist() if re.search(r"geo2020\.n?pl$", n)][0]
    seg = [n for n in z.namelist() if re.search(r"000012020\.n?pl$", n)][0]
    keep = {}
    with z.open(geo) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            head = raw.split("|", 5)  # FILEID|STUSAB|SUMLEV|GEOVAR|GEOCOMP|...
            if head[2] not in ("010", "040", "050") or head[4] != "00":
                continue
            fld = raw.rstrip("\r\n").split("|")
            if len(fld) != len(PL2020_GEO_FIELDS):
                raise ValueError(f"{fname}: geo record has {len(fld)} fields, expected {len(PL2020_GEO_FIELDS)}")
            keep[fld[_PL["LOGRECNO"]]] = fld
    rows, pub = [], []
    with z.open(seg) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            s = raw.split("|", 6)  # FILEID|STUSAB|CHARITER|CIFSN|LOGRECNO|P0010001|...
            fld = keep.get(s[4])
            if fld is None:
                continue
            p1 = s[5]
            if _int(fld[_PL["POP100"]]) != _int(p1):
                raise ValueError(f"{fname}: POP100 != P0010001 at LOGRECNO {s[4]}")
            sumlev, st, co = fld[_PL["SUMLEV"]], fld[_PL["STATE"]], fld[_PL["COUNTY"]]
            loc = (f"{fname} ({seg}): LOGRECNO={s[4]}, SUMLEV={sumlev}, GEOID={fld[_PL['GEOID']]}, "
                   f"P0010001 (Total population)")
            if sumlev == "050":
                rows.append([st + co, fld[_PL["NAME"]], 2020, "APR1_CENSUS", _int(p1), sid, loc])
            elif sumlev == "040":
                pub.append(_pub("pr" if st == "72" else "state", st, 2020, "APR1_CENSUS", p1, sid, loc))
            else:
                pub.append(_pub("us", "", 2020, "APR1_CENSUS", p1, sid, loc))
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)


# ------------------------------------------------------------------------------------------ island areas
def _ia_rows(cells: list[list[str]], members: dict[str, str], total_name: str, years: dict[int, int],
             sid: str, fname: str, st: str, offset: int = 0) -> tuple[list, list]:
    """cells: table rows (strings). members: county-equivalent name -> geoid. years: {census year: column}."""
    rows, pub = [], []
    seen = set()
    for i, c in enumerate(cells):
        if not c:
            continue
        name = str(c[0]).strip()
        for y, col in years.items():
            loc = f"{fname}: row '{name}' (line {i + offset + 1}), column {y}"
            if name == total_name and (y, "total") not in seen:
                seen.add((y, "total"))
                pub.append(_pub("territory", st, y, "APR1_CENSUS", c[col], sid, loc))
            # Guam is both the territory and its single county-equivalent: the same row serves both.
            if name in members and (y, name) not in seen:
                seen.add((y, name))
                rows.append([members[name], name, y, "APR1_CENSUS", _int(c[col]), sid, loc])
    for y in years:
        missing = [m for m in members if (y, m) not in seen]
        if missing or (y, "total") not in seen:
            raise ValueError(f"{fname}: missing {missing or total_name} for {y}")
    return rows, pub


def island_2020_phc(path: Path, sid: str, fname: str, st: str, members: dict[str, str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """2020 Island Areas 'Population ... 2010 and 2020' table (CSV): Geographic area, 2010, 2020, ..."""
    text = path.read_bytes().decode("utf-8-sig")
    cells = list(csv.reader(io.StringIO(text)))
    header = next(i for i, c in enumerate(cells) if c and c[0].strip() == "Geographic area")
    if [x.strip() for x in cells[header][1:3]] != ["2010", "2020"]:
        raise ValueError(f"{fname}: unexpected header {cells[header]}")
    total = {"GU": "Guam", "VI": "United States Virgin Islands", "MP": "Commonwealth of the Northern Mariana Islands"}[st]
    rows, pub = _ia_rows(cells[header + 1:], members, total, {2010: 1, 2020: 2}, sid, fname, st, header + 1)
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)


def island_2010_cb(path: Path, sid: str, fname: str, st: str, members: dict[str, str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """2010 Census press-release table (xls): Geographic area, 2000, 2010, change."""
    df = pd.read_excel(path, sheet_name=0, header=None, dtype=str, engine="xlrd")
    cells = [[("" if pd.isna(v) else str(v)) for v in r] for r in df.itertuples(index=False)]
    header = next(i for i, c in enumerate(cells) if c and c[0].strip() == "Geographic area")
    h = [x.strip() for x in cells[header][1:3]]
    if [h[0], h[1].replace(".0", "")] != ["2000", "2010"]:
        raise ValueError(f"{fname}: unexpected header {cells[header]}")
    for c in cells:  # xls stores some counts as floats ("159358.0")
        for k in (1, 2):
            if len(c) > k and re.fullmatch(r"\d+\.0", c[k].strip()):
                c[k] = c[k].strip()[:-2]
    total = {"GU": "Guam", "VI": "U.S. Virgin Islands", "MP": "Commonwealth of the Northern Mariana Islands"}[st]
    rows, pub = _ia_rows(cells[header + 1:], members, total, {2000: 1, 2010: 2}, sid, fname, st, header + 1)
    return pd.DataFrame(rows, columns=COUNTY_COLS), pd.DataFrame(pub, columns=PUB_COLS)
