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

STATUS_PLACEHOLDER

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
page before any district gets extras.

**Rate limit.** The first run sent 50 requests between 06:33 and 06:45 UTC. CourtListener then answered
**HTTP 429 with `Retry-After: 2497`** (about 42 minutes), the end of a one-hour window. The run was stopped and
not retried in a loop. After that:
- each run makes at most **45** new requests (`CASES_RUN_BUDGET`);
- on a 429 that outlasts the fetcher's back-off, a run stops requesting and builds from the cache;
- the remaining districts are filled by later runs, spaced at least an hour apart.

REQUESTS_PLACEHOLDER

## Selection and filtering (`filters.py`)

**Per district.** The build picks, in this order, up to:
1. 2 criminal (`cr`) dockets, newest filed first. A docket number appears only once, even when CourtListener
   holds one docket per defendant.
2. The newest opinion.
3. Civil (`cv`) dockets, newest first, preferring distinct natures of suit, until there are 5 items. At most 4
   are civil.

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

These rules are conservative and mechanical. They will drop some ordinary cases; they are meant never to let a
protected one through. Rejection counts are in `build_summary.json`. For the first 16 districts:

| Rule | Items rejected |
|---|---|
| nature of suit 463 | 80 |
| Social Security | 30 |
| initials-only parties | 12 |
| sensitive caption | 9 |
| no caption | 6 |

## Coverage

COVERAGE_PLACEHOLDER

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

GAPS_PLACEHOLDER
