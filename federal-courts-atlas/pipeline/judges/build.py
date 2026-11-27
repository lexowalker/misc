"""Build the judges lane from the FJC Biographical Directory of Article III Federal Judges export.

    PYTHONPATH=. .venv/bin/python -m pipeline.judges.build

Idempotent: downloads go through pipeline.common.http.fetch (disk cache) and every output is rewritten.
No photographs are downloaded or referenced: only the CSV export files and FJC text pages are fetched.

Outputs (data/processed/judges/):
  district_judges.{csv,parquet}   one row per FJC service record on one of the 91 Article III district
                                  courts in the registry (judge x district-court appointment), all years
  historical_court_service.csv    service records on district courts that no longer exist (not mapped)
  court_crosswalk.csv             every FJC district-court name -> district_id / historical, with counts
  observations.{parquet,csv}      SNAPSHOT_SEP30 counts per district per year, 1950 to the latest Sep 30
  variables.json                  one entry per observation variable
  build_summary.json              row counts and checks
"""
from __future__ import annotations

import json
import re
from datetime import date

import pandas as pd
from bs4 import BeautifulSoup

from pipeline.common.districts import BY_ID, DISTRICTS, TERRITORIAL
from pipeline.common.http import fetch
from pipeline.common.manifest import DATA, record_gap, register_source, write_observations

from . import LANE
from .crosswalk import INCARNATION_START, article3_names, map_court, note_for

OUT = DATA / "processed" / LANE
PUBLISHER = "Federal Judicial Center, History Office (fjc.gov)"
DATASET = "Biographical Directory of Article III Federal Judges, 1789-present: database export"
EXPORT_PAGE = "https://www.fjc.gov/history/judges/biographical-directory-article-iii-federal-judges-export"
FILES = {
    "fjc_federal_judicial_service_csv": "https://www.fjc.gov/sites/default/files/history/federal-judicial-service.csv",
    "fjc_demographics_csv": "https://www.fjc.gov/sites/default/files/history/demographics.csv",
    "fjc_judges_flat_csv": "https://www.fjc.gov/sites/default/files/history/judges.csv",
}
FIRST_SNAPSHOT_YEAR = 1950

# FJC state legislative-history pages that document when the courts whose current form post-dates 1950
# began. The build checks that each phrase is on the page and that no FJC service record in the district
# starts before the date (a consistency check between the two FJC products).
LEGHIST = {
    "akd": ("https://www.fjc.gov/history/courts/us-district-court-district-alaska-legislative-history",
            "January 3, 1959", "1959-01-03"),
    "hid": ("https://www.fjc.gov/history/courts/us-district-court-district-hawaii-legislative-history",
            "August 21, 1959", "1959-08-21"),
    "prd": ("https://www.fjc.gov/history/courts/us-district-court-district-puerto-rico-legislative-history",
            "September 12, 1966", "1966-09-12"),
    "cacd": ("https://www.fjc.gov/history/courts/us-district-courts-districts-california-legislative-history",
             "March 18, 1966", "1966-03-18"),
    "caed": ("https://www.fjc.gov/history/courts/us-district-courts-districts-california-legislative-history",
             "March 18, 1966", "1966-03-18"),
    "flmd": ("https://www.fjc.gov/history/courts/us-district-courts-districts-florida-legislative-history",
             "July 30, 1962", "1962-07-30"),
    "lamd": ("https://www.fjc.gov/history/courts/us-district-courts-districts-louisiana-legislative-history",
             "April 16, 1972", "1972-04-16"),
    "ilcd": ("https://www.fjc.gov/history/courts/us-district-courts-districts-illinois-legislative-history",
             "March 31, 1979", "1979-03-31"),
    "scd": ("https://www.fjc.gov/history/courts/us-district-courts-districts-south-carolina-legislative-history",
            "October 7, 1965", "1965-10-07"),
}
LEGHIST_SOURCE_ID = {
    "akd": "fjc_leghist_alaska", "hid": "fjc_leghist_hawaii", "prd": "fjc_leghist_puerto_rico",
    "cacd": "fjc_leghist_california", "caed": "fjc_leghist_california", "flmd": "fjc_leghist_florida",
    "lamd": "fjc_leghist_louisiana", "ilcd": "fjc_leghist_illinois", "scd": "fjc_leghist_south_carolina",
}

