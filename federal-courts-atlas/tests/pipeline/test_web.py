"""Tests for the web lane (run after `python -m pipeline.web.build`, i.e. `make web`).

Every check re-derives what it verifies from the producing lanes' processed tables or from the published files
themselves, using code independent of pipeline.web (only the registry and the published metadata are shared).
"""
from __future__ import annotations

import hashlib
import json
import math
import re

from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import BY_ID, IDS, TERRITORIAL

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public" / "data"
PROC = ROOT / "data" / "processed"
FAMILIES = {"speed", "workload", "sentencing", "casemix"}
APPROX = {"mtd", "idd", "wyd", "ncmd", "nced"}

if not (PUB / "variables.json").exists():
    pytest.skip("public/data not built; run `make web`", allow_module_level=True)


def load(rel: str):
    return json.loads((PUB / rel).read_text())


VARIABLES = load("variables.json")
VAR_BY_ID = {v["id"]: v for v in VARIABLES}
SOURCES = load("sources.json")
VALUES = {v["id"]: load(f"values/{v['id']}.json") for v in VARIABLES}


_TABLES: dict[tuple[str, str], pd.DataFrame] = {}


def lane_table(lane: str, name: str) -> pd.DataFrame:
    key = (lane, name)
    if key not in _TABLES:
        pq = PROC / lane / f"{name}.parquet"
        _TABLES[key] = pd.read_parquet(pq) if pq.exists() else pd.read_csv(PROC / lane / f"{name}.csv")
    return _TABLES[key]


def lane_rows(lane: str, tbl: str, var: str) -> pd.DataFrame:
    df = lane_table(lane, tbl)
    df = df[(df["variable"] == var) & df["value"].notna()]
    return df


def walk_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for x in obj:
            yield from walk_strings(x)


def cell_sources(vf: dict, d: str, y: str) -> list[str]:
    return vf.get("cell_sources", {}).get(d, {}).get(y) or vf["source_by_year"][y]


# ------------------------------------------------------------------------------------------- files
ALL_JSON = sorted(PUB.rglob("*.json"))


def test_files_are_valid_json_without_em_dash():
    assert len(ALL_JSON) > 300
    for f in ALL_JSON:
        text = f.read_text()
        assert "\u2014" not in text and "\\u2014" not in text, f"em-dash in {f.relative_to(PUB)}"
        obj = json.loads(text)
        for s in walk_strings(obj):
            assert "\u2014" not in s


def test_no_local_paths_or_secrets_published():
    for rel in ("sources.json", "variables.json", "districts.json"):
        text = (PUB / rel).read_text()
        assert "local_path" not in text
        assert "data/raw/" not in text
    for f in (PUB / "cases").glob("*.json"):
        t = f.read_text().lower()
        assert "token" not in t and "authorization" not in t


# ------------------------------------------------------------------------------------------- catalog
REQUIRED = ["id", "family", "label", "short_label", "unit", "format", "explainer", "caveats", "source_ids", "derived",
            "formula", "higher_means", "years", "period_type", "lane", "default_rank_direction"]


def test_catalog_shape_and_coverage():
    assert len(VARIABLES) >= 24
    assert {v["family"] for v in VARIABLES} == FAMILIES
    long = [v for v in VARIABLES if len(v["years"]) >= 10]
    assert len(long) >= 15
    for fam in FAMILIES:
        assert any(v["family"] == fam for v in long), fam
    for v in VARIABLES:
        for k in REQUIRED:
            assert k in v, (v["id"], k)
        assert isinstance(v["caveats"], list) and v["caveats"]
        assert re.fullmatch(r",?\.\d+f", v["format"]), v["format"]
        sentences = [s for s in re.split(r"(?<=[.!?])\s+", v["explainer"].strip()) if s]
        assert 1 <= len(sentences) <= 3, v["id"]
        assert v["default_rank_direction"] in ("asc", "desc")
        if v["derived"]:
            assert v["formula"], v["id"]
        assert v["years"] == VALUES[v["id"]]["years"]
        assert v["period_type"] == VALUES[v["id"]]["period_type"]
        assert any("Ranks are derived" in c for c in v["caveats"]), v["id"]


def test_every_variable_has_at_least_ten_years():
    for v in VARIABLES:
        assert len(v["years"]) >= 10, v["id"]


# ------------------------------------------------------------------------------------------- values
def _lane_inputs(v: dict):
    if v["lane"] == "web":
        return None
    return v["lane"], v["lane_table"], v["lane_variable"]


