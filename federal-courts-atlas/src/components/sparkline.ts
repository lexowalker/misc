// Sparkline with min / max / latest marks. Gaps (missing years) break the line
// rather than being bridged, so a missing value never looks like a real one.

import { s, h } from '../lib/dom.ts';
import { formatTick, periodLabel } from '../lib/format.ts';
import type { Variable } from '../data/types.ts';

export interface SparklineOptions {
  /** [year, value|null] pairs in ascending year order. */
  points: Array<[number, number | null]>;
  variable?: Pick<Variable, 'unit' | 'format' | 'label'> | null;
  periodType?: string;
  width?: number;
  height?: number;
  /** Label the latest value at the right end (default true). */
  labelLatest?: boolean;
}

export function renderSparkline(o: SparklineOptions): HTMLElement {
  const W = o.width ?? 132;
  const H = o.height ?? 36;
  const padX = 3;
  const padY = 5;
  const valid = o.points.filter((p): p is [number, number] => p[1] !== null && Number.isFinite(p[1]));
  const wrap = h('span', { class: 'sparkline' });
  if (valid.length < 2) {
    wrap.append(h('span', { class: 'sparkline__empty' }, valid.length ? 'One year of data' : 'No data'));
    return wrap;
  }
  const years = o.points.map((p) => p[0]);
  const y0 = Math.min(...years);
  const y1 = Math.max(...years);
  const vals = valid.map((p) => p[1]);
  const vmin = Math.min(...vals);
  const vmax = Math.max(...vals);
  const x = (yr: number) => padX + ((yr - y0) / Math.max(1, y1 - y0)) * (W - 2 * padX);
  const y = (v: number) => (vmax === vmin ? H / 2 : padY + (1 - (v - vmin) / (vmax - vmin)) * (H - 2 * padY));
  let d = '';
  let pen = false;
  for (const [yr, v] of o.points) {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x(yr).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  }
  const minP = valid.find((p) => p[1] === vmin)!;
  const maxP = valid.find((p) => p[1] === vmax)!;
  const last = valid[valid.length - 1]!;
  const first = valid[0]!;
  const label = `${o.variable?.label ?? 'Trend'}: ${formatTick(first[1], o.variable)} in ${periodLabel(first[0], o.periodType)} to ${formatTick(last[1], o.variable)} in ${periodLabel(last[0], o.periodType)}; low ${formatTick(vmin, o.variable)} (${minP[0]}), high ${formatTick(vmax, o.variable)} (${maxP[0]}).`;
  const svg = s(
    'svg',
    { class: 'sparkline__svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
    s('path', { class: 'sparkline__line', d }),
    s('circle', { class: 'sparkline__mark sparkline__mark--min', cx: x(minP[0]), cy: y(minP[1]), r: 2 }),
    s('circle', { class: 'sparkline__mark sparkline__mark--max', cx: x(maxP[0]), cy: y(maxP[1]), r: 2 }),
    s('circle', { class: 'sparkline__mark sparkline__mark--latest', cx: x(last[0]), cy: y(last[1]), r: 2.75 }),
  );
  wrap.append(svg);
  if (o.labelLatest !== false) wrap.append(h('span', { class: 'sparkline__latest num' }, formatTick(last[1], o.variable)));
  return wrap;
}