DATE_COLS = {  # FJC column -> output column
    "Recess Appointment Date": "recess_appointment_date",
    "Nomination Date": "nomination_date",
    "Confirmation Date": "confirmation_date",
    "Commission Date": "commission_date",
    "Senior Status Date": "senior_status_date",
    "Termination Date": "termination_date",
}
NONE_PARTIES = {"None (reassignment)", "None (assignment)"}

VARIABLES = [
    {
        "id": "judges_active",
        "label": "Active district judges",
        "unit": "count",
        "description": "Number of Article III judges in active (not senior) service on the district court on "
                       "September 30 of the year, counted from the FJC service records.",
        "formula": "count of distinct FJC nid with a service record in the district where service_start <= "
                   "Sep 30 < active_service_end; service_start = min(recess appointment date, commission date); "
                   "active_service_end = earliest of effective senior status date and termination date",
        "higher_means": "more active judges",
    },
    {
        "id": "judges_senior",
        "label": "Senior district judges",
        "unit": "count",
        "description": "Number of Article III judges in senior status on the district court on September 30 "
                       "of the year (they have left active service but still hold office and may hear cases).",
        "formula": "count of distinct FJC nid with a service record in the district where service_start <= "
                   "Sep 30, effective senior status date <= Sep 30 and (no termination date or termination "
                   "date > Sep 30)",
        "higher_means": "more senior judges",
    },
    {
        "id": "judges_active_appointed_dem",
        "label": "Active judges appointed by a Democratic president",
        "unit": "count",
        "description": "Active district judges (as in judges_active) whose appointing president's party, as "
                       "given by FJC, is Democratic.",
        "formula": "judges_active restricted to records whose resolved_appointing_party == 'Democratic' "
                   "(for statutory reassignments FJC gives 'None (reassignment)'; the party is then taken from "
                   "the judge's prior FJC service record that ended in that reassignment)",
        "higher_means": "more active judges appointed by Democratic presidents",
    },
    {
        "id": "judges_active_appointed_rep",
        "label": "Active judges appointed by a Republican president",
        "unit": "count",
        "description": "Active district judges (as in judges_active) whose appointing president's party, as "
                       "given by FJC, is Republican.",
        "formula": "judges_active restricted to records whose resolved_appointing_party == 'Republican' "
                   "(reassignments resolved as for judges_active_appointed_dem)",
        "higher_means": "more active judges appointed by Republican presidents",
    },
]
COMMON_CAVEATS = (
    "Derived count from public FJC dates, not an official AO statistic; it can differ from authorized "
    "judgeships (vacancies) and from AO judge counts. Counts are 'at the end of the day' on Sep 30: a judge "
    "whose service starts on Sep 30 is counted, one whose senior status or termination date is Sep 30 is "
    "not. Service starts at the commission date (or the recess appointment date if earlier); FJC has no "
    "oath dates. A judge appointed to more than one district (e.g. a roving judgeship) is counted in each, "
    "so district counts do not sum to a national head count. Judges reassigned by statute to a new district "
    "who were already senior are treated as senior there (FJC seat id ending 'SR'). The FJC export is "
    "updated nightly and its historical data are occasionally corrected. Series start at the first Sep 30 "
    "on or after the district's first Article III service record (1950 at the earliest). Article IV courts "
    "(D.V.I., D. Guam, D.N.M.I.) are not in the directory."
)


def _text(cached) -> str:
    return BeautifulSoup(cached.text, "lxml").get_text("\n", strip=True)


