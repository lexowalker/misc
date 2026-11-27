## Cross-cutting gaps (read these first)

Hand-written overview, last checked 2026-11-27. Each item points to the lane report that has the detail. The
per-lane records below are generated from `data/gaps/*.json` and are the authoritative list.

- **CourtListener quota.** The free tier answered HTTP 429 after about 50 requests in an hour and about 124 in a
  day (Retry-After 69,262 s on 2026-11-27). Seven districts (wied, wiwd, wyd, prd, vid, gud, nmid) have no recent
  cases yet, and many others lack the opinion or criminal follow-up query. `make cases` reuses every cached
  response and stops after 45 new requests per run by default (`CASES_RUN_BUDGET`); re-run it after the daily
  quota resets (about 04:15 UTC on 2026-11-28). See `docs/lanes/cases.md`.
- **No street addresses or divisional offices.** The uscourts.gov court finder's result pages return HTTP 403
  (Akamai) to the pipeline. Courthouses are therefore placed at city level (statutory places of holding court
  plus the FJC's historic courthouse list), `address` is empty, and no `divisional_office` records exist. See
  `docs/lanes/courthouses.md`.
- **No duty station for judges.** The FJC Biographical Directory export has no duty-station field, so the bench
  lists each judge's court but not the city where the judge sits. See `docs/lanes/judges.md`.
- **Territories have no annual population estimates.** The Census Bureau's estimates program does not cover Guam,
  the Virgin Islands or the Northern Mariana Islands. Only the 2000, 2010 and 2020 census counts exist. The
  per-resident rates use annual estimates, so they show No data for those three districts in every year. See
  `docs/lanes/population.md`.
- **IDB FY 2026 is preliminary.** The FJC posted files through September 30, 2026 on November 24, 2026. The AO has
  not yet published its FY 2026 tables, so these values have no published cross-check. The site labels FY 2026
  "(preliminary)" wherever it shows it. See `docs/lanes/idb.md`.
- **FCMS method breaks.** From March 2012 the AO counts criminal defendants rather than cases and measures the
  criminal median from the proceeding date. Case weights were revised for use after December 2015, and
  supervised release hearings enter the totals from FY 2002. Affected series carry a break note; ranks compare
  districts within one year only. See `docs/lanes/fcms.md` section 6.
- **USSC grouping changes.** The Sentencing Commission printed the four-way grouping (within, above,
  government-sponsored below, other below) through FY 2017 and changed its classification in FY 2018; the atlas
  rebuilds the grouping from published components for FY 2014 to 2025 and marks it derived. Early-disposition
  (§5K3.1) departures are reported separately only from FY 2006. FY 2004 and FY 2005 are pooled from two part-year
  tables. Offense categories moved from statute of conviction to primary guideline in FY 2018. See
  `docs/lanes/ussc.md`.
- **Mass-tort distortion.** One multidistrict litigation (MDL docket 2885) put about 200,000 product-liability
  cases on N.D. Fla.'s docket in FY 2020, many coded pro se, which also lifts national shares in FY 2020 to 2024.
  In FY 2007 M.D. La. recorded thousands of personal-injury cases as jury verdicts, lifting that year's national
  civil trial rate. These are counted as filed and flagged in caveats, not removed. See `docs/lanes/idb.md`.
