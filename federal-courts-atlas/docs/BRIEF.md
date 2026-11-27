# Project: "The Federal Courts Atlas"

ultracode

## Mission

Build an ambitious, beautiful, interactive atlas of the U.S. federal district courts. A curious non-lawyer should be able to spend an hour in it, learning how justice really varies across the country. A lawyer or researcher should trust every number in it.

Plan this as a multi-lane workflow: data acquisition, geometry, analysis, design, writing, and adversarial verification. Run lanes in parallel where they are independent. Verification lanes must check the work of the other lanes.

## Non-negotiable rule: real data only

- **Every number shown must come from a real, cited public source.** Store the source URL, dataset name, vintage/fiscal year, and retrieval date alongside the data.
- **Never invent, estimate, or "fill in" a statistic.** If a value can't be sourced, show "No data" in the UI and record the gap in `DATA_GAPS.md`.
- **Label anything modeled or derived** (per-capita rates, rankings, change over time) as derived, and show its formula on hover.
- **Report patterns, not motives.** Copy must not claim why a court or judge behaves as it does. No judge-level accusations. Keep statistics at the district level unless the data is public at the judge level and the comparison is methodologically sound.

## Data sources (acquire, clean, and version all of these)

1. **District boundaries.** Build all 94 districts from the statutory county lists in 28 U.S.C. §§ 81–131, dissolved from Census TIGER/Line or `us-atlas` county geometry. Handle:
   - Virginia independent cities
   - St. Louis city
   - Connecticut planning regions vs. legacy counties
   - Alaska boroughs
   - Yellowstone National Park (D. Wyo.)

   Test every county in the U.S. for assignment to exactly one district. Include Puerto Rico, Guam, the U.S. Virgin Islands, and the Northern Mariana Islands as insets. Use AlbersUSA plus insets.
2. **Federal Court Management Statistics** (uscourts.gov). Pull by district and year, as far back as available:
   - filings and terminations
   - median time to disposition (civil and criminal)
   - median time to civil trial
   - weighted filings per judgeship
   - vacancy months
   - three-year-old civil cases
3. **Federal Judicial Center Integrated Database (IDB).** Use the case-level civil and criminal data for nature-of-suit mix, disposition types, trial rates, pro se rates, and patent (NOS 830) filings by district over time.
4. **U.S. Sentencing Commission** datafiles and statistical information packets, by district and fiscal year:
   - sentence relative to guideline range (within, above, government-sponsored below, non-government-sponsored below)
   - average and median sentence
   - offense mix
   - substantial-assistance (§5K1.1) rates
5. **FJC Biographical Directory of Article III Judges.** List every district judge with:
   - court and duty station
   - appointing president
   - commission date
   - senior status and service end

   Use this for "the bench over time" visuals. Do not download or display photographs of judges; use typographic initials.
6. **Courthouse locations.** Geocode every place of holding court and every divisional office from uscourts.gov court locator data.
7. **CourtListener API** (token in env var `COURTLISTENER_API_TOKEN`). Use it for live example opinions and dockets per district, so each district page links to real recent cases. Respect rate limits and cache responses.
8. **Census population** by county, aggregated to districts, for per-capita normalization.

Write the pipeline in Python. It must be reproducible: `make data` rebuilds everything from scratch into versioned JSON/Parquet in `/data`, with a `SOURCES.md` manifest.

## The experience

Build a static site with Vite + TypeScript. Use D3 and/or MapLibre or deck.gl as you judge best. It must run with `npm run dev` and build to a static `dist/`.

1. **The map (home).** A national choropleth of the 94 districts in the style I've chosen:
   - 5-step blue quantile scale (pale periwinkle to deep navy)
   - "Lowest" and "Highest" legend
   - thin white district borders, slightly heavier state borders
   - clean white or very light background
   - navy rounded-square home, +, and − buttons stacked bottom-right

   Smooth zoom and pan, including pinch on mobile. Courthouse cities appear as small dots, with labels revealed on zoom. Hover shows a compact tooltip; click opens the district.
2. **Variable switcher.** At least 15 variables, grouped into four families: Speed, Workload, Sentencing, Case mix. A strip of small-multiple thumbnail maps doubles as the switcher. Each variable has a plain-English explainer, its source, and its caveats.
3. **Time machine.** A year slider and play button that animate any variable across all available years. Add annotations for landmark events: *Booker* (2005), the First Step Act (2018), the *TC Heartland* venue decision (2017), and COVID (2020).
4. **District profile pages.** Each district gets a magazine-quality page:
   - a hero locator map
   - its counties, divisions, and courthouses
   - key stats with rank and trend sparklines
   - the bench over time: a timeline of every judge, colored by appointing president's party, with senior-status bands
   - its case mix
   - 3–5 recent real cases from CourtListener
   - an auto-generated but fact-checked "what makes this district distinctive" paragraph, built only from its outlier statistics