@pytest.mark.parametrize("vid", [v["id"] for v in VARIABLES if v["lane"] != "web"])
def test_values_equal_lane_observations(vid):
    v = VAR_BY_ID[vid]
    vf = VALUES[vid]
    lane, tbl, var = _lane_inputs(v)
    rows = lane_rows(lane, tbl, var)
    expected = {(r.district_id, str(int(r.period))): (float(r.value), str(r.source_id)) for r in rows.itertuples()}
    got = {(d, y): val for d, row in vf["values"].items() for y, val in row.items()}
    assert set(got) == set(expected), f"{vid}: cell sets differ"
    for key, val in got.items():
        exp_val, exp_src = expected[key]
        assert float(val) == exp_val, (vid, key, val, exp_val)
        assert cell_sources(vf, *key) == [exp_src], (vid, key)
        assert exp_src in vf["provenance"]


@pytest.mark.parametrize("vid", [v["id"] for v in VARIABLES if v["lane"] == "web"])
def test_per_capita_values_recompute(vid):
    v = VAR_BY_ID[vid]
    vf = VALUES[vid]
    assert v["derived"] and vf["derived"] and "100,000" in v["formula"]
    num_in, pop_in = v["lane_inputs"]
    num = lane_rows(num_in["lane"], num_in["table"], num_in["variable"])
    pop = lane_rows("population", "observations", "population_estimate")
    pop = {(r.district_id, int(r.period)): (float(r.value), r.source_id) for r in pop.itertuples()}
    n_cells = 0
    for r in num.itertuples():
        key = (r.district_id, int(r.period))
        if key not in pop:
            assert str(key[1]) not in vf["values"].get(key[0], {})
            continue
        p, psid = pop[key]
        expected = round(float(r.value) / p * 100000, 1)
        got = vf["values"][key[0]][str(key[1])]
        assert math.isclose(got, expected, abs_tol=1e-9), (vid, key, got, expected)
        assert sorted(cell_sources(vf, key[0], str(key[1]))) == sorted([r.source_id, psid])
        n_cells += 1
        if key[0] in APPROX:
            assert "approximate" in vf["cell_notes"][key[0]][str(key[1])]
    assert n_cells == sum(len(row) for row in vf["values"].values())
    for t in TERRITORIAL:
        assert t not in vf["values"]
    assert "national" not in vf


@pytest.mark.parametrize("vid", list(VALUES))
def test_ranks_consistent_with_values(vid):
    vf = VALUES[vid]
    fmt = VAR_BY_ID[vid]["format"]
    for y in vf["years"]:
        ys = str(y)
        # ranks compare values as the site displays them (data audit 2026-11-27)
        vals = {d: _shown(row[ys], fmt) for d, row in vf["values"].items() if ys in row}
        assert vf["ranked_of"][ys] == len(vals)
        for d, val in vals.items():
            expected = 1 + sum(1 for x in vals.values() if x > val)
            assert vf["ranks"][d][ys] == expected, (vid, d, y)
    ranked = {(d, y) for d, row in vf["ranks"].items() for y in row}
    valued = {(d, y) for d, row in vf["values"].items() for y in row}
    assert ranked == valued


@pytest.mark.parametrize("vid", [v["id"] for v in VARIABLES if VALUES[v["id"]].get("national")])
def test_national_values_equal_lane_national(vid):
    v = VAR_BY_ID[vid]
    vf = VALUES[vid]
    lane, tbl, var = _lane_inputs(v)
    nat_tbl = {("fcms", "observations"): "national", ("fcms", "observations_current_method"): "national_current_method",
               ("ussc", "observations"): "national", ("idb", "observations"): "national"}[(lane, tbl)]
    df = lane_table(lane, nat_tbl)
    df = df[df["variable"] == var]
    if "district_id" in df.columns:
        df = df[df["district_id"].isin(["US", "_national"])]
    exp = {str(int(r.period)): float(r.value) for r in df.itertuples() if pd.notna(r.value)}
    assert {k: float(x) for k, x in vf["national"].items()} == exp


def test_derived_years_match_ussc_row_flags():
    for v in VARIABLES:
        if v["lane"] != "ussc":
            continue
        vf = VALUES[v["id"]]
        rows = lane_rows("ussc", "observations", v["lane_variable"])
        dy = sorted({int(r.period) for r in rows.itertuples() if bool(r.derived)})
        if vf["derived"]:
            assert dy == vf["years"]
        else:
            assert vf.get("derived_years", []) == dy, v["id"]