def acquire() -> dict:
    """Download + register every source file. Returns {source_id: CachedResponse}."""
    got = {}
    page = fetch(EXPORT_PAGE)
    register_source(LANE, "fjc_export_page", url=EXPORT_PAGE, dataset=DATASET + " (export landing page)",
                    publisher=PUBLISHER, vintage=f"page retrieved {page.meta['retrieved_at'][:10]}", cached=page,
                    notes="Field definitions (nid, Seat ID, Appointment Title, Senior Status Date, termination "
                          "date convention). Links to the CSV files below.")
    got["fjc_export_page"] = page
    links = set(re.findall(r'href="(/sites/default/files/history/[^"]+)"', page.text))
    for sid, url in FILES.items():
        rel = url.replace("https://www.fjc.gov", "")
        if rel not in links:
            raise RuntimeError(f"{url} is no longer linked from the FJC export page")
        r = fetch(url)
        lm = r.meta.get("last_modified") or ""
        register_source(LANE, sid, url=url, dataset=f"{DATASET}: {url.rsplit('/', 1)[-1]}",
                        publisher=PUBLISHER,
                        vintage=f"nightly export; file Last-Modified {lm}" if lm else "nightly export",
                        cached=r,
                        notes={"fjc_federal_judicial_service_csv": "One row per Article III service record "
                               "(relational 'Federal Judicial Service' table). Primary source of this lane.",
                               "fjc_demographics_csv": "Used only for name parts (Last/First/Middle Name, "
                               "Suffix), joined on nid.",
                               "fjc_judges_flat_csv": "Flat file (one row per judge); used only to cross-check "
                               "court names and dates of every service record."}[sid])
        got[sid] = r
    seen = set()
    for did, (url, phrase, _) in LEGHIST.items():
        sid = LEGHIST_SOURCE_ID[did]
        r = fetch(url)
        got[sid] = r
        if sid in seen:
            continue
        seen.add(sid)
        title = re.search(r"<title>([^<|]+)", r.text)
        register_source(LANE, sid, url=url,
                        dataset=(title.group(1).strip() if title else "FJC legislative history page"),
                        publisher=PUBLISHER, vintage=f"page retrieved {r.meta['retrieved_at'][:10]}", cached=r,
                        notes="Used to document (and check) when the district's current court began; see "
                              "docs/lanes/judges.md.")
    return got


def _iso(s: pd.Series) -> pd.Series:
    out = pd.to_datetime(s, format="%Y-%m-%d", errors="raise")
    return out


def load_service(got: dict) -> pd.DataFrame:
    svc = pd.read_csv(got["fjc_federal_judicial_service_csv"].path, dtype=str, keep_default_na=False,
                      na_values=[""])
    demo = pd.read_csv(got["fjc_demographics_csv"].path, dtype=str, keep_default_na=False, na_values=[""])
    flat = pd.read_csv(got["fjc_judges_flat_csv"].path, dtype=str, keep_default_na=False, na_values=[""])
    for c in svc.columns:
        if svc[c].dtype == object or str(svc[c].dtype).startswith("str"):
            svc[c] = svc[c].str.strip()
    # Cross-check every service record against the flat file (same nid, column suffix "(Sequence)").
    fl = flat.set_index("nid")
    mism = []
    for _, r in svc.iterrows():
        k = r["Sequence"]
        f = fl.loc[r["nid"]]
        for c in ["Court Name", "Commission Date", "Senior Status Date", "Termination Date",
                  "Appointing President", "Recess Appointment Date"]:
            a, b = r[c], f.get(f"{c} ({k})")
            b = b.strip() if isinstance(b, str) else b
            if not ((pd.isna(a) and pd.isna(b)) or a == b):
                mism.append((r["nid"], k, c, a, b))
    if mism:
        raise RuntimeError(f"federal-judicial-service.csv disagrees with judges.csv: {mism[:5]}")
    if not demo["nid"].is_unique:
        raise RuntimeError("demographics.csv nid not unique")
    missing = set(svc["nid"]) - set(demo["nid"])
    if missing:
        raise RuntimeError(f"{len(missing)} nids missing from demographics.csv")
    names = demo[["nid", "Last Name", "First Name", "Middle Name", "Suffix"]].copy()
    for c in ["Last Name", "First Name", "Middle Name", "Suffix"]:
        names[c] = names[c].str.strip().replace("", pd.NA)
    svc = svc.merge(names, on="nid", how="left", validate="many_to_one")
    for src in DATE_COLS:
        svc[src] = _iso(svc[src])
    svc["service_start_date"] = svc[["Recess Appointment Date", "Commission Date"]].min(axis=1)
    return svc