5. **Compare mode.** Pick any two to four districts and see side-by-side stats, charts, and their map shapes.
6. **Guided stories.** Write four to six scrollytelling essays, each grounded only in the atlas's own data, where the map animates as you scroll. Candidates:
   - "The Rocket Docket" (E.D. Va. speed)
   - "How Texas Became the Patent Capital, and What Happened After *TC Heartland*"
   - "The Border Districts" (immigration caseloads)
   - "After *Booker*: How Far Judges Stray from the Guidelines"
   - "Where Trials Went" (the vanishing trial)

   Write them like a great newspaper graphics desk: concise, precise, and neutral.
7. **The Courtroom.** A three.js courtroom you can explore. Clicking a seat (bench, jury box, witness stand, prosecution table, defense table, gallery, clerk, court reporter) moves the camera to that seat's point of view. A panel then shows real atlas data relevant to that seat for the currently selected district.
8. **Learn layer.** Every legal term (guideline range, §5K1.1, nature of suit, senior status, weighted filings) gets a glossary tooltip. There is also a "How federal courts work" primer page with a diagram of the district → circuit → Supreme Court structure and of a criminal case's life cycle.
9. **Search.** Search by city, county, ZIP code, or courthouse to find "your federal court."

## Quality bar

- **Design.** Typography and spacing on par with the NYT or ProPublica graphics desks. Use one coherent design system (tokens for color, type, and spacing). Support light and dark modes, with the dark mode designed deliberately rather than inverted.
- **Mobile.** Mobile-first and touch-friendly. Every view must work at 375px wide.
- **Accessibility.** Keyboard navigable, with ARIA labels on map regions, colorblind-safe scales, and a table view for every map.
- **Performance.** First map paint in under 2 seconds on a typical laptop; topology simplified appropriately for each zoom level.
- **Testing.**
  - Unit tests for the data pipeline, including the county→district assignment and source-total reconciliation.
  - Playwright screenshot tests at desktop and mobile widths for every page type.

## Verification (run as separate adversarial lanes)

- **Data audit.** For a random sample of at least 50 displayed numbers, trace each back to its source file and confirm it matches. Log the results in `VERIFICATION.md`.
- **Boundary audit.** Spot-check 30 counties across 20 multi-district states against the statute text.
- **Copy audit.** Check every sentence in the stories and profiles for factual support in the data. Strike anything unsupported.
- **UI audit.** Review screenshots of every page at both widths. Fix overlaps, clipped labels, and empty states.

## Spending cap: hard limit of $50 total, target $0

Every source listed above is free. The whole project should cost nothing beyond my Claude plan. Rules:

- **No paid services without a ledger.** Before any call that could cost money, add an entry to `SPEND.md` with the service, the expected cost, and a running total. If the running total would pass **$50**, stop that work and record it in `PROGRESS.md` instead.
- **Banned outright:**
  - PACER downloads; RECAP via CourtListener is free, so use that instead
  - TRAC and other subscription data
  - Google Maps, Mapbox, or any paid geocoding or tile service. Use the free U.S. Census Geocoder, Nominatim (at most 1 request per second, cached), or self-hosted vector tiles / plain GeoJSON.
  - Any paid cloud hosting or deployment
- **No LLM API calls from the pipeline.** Scripts must not call the Anthropic, OpenAI, or any other paid model API (e.g., to classify docket text). Do that reasoning yourself inside this Claude Code session, or skip it.
- **Do not create accounts, enter payment details, or accept paid tiers or trials** on any site.
- **Respect free-tier limits** (CourtListener, Census, Nominatim). Cache every response to disk so nothing is fetched twice, and back off on rate-limit errors instead of retrying in a loop.
- At the end, `SPEND.md` must state the total spent, which should be $0.

## How to work overnight

- Commit to git at each milestone with clear messages. Do not push to any remote or deploy anywhere.
- Keep `PROGRESS.md` updated with what's done, what's in progress, and what's blocked, so I can read it in the morning.
- I'm on a usage-capped plan, so be purposeful with agent fan-out. Prefer fewer, well-scoped agents over sprawling ones, and don't re-download data you already have.
- If you hit a usage limit or a blocked source, record it in `PROGRESS.md` and continue with whatever else can proceed.
- If a source requires a login or payment (e.g., TRAC, PACER fees), skip it and note it in `DATA_GAPS.md`. Never pay for anything.
- Priority order if time runs short:
  1. accurate boundaries and the core map
  2. FCMS and USSC variables
  3. district profiles
  4. time machine
  5. stories
  6. compare
  7. courtroom
  8. everything else

## Definition of done

`npm run dev` opens the atlas. All 94 districts render correctly. At least 15 variables are sourced and switchable, with at least 10 years of history where available. Every district has a profile page, at least four stories are written and verified, and `SOURCES.md`, `VERIFICATION.md`, `DATA_GAPS.md`, and `PROGRESS.md` are complete and honest.
