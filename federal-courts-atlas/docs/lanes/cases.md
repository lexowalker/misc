# Lane report: cases (recent CourtListener items per district)

Each district page links to a few real, recent cases. This lane fetches them from the CourtListener API (Free Law
Project; free tier) and keeps metadata only:
- the case name, court, filing date and docket number;
- the nature of suit and cause, when CourtListener has them;
- the CourtListener link, item type and retrieval time.

Cases are not summarised or characterised.

- **Rebuild:** `PYTHONPATH=. .venv/bin/python -m pipeline.cases.build`. It is resumable: every API response is
  cached under `data/raw/http/www.courtlistener.com/`, so a re-run reuses them and only requests what is still
  missing.
- **Tests:** `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_cases*.py`.
- **Authentication:** the network proxy injects the token into requests sent by `pipeline.common.http.fetch`. The
  token is never printed, logged or stored, and a test checks that no output contains one.

**Status: partial.**
- **87 of 94 districts** have 3–5 items (394 in all).
- **7 districts** (wied, wiwd, wyd, prd, vid, gud, nmid) have none yet. CourtListener's free-tier quota ran out
  first: HTTP 429 with `Retry-After: 69262`, about 19 hours, at 08:57 UTC on 2026-11-27. They are recorded as
  gaps. Re-running the build after the quota resets fills them from where it stopped.

## Outputs

| File | What it holds |
|---|---|
| `data/processed/cases/<district_id>.json` (94 files) | `district_id`, `district_name`, `courtlistener_court` (the CourtListener court record: id, full name, citation string, in_use), `court_confirmed`, `items` (0–5), `queries` (the API URLs used), `queries_not_fetched`, `selection` (the rule, in words), `retrieved_at`. |
| `data/processed/cases/summary.csv` | One row per district: item counts by type, earliest and latest filing dates, newest opinion date, queries used and not fetched, retrieval time. |
| `data/processed/cases/build_summary.json` | Totals: requests made this run, whether the run stopped on a 429, and rejection counts by rule. |
| `data/processed/cases/variables.json` | `[]`: no district statistics. |
| `data/sources/cases.json` | One entry per API response used (URL, retrieval time, sha256). |
| `data/gaps/cases.json` | Districts not fully served (see Gaps). |

**Item fields:**
- `item_type`: `recap_docket` or `opinion`.
- `case_name`, `court`, `court_id`, `date_filed`, `date_terminated` (RECAP), `docket_number`.
- `docket_type`: the case-type letters in the docket number, `cv` or `cr`. It is read from the number itself and
  is not a classification.
- `nature_of_suit`, `cause` (RECAP; often empty for brand-new dockets).
- `url`: an absolute `https://www.courtlistener.com/docket/…` or `/opinion/…` link.
- `courtlistener_id`: the docket id or opinion-cluster id.
- `opinion_status`: opinions only.
- `retrieved_at`, `source_id`.

The web lane copies these into `public/data/cases/<district>.json` (per the data contract).

## Sources and requests

All requests go through `pipeline.common.http.fetch`, which caches responses, throttles to 0.8 s between
requests, and backs off on 429/5xx.

1. **`/api/rest/v4/courts/?jurisdiction=FD`** (7 pages, `fields=` restricted). All 94 registry ids exist as
   CourtListener court ids, including `gud`, `vid` and `nmid`.
2. **Phase 1, one RECAP page per district:**
   `/api/rest/v4/search/?type=r&court=<id>&order_by=dateFiled desc&q=docketNumber:(cv OR cr)`. This returns
   the 20 most recently filed civil or criminal dockets, leaving out petty-offense, magistrate-judge,
   miscellaneous and other docket types.
3. **Phase 2, opinions:** `/api/rest/v4/search/?type=o&court=<id>&order_by=dateFiled desc`. This returns the
   20 newest opinions in CourtListener's case-law collection for the court.
4. **Phase 3, only where phase 1 gave fewer than 2 usable criminal dockets:** the same RECAP search with
   `q=docketNumber:cr`.

