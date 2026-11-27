// Number and text formatting. Values arrive exactly as published (percents as 0-100,
// FCMS medians in months); formatting never rescales them.

import type { Variable } from '../data/types.ts';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
    nfCache.set(key, f);
  }
  return f;
}

/** Decimal places implied by a variable's `format` string (d3-style ".1f", ",.0f", "0.0", "int"). */
export function decimalsFor(variable?: Pick<Variable, 'format' | 'unit'> | null, value?: number): number {
  const f = variable?.format ?? '';
  const m = /\.(\d+)/.exec(f);
  if (m) return Math.min(4, parseInt(m[1]!, 10));
  if (/int|count|^d$|,d/.test(f)) return 0;
  const unit = variable?.unit ?? '';
  if (unit === 'percent' || unit === 'months') return 1;
  if (unit === 'cases' || unit === 'count' || unit === 'persons') return 0;
  if (value !== undefined && Math.abs(value) < 10 && !Number.isInteger(value)) return 1;
  return value !== undefined && Number.isInteger(value) ? 0 : 1;
}

export function formatNumber(value: number, decimals = 0): string {
  return nf(decimals, decimals).format(value);
}

const UNIT_SUFFIX: Record<string, [string, string]> = {
  // unit: [singular, plural]
  months: ['month', 'months'],
  days: ['day', 'days'],
  cases: ['case', 'cases'],
  count: ['', ''],
  persons: ['person', 'people'],
  per_judgeship: ['per judgeship', 'per judgeship'],
  per_100k: ['per 100,000 residents', 'per 100,000 residents'],
  per_capita: ['per resident', 'per resident'],
  defendants: ['defendant', 'defendants'],
  judges: ['judge', 'judges'],
  judgeships: ['judgeship', 'judgeships'],
  years: ['year', 'years'],
};

/** "4.2 months", "38.5%", "612 per judgeship". Returns "No data" for missing values. */
export function formatValue(
  value: number | null | undefined,
  variable?: Pick<Variable, 'format' | 'unit'> | null,
  opts: { unit?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  let d = decimalsFor(variable, value);
  // A published fraction is never rounded away: the AO prints shared judgeships as halves (3.5), and a
  // '.0f' format must not turn that into 4. Whole numbers are unaffected.
  if (d === 0 && !Number.isInteger(value)) d = 1;
  const n = formatNumber(value, d);
  const unit = variable?.unit ?? '';
  if (unit === 'percent') return `${n}%`;
  if (unit === 'dollars' || unit === 'usd') return `$${n}`;
  if (opts.unit === false) return n;
  const suffix = UNIT_SUFFIX[unit];
  if (suffix) {
    const word = value === 1 ? suffix[0] : suffix[1];
    return word ? `${n} ${word}` : n;
  }
  return unit ? `${n} ${unit.replace(/_/g, ' ')}` : n;
}

/** Short tick label: no unit words, percent sign kept. */
export function formatTick(value: number, variable?: Pick<Variable, 'format' | 'unit'> | null): string {
  const d = decimalsFor(variable, value);
  const n = formatNumber(value, d);
  return variable?.unit === 'percent' ? `${n}%` : n;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

/** "12th of 94", or "12th of 94 (tied)" when other districts share the rank. */
export function rankText(rank: number | null | undefined, of: number | null | undefined, ties = 1): string | null {
  if (!rank || !of) return null;
  return `${ordinal(rank)} of ${of}${ties > 1 ? ' (tied)' : ''}`;
}

const PERIOD_LABEL: Record<string, (y: number) => string> = {
  FY_SEP30: (y) => `FY ${y}`,
  CY: (y) => `${y}`,
  '12M_JUN30': (y) => `12 months to June 30, ${y}`,
  '12M_MAR31': (y) => `12 months to Mar. 31, ${y}`,
  '12M_DEC31': (y) => `12 months to Dec. 31, ${y}`,
  SNAPSHOT_SEP30: (y) => `as of Sept. 30, ${y}`,
  JUL1_EST: (y) => `July 1, ${y} estimate`,
  APR1_CENSUS: (y) => `${y} Census`,
};

/** Human label for a period, e.g. "FY 2023" (fiscal year ending Sept. 30). */
export function periodLabel(year: number | string, periodType?: string | null): string {
  const y = typeof year === 'string' ? parseInt(year, 10) : year;
  const f = periodType ? PERIOD_LABEL[periodType] : undefined;
  return f ? f(y) : String(year);
}

/** periodLabel plus " (preliminary)" for a year the variable lists in `preliminary_years` (IDB FY 2026). */
export function periodLabelFor(
  variable: Pick<Variable, 'preliminary_years'> | null | undefined,
  year: number | string,
  periodType?: string | null,
): string {
  const y = typeof year === 'string' ? parseInt(year, 10) : year;
  const base = periodLabel(y, periodType);
  return variable?.preliminary_years?.includes(y) ? `${base} (preliminary)` : base;
}

/** Compact year tick label, e.g. "’05" for dense axes. */
export function shortYear(y: number): string {
  return `’${String(y).slice(-2)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
