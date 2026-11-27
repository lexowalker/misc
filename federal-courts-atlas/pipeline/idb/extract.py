"""Stream the needed columns out of the FJC IDB cumulative text files into compact Parquet extracts.

The cumulative files are tab-delimited text inside a zip (civil ``cv88on.txt`` about 2.0 GB, 11.1M
records; criminal ``cr96on.txt`` about 3.6 GB, 6.3M records). They are never loaded whole: the zip
member is read as a stream, a chunk of lines at a time, and only the columns this lane needs are kept.
The extracts are cached under ``data/raw/idb_extract/`` (git-ignored), keyed by the sha256 of the zip,
so a rebuild from the HTTP cache only re-parses when the source file changes.

Civil parsing detail: about 640 civil records hold a tab inside a quoted party name (PLT/DEF), which
gives them 47-48 fields instead of 46. PLT and DEF are fields 22-23 of 46 and are not used here, so each
line is split on tabs and the first 21 fields are taken from the left and the last 23 from the right;
the party names in between are ignored. This is exact for every line (asserted: no line has < 46 fields).
"""
from __future__ import annotations

import io
import json
import zipfile_deflate64 as zipfile  # stdlib zipfile + Deflate64 (method 9) support
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from pipeline.common.http import PROJECT_ROOT

EXTRACT_DIR = PROJECT_ROOT / "data" / "raw" / "idb_extract"

CIVIL_HEADER = (
    "CIRCUIT DISTRICT OFFICE DOCKET ORIGIN FILEDATE FDATEUSE JURIS NOS TITL SECTION SUBSECT RESIDENC JURY "
    "CLASSACT DEMANDED FILEJUDG FILEMAG COUNTY ARBIT MDLDOCK PLT DEF TRANSDAT TRANSOFF TRANSDOC TRANSORG "
    "TERMDATE TDATEUSE TRCLACT TERMJUDG TERMMAG PROCPROG DISP NOJ AMTREC JUDGMENT DJOINED PRETRIAL TRIBEGAN "
    "TRIALEND TRMARB PROSE IFP STATUSCD TAPEYEAR"
).split()
assert len(CIVIL_HEADER) == 46

CIVIL_STR = ["CIRCUIT", "DISTRICT", "OFFICE", "DOCKET", "STATUSCD", "IFP", "MDLDOCK", "TRANSOFF", "TRANSDOC"]
CIVIL_INT = ["ORIGIN", "JURIS", "NOS", "CLASSACT", "TRCLACT", "PROCPROG", "DISP", "NOJ", "JUDGMENT", "PROSE",
             "TAPEYEAR"]
CIVIL_DATE = ["FILEDATE", "FDATEUSE", "TERMDATE", "TDATEUSE", "TRANSDAT"]
CIVIL_KEEP = CIVIL_STR + CIVIL_INT + CIVIL_DATE

CRIM_STR = ["CIRCUIT", "DISTRICT", "OFFICE", "DOCKET", "DEFNO", "TYPEREG", "TYPETRN", "DEFLGKY", "STATUSCD",
            "FUGSTAT", "FTITLE1", "FOFFCD1", "D2FOFFCD1", "FSEV1", "TTITLE1", "TOFFCD1", "D2TOFFCD1", "TERMOFF",
            "SOURCE"]
CRIM_INT = ["FISCALYR", "REOPSEQ", "PROCCD", "FCOUNSEL", "FOFFLVL1", "TCOUNSEL", "TOFFLVL1", "DISP1",
            "CTFILTRN", "CTFIL", "CTFILWOR", "CTFILR", "CTTRTRN", "CTTR", "CTTRWOR", "CTTRR", "CTPN", "CTPNWOF",
            "TAPEYEAR"]
CRIM_DATE = ["FILEDATE", "PROCDATE", "APPDATE", "DISPDATE", "SENTDATE", "TERMDATE"]
CRIM_KEEP = CRIM_STR + CRIM_INT + CRIM_DATE

CHUNK = 500_000


def _clean_str(s: pd.Series) -> pd.Series:
    s = s.str.strip()
    return s.where(s != "", None)


def _to_int(s: pd.Series, field: str, report: dict) -> pd.Series:
    st = s.str.strip()
    num = pd.to_numeric(st, errors="coerce")
    bad = st[(num.isna()) & (st != "") & st.notna()]
    if len(bad):
        r = report.setdefault("non_numeric", {}).setdefault(field, {})
        for k, v in bad.value_counts().head(20).items():
            r[k] = r.get(k, 0) + int(v)
    return num.astype("Int32")


