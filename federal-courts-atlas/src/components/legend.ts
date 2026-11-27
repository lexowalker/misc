// Quantile legend in the client's style: five swatches from "Lowest" to "Highest",
// break values beneath, and a separate hatched "No data" swatch. Hovering or focusing
// a swatch can highlight that class on the map (onHighlight).

import { h, s } from '../lib/dom.ts';
import { formatTick } from '../lib/format.ts';
import type { Variable } from '../data/types.ts';
import type { QuantileScale } from '../map/scale.ts';
import { STEPS } from '../map/scale.ts';

export interface LegendOptions {
  scale: QuantileScale | null;
  variable?: Pick<Variable, 'unit' | 'format' | 'label' | 'higher_means'> | null;
  /** Show the hatched No-data swatch (default true). */
  showNoData?: boolean;
  /** Footnote under the legend, e.g. how breaks were computed. */
  note?: string;
  onHighlight?: (step: number | null) => void;
  compact?: boolean;
}

let hatchSeq = 0;

/** A small inline SVG swatch with the No-data hatch (pattern defined locally). */
export function noDataSwatch(size = 14): SVGSVGElement {
  hatchSeq += 1;
  const id = `nd-swatch-${hatchSeq}`;
  return s(
    'svg',
    { class: 'legend__nodata', width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
    s('defs', null, hatchPattern(id)),
    s('rect', { x: 0.5, y: 0.5, width: size - 1, height: size - 1, rx: 2, fill: `url(#${id})`, class: 'legend__nodata-rect' }),
  );
}

/** The No-data hatch pattern (also used by the map and thumbnails). */
export function hatchPattern(id: string, spacing = 4): SVGPatternElement {
  return s(
    'pattern',
    { id, width: spacing, height: spacing, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    s('rect', { width: spacing, height: spacing, class: 'hatch-bg' }),
    s('line', { x1: 0, y1: 0, x2: 0, y2: spacing, class: 'hatch-line' }),
  );
}

export function renderLegend(o: LegendOptions): HTMLElement {
  const root = h('div', { class: `legend${o.compact ? ' legend--compact' : ''}` });
  if (!o.scale) {
    root.append(h('p', { class: 'legend__empty caps' }, 'No values to scale'));
    return root;
  }
  const scale = o.scale;
  const steps: number[] = [];
  for (let i = 0; i < STEPS; i++) if (!Number.isNaN(scale.range(i)[0])) steps.push(i);

  const bar = h('div', { class: 'legend__bar', role: 'list', 'aria-label': 'Color key, lowest to highest' });
  for (const i of steps) {
    const [lo, hi] = scale.range(i);
    const label = `${formatTick(lo, o.variable)} to ${formatTick(hi, o.variable)}`;
    const sw = h('span', {
      class: `legend__swatch q${i}`,
      role: 'listitem',
      tabindex: o.onHighlight ? '0' : null,
      'aria-label': `Step ${steps.indexOf(i) + 1} of ${steps.length}: ${label}`,
      title: label,
    });
    if (o.onHighlight) {
      const on = () => o.onHighlight!(i);
      const off = () => o.onHighlight!(null);
      sw.addEventListener('pointerenter', on);
      sw.addEventListener('pointerleave', off);
      sw.addEventListener('focus', on);
      sw.addEventListener('blur', off);
    }
    bar.append(sw);
  }

  // Break values sit under the boundaries between swatches.
  const ticks = h('div', { class: 'legend__ticks', 'aria-hidden': 'true' });
  const n = steps.length;
  steps.forEach((step, k) => {
    if (k === n - 1) return;
    const [, hi] = scale.range(step);
    ticks.append(h('span', { class: 'legend__tick', style: `left:${((k + 1) / n) * 100}%` }, formatTick(hi, o.variable)));
  });

  const scaleBlock = h(
    'div',
    { class: 'legend__scale' },
    h('span', { class: 'legend__end legend__end--lo' }, 'Lowest'),
    h('div', { class: 'legend__track' }, bar, ticks),
    h('span', { class: 'legend__end legend__end--hi' }, 'Highest'),
  );
  root.append(scaleBlock);

  if (o.showNoData !== false) {
    root.append(h('div', { class: 'legend__nd' }, noDataSwatch(), h('span', null, 'No data')));
  }
  if (o.note) root.append(h('p', { class: 'legend__note' }, o.note));
  return root;
}