def resolve_parties(svc: pd.DataFrame) -> pd.DataFrame:
    """For FJC 'None (reassignment)' / 'None (assignment)' records, take the appointing president and party
    from the judge's prior service record; flag senior status carried over from that record."""
    svc = svc.copy()
    svc["resolved_appointing_president"] = svc["Appointing President"]
    svc["resolved_appointing_party"] = svc["Party of Appointing President"]
    svc["party_resolution"] = "as_given"
    svc["effective_senior_status_date"] = svc["Senior Status Date"]
    svc["senior_status_basis"] = svc["Senior Status Date"].notna().map({True: "fjc_senior_status_date", False: ""})
    by_nid = {nid: g for nid, g in svc.groupby("nid")}

    def predecessors(idx):
        r = svc.loc[idx]
        g = by_nid[r["nid"]].drop(index=idx)
        start = r["service_start_date"]
        if r["Party of Appointing President"] == "None (reassignment)":
            p = g[(g["Termination"] == "Reassignment") & (g["Termination Date"] == start)]
        else:  # assignment: a concurrent record of the same judge that began earlier
            p = g[(g["service_start_date"] <= start) &
                  (g["Termination Date"].isna() | (g["Termination Date"] >= start)) &
                  (~g["Party of Appointing President"].isin(NONE_PARTIES))]
        return svc.loc[p.index]  # current (possibly already resolved) values

    pending = list(svc.index[svc["Party of Appointing President"].isin(NONE_PARTIES)
                             & (svc["Court Type"] == "U.S. District Court")])
    for _ in range(6):  # chains of reassignments
        left = []
        for idx in pending:
            p = predecessors(idx)
            if p.empty:
                left.append(idx)
                continue
            if (p["resolved_appointing_party"].isin(NONE_PARTIES)).any():
                left.append(idx)
                continue
            parties = set(p["resolved_appointing_party"])
            pres = set(p["resolved_appointing_president"])
            if len(parties) != 1 or len(pres) != 1:
                raise RuntimeError(f"ambiguous predecessors for {svc.loc[idx, 'Judge Name']}: {parties} {pres}")
            svc.loc[idx, "resolved_appointing_party"] = parties.pop()
            svc.loc[idx, "resolved_appointing_president"] = pres.pop()
            svc.loc[idx, "party_resolution"] = "from_prior_record_seq_" + ";".join(sorted(p["Sequence"]))
            # senior status carried across a reassignment
            r = svc.loc[idx]
            prior_senior = p["effective_senior_status_date"].dropna()
            if pd.isna(r["Senior Status Date"]) and len(prior_senior) and prior_senior.min() <= r["service_start_date"]:
                svc.loc[idx, "effective_senior_status_date"] = r["service_start_date"]
                svc.loc[idx, "senior_status_basis"] = "senior_before_reassignment"
        if not left or left == pending:
            pending = left
            break
        pending = left
    if pending:
        raise RuntimeError("unresolved None-party records: "
                           + "; ".join(svc.loc[i, "Judge Name"] + " / " + svc.loc[i, "Court Name"] for i in pending))
    # consistency: FJC seat ids ending in 'SR' are senior judges reassigned to a new court
    sr = svc["Seat ID"].fillna("").str.endswith("SR")
    bad = svc[sr & (svc["Court Type"] == "U.S. District Court") & (svc["senior_status_basis"] == "")]
    if not bad.empty:
        raise RuntimeError(f"SR seat without senior status: {bad['Judge Name'].tolist()}")
    return svc


