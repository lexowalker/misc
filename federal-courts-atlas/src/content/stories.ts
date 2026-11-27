// Guided stories: the words. Every number comes from public/data/stories/<slug>.json at runtime.
//
// Template syntax inside prose (titles, deks, step text, captions and method notes):
//   {key}        a number's display text, e.g. "15.6 months" or "FY 2025"
//   {key:bare}   the number without its unit word, e.g. "15.6"
//   {key:year}   the fiscal year the number belongs to, e.g. "FY 2025"
//   {key:word}   a small whole number as a word ("two"); {key:Word} capitalized
//   {ev:id}      a landmark date from src/content/events.ts ("May 22, 2017"); {evy:id} its year
//   [[term|text]] a glossary term; *text* italics
// Step text must not contain a bare digit: tests check that every digit in a rendered step comes from a
// number, an event date or a glossary term (tests/e2e/stories.spec.ts) and that every {key} exists in the
// story's data file (tests/pipeline/test_stories.py).

export interface MapGraphic {
  kind: 'map';
  layer: string;
  year: number;
  /** Districts outlined and labeled. */
  focus?: string[];
  /** Districts to frame (zoom to their combined bounds). */
  zoom?: string[];
}

export interface ChartGraphic {
  kind: 'chart';
  chart: string;
  /** Series, layer, panel or bar ids to emphasize; others recede. */
  highlight?: string[];
  /** Vertical markers on time charts. Labels must not contain digits. */
  marks?: Array<{ x: number | string; label: string }>;
  /** Rank strip only: emphasize the years the focus district was not first. */
  exceptions?: boolean;
  /** Line charts: show only the first n series (others hidden), for step-by-step reveals. */
  only?: string[];
}

export type Graphic = MapGraphic | ChartGraphic;

export interface StoryStep {
  text: string;
  graphic: Graphic;
}

export interface StoryContent {
  slug: string;
  title: string;
  /** Short title for cards and the browser tab. */
  short: string;
  dek: string;
  steps: StoryStep[];
  /** Captions shown under charts, by chart id (no digits). */
  captions?: Record<string, string>;
  method: { intro: string; notes: string[] };
}

export interface StoryMeta {
  slug: string;
  title: string;
  dek: string;
}

const B = ['casd', 'azd', 'nmd', 'txwd', 'txsd'];

