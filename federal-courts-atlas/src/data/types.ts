// Types for every file in docs/DATA_CONTRACT.md. Fields marked optional are either
// optional in the contract or not yet pinned down by the producing lane; loaders
// normalize shape variations (array vs. keyed object) so pages see one shape.

import type { Topology, GeometryCollection } from 'topojson-specification';

export type Family = 'speed' | 'workload' | 'sentencing' | 'casemix';

export type PeriodType =
  | 'FY_SEP30'
  | 'CY'
  | '12M_JUN30'
  | '12M_MAR31'
  | '12M_DEC31'
  | 'SNAPSHOT_SEP30'
  | 'JUL1_EST'
  | 'APR1_CENSUS'
  | (string & {});

/** public/data/variables.json entries. */
export interface Variable {
  id: string;
  family: Family;
  label: string;
  short_label?: string;
  unit: string;
  format?: string;
  explainer?: string;
  caveats?: string | string[];
  source_ids: string[];
  derived?: boolean;
  formula?: string | null;
  /** e.g. "slower", "more work", "longer sentences": used in legend copy. */
  higher_means?: string;
  years?: number[];
  period_type?: PeriodType;
  description?: string;
  /* ---- fields emitted by the web lane (pipeline/web); all optional for backwards compatibility ---- */
  /** "asc" when the natural reading order is lowest first (e.g. speed: shortest time first), else "desc". */
  default_rank_direction?: 'asc' | 'desc';
  /** Years with no published cross-check yet (IDB FY 2026); pages label them "preliminary". */
  preliminary_years?: number[];
  /** Producing lane ("fcms", "ussc", "idb", "judges") or "web" for rates computed by the web lane. */
  lane?: string;
  lane_table?: string;
  lane_variable?: string;
  /** For web-derived rates: the lane tables combined. */
  lane_inputs?: Array<{ lane: string; table: string; variable: string }>;
  first_year?: number;
  last_year?: number;
  n_years?: number;
  /** Number of districts with a value in the latest year. */
  districts_latest?: number;
  /** Years in which values are derived when the variable as a whole is not (USSC per-row flags). */
  derived_years?: number[];
  /** Plain-English formula for each derived basis (USSC). */
  formula_by_basis?: Record<string, string>;
  national_available?: boolean;
  values_file?: string;
  /** Curated subset shown first on district profiles. */
  featured?: boolean;
  /** Definitional breaks to annotate on time series. */
  breaks?: Array<{ year: number; note: string }>;
  in_profile_facts?: boolean;
}

export interface Provenance {
  dataset?: string;
  publisher?: string;
  url?: string;
  vintage?: string;
  retrieved_at?: string;
  locator?: string;
  [k: string]: unknown;
}

/** public/data/values/<variable>.json */
export interface ValuesFile {
  variable: string;
  period_type: PeriodType;
  years: number[];
  /** district_id -> year (string key) -> value. Missing = no data. */
  values: Record<string, Record<string, number | null>>;
  provenance?: Record<string, Provenance>;
  /** Optional precomputed ranks; normalized by getRank() whichever nesting is used. */
  ranks?: Record<string, Record<string, number | null>>;
  /** Optional: number of districts ranked per year. */
  ranked_of?: Record<string, number>;
  /* ---- fields emitted by the web lane; optional ---- */
  unit?: string;
  /** Published national figure per year (absent where none is published or it would not be comparable). */
  national?: Record<string, number>;
  national_source_by_year?: Record<string, string>;
  national_note?: string;
  national_derived_years?: number[];
  rank_method?: string;
  /** Default source ids per year; a cell listed in cell_sources uses those instead. */
  source_by_year?: Record<string, string[]>;
  cell_sources?: Record<string, Record<string, string[]>>;
  /** district_id -> year -> caveat text (source-cell caveats, small bases, approximate population). */
  cell_notes?: Record<string, Record<string, string>>;
  /** district_id -> year -> number of cases/people behind a share or median. */
  n_basis?: Record<string, Record<string, number>>;
  /** True when every value is derived; otherwise see derived_years / derived_cells. */
  derived?: boolean;
  formula?: string;
  derived_years?: number[];
  derived_cells?: Record<string, string[]>;
  basis_by_year?: Record<string, string[]>;
  formula_by_basis?: Record<string, string>;
}

