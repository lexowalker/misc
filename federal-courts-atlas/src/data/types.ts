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
  /** e.g. "slower", "more work", "longer sentences" — used in legend copy. */
  higher_means?: string;
  years?: number[];
  period_type?: PeriodType;
  description?: string;
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
  [k: string]: unknown;
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
  [k: string]: unknown;
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
  [k: string]: unknown;
}

export interface CasesFile {
  district_id: string;
  retrieved_at?: string;
  source_id?: string;
  items: Case[];
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

/** One normalized search hit, whatever file it came from. */
export interface SearchEntry {
  /** What the reader typed against: "Alexandria, VA", "Fairfax County, VA", "22314", "Albert V. Bryan U.S. Courthouse". */
  label: string;
  kind: 'city' | 'county' | 'zip' | 'courthouse' | 'district' | (string & {});
  district_id: string;
  /** Some ZIPs and cities straddle districts; all candidate districts are kept. */
  district_ids?: string[];
  state?: string;
  detail?: string;
  lat?: number;
  lon?: number;
  /** Lower-cased, accent-folded search key. */
  key: string;
}

export interface SearchIndex {
  entries: SearchEntry[];
  /** Raw files that were found, for diagnostics. */
  files: string[];
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
}
export type SourcesFile = Record<string, SourceRecord>;

export interface DataManifest {
  version?: string;
  build_date?: string;
  files?: Record<string, string>;
  [k: string]: unknown;
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