export const STORY_CONTENT: StoryContent[] = [
  {
    slug: 'rocket-docket',
    title: 'The Rocket Docket',
    short: 'The Rocket Docket',
    dek: 'Civil cases in the Eastern District of Virginia reach trial faster than almost anywhere else. In {fy_latest}, the median case got there in {vaed_trial_latest}. Across all district courts, the median was {us_trial_latest}.',
    steps: [
      {
        text: 'Lawyers call the Eastern District of Virginia the “rocket docket.” The court’s own statistics show why the name stuck. In {fy_latest}, the median civil case there went from filing to trial in {vaed_trial_latest}. Across all district courts, the median was {us_trial_latest}. Among the {n_trial_latest} districts with a median that year, the Eastern District ranked {rank_latest}.',
        graphic: { kind: 'map', layer: 'civil_trial', year: 2025, focus: ['vaed'] },
      },
      {
        text: 'The gap is not new. In {n_below_half} of the {n_years_trial} years from {fy_first} to {fy_latest}, the court’s median was less than half the national figure. Its fastest year was {vaed_trial_min_year}, at {vaed_trial_min}. Its slowest was {vaed_trial_max_year}, at {vaed_trial_max}.',
        graphic: { kind: 'chart', chart: 'trial_line', highlight: ['vaed'] },
      },
      {
        text: 'The Administrative Office of the U.S. Courts ranks every district on this measure each year. From {fy_rank_first} to {fy_latest}, the Eastern District of Virginia ranked first in {n_first} of {n_rank_years} years. It held the top spot every year from {run1_start} to {run1_end}, and again from {run2_start} to {run2_end}.',
        graphic: { kind: 'chart', chart: 'trial_rank' },
      },
      {
        text: 'In the other years, another court came first: {other1} from {other1_start} to {other1_end}, {other2} in {other2_start} and {other3} in {other3_start}. The Eastern District’s lowest standing was {rank_worst}, in {fy_worst}, when its median rose to {vaed_trial_worst}. That was the first full fiscal year of the COVID-19 pandemic.',
        graphic: { kind: 'chart', chart: 'trial_rank', exceptions: true },
      },
      {
        text: 'Not every district gets a median. The AO computes one only for a district that held at least ten civil trials in the year. In {n_trial_2019:year}, {n_trial_2019} districts qualified. In {n_trial_2020:year}, only {n_trial_2020} did. Hatched districts on the map had no median that year.',
        graphic: { kind: 'map', layer: 'civil_trial', year: 2020, focus: ['vaed'] },
      },
      {
        text: 'Cases that end without a trial move quickly there, too. The court’s median time from filing to disposition was below the national median in all {n_disp_years} years. It ranked among the five fastest districts in {n_disp_top5} of the {n_disp_rank_years} years with a published standing. In {fy_latest}, its median was {vaed_disp_latest}. The national median was {us_disp_latest}.',
        graphic: { kind: 'chart', chart: 'disp_line', highlight: ['vaed'] },
      },
      {
        text: 'On criminal cases the court is quick, but not the quickest. Its median time to resolve a felony case was below the national median in each of the {n_crim_years} years from {fy_crim_first} to {fy_latest}. Its national standing ranged from {crim_rank_best} to {crim_rank_worst}. In {fy_latest}, the fastest district was {fastest_crim_latest}, at {fastest_crim_value}.',
        graphic: { kind: 'chart', chart: 'crim_line', highlight: ['vaed'] },
      },
      {
        text: 'It also completes more trials for its size. Per authorized [[judgeship]], the court finished more trials than the national figure in {n_trials_more} of {n_trials_years} years, and the same number in {fy_trials_equal}. In {fy_latest}, it completed {vaed_trials_latest} trials per judgeship. The national figure was {us_trials_latest}.',
        graphic: { kind: 'chart', chart: 'trials_line', highlight: ['vaed'] },
      },
      {
        text: 'These statistics show how quickly cases move through the court, year after year. They do not show why.',
        graphic: { kind: 'map', layer: 'civil_trial', year: 2025, focus: ['vaed'], zoom: ['vaed', 'vawd', 'mdd', 'dcd', 'ncmd', 'nced'] },
      },
    ],
    captions: {
      trial_line: 'The shaded band spans the fastest and slowest district medians each year.',
      trial_rank: 'Each square is one fiscal year. The number is the Eastern District’s national standing (first = shortest median).',
      crim_line: 'The shaded band spans the fastest and slowest district medians each year.',
    },
    method: {
      intro:
        'All figures come from the Federal Court Management Statistics (FCMS) district profiles published by the Administrative Office of the U.S. Courts, editions for FY 2004 to FY 2025. Values for FY 1999 to FY 2003 come from the earlier columns printed in the FY 2004 edition. Federal fiscal years run from October 1 to September 30.',
      notes: [
        'The AO computes the civil filing-to-trial median only for districts with at least ten civil trials in the year, so the number of districts with a median changes every year. Districts without one show as No data.',
        'Standings are as printed by the AO (first = shortest median). Years before FY 2004 have no printed standing, and none is shown.',
        'Felony times use the FCMS current-method table, which counts defendants and, since March 2012, measures from the proceeding date. It starts in FY 2005.',
        'Trials completed include evidentiary hearings on temporary restraining orders and preliminary injunctions, divided by authorized judgeships. Senior judges also try cases.',
        'The national civil disposition median rose sharply in FY 2024 and FY 2025, years in which one district, N.D. Fla., closed an unusually large number of civil cases (see Where Trials Went). In those years, compare the court’s standing rather than only the national figure.',
        '“Rocket docket” is a nickname. Nothing in this data explains why the court is fast, and nothing here describes any individual judge.',
      ],
    },
  },
  {
    slug: 'patent-capital',
    title: 'How Texas Became the Patent Capital, and What Happened After TC Heartland',
    short: 'The Patent Capital',
    dek: 'Patent suits concentrated in East Texas for a decade. After the Supreme Court’s {evy:tc-heartland} venue ruling, filings shifted to Delaware and then to West Texas. By {txed_2025:year}, the Eastern District of Texas led again, with {txed_2025} cases.',
    steps: [
      {
        text: 'Patent cases are a small part of the federal docket, but a closely watched one. In {us_peak_year}, {us_peak} were filed in federal district courts, the most in any year of a series that begins in {fy_first}. In {us_2025:year}, {us_2025} were filed.',
        graphic: { kind: 'chart', chart: 'national_line' },
      },
      {
        text: 'For years, one district drew far more of them than any other. In {txed_2015:year}, the Eastern District of Texas received {txed_2015} of the {us_2015} patent cases filed nationwide: {txed_share_2015}, its highest share.',
        graphic: { kind: 'map', layer: 'patent_share', year: 2015, focus: ['txed'] },
      },
      {
        text: 'From {txed_lead_first} to {txed_lead_last}, the district had more patent filings than any other in every year except {lead_exc1}, when {lead_exc1_district} led, and {lead_exc2}, when {lead_exc2_district} did.',
        graphic: { kind: 'chart', chart: 'annual_lines', highlight: ['txed'] },
      },
      {
        text: 'On {ev:tc-heartland}, the Supreme Court decided [[tc-heartland|*TC Heartland v. Kraft Foods*]], which narrowed where patent suits against U.S. companies may be filed. In the four full quarters before the decision, the Eastern District of Texas received {txed_before_share} of the nation’s patent cases. In the four full quarters after it, it received {txed_after_share}.',
        graphic: { kind: 'chart', chart: 'quarterly', highlight: ['txed'], marks: [{ x: '2017Q2', label: 'TC Heartland' }] },
      },
      {
        text: 'Delaware moved the other way. The District of Delaware’s share rose from {ded_before_share} to {ded_after_share}. The two California districts with the most patent cases gained too: the Central District went from {cacd_before_share} to {cacd_after_share}, and the Northern District from {cand_before_share} to {cand_after_share}.',
        graphic: { kind: 'chart', chart: 'window_slope', highlight: ['txed', 'ded', 'cacd', 'cand'] },
      },
      {
        text: 'Then came West Texas. The Western District of Texas received {txwd_2017} patent cases in {txwd_2017:year} and {txwd_2021} in {txwd_2021:year}, or {txwd_share_2021} of the national total. It had more than any other district every year from {txwd_lead_first} to {txwd_lead_last}.',
        graphic: { kind: 'chart', chart: 'annual_lines', highlight: ['txwd'] },
      },
      {
        text: 'The Eastern District’s count fell to {txed_low} in {txed_low_year}. Then it climbed back: {txed_2025} cases in {txed_2025:year}, or {txed_share_2025} of the national total, again the most of any district. It has led every year since {txed_back_first}.',
        graphic: { kind: 'chart', chart: 'annual_lines', highlight: ['txed', 'txwd', 'ded'] },
      },
      {
        text: 'Taken together, the four federal districts in Texas received {tx_share_2025} of all patent cases filed in {tx_share_2025:year}, the highest share in the series. Before {tx_pre_cut}, their combined share never exceeded {tx_share_max_pre2005}.',
        graphic: { kind: 'chart', chart: 'texas_share' },
      },
      {
        text: 'These counts record where cases were filed, not why they were filed there. Each count is a case, not a patent: a plaintiff that sues several defendants separately creates several cases.',
        graphic: { kind: 'map', layer: 'patent_share', year: 2025, focus: ['txed', 'txwd', 'ded'] },
      },
    ],
    captions: {
      quarterly: 'Natures of suit 830 and 835 combined, by calendar quarter of filing. Quarters in fiscal year 2026 are preliminary.',
      annual_lines: 'Nature of suit 830, by fiscal year of filing. The last year is preliminary.',
      window_slope: 'Four full calendar quarters on each side of the decision quarter. Natures of suit 830 and 835 combined.',
    },
    method: {
      intro:
        'Counts come from the Federal Judicial Center’s Integrated Database (IDB) civil file, rebuilt by the atlas’s IDB lane. Each case is counted once, in the fiscal year (October to September) or calendar quarter of its filing date. Patent cases are those coded nature of suit 830.',
      notes: [
        'Since June 2017, drug patent cases brought under the abbreviated new drug application process have their own code, 835. The before-and-after comparison around TC Heartland counts codes 830 and 835 together, so both periods measure the same kinds of cases. Yearly figures use code 830, the atlas’s standard patent measure.',
        'The decision quarter, April to June 2017, is left out of both comparison periods.',
        'FY 2026 figures have no published AO table to check them against yet and are marked preliminary.',
        'IDB filing counts were checked against the AO’s published totals of civil filings, but not against a published table of patent cases.',
        'Shares, sums and the leading district in each year are derived by the atlas. Hover a number to see its formula.',
        'The data cannot show why filings moved. This story reports timing only, and it makes no claim about any judge or court order.',
      ],
    },
  },
  {
    slug: 'border-districts',
    title: 'The Border Districts',
    short: 'The Border Districts',
    dek: 'Five districts along the Mexican border handle an outsized share of federal felony cases, most of them immigration cases. In {fy_latest}, they received {fel5_share_2025} of the nation’s felony defendants.',
    steps: [
      {
        text: 'Five federal districts reach the border with Mexico: the Southern District of California, the District of Arizona, the District of New Mexico, and the Western and Southern Districts of Texas. In {fy_latest}, they received {imm5_latest} of the {imm_us_latest} felony immigration defendants charged in federal court, or {imm5_share_latest}.',
        graphic: { kind: 'map', layer: 'imm_share', year: 2025, focus: B },
      },
      {
        text: 'Their share of the nation’s felony immigration cases rose from {imm5_share_first} in {fy_first} to a peak of {imm5_share_peak} in {imm5_share_peak_year}. Their share of all [[felony]] defendants grew too, from {fel5_share_1996} in {fy_first} to {fel5_share_2025} in {fy_latest}.',
        graphic: { kind: 'chart', chart: 'share_lines' },
      },
      {
        text: 'Immigration charges make up most of each district’s felony docket. In {fy_latest}, they ranged from {imm_pct_lo_value} of felony defendants in {imm_pct_lo} to {imm_pct_hi_value} in {imm_pct_hi}. Across all districts, the figure was {us_imm_pct}.',
        graphic: { kind: 'chart', chart: 'imm_bars' },
      },
      {
        text: 'Measured per [[judgeship]], these are the busiest criminal dockets in the country. In {n_top5} of the {n_top5_years} years with a published ranking, the five held the top five places for felony filings per judgeship. In {fy_latest}, {fpj_top} had {fpj_top_value} felony filings per judgeship. The national figure was {us_fpj_latest}.',
        graphic: { kind: 'chart', chart: 'fpj_bars' },
      },
      {
        text: 'They also resolve felony cases quickly. Each of the five had a [[median-time|median time]] from filing to disposition below the national median in every year from {disp_first} to {fy_latest}. The District of New Mexico had the shortest median in the country in {n_nmd_first} of those {n_disp_years} years. In {fy_latest}, its median was {nmd_disp_latest}. The national median was {us_disp_latest}.',
        graphic: { kind: 'chart', chart: 'disp_lines', highlight: ['nmd'] },
      },
      {
        text: 'Few defendants there go to trial. Among the {n_big} districts where at least {plea_base} defendants’ cases ended in {fy_latest}, the five border districts had the five lowest trial rates, from {trial_lo_value} in {trial_lo} to {trial_hi5_value} in {trial_hi5}. Nationally, {us_trial} of defendants went to trial. {n_top_plea:Word} of the five had the {n_top_plea:word} highest guilty-plea shares.',
        graphic: { kind: 'chart', chart: 'plea_dots' },
      },
      {
        text: 'The five also account for nearly all [[5k3-1|early-disposition]] sentences, the reductions offered in fast-track programs. In {fy_latest}, they imposed {k3_5_latest} of the {k3_us_latest} such sentences nationwide, or {k3_5_share_latest}. Their share has been at least {k3_5_min} in every year since {k3_first}.',
        graphic: { kind: 'chart', chart: 'k3_multiples' },
      },
      {
        text: 'Yet the five use them very differently. In {fy_latest}, early-disposition reductions applied to {casd_k3} of sentences in the Southern District of California and {txwd_k3} in the Western District of Texas. In the Western District, the share has not exceeded {txwd_k3_max} in any year since {k3_first}. The data records the outcomes; it does not say why practice differs.',
        graphic: { kind: 'chart', chart: 'k3_multiples', highlight: ['casd', 'txwd'] },
      },
      {
        text: 'Altogether, {sent5_share_2025} of everyone sentenced in federal court in {fy_latest} was sentenced in one of these five districts, up from {sent5_share_2002} in {sent_first}.',
        graphic: { kind: 'map', layer: 'imm_share', year: 2025, focus: B, zoom: B },
      },
    ],
    captions: {
      share_lines: 'Felony defendants filed, by fiscal year. The last year is preliminary.',
      imm_bars: 'Felony defendants filed, by most serious filing charge.',
      fpj_bars: 'Each bar is one district. The five border districts are highlighted.',
      plea_dots: 'Each dot is one district. Border districts are highlighted.',
      k3_multiples: 'The gray line in each panel is the figure for all districts.',
    },
    method: {
      intro:
        'Defendant counts come from the FJC Integrated Database (IDB) criminal file, by fiscal year of filing and most serious charge; the immigration category follows the AO’s offense groupings. Caseload rankings and disposition times come from the FCMS district profiles. Sentencing figures come from the U.S. Sentencing Commission.',
      notes: [
        'Immigration shares here count felony defendants only. Shares across all offense levels are lower where misdemeanor and petty filings are common.',
        'The IDB immigration category matches the AO’s published immigration totals for FY 2005 to FY 2025. Earlier years rely on offense codes the FJC added later, which could not be checked against an AO table.',
        'FCMS counted felony cases in some years and defendants in others. Published rankings compare districts within one year only. Disposition times use the FCMS current-method table.',
        'The Sentencing Commission reports early-disposition (section 5K3.1) departures separately only from FY 2006.',
        'The trial and plea comparison is limited to districts with at least {plea_base} terminated defendants, because smaller districts swing widely from year to year.',
        'Sentence outcomes reflect each district’s mix of cases. The data does not show why practices differ, and none of these figures describes any individual judge.',
        'FY 2026 IDB figures have no AO cross-check yet and are marked preliminary. All five-district totals and shares are derived by the atlas.',
      ],
    },
  },
  {
    slug: 'after-booker',
    title: 'After Booker: How Often Sentences Fall Outside the Guideline Range',
    short: 'After Booker',
    dek: 'Before {evy:booker}, between {pre_min} and {pre_max} of federal sentences each year fell within the guideline range. In {fy_latest}, {within_latest} did, and the share varies far more from one district to the next.',
    steps: [
      {
        text: 'For each federal sentence, the judge first calculates a [[guideline-range|guideline range]] under the Sentencing Guidelines. From {fy_first} to {pre_last}, the share of sentences that fell within that range stayed between {pre_min} and {pre_max}.',
        graphic: { kind: 'chart', chart: 'within_line', only: ['_within'] },
      },
      {
        text: 'In {evy:booker}, the Supreme Court’s decision in [[booker|*United States v. Booker*]] made the Guidelines advisory. The within-range share has not been above {post_max} in any year since {post_first}. It fell to {post_min} in {post_min_year}, then rose to {within_latest} in {fy_latest}.',
        graphic: { kind: 'chart', chart: 'within_line', only: ['_within'], marks: [{ x: 2005, label: 'Booker' }] },
      },
      {
        text: 'The [[ussc|Sentencing Commission]] sorts sentences outside the range into three groups. Since {post_first}, sentences below the range on the government’s motion have been the largest of the three every year: {govt_2006} of all sentences in {govt_2006:year} and {govt_2025} in {govt_2025:year}.',
        graphic: { kind: 'chart', chart: 'split_stack', highlight: ['ussc_pct_govt_sponsored_below_range'] },
      },
      {
        text: 'Sentences below the range without a government motion grew from {nongovt_2006} in {nongovt_2006:year} to a peak of {nongovt_peak} in {nongovt_peak_year}, and stood at {nongovt_2025} in {nongovt_2025:year}. Sentences above the range stayed rare: {above_2025} in {above_2025:year}.',
        graphic: { kind: 'chart', chart: 'split_stack', highlight: ['ussc_pct_non_govt_sponsored_below_range', 'ussc_pct_above_range'] },
      },
      {
        text: 'One kind of government motion has become less common. Sentences reduced for [[5k1-1|substantial assistance]] to prosecutors fell from {k1_1995} of all sentences in {k1_1995:year} to {k1_2025} in {k1_2025:year}.',
        graphic: { kind: 'chart', chart: 'within_line', highlight: ['_k1'] },
      },
      {
        text: 'District by district, the change is starker. In {n_major_2004:year}, {n_major_2004} of the {n_districts} districts sentenced a majority of their cases within the range, and {n_80_2004} kept {eighty} or more within it.',
        graphic: { kind: 'map', layer: 'within', year: 2004 },
      },
      {
        text: 'In {n_major_2025:year}, {n_major_2025} districts did. The low point was {n_major_2023:year}, with {n_major_2023}. No district has kept {eighty} of its sentences within the range in any year from {zero80_since} on.',
        graphic: { kind: 'map', layer: 'within', year: 2025 },
      },
      {
        text: 'Districts have also drifted apart. In {iqr_2004:year}, the middle half of districts spanned {iqr_2004} of within-range share. In {iqr_2025:year}, they spanned {iqr_2025}. The median district went from {median_2004} to {median_2025}.',
        graphic: { kind: 'chart', chart: 'ribbon' },
      },
      {
        text: 'The spread is widest for sentences below the range without a government motion. Among the {n_big} districts with at least {min_base} cases in {fy_latest}, the share ranged from {ng_lo_value} in {ng_lo} to {ng_hi_value} in {ng_hi}. These figures describe the reasons recorded for sentences. They do not measure any judge’s choices, and they do not explain them.',
        graphic: { kind: 'chart', chart: 'nongovt_bars' },
      },
    ],
    captions: {
      within_line: 'Shares of cases with a known guideline range. The two pooled years are derived from half-year tables.',
      split_stack: 'Shares of cases with a known guideline range. From fiscal year 2018 the three outer groups are rebuilt from the Commission’s new method.',
      ribbon: 'The dark band holds the middle half of districts; the light band runs from the lowest district to the highest.',
      nongovt_bars: 'Each bar is one district. The vertical rule marks the figure for all districts.',
    },
    method: {
      intro:
        'Figures come from the U.S. Sentencing Commission: its statistical information packets for FY 1995 to FY 2001 and its individual offender datafiles from FY 2002, processed by the atlas’s USSC lane. Shares are of cases with a known guideline range.',
      notes: [
        'The three groups outside the range exist only from FY 2006. Earlier years have only the within-range and substantial-assistance shares.',
        'FY 2004 and FY 2005 each pool two half-year tables (before and after *Blakely v. Washington* in June 2004, and before and after *Booker* in January 2005), so those values are derived.',
        'The Commission changed how it classifies sentences in FY 2018. From FY 2018, the three outer groups are rebuilt from the new method’s components. In FY 2014 to FY 2017, when both are available, they agree exactly.',
        'Before FY 2003, below-range sentences counted departures only. The PROTECT Act of 2003 and fast-track programs changed what “below the range” contains.',
        'Small districts swing widely from year to year. The district extremes use only districts with at least {min_base} cases.',
        'A sentence outside the range is not an error. The data records the outcome and the reason given on the statement of reasons; it does not show why a sentence was imposed, and it says nothing about any individual judge.',
        'The middle-half spread uses the 25th and 75th percentiles of the 94 district shares (linear interpolation).',
      ],
    },
  },
  {
    slug: 'where-trials-went',
    title: 'Where Trials Went',
    short: 'Where Trials Went',
    dek: 'Federal trials have become rare. Civil cases decided by a trial fell by {civ_drop} from {fy_first} to {fy_latest}. In {fy_latest}, {crim_rate_2025} of criminal defendants went to trial.',
    steps: [
      {
        text: 'In {fy_first}, federal district courts decided {civ_first} civil cases by a jury verdict, a directed verdict or a [[bench-trial|bench trial]]. In {fy_latest}, they decided {civ_latest}, a drop of {civ_drop}.',
        graphic: { kind: 'chart', chart: 'civil_count' },
      },
      {
        text: 'One year breaks the pattern. In {civ_spike:year}, the count jumped to {civ_spike} because the Middle District of Louisiana recorded {spike_trials} of its {spike_terms} civil terminations that year as trials. Without that district, the national count would have been {civ_spike_ex}.',
        graphic: { kind: 'chart', chart: 'civil_count', marks: [{ x: 2007, label: 'M.D. La.' }] },
      },
      {
        text: 'As a share of all civil cases closed, trials fell from {rate_first} in {fy_first} to {rate_latest} in {fy_latest}. Part of the recent drop is arithmetic. In {mass_terms_2025:year}, the Northern District of Florida closed {mass_terms_2025} civil cases, {mass_share_2025} of the national total. Leaving that district out, the rate was {rate_ex_latest}.',
        graphic: { kind: 'chart', chart: 'civil_rate', highlight: ['_national', '_ex'] },
      },
      {
        text: 'Criminal trials have declined too. In {fy_crim_first}, {crim_rate_1996} of criminal defendants whose cases ended went to trial, or {crim_trials_1996} defendants. In {fy_latest}, {crim_rate_2025} did, or {crim_trials_2025}.',
        graphic: { kind: 'chart', chart: 'crim_rate' },
      },
      {
        text: 'Most defendants plead guilty, and the share has grown: from {plea_1996} in {fy_crim_first} to {plea_2025} in {fy_latest}.',
        graphic: { kind: 'chart', chart: 'plea_rate' },
      },
      {
        text: 'In {n_high_1996:year}, {n_high_1996} districts had criminal trial rates of {high_rate} or more. The median district’s rate was {median_1996}.',
        graphic: { kind: 'map', layer: 'crim_trial', year: 1996 },
      },
      {
        text: 'In {n_high_2025:year}, {n_high_2025:word} did. The median district’s rate was {median_2025}.',
        graphic: { kind: 'map', layer: 'crim_trial', year: 2025 },
      },
      {
        text: 'Rates still vary widely. Among the {n_big} districts where at least {base} defendants’ cases ended in {fy_latest}, the trial rate ranged from {big_lo_value} in {big_lo} to {big_hi_value} in {big_hi}. That same year, {hi_dismissed_2025} of {big_hi:bare} defendants’ cases ended in dismissal, against {hi_dismissed_2024} the year before.',
        graphic: { kind: 'chart', chart: 'big_bars' },
      },
      {
        text: 'The courts’ own workload statistics show the same pattern. District courts completed {tpj_first} trials per authorized [[judgeship]] in {fy_tpj_first} and {tpj_latest} in {fy_latest}, with a low of {tpj_low} in {tpj_low_year}. The data shows the decline. It does not show why it happened.',
        graphic: { kind: 'chart', chart: 'tpj_line' },
      },
    ],
    captions: {
      civil_count: 'Civil cases terminated by jury verdict, directed verdict or bench trial, by fiscal year of termination. The last year is preliminary.',
      civil_rate: 'The second line leaves the Northern District of Florida out of both counts. The last year is preliminary.',
      crim_rate: 'Defendants terminated, most serious charge. The last year is preliminary.',
      plea_rate: 'Includes pleas of nolo contendere. The last year is preliminary.',
      big_bars: 'Each bar is one district. The vertical rule marks the rate for all districts.',
    },
    method: {
      intro:
        'Civil and criminal counts come from the FJC Integrated Database (IDB), rebuilt by the atlas’s IDB lane: civil cases by fiscal year of termination, criminal defendants by fiscal year of termination and most serious charge. Trials per judgeship come from the FCMS district profiles.',
      notes: [
        'A civil case counts as decided by trial when its recorded disposition is a jury verdict, a directed verdict or a court (bench) trial.',
        'The IDB counts criminal defendants, not cases.',
        'In FY 2024 and FY 2025, N.D. Fla. closed {mass_terms_2024:bare} and {mass_terms_2025:bare} civil cases, which lowers the national civil trial rate in those years. The second line on the rate chart leaves that district out; it is derived.',
        'FCMS trials completed include evidentiary hearings on temporary restraining orders and preliminary injunctions, divided by authorized judgeships. It is a different measure from the IDB counts.',
        'The district comparison is limited to districts with at least {base} terminated defendants.',
        'FY 2026 IDB figures have no AO cross-check yet and are marked preliminary.',
        'The data shows that trials declined. It does not show why, and it says nothing about any individual judge.',
      ],
    },
  },
];

/** Titles and deks for the index and the router (deks are templates). */
export const STORIES: StoryMeta[] = STORY_CONTENT.map(({ slug, title, dek }) => ({ slug, title, dek }));

export function storyContent(slug: string): StoryContent | undefined {
  return STORY_CONTENT.find((s) => s.slug === slug);
}