/** public/data/districts.json (normalized to a record keyed by id). */
export interface District {
  id: string;
  name: string;
  short: string;
  state: string;
  state_name?: string;
  circuit: string;
  article?: 'III' | 'IV';
  population?: number | Record<string, number> | null;
  population_year?: number;
  population_source_id?: string;
  counties?: Array<string | { geoid: string; name?: string; state?: string }>;
  divisions?: Array<string | { name: string; counties?: string[]; places?: string[] }>;
  courthouse_ids?: string[];
  /* ---- fields emitted by the web lane; optional ---- */
  state_fips?: string;
  population_period_type?: PeriodType;
  population_derived?: boolean;
  population_formula?: string;
  /** True for districts whose county-sum population includes statutory carve-outs (mtd, idd, wyd, ncmd, nced). */
  population_approximate?: boolean;
  population_note?: string;
  population_census_2020?: { value: number; year: number; period_type: PeriodType; source_id: string; derived?: boolean; formula?: string };
  has_statutory_divisions?: boolean;
  places_of_holding_court?: string[];
  statute_sections?: string[];
  partial_counties_included?: Array<{ geoid: string; name: string; portion?: string | null; statute?: string | null }>;
  judgeships?: LatestStat | null;
  judges_active?: LatestStat | null;
  judges_senior?: LatestStat | null;
  judges_note?: string;
  /** Registry-order neighbours (wraps around), for previous/next navigation. */
  prev?: string;
  next?: string;
  [k: string]: unknown;
}

/** A single latest value with its period and source (districts.json). */
export interface LatestStat {
  value: number;
  year: number;
  period_type: PeriodType;
  source_id: string;
  derived?: boolean;
}

/** One judge record (public FJC Biographical Directory fields only; no photos). */
export interface Judge {
  id?: string;
  nid?: string | number;
  name: string;
  district_id: string;
  duty_station?: string | null;
  appointing_president?: string | null;
  party_of_appointing_president?: string | null;
  commission_date?: string | null;
  senior_status_date?: string | null;
  service_end_date?: string | null;
  termination_reason?: string | null;
  /* ---- fields emitted by the web lane; optional ---- */
  /** "Last, First Middle" as the FJC gives it. */
  sort_name?: string;
  /** Typographic initials (first + last name); never a photo. */
  initials?: string;
  /** Party exactly as the FJC gives it, e.g. "None (reassignment)". */
  appointing_party?: string | null;
  /** For statutory reassignments: the appointing president from the judge's earlier FJC record. */
  president_of_record?: string;
  appointment_kind?: 'nomination' | 'recess_appointment' | 'statutory_reassignment' | 'statutory_assignment' | (string & {});
  recess_appointment_date?: string;
  service_start_date?: string;
  effective_senior_status_date?: string;
  active_service_end_date?: string;
  seat_id?: string;
  reassignment?: boolean;
  party_note?: string;
  reappointing_president?: string;
  before_current_incarnation?: boolean;
  [k: string]: unknown;
}

/** public/data/judges/<district>.json (one district; same records as judges.json). */
export interface DistrictJudgesFile {
  district_id: string;
  source_ids: string[];
  note?: string;
  /** e.g. "https://www.fjc.gov/node/{nid}" (FJC text biography). */
  biography_url_template?: string;
  judges: Judge[];
}

/** One CourtListener item for public/data/cases/<district>.json */
export interface Case {
  id?: string | number;
  case_name: string;
  url: string;
  date_filed?: string | null;
  date?: string | null;
  docket_number?: string | null;
  kind?: 'opinion' | 'docket' | (string & {});
  nature_of_suit?: string | null;
  court_id?: string;
  summary?: string | null;
  /* ---- fields emitted by the web lane; optional ---- */
  item_type?: 'recap_docket' | 'opinion' | (string & {});
  docket_type?: string | null;
  date_terminated?: string | null;
  cause?: string | null;
  opinion_status?: string | null;
  source_id?: string;
  [k: string]: unknown;
}

export interface CasesFile {
  district_id: string;
  retrieved_at?: string | null;
  source_id?: string;
  items: Case[];
  /* ---- fields emitted by the web lane; optional ---- */
  district_name?: string;
  /** The selection rule, in words. */
  selection?: string | null;
  source_ids?: string[];
  publisher?: string;
  /** Present when there are no (or few) items: why. */
  note?: string;
}

/** public/data/geo/courthouses.json entries (courthouses lane). */
export interface Courthouse {
  id: string;
  district_id: string;
  city: string;
  state: string;
  name?: string | null;
  address?: string | null;
  lat: number;
  lon: number;
  kind: 'place_of_holding_court' | 'divisional_office' | 'courthouse' | (string & {});
  statute_section?: string | null;
  source_id?: string;
  geocoder?: string;
  geocode_match?: string;
  division?: string | null;
}

/** public/data/sources.json: merged source manifest keyed by source_id. */
export interface SourceRecord {
  lane?: string;
  url: string;
  dataset: string;
  publisher?: string;
  vintage?: string;
  retrieved_at?: string | null;
  sha256?: string | null;
  notes?: string;
  local_path?: string | null;
  /** "series": a citation record grouping the per-file sources in `members`. */
  kind?: 'series' | (string & {});
  members?: string[];
}
export type SourcesFile = Record<string, SourceRecord>;

