// Sparkline with min / max / latest marks. Gaps (missing years) break the line
// rather than being bridged, so a missing value never looks like a real one.
//
// Optional (all default off, so existing callers render exactly as before):
// a shared y-domain and x-domain (one scale for every sparkline in a compare row),
// a dashed reference series (e.g. the national figure) and a marked year.

import { s, h } from '../lib/dom.ts';
import { formatTick, periodLabel, periodLabelFor } from '../lib/format.ts';
import type { Variable } from '../data/types.ts';

export interface SparklineOptions {
  /** [year, value|null] pairs in ascending year order. */
  points: Array<[number, number | null]>;
  /** Its preliminary_years, when given, mark those years "(preliminary)" in the accessible label. */
  variable?: (Pick<Variable, 'unit' | 'format' | 'label'> & Partial<Pick<Variable, 'preliminary_years'>>) | null;
  periodType?: string;
  width?: number;
  height?: number;
  /** Label the latest value at the right end (default true). */
  labelLatest?: boolean;
  /** Shared y-domain [min, max], e.g. one scale for every sparkline in a row. Default: this series' own range (plus `reference`, if given). */
  domain?: [number, number] | null;
  /** Shared x-domain [first year, last year]. Default: the first and last year in `points`. */
  xDomain?: [number, number] | null;
  /** A second series drawn as a thin dashed line, e.g. the national figure. Gaps break it too. */
  reference?: Array<[number, number | null]> | null;
  /** Words for the reference line in the accessible label, e.g. "National figure". */
  referenceLabel?: string;
  /** Marks one year with a hairline (and a ring where the series has a value), e.g. the year on show. */
  markYear?: number | null;
  /** Prefix for the accessible label, e.g. a district name. */
  labelPrefix?: string;
}

export function renderSparkline(o: SparklineOptions): HTMLElement {
  const W = o.width ?? 132;
  const H = o.height ?? 36;
  const padX = 3;
  const padY = 5;
  const finite = (p: [number, number | null]): p is [number, number] => p[1] !== null && Number.isFinite(p[1]);
  const valid = o.points.filter(finite);
  const wrap = h('span', { class: 'sparkline' });
  if (valid.length < 2) {
    wrap.append(h('span', { class: 'sparkline__empty' }, valid.length ? 'One year of data' : 'No data'));
    return wrap;
  }
  const ref = (o.reference ?? []).filter(finite);
  const years = o.points.map((p) => p[0]);
  const y0 = o.xDomain ? o.xDomain[0] : Math.min(...years);
  const y1 = o.xDomain ? o.xDomain[1] : Math.max(...years);
  const vals = valid.map((p) => p[1]);
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  const dmin = o.domain ? o.domain[0] : Math.min(vmin, ...ref.map((p) => p[1]));
  const dmax = o.domain ? o.domain[1] : Math.max(vmax, ...ref.map((p) => p[1]));
  const x = (yr: number) => padX + ((yr - y0) / Math.max(1, y1 - y0)) * (W - 2 * padX);
  const y = (v: number) => (dmax === dmin ? H / 2 : padY + (1 - (v - dmin) / (dmax - dmin)) * (H - 2 * padY));
  const pathOf = (pts: Array<[number, number | null]>): string => {
    let d = '';
    let pen = false;
    for (const [yr, v] of pts) {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(yr).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const d = pathOf(o.points);
  const minP = valid.find((p) => p[1] === vmin)!;
  const maxP = valid.find((p) => p[1] === vmax)!;
  const last = valid[valid.length - 1]!;
  const first = valid[0]!;
  let label = `${o.variable?.label ?? 'Trend'}: ${formatTick(first[1], o.variable)} in ${periodLabel(first[0], o.periodType)} to ${formatTick(last[1], o.variable)} in ${periodLabelFor(o.variable, last[0], o.periodType)}; low ${formatTick(vmin, o.variable)} (${minP[0]}), high ${formatTick(vmax, o.variable)} (${maxP[0]}).`;
  if (o.labelPrefix) label = `${o.labelPrefix}. ${label}`;
  if (ref.length && o.referenceLabel) label += ` ${o.referenceLabel} shown as a dashed line.`;
  const svg = s('svg', { class: 'sparkline__svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label });
  if (o.markYear !== undefined && o.markYear !== null && o.markYear >= y0 && o.markYear <= y1) {
    const mx = x(o.markYear).toFixed(1);
    svg.append(s('line', { class: 'sparkline__year', x1: mx, x2: mx, y1: 1, y2: H - 1 }));
  }
  if (ref.length >= 2) svg.append(s('path', { class: 'sparkline__ref', d: pathOf(o.reference!) }));
  svg.append(
    s('path', { class: 'sparkline__line', d }),
    s('circle', { class: 'sparkline__mark sparkline__mark--min', cx: x(minP[0]), cy: y(minP[1]), r: 2 }),
    s('circle', { class: 'sparkline__mark sparkline__mark--max', cx: x(maxP[0]), cy: y(maxP[1]), r: 2 }),
    s('circle', { class: 'sparkline__mark sparkline__mark--latest', cx: x(last[0]), cy: y(last[1]), r: 2.75 }),
  );
  if (o.markYear !== undefined && o.markYear !== null) {
    const hit = valid.find((p) => p[0] === o.markYear);
    if (hit) svg.append(s('circle', { class: 'sparkline__mark sparkline__mark--year', cx: x(hit[0]), cy: y(hit[1]), r: 3.25 }));
  }
  wrap.append(svg);
  if (o.labelLatest !== false) wrap.append(h('span', { class: 'sparkline__latest num' }, formatTick(last[1], o.variable)));
  return wrap;
}