Only the first page of each query is read. The phases run in this order so that every district gets its RECAP
page before any district gets extras. Run 1 used an earlier order: all three queries for one district before the
next. That is why the first 15 districts have opinions and the rest do not.

**Rate limit.** After 50 requests between 06:33 and 06:45 UTC (the exploratory ones and run 1), CourtListener
answered **HTTP 429 with `Retry-After: 2497`** (about 42 minutes, the end of a one-hour window). The run was
stopped and not retried in a loop.

After run 3, at about 124 requests for the day, it answered **`Retry-After: 69262`** (about 19 hours): a daily
quota.

Since then:
- each run makes at most **45** new requests (`CASES_RUN_BUDGET`);
- on a 429 that outlasts the fetcher's back-off, a run stops requesting and builds from the cache;
- later runs, after the quota resets, continue where the last one stopped.

**Request ledger, 2026-11-27 UTC**

| When | Requests | Result |
|---|---|---|
| 06:27–06:33 | 4 | Exploratory: court record, opinion and RECAP query shapes. 2 of them were reused by the build. |
| 06:36–06:45 | 46 | Run 1: 7 court pages and 15 districts (with vaed's exploratory pages, 16). Then HTTP 429 with Retry-After 2,497 s; the process was stopped. |
| 07:35–07:45 | 45 | Run 2: phase 1 for 45 more districts. |
| 08:37–08:46 | 26 | Run 3: phase 1 for 26 more districts. Then HTTP 429. |
| 08:51, 08:57 | 2 | Probes of the rate-limit headers, both 429. The second showed `Retry-After: 69262`, a daily quota reached after about 124 requests since 04:18 UTC. |
| 06:46–06:51, 08:46–08:57 | a few | The fetcher's own back-off attempts, all 429, before the stalled runs were stopped. |

In all: **121 successful requests**, plus a handful answered 429. The lane's ceiling was 300.
`data/sources/cases.json` lists the 119 responses the build uses: 7 court pages, 87 RECAP pages, 9
criminal-only RECAP pages and 16 opinion pages.

## Selection and filtering (`filters.py`)

**Per district.** The build picks, in this order, up to:
1. 2 criminal (`cr`) dockets, newest filed first. A docket number appears only once, even when CourtListener
   holds one docket per defendant.
2. The newest opinion.
3. Civil (`cv`) dockets until there are 5 items, at most 4 of them civil. The order is newest first, with
   preferences described below the skip list.

The result depends only on the cached responses, so it is the same on every run.

**Skipped**, so that nothing sealed or identifying a protected party is shown:
- **Captions** that suggest:
  - a sealed matter: "sealed", "under seal", "impounded";
  - a minor or a pseudonymous party: Doe/Roe, minor, juvenile, child, infant, guardian, next friend, o/b/o, on
    behalf of, anonymous, pseudonym;
  - an investigative application: grand jury, search warrant, "search of", "seizure of", pen register, trap
    and trace, tracking, cell phone, "application for/of", "in the matter of";
  - sexual abuse: sexual, abuse, incest, trafficking victim;
  - unknown or unnamed parties.
- **Parties named only by initials** ("A.B. v. Smith", "Smith v. J.D.") or **by first name and last initial**
  ("Robert S. v. …"). These are the forms courts use to protect minors and benefit claimants.
- **Social Security benefit appeals**: captions naming Social Security or a Commissioner (Bisignano, Kijakazi,
  Berryhill, O'Malley, Colvin, Astrue, Dudek), or nature of suit 861–865. These cases turn on claimants' medical
  records.
- **Immigration-detention habeas petitions**: nature of suit 463, "Habeas Corpus – Alien Detainee", or a cause
  under 8 U.S.C. § 1105(a). Their petitioners include asylum seekers.
- **Docket types other than `cv` and `cr`**: `mj`, `po`, `sw`, `gj`, `mc` and others.
- **Civil dockets with no nature of suit yet whose defendant also appears in an immigration-detention petition**
  in any fetched page (e.g. "… v. Blanche"). New dockets often lack a nature of suit, so this catches the same
  kind of petition.
- **Evident source-data errors**: a filing date after the retrieval date, or a docket number whose two-digit year
  disagrees with the filing date. One case: a 1983 New Hampshire docket listed as filed on 2027-09-29.

Within the civil pick, dockets that already carry a nature of suit come first (distinct ones), then dockets
without one, preferring distinct defendants. A brand-new docket cannot be screened by nature of suit, and one
mass-tort wave can fill a page: N.D. Fla.'s newest 20 civil dockets are all against one defendant.

These rules are conservative and mechanical. They will drop some ordinary cases; they are meant never to let a
protected one through. They cannot catch a sensitive case whose caption and metadata give no sign of it.

Rejections over the 87 fetched districts, each item counted once (`build_summary.json`):

| Rule | Items rejected |
|---|---|
| nature of suit 463 (immigration-detention habeas) | 215 |
| Social Security | 118 |
| no nature of suit; defendant named in detention petitions | 54 |
| parties named by initials | 32 |
| sensitive caption | 23 |
| no caption | 4 |
| date error | 1 |

## Coverage

| What | Districts | Notes |
|---|---|---|
| CourtListener court id confirmed | 94 | All registry ids, including gud, vid and nmid. |
| ≥ 3 items | 87 | 49 districts with 5 items, 35 with 4, 3 with 3. |
| RECAP page fetched (phase 1) | 87 | Missing: wied, wiwd, wyd, prd, vid, gud, nmid. |
| Opinion page fetched (phase 2) | 16 | The first 15 districts in registry order (alnd … dcd) and vaed, whose page was fetched while exploring. Their newest usable opinions date from 2017-09-26 to 2026-11-25. Only dcd's is from 2026; the other 15 are from 2017–2019. |
| Criminal-only page fetched where needed (phase 3) | 9 | 52 districts still need it, so they show 0–1 criminal items and more civil ones. |
| Items | | 378 RECAP dockets, filed 2026-11-05 to 2026-11-27, and 16 opinions. By docket type, opinions included: 307 `cv`, 87 `cr`. 84 items carry a nature of suit. |

Retrieved 2026-11-27, 06:36–08:46 UTC. There is one time point and no time series.

## Caveats

- **Not a sample.** The items are the newest filings that pass the filters, not a representative cross-section
  of a court's docket. The filters themselves shift the mix: for example, they remove the immigration-detention
  petitions that dominate many districts' newest civil filings, and they remove Social Security appeals.
- **"Recent" opinions are often old.** For most district courts, the newest opinion in CourtListener's case-law
  collection dates from 2017–2019. RECAP dockets, by contrast, are from the last few days before retrieval. Each
  item's `date_filed` is shown as published.
- **New dockets carry little metadata.** RECAP dockets just created from court RSS feeds often have no nature of
  suit or cause yet; those fields are then `null`.
- **CourtListener quirks:**
  - one case can appear as several dockets with the same number (multi-defendant criminal cases); the build keeps
    one;
  - opinion docket numbers come in free-text forms ("Civil Action No. 1:16-cv-375 (AJT/JFA)").
  `docket_type` is parsed from the number as written.
- **Point in time.** The items reflect CourtListener on the retrieval date. Dockets can later be sealed or
  re-captioned upstream; the links point to CourtListener's live pages.

## Gaps (`data/gaps/cases.json`)

- `not_fetched_rate_limit`, `fewer_than_3_cases`: **wied, wiwd, wyd, prd, vid, gud, nmid** have no items. The API
  quota ran out before their RECAP query (see the request ledger).
- `opinions_not_fetched`: 78 districts have no opinion query yet, so their files list RECAP dockets only.
- `criminal_query_not_fetched`: 52 districts whose first RECAP page held fewer than 2 usable criminal dockets
  have not had the criminal-only follow-up.

**To complete**, run `PYTHONPATH=. .venv/bin/python -m pipeline.cases.build` after the quota resets (about 04:15
UTC on 2026-11-28). Each run:
- makes at most 45 new requests, in the order missing RECAP pages, then opinions, then criminal follow-ups;
- stops cleanly on a 429;
- rewrites every output and this lane's gap fragment from the cache.

About three such runs on separate days would complete every phase.