def test_fcms_cell_caveats_are_carried():
    vf = VALUES["civil_disposition_months"]
    assert "0.0" in vf["cell_notes"]["flsd"]["2023"]
    assert "paed" in vf["cell_notes"]


def test_four_way_sentencing_series_not_spliced():
    new = VALUES["above_range_pct"]
    old = VALUES["above_range_pct_2006"]
    assert new["years"] == list(range(2014, 2026)) and new["derived"]
    assert old["years"] == list(range(2006, 2018)) and not old["derived"]
    assert VAR_BY_ID["above_range_pct"]["lane_variable"].endswith("_2018scheme")


# ------------------------------------------------------------------------------------------- sources
def _collect(obj, acc):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("source_id", "population_source_id") and isinstance(v, str):
                acc.add(v)
            elif k == "source_ids" and isinstance(v, list):
                acc.update(v)
            elif k == "provenance" and isinstance(v, dict):
                acc.update(v)
            elif k in ("source_by_year", "national_source_by_year"):
                for x in v.values():
                    acc.update([x] if isinstance(x, str) else x)
            elif k == "cell_sources":
                for row in v.values():
                    for x in row.values():
                        acc.update(x)
            else:
                _collect(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            _collect(x, acc)


def test_every_source_id_resolves():
    ids: set[str] = set()
    for f in ALL_JSON:
        rel = f.relative_to(PUB).as_posix()
        if rel.startswith("search/") or rel.endswith(".topo.json") or rel in ("sources.json", "manifest.json"):
            continue
        _collect(json.loads(f.read_text()), ids)
    missing = sorted(i for i in ids if i not in SOURCES)
    assert not missing, missing[:10]
    for sid, rec in SOURCES.items():
        assert rec.get("url", "").startswith("http"), sid
        assert rec.get("dataset"), sid
        assert "local_path" not in rec
        for m in rec.get("members", []):
            assert m in SOURCES, (sid, m)


def test_variable_citations_cover_cell_sources():
    for v in VARIABLES:
        allowed = set()
        for sid in v["source_ids"]:
            allowed.add(sid)
            allowed.update(SOURCES[sid].get("members", []))
        vf = VALUES[v["id"]]
        for sid, rec in vf["provenance"].items():
            assert sid in allowed, (v["id"], sid)
            assert rec["url"] == SOURCES[sid]["url"]


# ------------------------------------------------------------------------------------------- districts
DISTRICTS = load("districts.json")


def test_districts_complete_and_consistent():
    assert sorted(DISTRICTS) == sorted(IDS)
    div = load("geo/divisions.json")["districts"]
    ch_ids = {c["id"]: c["district_id"] for c in load("geo/courthouses.json")}
    pop = lane_rows("population", "observations", "population_estimate")
    latest = pop.sort_values("period").groupby("district_id").tail(1).set_index("district_id")
    for i, d in enumerate(IDS):
        r = DISTRICTS[d]
        reg = BY_ID[d]
        assert (r["name"], r["short"], r["state"], r["circuit"]) == (reg.name, reg.short, reg.state, reg.circuit)
        assert r["prev"] == IDS[i - 1] and r["next"] == IDS[(i + 1) % len(IDS)]
        assert [c["geoid"] for c in r["counties"]] == [c["geoid"] for c in div[d]["counties"]]
        for cid in r["courthouse_ids"]:
            assert ch_ids[cid] == d
        assert r["population_approximate"] == (d in APPROX)
        if d in TERRITORIAL:
            assert r["population"] is None and "No data" in r["population_note"]
            assert r["judges_active"] is None
        else:
            assert r["population"] == latest.loc[d, "value"]
            assert r["population_year"] == int(latest.loc[d, "period"])
            assert r["population_source_id"] == latest.loc[d, "source_id"]
        for dv in r["divisions"]:
            assert set(dv["counties"]) <= {c["geoid"] for c in r["counties"]}


# ------------------------------------------------------------------------------------------- judges
def test_judges_match_fjc_records():
    jd = load("judges.json")
    lane = lane_table("judges", "district_judges")
    counts = lane.groupby("district_id").size().to_dict()
    for d in IDS:
        recs = jd[d]
        assert len(recs) == counts.get(d, 0), d
        per = load(f"judges/{d}.json")["judges"]
        assert [{k: v for k, v in r.items() if k != "district_id"} for r in per] == recs
    by_key = {f"{int(r.fjc_nid)}-{int(r.fjc_sequence)}": r for r in lane.itertuples()}
    for d in IDS:
        for rec in jd[d]:
            src = by_key[rec["id"]]
            assert rec.get("appointing_party") == (src.appointing_party if isinstance(src.appointing_party, str) else None)
            assert rec.get("appointing_president") == (src.appointing_president if isinstance(src.appointing_president, str) else None)
            assert rec.get("commission_date") == (str(src.commission_date)[:10] if isinstance(src.commission_date, str) else rec.get("commission_date"))
            for banned in ("photo", "image", "portrait", "reversal", "rating"):
                assert not any(banned in k for k in rec), (rec["id"], banned)
    for t in TERRITORIAL:
        assert jd[t] == []


# ------------------------------------------------------------------------------------------- cases
def test_cases_copied_from_lane():
    for d in IDS:
        pub = load(f"cases/{d}.json")
        lane = json.loads((PROC / "cases" / f"{d}.json").read_text())
        assert pub["district_id"] == d
        assert [i["url"] for i in pub["items"]] == [i["url"] for i in lane["items"]]
        assert [i["case_name"] for i in pub["items"]] == [i["case_name"].replace(" \u2014 ", ", ").replace("\u2014", "-") for i in lane["items"]]
        for i in pub["items"]:
            assert i["url"].startswith("https://www.courtlistener.com/")
            assert i["kind"] in ("docket", "opinion")
        if not pub["items"]:
            assert pub["note"]
        else:
            assert 1 <= len(pub["items"]) <= 5


# ------------------------------------------------------------------------------------------- profiles
PROFILES = {d: load(f"profiles/{d}.json") for d in IDS}
CIRCUITS = {"1": "First", "2": "Second", "3": "Third", "4": "Fourth", "5": "Fifth", "6": "Sixth", "7": "Seventh",
            "8": "Eighth", "9": "Ninth", "10": "Tenth", "11": "Eleventh", "DC": "D.C."}
BANNED_WORDS = re.compile(r"\b(because|due to|lenient|harsh|biased|bias|activist|soft on|tough on|fault|blame|"
                          r"inefficien\w*|lazy|better|worse|best|worst|unfair)\b", re.I)


def _shown(v: float, fmt: str) -> float:
    """A value as the site displays it: Intl.NumberFormat rounds the exact binary value half away from zero."""
    from decimal import ROUND_HALF_UP, Decimal
    d = int(re.search(r"\.(\d+)", fmt).group(1))
    if d == 0 and v != int(v):
        d = 1
    return float(Decimal(float(v)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP))


def _fmt(v: float, fmt: str) -> str:
    d = int(re.search(r"\.(\d+)", fmt).group(1))
    if d == 0 and v != int(v):
        d = 1  # a published fraction (half judgeships) is printed, never rounded away
    return f"{_shown(v, fmt):,.{d}f}"


def test_profiles_exist_for_all_districts():
    assert sorted(PROFILES) == sorted(IDS)
    for d, p in PROFILES.items():
        assert p["district_id"] == d
        assert p["distinctive"]["paragraph"]
        assert len(p["key_stats"]) == len(VARIABLES)


def test_every_profile_claim_reverifies():
    judge_names = {r["name"] for recs in load("judges.json").values() if isinstance(recs, list) for r in recs}
    for d, p in PROFILES.items():
        dist = p["distinctive"]
        assert 1 <= len(dist["sentences"]) <= 3
        para = dist["paragraph"]
        assert not BANNED_WORDS.search(para), (d, para)
        for name in judge_names:
            assert name not in para
        for s in dist["sentences"]:
            assert s["claims"], d
            for c in s["claims"]:
                vf = VALUES[c["variable"]]
                v = VAR_BY_ID[c["variable"]]
                ys = str(c["year"])
                assert vf["values"][d][ys] == c["value"], (d, c)
                assert vf["ranks"][d][ys] == c["rank"]
                assert vf["ranked_of"][ys] == c["ranked_of"]
                assert sorted(c["source_ids"]) == sorted(cell_sources(vf, d, ys))
                txt = _fmt(c["value"], v["format"])
                assert txt in s["text"] and txt in para, (d, txt, s["text"])
                # positions and ties are judged on the value as displayed (data audit 2026-11-27)
                vals = {x: _shown(row[ys], v["format"]) for x, row in vf["values"].items() if ys in row}
                cv = _shown(c["value"], v["format"])
                if c["scope"] == "national":
                    assert c["year"] == vf["years"][-1]
                    pos = (1 + sum(1 for x in vals.values() if x > cv) if c["direction"] == "high"
                           else 1 + sum(1 for x in vals.values() if x < cv))
                    assert pos == c["position"] <= 3
                    tie = sum(1 for x in vals.values() if x == cv)
                    assert c["tied"] == (tie > 1) and tie <= 2
                    assert ("tied for" in s["text"]) == c["tied"]
                    assert f"of {c['ranked_of']} districts" in s["text"] or f"of the {c['ranked_of']} districts" in s["text"]
                elif c["scope"] == "circuit":
                    peers = [vals[x] for x in vals if BY_ID[x].circuit == BY_ID[d].circuit]
                    target = max(peers) if c["direction"] == "high" else min(peers)
                    assert cv == target and peers.count(target) == 1
                    assert f"{CIRCUITS[BY_ID[d].circuit]} Circuit" in s["text"]
                else:
                    assert c["scope"] == "size"
                if c["derived"]:
                    assert c.get("formula"), (d, c)


def test_profile_key_stats_match_values():
    for d, p in PROFILES.items():
        for row in p["key_stats"]:
            vf = VALUES[row["variable"]]
            y = str(vf["years"][-1])
            assert row["year"] == vf["years"][-1]
            assert row["value"] == vf["values"].get(d, {}).get(y)
            assert row["series"] == vf["values"].get(d, {})
            if row["value"] is not None:
                assert row["rank"] == vf["ranks"][d][y]
            assert row["national"] == vf.get("national", {}).get(y)


def test_profile_case_mix_recomputes():
    civ = lane_table("idb", "civil_nos_mix")
    cri = lane_table("idb", "criminal_offense_mix")
    for d, p in PROFILES.items():
        cm = p["case_mix"]
        for key, df, col in (("civil_nature_of_suit", civ, "nos_group"), ("criminal_offense", cri, "offense_category")):
            m = cm[key]
            sub = df[(df["district_id"] == d) & (df["period"] == m["year"])]
            assert m["year"] == int(df[df["district_id"] == d]["period"].max())
            counts = dict(zip(sub[col], sub["count"]))
            assert m["total"] == int(sub["filed_total"].iloc[0])
            for g in m["groups"]:
                assert g["count"] == counts[g["id"]]
                assert g["share"] == round(100 * g["count"] / m["total"], 1)
        for series in cm["sentencing_composition"]["series"]:
            for y, row in series["years"].items():
                for k, vid in series["variables"].items():
                    assert row[k] == VALUES[vid]["values"].get(d, {}).get(y)


def test_overlap_years_of_four_way_series_agree():
    for d, p in PROFILES.items():
        old, new = p["case_mix"]["sentencing_composition"]["series"]
        for y in ("2014", "2015", "2016", "2017"):
            if y in old["years"] and y in new["years"]:
                for k in ("within", "above", "govt_below", "nongovt_below"):
                    assert old["years"][y][k] == new["years"][y][k], (d, y, k)


# ------------------------------------------------------------------------------------------- manifest
def test_manifest_hashes():
    m = load("manifest.json")
    assert m["version"] and re.fullmatch(r"\d{4}-\d{2}-\d{2}", m["build_date"])
    files = {f.relative_to(PUB).as_posix() for f in ALL_JSON} - {"manifest.json"}
    assert set(m["files"]) == files
    for rel, e in m["files"].items():
        b = (PUB / rel).read_bytes()
        assert e["bytes"] == len(b)
        assert e["sha256"] == hashlib.sha256(b).hexdigest()


def test_first_paint_budget():
    """variables.json plus the default variable's values file stay small (topology is the boundaries lane's)."""
    default = sorted(VARIABLES, key=lambda v: ["speed", "workload", "sentencing", "casemix"].index(v["family"]))[0]
    size = (PUB / "variables.json").stat().st_size + (PUB / f"values/{default['id']}.json").stat().st_size
    assert size < 250_000, size


def test_build_is_deterministic():
    from pipeline.web import build
    before = {f.relative_to(PUB).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(PUB.rglob("*.json"))}
    extra = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in ("data/sources/web.json", "data/gaps/web.json")}
    build.main()
    after = {f.relative_to(PUB).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(PUB.rglob("*.json"))}
    extra2 = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in extra}
    assert before == after
    assert extra == extra2


def test_gaps_logged():
    gaps = json.loads((ROOT / "data" / "gaps" / "web.json").read_text())
    assert "per_capita_territories_no_population" in gaps
    assert "per_capita_population_approximate" in gaps
    empty = sorted(d for d in IDS if not load(f"cases/{d}.json")["items"])
    if empty:
        assert sorted(gaps["cases_none_published"]["districts"]) == empty
    for g in gaps.values():
        assert "\u2014" not in json.dumps(g, ensure_ascii=False)



