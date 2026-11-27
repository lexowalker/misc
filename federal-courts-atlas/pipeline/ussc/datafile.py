"""Read selected columns from a USSC Individual Offender datafile zip.

The USSC publishes each fiscal year as a zip holding a fixed-width ``.dat`` file plus
SAS (``.sas``) and SPSS (``.sps``) input programs. The ``.sas`` INPUT statement gives
each variable's column positions (``NAME [$] start[-end]``). Files are very wide
(10k-30k variables, 18-59 KB per record, up to ~2.3 GB uncompressed), so this module
streams the ``.dat`` member straight out of the zip, slices only the requested columns,
and never extracts the file to disk. The small column extract is cached as parquet
under ``data/raw/ussc_extract/`` (git-ignored), keyed by the zip's sha256 and the column
list, so rebuilds do not re-scan the big files.
"""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path

import pandas as pd

from pipeline.common.http import PROJECT_ROOT, file_sha256

EXTRACT_DIR = PROJECT_ROOT / "data" / "raw" / "ussc_extract"

_INPUT_RE = re.compile(r"\bINPUT\b(.*?);", re.S | re.I)
_TOKEN_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s+(\$)?\s*(\d+)(?:\s*-\s*(\d+))?")


def parse_sas_layout(sas_text: str) -> dict[str, tuple[int, int, bool]]:
    """Return {VARNAME: (start, end, is_char)} (1-based inclusive) from a SAS INPUT statement."""
    m = _INPUT_RE.search(sas_text)
    if not m:
        raise ValueError("no INPUT statement found in SAS program")
    out: dict[str, tuple[int, int, bool]] = {}
    for name, dollar, start, end in _TOKEN_RE.findall(m.group(1)):
        s = int(start)
        e = int(end) if end else s
        out[name.upper()] = (s, e, bool(dollar))
    return out


def zip_members(zpath: Path) -> tuple[str, str]:
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
    dat = [n for n in names if n.lower().endswith(".dat")]
    sas = [n for n in names if n.lower().endswith(".sas")]
    if len(dat) != 1 or len(sas) != 1:
        raise ValueError(f"{zpath}: expected one .dat and one .sas member, got {names}")
    return dat[0], sas[0]


def layout_for_zip(zpath: Path) -> dict[str, tuple[int, int, bool]]:
    _, sas = zip_members(zpath)
    with zipfile.ZipFile(zpath) as z:
        return parse_sas_layout(z.read(sas).decode("latin-1"))


def _to_num(s: str):
    s = s.strip()
    if s == "" or s == ".":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def read_columns(zpath: Path, columns: list[str], *, use_cache: bool = True) -> pd.DataFrame:
    """Stream ``columns`` (those present in this year's layout) from the zip's .dat member.

    Numeric columns become float (missing -> NaN); character columns stay str.
    Columns absent from the year's layout are simply not returned.
    """
    zpath = Path(zpath)
    layout = layout_for_zip(zpath)
    present = [c for c in columns if c in layout]
    sha = file_sha256(zpath)
    key = hashlib.sha256(json.dumps([sha, present]).encode()).hexdigest()[:16]
    cache = EXTRACT_DIR / f"{zpath.stem}_{key}.parquet"
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    dat, _ = zip_members(zpath)
    spans = [(c, layout[c][0] - 1, layout[c][1], layout[c][2]) for c in present]
    data: dict[str, list] = {c: [] for c in present}
    with zipfile.ZipFile(zpath) as z, z.open(dat) as f:
        for raw in f:
            if not raw.strip():
                continue
            for c, a, b, is_char in spans:
                v = raw[a:b].decode("latin-1")
                data[c].append(v.strip() if is_char else _to_num(v))
    df = pd.DataFrame(data)
    for c, _, _, is_char in spans:
        if not is_char:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache, index=False)
    return df