def tidy(svc: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    dc = svc[svc["Court Type"] == "U.S. District Court"].copy()
    mapped = dc["Court Name"].map(lambda n: map_court(n))
    dc["district_id"] = [m[0] for m in mapped]
    dc["court_name_status"] = [m[1] for m in mapped]
    if set(dc["district_id"].dropna()) & TERRITORIAL:
        raise RuntimeError("an Article IV court was mapped")
    floor = dc["district_id"].map(INCARNATION_START)
    dc["before_current_incarnation"] = dc["service_start_date"].notna() & floor.notna() & (
        dc["service_start_date"] < pd.to_datetime(floor))

    def kind(r):
        p = r["Party of Appointing President"]
        if p == "None (reassignment)":
            return "statutory_reassignment"
        if p == "None (assignment)":
            return "statutory_assignment"
        if pd.notna(r["Recess Appointment Date"]):
            return "recess_appointment"
        return "nomination"

    dc["appointment_kind"] = dc.apply(kind, axis=1)
    dc["active_service_end_date"] = dc[["effective_senior_status_date", "Termination Date"]].min(axis=1)
    out = pd.DataFrame({
        "fjc_nid": dc["nid"].astype("int64"),
        "fjc_sequence": dc["Sequence"].astype("int64"),
        "judge_name": dc["Judge Name"],
        "last_name": dc["Last Name"], "first_name": dc["First Name"],
        "middle_name": dc["Middle Name"], "suffix": dc["Suffix"],
        "district_id": dc["district_id"],
        "district_short": dc["district_id"].map(lambda d: BY_ID[d].short if isinstance(d, str) else None),
        "fjc_court_name": dc["Court Name"],
        "court_name_status": dc["court_name_status"],
        "before_current_incarnation": dc["before_current_incarnation"],
        "appointment_title": dc["Appointment Title"],
        "appointing_president": dc["Appointing President"],
        "appointing_party": dc["Party of Appointing President"],
        "reappointing_president": dc["Reappointing President"],
        "reappointing_party": dc["Party of Reappointing President"],
        "appointment_kind": dc["appointment_kind"],
        "resolved_appointing_president": dc["resolved_appointing_president"],
        "resolved_appointing_party": dc["resolved_appointing_party"],
        "party_resolution": dc["party_resolution"],
        "seat_id": dc["Seat ID"],
        "statute_authorizing_new_seat": dc["Statute Authorizing New Seat"],
        "recess_appointment": dc["Recess Appointment Date"].notna(),
        "recess_appointment_date": dc["Recess Appointment Date"],
        "nomination_date": dc["Nomination Date"],
        "confirmation_date": dc["Confirmation Date"],
        "commission_date": dc["Commission Date"],
        "service_start_date": dc["service_start_date"],
        "chief_judge_begin_year": dc["Service as Chief Judge, Begin"],
        "chief_judge_end_year": dc["Service as Chief Judge, End"],
        "chief_judge_2_begin_year": dc["2nd Service as Chief Judge, Begin"],
        "chief_judge_2_end_year": dc["2nd Service as Chief Judge, End"],
        "senior_status_date": dc["Senior Status Date"],
        "effective_senior_status_date": dc["effective_senior_status_date"],
        "senior_status_basis": dc["senior_status_basis"],
        "termination_reason": dc["Termination"],
        "termination_date": dc["Termination Date"],
        "active_service_end_date": dc["active_service_end_date"],
        "duty_station": pd.NA,
        "fjc_biography_url": "https://www.fjc.gov/node/" + dc["nid"],
    })
    for c in ["chief_judge_begin_year", "chief_judge_end_year", "chief_judge_2_begin_year", "chief_judge_2_end_year"]:
        out[c] = pd.to_numeric(out[c], errors="raise").astype("Int64")
    out = out.sort_values(["district_id", "service_start_date", "judge_name", "fjc_sequence"],
                          na_position="last").reset_index(drop=True)
    current = out[out["district_id"].notna()].reset_index(drop=True)
    hist = out[out["district_id"].isna()].reset_index(drop=True)

    # crosswalk table with FJC-observed date ranges
    names = sorted(set(dc["Court Name"]) | set(article3_names()))
    rows = []
    for n in names:
        g = out[out["fjc_court_name"] == n]
        did, status = map_court(n)
        rows.append({
            "fjc_court_name": n, "district_id": did or "", "status": status, "n_records": len(g),
            "first_service_start": g["service_start_date"].min(),
            "last_service_start": g["service_start_date"].max(),
            "last_termination": g["termination_date"].max(),
            "open_records": int(g["termination_date"].isna().sum()),
            "note": note_for(n),
        })
    xwalk = pd.DataFrame(rows)
    return current, hist, xwalk


def snapshots(current: pd.DataFrame, last_year: int) -> tuple[pd.DataFrame, dict]:
    rows = []
    starts = {}
    for d in DISTRICTS:
        if d.id in TERRITORIAL:
            continue
        g = current[(current["district_id"] == d.id) & ~current["before_current_incarnation"]]
        first = g["service_start_date"].min()
        y0 = max(FIRST_SNAPSHOT_YEAR, first.year if first <= pd.Timestamp(first.year, 9, 30) else first.year + 1)
        starts[d.id] = (y0, first)
        names = sorted(set(current.loc[current["district_id"] == d.id, "fjc_court_name"]))
        loc_court = "; ".join(names)
        for y in range(y0, last_year + 1):
            D = pd.Timestamp(y, 9, 30)
            inserv = g[(g["service_start_date"] <= D) & (g["termination_date"].isna() | (g["termination_date"] > D))]
            senior_mask = inserv["effective_senior_status_date"].notna() & (inserv["effective_senior_status_date"] <= D)
            active = inserv[~senior_mask]
            senior = inserv[senior_mask]
            # a judge counted once per status (distinct nid)
            a_ids = set(active["fjc_nid"])
            s_ids = set(senior["fjc_nid"]) - a_ids
            party = active.drop_duplicates("fjc_nid").set_index("fjc_nid")["resolved_appointing_party"]
            dem = int((party == "Democratic").sum())
            rep = int((party == "Republican").sum())
            if dem + rep != len(a_ids):
                raise RuntimeError(f"{d.id} {y}: active judges with other parties: {party.value_counts().to_dict()}")
            base = f"federal-judicial-service.csv; Court Name = {loc_court}; snapshot {D.date()}"
            for var, val, rule in [
                ("judges_active", len(a_ids), "distinct nid, service_start <= date < active_service_end"),
                ("judges_senior", len(s_ids), "distinct nid, effective senior status <= date < termination"),
                ("judges_active_appointed_dem", dem, "judges_active with resolved_appointing_party = Democratic"),
                ("judges_active_appointed_rep", rep, "judges_active with resolved_appointing_party = Republican"),
            ]:
                rows.append({"district_id": d.id, "period": y, "period_type": "SNAPSHOT_SEP30", "variable": var,
                             "value": float(val), "unit": "count",
                             "source_id": "fjc_federal_judicial_service_csv",
                             "source_locator": f"{base}; {rule}"})
    return pd.DataFrame(rows), starts


def check_leghist(got: dict, current: pd.DataFrame) -> list[dict]:
    out = []
    for did, (url, phrase, iso) in LEGHIST.items():
        text = _text(got[LEGHIST_SOURCE_ID[did]])
        if phrase not in text:
            raise RuntimeError(f"{url}: phrase {phrase!r} not found")
        g = current[(current["district_id"] == did) & ~current["before_current_incarnation"]]
        first = g["service_start_date"].min()
        if first < pd.Timestamp(iso):
            raise RuntimeError(f"{did}: FJC service record starts {first.date()} before {iso}")
        out.append({"district_id": did, "fjc_page_date": iso, "first_service_start": str(first.date())})
    return out


def write_tables(current: pd.DataFrame, hist: pd.DataFrame, xwalk: pd.DataFrame) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    date_cols = [c for c in current.columns if c.endswith("_date")]

    def to_csv(df, path):
        d = df.copy()
        for c in date_cols + ["first_service_start", "last_service_start", "last_termination"]:
            if c in d.columns:
                d[c] = d[c].dt.strftime("%Y-%m-%d")
        d.to_csv(path, index=False)

    pq = current.copy()
    for c in date_cols:
        pq[c] = pq[c].dt.date
    pq.to_parquet(OUT / "district_judges.parquet", index=False)
    to_csv(current, OUT / "district_judges.csv")
    to_csv(hist, OUT / "historical_court_service.csv")
    to_csv(xwalk, OUT / "court_crosswalk.csv")


def write_variables() -> None:
    src = ["fjc_federal_judicial_service_csv", "fjc_demographics_csv", "fjc_judges_flat_csv"]
    out = []
    for v in VARIABLES:
        out.append({"id": v["id"], "label": v["label"], "unit": v["unit"], "period_type": "SNAPSHOT_SEP30",
                    "description": v["description"], "source_ids": ["fjc_federal_judicial_service_csv"],
                    "caveats": COMMON_CAVEATS, "higher_means": v["higher_means"], "derived": True,
                    "formula": v["formula"]})
    (OUT / "variables.json").write_text(json.dumps(out, indent=1))


def record_gaps(starts: dict, last_year: int) -> None:
    record_gap(LANE, "duty_station_not_in_fjc_export",
               description="Judges' duty stations (the courthouse/city where each judge sits) are not a field "
                           "in the FJC Biographical Directory export; district_judges.duty_station is empty.",
               variables=["duty_station"], districts="all", periods="all",
               reason="duty station not in FJC export (checked every column of judges.csv, "
                      "federal-judicial-service.csv and demographics.csv)")
    record_gap(LANE, "territorial_courts_not_in_article3_directory",
               description="D.V.I., D. Guam and D.N.M.I. are Article IV courts whose judges serve fixed terms; they "
                           "are not in the FJC Biographical Directory of Article III judges, so there are no judge "
                           "records or judge counts for them.",
               variables=[v["id"] for v in VARIABLES] + ["district_judges"],
               districts=sorted(TERRITORIAL), periods="all",
               reason="out of scope of the FJC Article III directory")
    late = {d: y0 for d, (y0, _) in starts.items() if y0 > FIRST_SNAPSHOT_YEAR}
    for d, y0 in sorted(late.items()):
        record_gap(LANE, f"judge_counts_before_first_article3_judge_{d}",
                   description=f"{BY_ID[d].short}: no Sep 30 judge counts for {FIRST_SNAPSHOT_YEAR}-{y0 - 1}. "
                               f"The court in its current form had no Article III judge in the FJC directory "
                               f"before {starts[d][1].date()} (court created, reorganized, or converted to "
                               f"Article III status later); counts are omitted rather than shown as zero.",
                   variables=[v["id"] for v in VARIABLES], districts=[d],
                   periods=list(range(FIRST_SNAPSHOT_YEAR, y0)),
                   reason="court in its current form did not yet have Article III judges")
    record_gap(LANE, "judge_counts_before_1950",
               description="Sep 30 judge counts are produced from 1950 on. Earlier years would need each court's "
                           "pre-1950 splits, mergers and abolitions curated (e.g. Virginia 1864-1871, Louisiana "
                           "1866-1881, California 1866-1886); district_judges.csv still lists every service record "
                           "back to 1789 for timelines.",
               variables=[v["id"] for v in VARIABLES], districts="all",
               periods=f"1789-{FIRST_SNAPSHOT_YEAR - 1}", reason="scope: court-organization history before 1950 not curated")


def main() -> None:
    got = acquire()
    svc = load_service(got)
    svc = resolve_parties(svc)
    current, hist, xwalk = tidy(svc)
    # every Article III district must have records
    have = set(current["district_id"])
    need = {d.id for d in DISTRICTS if d.id not in TERRITORIAL}
    if have != need:
        raise RuntimeError(f"districts without FJC records: {sorted(need - have)}; extra: {sorted(have - need)}")
    leg = check_leghist(got, current)
    export_date = pd.Timestamp(got["fjc_federal_judicial_service_csv"].meta.get("last_modified")
                               or got["fjc_federal_judicial_service_csv"].meta["retrieved_at"]).tz_localize(None)
    last_year = export_date.year if export_date >= pd.Timestamp(export_date.year, 9, 30) else export_date.year - 1
    obs, starts = snapshots(current, last_year)
    write_tables(current, hist, xwalk)
    write_observations(LANE, obs)
    write_variables()
    record_gaps(starts, last_year)
    summary = {
        "built": date.today().isoformat(),
        "fjc_export_last_modified": str(export_date),
        "service_records_all_courts": int(len(svc)),
        "district_court_records": int(len(current) + len(hist)),
        "records_on_current_districts": int(len(current)),
        "records_on_historical_courts": int(len(hist)),
        "judges_on_current_districts": int(current["fjc_nid"].nunique()),
        "records_without_service_start": current.loc[current["service_start_date"].isna(),
                                                      ["judge_name", "district_id"]].to_dict("records"),
        "party_resolved_records": int((current["party_resolution"] != "as_given").sum()),
        "senior_before_reassignment_records": int((current["senior_status_basis"] == "senior_before_reassignment").sum()),
        "snapshot_years": [FIRST_SNAPSHOT_YEAR, last_year],
        "series_start": {d: y for d, (y, _) in starts.items() if y > FIRST_SNAPSHOT_YEAR},
        "leghist_checks": leg,
        "observation_rows": int(len(obs)),
    }
    (OUT / "build_summary.json").write_text(json.dumps(summary, indent=1, default=str))
    print(json.dumps({k: v for k, v in summary.items() if k != "leghist_checks"}, indent=1, default=str))


if __name__ == "__main__":
    main()
