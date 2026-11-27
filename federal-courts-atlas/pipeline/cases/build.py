"""Build the cases lane: 3-5 recent, real CourtListener items per district.

    PYTHONPATH=. .venv/bin/python -m pipeline.cases.build

Requests (free tier; auth is added by pipeline.common.http.fetch / the network proxy; the token is never
printed or stored). Every response is cached on disk, so a rebuild reuses it and makes no new request.

  1. /api/rest/v4/courts/?jurisdiction=FD  (paginated, 20 per page): confirms each registry id is a
     CourtListener court id.
  2. Phase 1, per district, RECAP dockets newest first:
     /search/?type=r&court=<id>&order_by=dateFiled desc&q=docketNumber:(cv OR cr)
  3. Phase 2, per district, opinions newest first:  /search/?type=o&court=<id>&order_by=dateFiled desc
  4. Phase 3, only where the phase-1 page held fewer than 2 usable criminal dockets:
     /search/?type=r&court=<id>&order_by=dateFiled desc&q=docketNumber:cr
Only the first page (20 results) of each query is read. Each run makes at most RUN_BUDGET (45) new requests:
CourtListener answered HTTP 429 with Retry-After 2,497 s after ~50 requests in an hour, and later with
Retry-After 69,262 s (a daily quota) after ~124 requests in a day. On a 429 that outlasts
the fetcher's back-off (Retry-After honoured, 5 attempts) the run stops requesting and builds from the cache;
a later run continues where it stopped. Nothing is retried in a loop.

Selection per district (deterministic given the cached responses): up to 2 criminal (cr) dockets (distinct
docket numbers) and the newest opinion, then civil (cv) dockets newest first, preferring distinct natures of
suit, up to 5 items; items rejected by ``filters.reject_reason`` are skipped. Districts with fewer than 3
items are recorded as gaps.

Outputs: data/processed/cases/<district_id>.json (94 files), summary.csv, build_summary.json, variables.json ([]),
data/sources/cases.json (one entry per API response used), data/gaps/cases.json.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime, timezone

import pandas as pd

from pipeline.common.districts import BY_ID, DISTRICTS
from pipeline.common.http import FetchError, _cache_paths, _full_url, fetch
from pipeline.common.manifest import DATA, record_gap, register_source

from . import LANE
from .filters import date_problem, defendant, detention_defendants, docket_type, reject_reason

API = "https://www.courtlistener.com/api/rest/v4"
SITE = "https://www.courtlistener.com"
PUBLISHER = "Free Law Project (CourtListener)"
OUT = DATA / "processed" / LANE
MAX_ITEMS, MAX_CRIMINAL, MAX_OPINIONS, MAX_CIVIL = 5, 2, 1, 4
MIN_ITEMS = 3
REQUEST_BUDGET = 300   # whole-lane ceiling (all runs)
# Per-run ceiling on new network requests. On 2026-11-27 CourtListener answered this pipeline with HTTP 429
# twice: after ~50 requests within an hour (Retry-After 2,497 s), and after ~124 requests since 04:18 UTC
# (Retry-After 69,262 s, i.e. a daily quota). A run stops at 45 new requests; later runs continue from the cache.
RUN_BUDGET = int(os.environ.get("CASES_RUN_BUDGET", "45"))

_requests_made = 0
_offline = False
_DETENTION_DEFENDANTS: set[str] = set()   # filled in main() from every cached RECAP page


class NotFetched(Exception):
    """The response is not cached and this run may not (budget) or cannot (429) fetch it."""


def _is_cached(url: str, params: dict) -> bool:
    body, meta = _cache_paths(_full_url(url, params))
    return body.exists() and meta.exists()


def _get(url: str, params: dict, source_id: str, dataset: str, notes: str = ""):
    """Fetch through the cache (new requests only within the run budget), register the response as a source."""
    global _requests_made, _offline
    if not _is_cached(url, params):
        if _offline or _requests_made >= RUN_BUDGET:
            raise NotFetched(source_id)
        _requests_made += 1
        if _requests_made > REQUEST_BUDGET:
            raise RuntimeError("CourtListener request budget exceeded; stopping (no retry loop)")
        try:
            r = fetch(url, params, headers={"Accept": "application/json"})
        except FetchError:
            # The fetcher already backed off (Retry-After honoured, 5 attempts). Stop all further requests.
            _offline = True
            raise NotFetched(source_id)
    else:
        r = fetch(url, params, headers={"Accept": "application/json"})
    register_source(LANE, source_id, url=r.meta["url"], dataset=dataset, publisher=PUBLISHER,
                    vintage=f"retrieved {r.meta['retrieved_at'][:10]}", notes=notes, cached=r)
    return r


def confirm_courts() -> dict[str, dict]:
    """CourtListener court records for the 94 registry ids (id -> record)."""
    found: dict[str, dict] = {}
    params = {"jurisdiction": "FD", "fields": "id,full_name,short_name,citation_string,in_use,end_date,jurisdiction,url"}
    page = 1
    while True:
        p = dict(params, **({"page": str(page)} if page > 1 else {}))
        r = _get(f"{API}/courts/", p, f"cl_courts_fd_p{page}",
                 f"CourtListener API v4 /courts/ (jurisdiction=FD), page {page}",
                 "Confirms that each district id is a CourtListener court id.")
        d = r.json()
        for c in d["results"]:
            found[c["id"]] = c
        if not d.get("next"):
            break
        page += 1
        if page > 20:
            raise RuntimeError("unexpected number of court pages")
    for did in BY_ID:
        if did not in found:
            r = _get(f"{API}/courts/", {"id": did}, f"cl_courts_{did}", f"CourtListener API v4 /courts/?id={did}")
            res = r.json().get("results", [])
            if res:
                found[did] = res[0]
    return {k: v for k, v in found.items() if k in BY_ID}


def _search(did: str, kind: str):
    if kind == "opinions":
        params = {"type": "o", "court": did, "order_by": "dateFiled desc"}
        ds = "CourtListener API v4 search: case-law opinions, newest first"
    elif kind == "recap":
        params = {"type": "r", "court": did, "order_by": "dateFiled desc", "q": "docketNumber:(cv OR cr)"}
        ds = "CourtListener API v4 search: RECAP dockets with cv or cr docket numbers, newest first"
    else:
        params = {"type": "r", "court": did, "order_by": "dateFiled desc", "q": "docketNumber:cr"}
        ds = "CourtListener API v4 search: RECAP dockets with cr docket numbers, newest first"
    sid = f"cl_search_{did}_{kind}"
    r = _get(f"{API}/search/", params, sid, ds, f"First page (20 results) only; court={did}.")
    return r, sid


def _recap_item(x: dict, r, sid: str) -> dict:
    return {
        "item_type": "recap_docket",
        "case_name": x.get("caseName"),
        "court": x.get("court"),
        "court_id": x.get("court_id"),
        "date_filed": x.get("dateFiled"),
        "date_terminated": x.get("dateTerminated"),
        "docket_number": x.get("docketNumber"),
        "docket_type": docket_type(x.get("docketNumber")),
        "nature_of_suit": x.get("suitNature") or None,
        "cause": x.get("cause") or None,
        "url": SITE + x["docket_absolute_url"],
        "courtlistener_id": x.get("docket_id"),
        "retrieved_at": r.meta["retrieved_at"],
        "source_id": sid,
    }


def _opinion_item(x: dict, r, sid: str) -> dict:
    return {
        "item_type": "opinion",
        "case_name": x.get("caseName"),
        "court": x.get("court"),
        "court_id": x.get("court_id"),
        "date_filed": x.get("dateFiled"),
        "date_terminated": None,
        "docket_number": x.get("docketNumber"),
        "docket_type": docket_type(x.get("docketNumber")),
        "nature_of_suit": x.get("suitNature") or None,
        "cause": None,
        "url": SITE + x["absolute_url"],
        "courtlistener_id": x.get("cluster_id"),
        "opinion_status": x.get("status") or None,
        "retrieved_at": r.meta["retrieved_at"],
        "source_id": sid,
    }


def select_recap(did: str, results: list[dict], r, sid: str, want_type: str, limit: int, taken: set,
                 rejected: Counter) -> list[dict]:
    """Pick up to ``limit`` usable dockets of ``want_type`` from one results page."""
    picks, seen_nos = [], set()
    pool = []
    for x in results:
        if x.get("court_id") != did:
            continue
        dt = docket_type(x.get("docketNumber"))
        # Each item is judged (and its rejection counted) in exactly one pass: its own type's, or the civil
        # pass for other docket types.
        if dt != want_type and (dt in ("cv", "cr") or want_type != "cv"):
            continue
        if not x.get("docket_absolute_url") or not x.get("dateFiled"):
            rejected["no url or date"] += 1
            continue
        why = (reject_reason(x.get("caseName"), x.get("docketNumber"), x.get("suitNature"), x.get("cause"))
               or date_problem(x.get("dateFiled"), x.get("docketNumber"), r.meta["retrieved_at"]))
        if (not why and want_type == "cv" and not (x.get("suitNature") or "").strip()
                and defendant(x.get("caseName")) in _DETENTION_DEFENDANTS):
            why = "no nature of suit; defendant also named in immigration-detention petitions"
        if why:
            rejected[why] += 1
            continue
        # The same case can appear as several CourtListener dockets (e.g. one per defendant, same number).
        key = ((x.get("docketNumber") or "").strip().lower(), (x.get("caseName") or "").strip().lower())
        if x.get("docket_id") in taken or key in taken or key in seen_nos:
            continue
        seen_nos.add(key)
        pool.append(x)
    if want_type == "cv":
        # Newest first, but dockets that already carry a nature of suit (distinct ones) before those that do not
        # (a brand-new docket without one cannot be screened by nature of suit), then distinct defendants.
        used_nos: set = set()
        for x in pool:
            nos = (x.get("suitNature") or "").strip()
            if nos and nos not in used_nos:
                picks.append(x)
                used_nos.add(nos)
                if len(picks) == limit:
                    break
        for x in pool:  # then dockets without one, preferring distinct defendants (mass-tort waves repeat one)
            if len(picks) >= limit:
                break
            if (x not in picks and not (x.get("suitNature") or "").strip()
                    and defendant(x.get("caseName")) not in {defendant(y.get("caseName")) for y in picks}):
                picks.append(x)
        for x in pool:
            if len(picks) >= limit:
                break
            if x not in picks:
                picks.append(x)
    else:
        picks = pool[:limit]
    for x in picks:
        taken.add(x.get("docket_id"))
        taken.add(((x.get("docketNumber") or "").strip().lower(), (x.get("caseName") or "").strip().lower()))
    return [_recap_item(x, r, sid) for x in picks]


def _try(did: str, kind: str):
    try:
        return _search(did, kind)
    except NotFetched:
        return None, None


def build_district(did: str, court: dict | None, fetched: dict) -> tuple[dict, Counter]:
    """Select items from whatever responses are cached for this district."""
    rejected: Counter = Counter()
    taken: set = set()
    queries, missing = [], []
    pages = {k: fetched.get((did, k)) for k in ("recap", "recap_cr", "opinions")}
    for k, v in pages.items():
        if v is not None:
            queries.append(v[0].meta["url"])
    criminal: list[dict] = []
    for k in ("recap", "recap_cr"):
        if len(criminal) >= MAX_CRIMINAL:
            break
        if pages[k] is None:
            missing.append(k)  # recap_cr counts as missing only when the first page fell short of 2 criminal
            if k == "recap":
                missing.append("recap_cr")
                break
            continue
        r, sid = pages[k]
        criminal += select_recap(did, r.json().get("results", []), r, sid, "cr", MAX_CRIMINAL - len(criminal),
                                 taken, rejected)
    if pages["opinions"] is None:
        missing.append("opinions")
    opinions = []
    if pages["opinions"]:
        ro, sido = pages["opinions"]
        for x in ro.json().get("results", []):
            if x.get("court_id") != did or not x.get("absolute_url") or not x.get("dateFiled"):
                continue
            why = (reject_reason(x.get("caseName"), x.get("docketNumber"), x.get("suitNature"), None,
                                 require_type=False)
                   or date_problem(x.get("dateFiled"), None, ro.meta["retrieved_at"]))
            if why:
                rejected[why] += 1
                continue
            opinions.append(_opinion_item(x, ro, sido))
            if len(opinions) == MAX_OPINIONS:
                break
    civil = []
    if pages["recap"]:
        r, sid = pages["recap"]
        n_civil = min(MAX_CIVIL, MAX_ITEMS - len(criminal) - len(opinions))
        civil = select_recap(did, r.json().get("results", []), r, sid, "cv", n_civil, taken, rejected)
    items = civil + criminal + opinions
    rec = {
        "district_id": did,
        "district_name": BY_ID[did].name,
        "courtlistener_court": ({k: court.get(k) for k in ("id", "full_name", "short_name", "citation_string",
                                                           "in_use", "end_date")} if court else None),
        "court_confirmed": court is not None,
        "items": items,
        "queries": queries,
        "queries_not_fetched": missing,
        "selection": ("Up to 2 criminal (cr) RECAP dockets and the newest opinion, then civil (cv) RECAP dockets "
                      "(newest filed first; dockets with a recorded nature of suit, distinct natures of suit and "
                      "distinct defendants preferred) up to 5 items in all; sealed, "
                      "minor-party, pseudonymous, initials-only, Social Security and immigration-detention items "
                      "skipped. Metadata only; not a sample of the court's docket."),
        "retrieved_at": max((i["retrieved_at"] for i in items), default=None),
    }
    return rec, rejected


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    gap_path = DATA / "gaps" / f"{LANE}.json"
    if gap_path.exists():  # the gap fragment is rebuilt from scratch each run
        gap_path.unlink()
    courts = confirm_courts()
    missing = [d for d in BY_ID if d not in courts]
    # Phase 1: one RECAP page per district (coverage first). Phase 2: opinions. Phase 3: criminal-only RECAP
    # page where the first page held fewer than 2 usable criminal dockets.
    fetched: dict = {}
    for d in DISTRICTS:
        r, sid = _try(d.id, "recap")
        if r is not None:
            fetched[(d.id, "recap")] = (r, sid)
    for d in DISTRICTS:
        r, sid = _try(d.id, "opinions")
        if r is not None:
            fetched[(d.id, "opinions")] = (r, sid)
    for d in DISTRICTS:
        if (d.id, "recap") not in fetched:
            continue
        r, sid = fetched[(d.id, "recap")]
        n_cr = len(select_recap(d.id, r.json().get("results", []), r, sid, "cr", MAX_CRIMINAL, set(), Counter()))
        if n_cr < MAX_CRIMINAL:
            r2, sid2 = _try(d.id, "recap_cr")
            if r2 is not None:
                fetched[(d.id, "recap_cr")] = (r2, sid2)
    for (did, kind), (r, _) in fetched.items():
        if kind.startswith("recap"):
            _DETENTION_DEFENDANTS.update(detention_defendants(r.json().get("results", [])))
    rows, rej_total = [], Counter()
    gap_d, unfetched = [], []
    for d in DISTRICTS:
        rec, rej = build_district(d.id, courts.get(d.id), fetched)
        rej_total.update(rej)
        (OUT / f"{d.id}.json").write_text(json.dumps(rec, indent=1, ensure_ascii=False) + "\n")
        its = rec["items"]
        dates = sorted(i["date_filed"] for i in its if i["date_filed"])
        rows.append({
            "district_id": d.id, "court_confirmed": rec["court_confirmed"], "n_items": len(its),
            "n_recap_civil": sum(i["item_type"] == "recap_docket" and i["docket_type"] == "cv" for i in its),
            "n_recap_criminal": sum(i["item_type"] == "recap_docket" and i["docket_type"] == "cr" for i in its),
            "n_opinions": sum(i["item_type"] == "opinion" for i in its),
            "earliest_date_filed": dates[0] if dates else "", "latest_date_filed": dates[-1] if dates else "",
            "latest_opinion_date": max((i["date_filed"] for i in its if i["item_type"] == "opinion"), default=""),
            "n_queries": len(rec["queries"]), "queries_not_fetched": ";".join(rec["queries_not_fetched"]),
            "retrieved_at": rec["retrieved_at"] or "",
        })
        if "recap" in rec["queries_not_fetched"]:
            unfetched.append(d.id)
        if len(its) < MIN_ITEMS:
            gap_d.append(d.id)
    summary = pd.DataFrame(rows)
    summary.to_csv(OUT / "summary.csv", index=False)
    if missing:
        record_gap(LANE, "courtlistener_court_ids_missing", description="Registry ids not found as CourtListener courts.",
                   districts=missing, reason="Not returned by /api/rest/v4/courts/.")
    if unfetched:
        record_gap(LANE, "not_fetched_rate_limit",
                   description="Districts whose RECAP query has not been fetched: CourtListener's free-tier quota "
                               "was exhausted (HTTP 429 with Retry-After 2,497 s after ~50 requests in an hour, then "
                               "Retry-After 69,262 s after ~124 requests in a day, on 2026-11-27). Re-run "
                               "`python -m pipeline.cases.build` after the quota resets; cached responses are reused "
                               f"and each run makes at most {RUN_BUDGET} new requests, coverage first.",
                   districts=unfetched, reason="API rate limit (free tier); backed off, not retried in a loop.")
    if gap_d:
        record_gap(LANE, "fewer_than_3_cases",
                   description="Districts with fewer than 3 usable recent CourtListener items.",
                   districts=gap_d,
                   reason="Not fetched yet (rate limit), or only the first page (20 results) of each query is read "
                          "and the rest were filtered out (sealed/sensitive or not civil/criminal).")
    no_op = summary.loc[(summary.n_opinions == 0) & ~summary.queries_not_fetched.str.contains("opinions"),
                        "district_id"].tolist()
    if no_op:
        record_gap(LANE, "no_usable_opinion",
                   description="Districts where the newest page of CourtListener opinions had no usable opinion.",
                   districts=no_op, reason="No opinions indexed for the court, or all 20 newest were filtered out.")
    no_op_fetch = summary.loc[summary.queries_not_fetched.str.contains("opinions"), "district_id"].tolist()
    if no_op_fetch:
        record_gap(LANE, "opinions_not_fetched",
                   description="Districts whose opinion query has not been fetched (API quota); their files list "
                               "RECAP dockets only.", districts=no_op_fetch,
                   reason="API rate limit; re-run the build after the quota resets.")
    no_cr_fetch = summary.loc[summary.queries_not_fetched.str.contains("recap_cr")
                              & ~summary.queries_not_fetched.str.contains("recap;"), "district_id"].tolist()
    no_cr_fetch = [d for d in no_cr_fetch if d not in unfetched]
    if no_cr_fetch:
        record_gap(LANE, "criminal_query_not_fetched",
                   description="Districts whose first RECAP page held fewer than 2 usable criminal dockets and whose "
                               "criminal-only follow-up query has not been fetched (API quota); they show fewer "
                               "criminal items and more civil ones.", districts=no_cr_fetch,
                   reason="API rate limit; re-run the build after the quota resets.")
    (OUT / "variables.json").write_text("[]\n")  # case metadata only; no district statistics
    srcs = json.loads((DATA / "sources" / f"{LANE}.json").read_text())
    (OUT / "build_summary.json").write_text(json.dumps({
        "districts": len(rows), "courts_confirmed": int(summary.court_confirmed.sum()),
        "items": int(summary.n_items.sum()), "districts_lt3": gap_d, "districts_not_fetched": unfetched,
        "network_requests_this_run": _requests_made, "stopped_on_429": _offline,
        "api_responses_used": len(srcs),
        "rejected_counts": dict(rej_total.most_common()),
    }, indent=1) + "\n")
    print(f"cases: {int(summary.n_items.sum())} items, {len(gap_d)} districts < {MIN_ITEMS}, "
          f"{len(unfetched)} not fetched, {_requests_made} network requests this run, stopped_on_429={_offline}")


if __name__ == "__main__":
    main()