export interface DataManifest {
  version?: string;
  build_date?: string;
  /** Web lane: path -> {sha256, bytes}. Older drafts used path -> hash string. */
  files?: Record<string, string | { sha256: string; bytes: number }>;
  [k: string]: unknown;
}

/* ---- public/data/profiles/<district>.json (web lane) ------------------------------------------- */

/** One number a profile sentence rests on; re-verifiable against values/<variable>.json. */
export interface ProfileClaim {
  variable: string;
  year: number;
  value: number;
  /** Rank in values/<variable>.json (1 = highest). */
  rank: number;
  ranked_of: number;
  source_ids: string[];
  derived: boolean;
  formula?: string | null;
  /** "high" = among the highest, "low" = among the lowest; null for the size sentence. */
  direction: 'high' | 'low' | null;
  /** 1-3: position from the top (high) or bottom (low); 1 within the circuit for circuit facts. */
  position: number | null;
  scope: 'national' | 'circuit' | 'size';
  tied: boolean;
  circuit?: string;
  circuit_of?: number;
}

export interface ProfileSentence {
  text: string;
  claims: ProfileClaim[];
  /** Period label the sentence opens with, e.g. "FY 2025". */
  lead?: string;
}

export interface KeyStatRow {
  variable: string;
  family: Family;
  featured: boolean;
  year: number;
  period_type: PeriodType;
  value: number | null;
  rank: number | null;
  ranked_of: number | null;
  /** Districts sharing this rank that year (1 = untied); null when there is no value. */
  rank_ties?: number | null;
  national: number | null;
  /** year (string) -> value, every year the district has data. */
  series: Record<string, number>;
  derived: boolean;
  source_ids?: string[];
  note?: string;
  latest_year_with_data?: number | null;
}

export interface MixGroup {
  id: string;
  label: string;
  count: number;
  share: number | null;
  national_count?: number;
  national_share?: number;
}

export interface MixBlock {
  year: number;
  period_type: PeriodType;
  total: number;
  national_total: number | null;
  groups: MixGroup[];
  source_ids: string[];
  source: string;
  basis: string;
  derived: boolean;
  formula: string;
}

export interface SentencingCompositionYear {
  within: number | null;
  above: number | null;
  govt_below: number | null;
  nongovt_below: number | null;
  n: number | null;
  source_ids: string[];
  derived: boolean;
}

export interface SentencingComposition {
  series: Array<{
    scheme: string;
    label: string;
    /** Which values file each share comes from. */
    variables: Record<'within' | 'above' | 'govt_below' | 'nongovt_below', string>;
    years: Record<string, SentencingCompositionYear>;
  }>;
  note: string;
}

export interface DistrictProfile {
  district_id: string;
  name: string;
  short: string;
  circuit: string;
  distinctive: {
    kind: 'outliers' | 'size_and_circuit';
    paragraph: string;
    sentences: ProfileSentence[];
    /** The size-and-circuit sentence, always available. */
    context: { text: string; claims: ProfileClaim[] };
    method: string;
  };
  key_stats: KeyStatRow[];
  case_mix: {
    civil_nature_of_suit?: MixBlock;
    criminal_offense?: MixBlock;
    sentencing_composition: SentencingComposition;
  };
}

export interface DivisionRecord {
  district_id: string;
  name: string;
  /** County names (or GEOIDs when names are absent). */
  counties: string[];
  statute_section?: string;
  places?: string[];
  ordinal?: number;
  /** The statute's own sentence defining the division, when provided. */
  sentence?: string;
}

/** Per-district statutory geography from public/data/geo/divisions.json (boundaries lane). */
export interface DistrictGeography {
  district_id: string;
  name?: string;
  statute_sections: string[];
  has_statutory_divisions: boolean;
  divisions: DivisionRecord[];
  counties: Array<{ geoid: string; name: string }>;
  places_of_holding_court: string[];
  notes?: string | string[];
}

export interface DivisionsFile {
  source?: string;
  source_ids: string[];
  districts: Record<string, DistrictGeography>;
}

export interface DistrictProps {
  name?: string;
  short?: string;
  state?: string;
  circuit?: string;
}
export interface CountyProps {
  name?: string;
  district_id?: string;
}

export type AtlasTopology = Topology<{
  districts: GeometryCollection<DistrictProps>;
  states: GeometryCollection<{ name?: string }>;
  counties?: GeometryCollection<CountyProps>;
}>;

/** Result of a data load: never throws; pages render an empty state for "missing". */
export type Loaded<T> =
  | { status: 'ok'; data: T; url: string }
  | { status: 'missing'; url: string }
  | { status: 'error'; url: string; error: string };
