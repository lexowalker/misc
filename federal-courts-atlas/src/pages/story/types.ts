// Shapes of public/data/stories/<slug>.json and index.json (written by pipeline/stories).

export interface StoryNumber {
  value: number | string;
  unit: string;
  /** Display text, e.g. "15.6 months", "39.3%", "FY 2015", "the District of Hawaii". */
  text: string;
  /** Number without its unit word, e.g. "15.6". */
  bare: string;
  decimals: number | null;
  source_ids: string[];
  how: string;
  derived: boolean;
  formula?: string;
  year?: number;
  headline?: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  /** focus | focus2 | national | context | c2 | c3 */
  role: string;
  values: Array<number | null>;
}

interface ChartBase {
  title?: string;
  unit: string;
  format?: string;
  source_ids: string[];
  derived: boolean;
  formula?: string;
  how?: string;
}

export interface LineChartSpec extends ChartBase {
  kind: 'line';
  x: Array<number | string>;
  x_type?: 'quarter';
  y_min?: number;
  y_max?: number;
  prelim_from?: number | string;
  mark?: string;
  series: LineSeries[];
  band?: { lo: Array<number | null>; hi: Array<number | null>; n?: number[]; label: string };
  band2?: { lo: Array<number | null>; hi: Array<number | null>; label: string };
  derived_x?: number[];
  notes?: Array<{ x: number | string; text: string }>;
  counts?: Array<{ year: number; majority: number; eighty: number }>;
}

export interface RankStripSpec extends ChartBase {
  kind: 'rankstrip';
  x: number[];
  focus: string;
  focus_label: string;
  ranks: number[];
  of: number[];
  leaders: Array<{ year: number; id: string | null }>;
}

export interface BarItem {
  id: string;
  label: string;
  value: number;
  role: string;
}

export interface BarsSpec extends ChartBase {
  kind: 'bars';
  items: BarItem[];
  x_max?: number;
  compact?: boolean;
  reference?: { label: string; value: number };
}

export interface SlopeSpec extends ChartBase {
  kind: 'slope';
  left_label: string;
  right_label: string;
  items: Array<{ id: string; label: string; before: number; after: number; before_n: number; after_n: number }>;
}

export interface StackSpec extends ChartBase {
  kind: 'stack';
  x: number[];
  y_max?: number;
  mark_x?: number;
  layers: Array<{ id: string; label: string; values: Array<number | null> }>;
}

export interface MultiplesSpec extends ChartBase {
  kind: 'multiples';
  x: number[];
  y_min?: number;
  panels: Array<{ id: string; label: string; values: Array<number | null> }>;
  national: { label: string; values: Array<number | null> };
}

export interface DotsSpec extends ChartBase {
  kind: 'dots';
  x_label: string;
  y_label: string;
  x_format?: string;
  y_format?: string;
  items: Array<{ id: string; label: string; x: number; y: number; n: number; role: string }>;
  reference?: { x: number; y: number; label: string };
}

export interface LeadersSpec extends ChartBase {
  kind: 'leaders';
  x: number[];
  leaders: Array<string | null>;
  values: Array<number | null>;
}

export type ChartSpec = LineChartSpec | RankStripSpec | BarsSpec | SlopeSpec | StackSpec | MultiplesSpec | DotsSpec | LeadersSpec;

export interface StoryLayer {
  label: string;
  unit: string;
  format: string;
  period_type: string;
  years: number[];
  values: Record<string, Record<string, number>>;
  source_ids: string[];
  how: string;
  derived: boolean;
  formula?: string;
  higher_means?: string;
  note?: string;
}

export interface SourceProv {
  dataset?: string;
  publisher?: string;
  url?: string;
  vintage?: string;
  retrieved_at?: string;
}

export interface StoryFile {
  slug: string;
  build_date: string;
  numbers: Record<string, StoryNumber>;
  charts: Record<string, ChartSpec>;
  layers: Record<string, StoryLayer>;
  sources: Record<string, SourceProv>;
}

export interface StoryIndexEntry {
  build_date: string;
  numbers: Record<string, StoryNumber>;
  thumb: { label: string | null; unit: string | null; year: number | null; focus: string[]; values: Record<string, number>; source_ids: string[] };
}

export interface StoryIndexFile {
  stories: Record<string, StoryIndexEntry>;
  order: string[];
}