def _to_date(s: pd.Series, field: str, report: dict) -> pd.Series:
    st = s.str.strip()
    d = pd.to_datetime(st, format="%m/%d/%Y", errors="coerce")
    bad = st[d.isna() & (st != "") & st.notna()]
    if len(bad):
        r = report.setdefault("unparsed_dates", {}).setdefault(field, {})
        for k, v in bad.value_counts().head(20).items():
            r[k] = r.get(k, 0) + int(v)
    # 01/01/1900 is the documented "missing" sentinel in the criminal file
    d = d.where(d != pd.Timestamp("1900-01-01"))
    return d


def _convert(df: pd.DataFrame, str_cols, int_cols, date_cols, report: dict) -> pd.DataFrame:
    out = {}
    for c in str_cols:
        out[c] = _clean_str(df[c])
    for c in int_cols:
        out[c] = _to_int(df[c], c, report)
    for c in date_cols:
        out[c] = _to_date(df[c], c, report)
    return pd.DataFrame(out)


def _member(zip_path: Path) -> str:
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".txt")]
    assert len(names) == 1, names
    return names[0]


def _write(writer_holder: list, df: pd.DataFrame, out_tmp: Path):
    table = pa.Table.from_pandas(df, preserve_index=False)
    if not writer_holder:
        writer_holder.append(pq.ParquetWriter(out_tmp, table.schema, compression="zstd"))
    writer_holder[0].write_table(table)


def extract_civil(zip_path: Path, sha256: str, log=print) -> Path:
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    out = EXTRACT_DIR / f"civil_{sha256[:16]}.parquet"
    rep_path = out.with_suffix(".report.json")
    if out.exists() and rep_path.exists():
        return out
    member = _member(zip_path)
    idx_left = list(range(21))           # CIRCUIT .. MDLDOCK
    idx_right = list(range(23, 46))      # TRANSDAT .. TAPEYEAR (taken from the right)
    names = [CIVIL_HEADER[i] for i in idx_left + idx_right]
    keep_pos = [names.index(c) for c in CIVIL_KEEP]
    report = {"member": member, "lines": 0, "fields_hist": {}, "rows": 0}
    holder: list = []
    tmp = out.with_suffix(".parquet.part")
    rows_buf: list = []
    row_no = 0
    with zipfile.ZipFile(zip_path) as z, z.open(member) as fh:
        text = io.TextIOWrapper(fh, encoding="latin-1", newline="")
        header = text.readline().rstrip("\r\n").split("\t")
        assert header == CIVIL_HEADER, header
        for line in text:
            line = line.rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            n = len(parts)
            report["fields_hist"][n] = report["fields_hist"].get(n, 0) + 1
            if n < 46:
                raise ValueError(f"civil line {row_no + 2} has {n} fields")
            sel = parts[:21] + parts[n - 23:]
            rows_buf.append([sel[p] for p in keep_pos])
            row_no += 1
            if len(rows_buf) >= CHUNK:
                df = pd.DataFrame(rows_buf, columns=CIVIL_KEEP)
                df = _convert(df, CIVIL_STR, CIVIL_INT, CIVIL_DATE, report)
                df["ROWNO"] = np.arange(row_no - len(rows_buf), row_no, dtype=np.int64)
                _write(holder, df, tmp)
                rows_buf = []
                log(f"  civil: {row_no:,} records")
        if rows_buf:
            df = pd.DataFrame(rows_buf, columns=CIVIL_KEEP)
            df = _convert(df, CIVIL_STR, CIVIL_INT, CIVIL_DATE, report)
            df["ROWNO"] = np.arange(row_no - len(rows_buf), row_no, dtype=np.int64)
            _write(holder, df, tmp)
    holder[0].close()
    report["lines"] = row_no
    report["rows"] = row_no
    report["fields_hist"] = {str(k): v for k, v in sorted(report["fields_hist"].items())}
    tmp.replace(out)
    rep_path.write_text(json.dumps(report, indent=1))
    return out


def extract_criminal(zip_path: Path, sha256: str, log=print) -> Path:
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    out = EXTRACT_DIR / f"criminal_{sha256[:16]}.parquet"
    rep_path = out.with_suffix(".report.json")
    if out.exists() and rep_path.exists():
        return out
    member = _member(zip_path)
    report = {"member": member, "rows": 0}
    holder: list = []
    tmp = out.with_suffix(".parquet.part")
    n = 0
    with zipfile.ZipFile(zip_path) as z, z.open(member) as fh:
        reader = pd.read_csv(fh, sep="\t", dtype=str, usecols=CRIM_KEEP, quoting=3, encoding="latin-1",
                             keep_default_na=False, na_values=[], chunksize=CHUNK, engine="c")
        for chunk in reader:
            df = _convert(chunk, CRIM_STR, CRIM_INT, CRIM_DATE, report)
            df["ROWNO"] = np.arange(n, n + len(df), dtype=np.int64)
            n += len(df)
            _write(holder, df, tmp)
            log(f"  criminal: {n:,} records")
    holder[0].close()
    report["rows"] = n
    tmp.replace(out)
    rep_path.write_text(json.dumps(report, indent=1))
    return out
