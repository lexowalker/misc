// 5-step quantile classification for the choropleth (and every small multiple).
// Classes are 0..4 (CSS classes .q0-.q4 map them to the theme's ramp); null = No data.

import { quantileSorted } from 'd3-array';
import type { ValuesFile } from '../data/types.ts';
import { getValue } from '../data/loaders.ts';

export const STEPS = 5;

export interface QuantileScale {
  /** Upper bounds of classes 0..3 (class 4 is everything above the last). Unique, ascending. */
  thresholds: number[];
  min: number;
  max: number;
  /** Number of values the breaks were computed from. */
  n: number;
  /** Actual number of classes in use (fewer than 5 when values have many ties). */
  classes: number;
  classOf(v: number | null | undefined): number | null;
  /** Value range covered by class i: [lo, hi]. */
  range(i: number): [number, number];
}

/**
 * Build a quantile scale. With heavy ties, duplicate breaks are dropped, so a variable
 * with few distinct values gets fewer classes rather than misleading empty ones.
 * Classes are then spread across the ramp (e.g. 3 classes -> steps 0, 2, 4).
 */
export function quantileScale(values: Array<number | null | undefined>): QuantileScale | null {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const raw: number[] = [];
  for (let i = 1; i < STEPS; i++) raw.push(quantileSorted(sorted, i / STEPS)!);
  // A break equal to the maximum would leave an empty top class; drop it (and duplicates).
  const thresholds = [...new Set(raw)].filter((t) => t < max);
  const classes = Math.min(STEPS, thresholds.length + 1);
  const spread = (i: number) => (classes === STEPS ? i : Math.round((i * (STEPS - 1)) / Math.max(1, classes - 1)));
  const rawClass = (v: number) => {
    let i = 0;
    while (i < thresholds.length && v > thresholds[i]!) i++;
    return i;
  };
  return {
    thresholds,
    min,
    max,
    n: sorted.length,
    classes,
    classOf(v) {
      if (v === null || v === undefined || !Number.isFinite(v)) return null;
      return spread(rawClass(v));
    },
    range(i) {
      // i is a ramp step; find the raw class that maps to it.
      let rc = -1;
      for (let k = 0; k < classes; k++) if (spread(k) === i) rc = k;
      if (rc < 0) return [NaN, NaN];
      const lo = rc === 0 ? min : thresholds[rc - 1]!;
      const hi = rc >= thresholds.length ? max : thresholds[rc]!;
      return [lo, hi];
    },
  };
}

/** Scale over one year, or pooled over all years so colors compare across years. */
export function scaleForValues(file: ValuesFile, scope: 'year' | 'all', year: number | null): QuantileScale | null {
  const vals: Array<number | null> = [];
  for (const id of Object.keys(file.values)) {
    if (scope === 'year') vals.push(getValue(file, id, year));
    else for (const y of file.years) vals.push(getValue(file, id, y));
  }
  return quantileScale(vals);
}
