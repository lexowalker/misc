// Story charts: small, dependency-light SVG/HTML charts driven by scroll steps.
// Every chart reads its numbers from the story data file; nothing here holds a statistic.
// Each chart re-renders on resize and on update(state), and exposes a text description.

import { nice as d3nice, ticks as d3ticks } from 'd3-array';
import { h, s, debounce } from '../../lib/dom.ts';
import { formatNumber, formatValue } from '../../lib/format.ts';
import { districtShort } from '../../data/districts.ts';
import { Tooltip } from '../../components/tooltip.ts';
import type { ChartGraphic } from '../../content/stories.ts';
import type {
  BarsSpec,
  ChartSpec,
  DotsSpec,
  LineChartSpec,
  MultiplesSpec,
  RankStripSpec,
  SlopeSpec,
  StackSpec,
} from './types.ts';

export interface ChartView {
  readonly el: HTMLElement;
  update(state: ChartGraphic): void;
  /** One or two sentences for the graphic's accessible name. */
  describe(state: ChartGraphic): string;
  destroy(): void;
}

type XVal = number | string;

/* ---- helpers --------------------------------------------------------------- */

function lin(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

function decimalsOf(fmt?: string): number {
  const m = /\.(\d+)/.exec(fmt ?? '');
  return m ? parseInt(m[1]!, 10) : 0;
}

/** Value with unit for tooltips and labels: "15.6 months", "39.3%", "2,184 cases". */
function fmtVal(v: number | null | undefined, unit: string, fmt?: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'No data';
  return formatValue(v, { unit, format: fmt ?? (unit === 'percent' ? '.1f' : '.0f') });
}

/** Short value for direct labels: no unit words, percent sign kept. */
function fmtShort(v: number, unit: string, fmt?: string): string {
  const n = formatNumber(v, decimalsOf(fmt));
  return unit === 'percent' ? `${n}%` : n;
}

function tickFmt(v: number, step: number, unit: string): string {
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const n = formatNumber(v, d);
  return unit === 'percent' ? `${n}%` : n;
}

function xLabel(x: XVal, short = false): string {
  if (typeof x === 'string' && /Q\d$/.test(x)) {
    const [y, q] = x.split('Q');
    return short ? `${y}` : `Q${q} ${y}`;
  }
  return short ? `’${String(x).slice(-2)}` : `FY ${x}`;
}

function roleClass(role: string): string {
  switch (role) {
    case 'focus':
    case 'c1':
      return 'ch-c1';
    case 'c2':
      return 'ch-c2';
    case 'c3':
      return 'ch-c3';
    case 'focus2':
      return 'ch-focus2';
    case 'national':
      return 'ch-national';
    default:
      return 'ch-context';
  }
}

/** Greedy word wrap to at most `max` characters per line. */
function wrapWords(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

/** Spread label y positions so none are closer than `gap` (simple relaxation). */
function spread(items: Array<{ y: number }>, gap: number, lo: number, hi: number): void {
  items.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const d = items[i]!.y - items[i - 1]!.y;
      if (d < gap) {
        const push = (gap - d) / 2;
        items[i - 1]!.y -= push;
        items[i]!.y += push;
        moved = true;
      }
    }
    for (const it of items) it.y = Math.max(lo, Math.min(hi, it.y));
    if (!moved) break;
  }
}

function pathFor(xs: number[], ys: Array<number | null>): string {
  let d = '';
  let pen = false;
  ys.forEach((y, i) => {
    if (y === null || !Number.isFinite(y)) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${xs[i]!.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

function areaFor(xs: number[], lo: Array<number | null>, hi: Array<number | null>): string {
  // Contiguous runs only.
  let d = '';
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      d += `M${run.map((i) => `${xs[i]!.toFixed(1)},${hi[i]!.toFixed(1)}`).join('L')}`;
      d += `L${[...run].reverse().map((i) => `${xs[i]!.toFixed(1)},${lo[i]!.toFixed(1)}`).join('L')}Z`;
    }
    run = [];
  };
  xs.forEach((_, i) => {
    if (lo[i] === null || hi[i] === null) flush();
    else run.push(i);
  });
  flush();
  return d;
}

/** Base class: measures its box and re-renders on resize. */
abstract class BaseChart<S extends ChartSpec> implements ChartView {
  readonly el: HTMLElement;
  protected spec: S;
  protected state: ChartGraphic;
  protected tip: Tooltip;
  private ro: ResizeObserver;
  protected w = 0;
  protected hgt = 0;

  constructor(spec: S, state: ChartGraphic, kind: string) {
    this.spec = spec;
    this.state = state;
    this.el = h('div', { class: `story-chart story-chart--${kind}` });
    this.tip = new Tooltip(this.el, 'chart-tip');
    this.ro = new ResizeObserver(
      debounce(() => {
        if (this.measure()) this.render();
      }, 40),
    );
    this.ro.observe(this.el);
  }

  protected measure(): boolean {
    const w = Math.round(this.el.clientWidth);
    const hh = Math.round(this.el.clientHeight);
    if (!w || !hh || (w === this.w && hh === this.hgt)) return false;
    this.w = w;
    this.hgt = hh;
    return true;
  }

  update(state: ChartGraphic): void {
    this.state = state;
    this.measure();
    this.render();
  }

  protected isHi(id: string): boolean {
    const hl = this.state.highlight;
    return !hl || !hl.length || hl.includes(id);
  }

  protected svg(): SVGSVGElement {
    const svg = s('svg', { class: 'story-chart__svg', width: this.w, height: this.hgt, viewBox: `0 0 ${this.w} ${this.hgt}`, 'aria-hidden': 'true' });
    this.el.querySelector('svg.story-chart__svg')?.remove();
    this.el.querySelector('.story-chart__html')?.remove();
    this.el.prepend(svg);
    return svg;
  }

  abstract render(): void;
  abstract describe(state: ChartGraphic): string;

  destroy(): void {
    this.ro.disconnect();
    this.tip.destroy();
    this.el.remove();
  }
}

/* ---- line chart ------------------------------------------------------------ */

class LineChart extends BaseChart<LineChartSpec> {
  constructor(spec: LineChartSpec, state: ChartGraphic) {
    super(spec, state, 'line');
  }

  private visible() {
    const only = this.state.only;
    return this.spec.series.filter((sr) => !only || only.includes(sr.id));
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const series = this.visible();
    const labelled = series.length <= 4;
    const m = { t: 22, r: labelled ? (narrow ? 78 : 124) : 16, b: 26, l: narrow ? 34 : 44 };
    const iw = this.w - m.l - m.r;
    const ih = this.hgt - m.t - m.b;
    const xs = sp.x.map((_, i) => i);
    const X = lin(0, Math.max(1, sp.x.length - 1), m.l, m.l + iw);
    const all: number[] = [];
    for (const sr of series) for (const v of sr.values) if (v !== null) all.push(v);
    if (sp.band) for (const v of [...sp.band.lo, ...sp.band.hi]) if (v !== null) all.push(v);
    if (sp.band2) for (const v of [...sp.band2.lo, ...sp.band2.hi]) if (v !== null) all.push(v);
    const count = narrow ? 4 : 5;
    let [y0, y1] = d3nice(sp.y_min ?? Math.min(...all), sp.y_max ?? Math.max(...all), count);
    if (sp.y_min !== undefined) y0 = sp.y_min;
    if (sp.y_max !== undefined) y1 = sp.y_max;
    const Y = lin(y0, y1, m.t + ih, m.t);
    const yt = d3ticks(y0, y1, count);
    const step = yt.length > 1 ? yt[1]! - yt[0]! : 1;
    const grid = s('g', { class: 'ch-grid' });
    for (const t of yt) {
      grid.append(s('line', { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t) }));
      grid.append(s('text', { x: m.l - 6, y: Y(t), dy: '0.32em', 'text-anchor': 'end', class: 'ch-tick' }, tickFmt(t, step, sp.unit)));
    }
    svg.append(grid);

    // Preliminary period.
    if (sp.prelim_from !== undefined) {
      const i0 = sp.x.indexOf(sp.prelim_from as never);
      if (i0 > 0) {
        const xa = (X(i0 - 1) + X(i0)) / 2;
        svg.append(
          s('rect', { class: 'ch-prelim', x: xa, y: m.t, width: m.l + iw - xa + 4, height: ih }),
          s('text', { class: 'ch-prelim-label', x: m.l + iw + 2, y: m.t - 8, 'text-anchor': 'end' }, 'Prelim.'),
        );
      }
    }

    // X axis labels: about one every 5 years (or every 2 years of quarters).
    const xt = s('g', { class: 'ch-xaxis' });
    const isQ = sp.x_type === 'quarter';
    const every = isQ ? (narrow ? 12 : 8) : sp.x.length > 24 ? (narrow ? 10 : 5) : narrow ? 4 : 2;
    const isTick = (x: XVal) => (isQ ? String(x).endsWith('Q1') && Number(String(x).slice(0, 4)) % (every / 4) === 0 : Number(x) % every === 0);
    const firstTick = sp.x.findIndex(isTick);
    sp.x.forEach((x, i) => {
      // The first period is labelled too unless a regular tick sits right next to it.
      const lab = isTick(x) || (i === 0 && !isQ && (firstTick < 0 || firstTick >= Math.max(3, every / 2)));
      if (!lab) return;
      xt.append(s('line', { x1: X(i), x2: X(i), y1: m.t + ih, y2: m.t + ih + 4 }));
      xt.append(s('text', { x: X(i), y: m.t + ih + 16, 'text-anchor': 'middle', class: 'ch-tick' }, isQ ? String(x).slice(0, 4) : String(x)));
    });
    xt.append(s('line', { class: 'ch-baseline', x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih }));
    svg.append(xt);

    if (sp.band2) svg.append(s('path', { class: 'ch-band ch-band--light', d: areaFor(xs.map(X), sp.band2.lo.map((v) => (v === null ? null : Y(v))), sp.band2.hi.map((v) => (v === null ? null : Y(v)))) }));
    if (sp.band) svg.append(s('path', { class: 'ch-band', d: areaFor(xs.map(X), sp.band.lo.map((v) => (v === null ? null : Y(v))), sp.band.hi.map((v) => (v === null ? null : Y(v)))) }));

    // Marks (events).
    for (const mk of this.state.marks ?? []) {
      const i = sp.x.findIndex((x) => String(x) === String(mk.x));
      if (i < 0) continue;
      svg.append(
        s('line', { class: 'ch-mark', x1: X(i), x2: X(i), y1: m.t - 4, y2: m.t + ih }),
        s('text', { class: 'ch-mark-label caps-svg', x: X(i) + 4, y: m.t + 6, 'text-anchor': X(i) > m.l + iw * 0.75 ? 'end' : 'start', dx: X(i) > m.l + iw * 0.75 ? -8 : 0 }, mk.label),
      );
    }

    // Series: context first, focus last.
    const order = [...series].sort((a, b) => (a.role === 'focus' || a.role === 'c1' ? 1 : 0) - (b.role === 'focus' || b.role === 'c1' ? 1 : 0));
    const labels: Array<{ y: number; y0: number; text: string; cls: string; muted: boolean }> = [];
    for (const sr of order) {
      const muted = !this.isHi(sr.id);
      const ys = sr.values.map((v) => (v === null ? null : Y(v)));
      svg.append(s('path', { class: `ch-line ${roleClass(sr.role)}${muted ? ' is-muted' : ''}`, d: pathFor(xs.map(X), ys) }));
      if (sp.derived_x?.length && (sr.role === 'focus' || sr.role === 'c1')) {
        for (const dx of sp.derived_x) {
          const i = sp.x.indexOf(dx as never);
          if (i >= 0 && ys[i] !== null) svg.append(s('circle', { class: `ch-derived ${roleClass(sr.role)}`, cx: X(i), cy: ys[i]!, r: 3.5 }));
        }
      }
      let li = sr.values.length - 1;
      while (li >= 0 && sr.values[li] === null) li--;
      if (li >= 0) {
        svg.append(s('circle', { class: `ch-end ${roleClass(sr.role)}${muted ? ' is-muted' : ''}`, cx: X(li), cy: ys[li]!, r: 3 }));
        if (labelled) labels.push({ y: ys[li]!, y0: ys[li]!, text: `${sr.label}`, cls: roleClass(sr.role), muted });
      }
    }
    if (labelled) {
      const lx = m.l + iw + 8;
      // Wrap each label to the right margin (about 6.3px per character at 12px).
      const budget = Math.max(8, Math.floor((m.r - 12) / 6.3));
      const wrapped = labels.map((lb) => ({ ...lb, lines: wrapWords(lb.text, budget) }));
      spread(wrapped, 13 * Math.max(...wrapped.map((w) => w.lines.length)), m.t, m.t + ih);
      for (const lb of wrapped) {
        const t = s('text', { class: `ch-direct${lb.muted ? ' is-muted' : ''}`, x: lx, y: lb.y, dy: '0.32em' });
        const k = lb.lines.length;
        lb.lines.forEach((line, i) => t.append(s('tspan', { x: lx, dy: i === 0 ? `${0.32 - ((k - 1) * 1.1) / 2}em` : '1.1em' }, line)));
        t.removeAttribute('dy');
        svg.append(s('line', { class: `ch-leader ${lb.cls}`, x1: m.l + iw + 2, x2: lx - 2, y1: lb.y0, y2: lb.y }), t);
      }
    }

    // Hover: crosshair + tooltip.
    const cross = s('line', { class: 'ch-cross', y1: m.t, y2: m.t + ih, x1: 0, x2: 0, visibility: 'hidden' });
    const hit = s('rect', { class: 'ch-hit', x: m.l, y: m.t, width: iw, height: ih });
    svg.append(cross, hit);
    const move = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(sp.x.length - 1, Math.round(((px - m.l) / iw) * (sp.x.length - 1))));
      cross.setAttribute('x1', String(X(i)));
      cross.setAttribute('x2', String(X(i)));
      cross.setAttribute('visibility', 'visible');
      const box = h('div', null, h('p', { class: 'chart-tip__x' }, isQ ? xLabel(sp.x[i]!) : `FY ${sp.x[i]}`));
      for (const sr of series) {
        box.append(h('p', { class: 'chart-tip__row' }, h('span', { class: `chart-tip__key ${roleClass(sr.role)}` }), h('span', null, sr.label), h('strong', { class: 'num' }, fmtVal(sr.values[i], sp.unit, sp.format))));
      }
      if (sp.band && sp.band.lo[i] !== null) {
        box.append(h('p', { class: 'chart-tip__row chart-tip__row--band' }, h('span', null, sp.band.label), h('strong', { class: 'num' }, `${fmtShort(sp.band.lo[i]!, sp.unit, sp.format)} to ${fmtShort(sp.band.hi[i]!, sp.unit, sp.format)}`)));
      }
      if (sp.prelim_from !== undefined && sp.x.indexOf(sp.prelim_from as never) <= i) box.append(h('p', { class: 'chart-tip__note' }, 'Preliminary'));
      if (sp.derived_x?.includes(sp.x[i] as number)) box.append(h('p', { class: 'chart-tip__note' }, 'Derived: pooled from two part-year tables'));
      this.tip.show(box, e.clientX - this.el.getBoundingClientRect().left, e.clientY - this.el.getBoundingClientRect().top);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      this.tip.hide();
    });
  }

  describe(state: ChartGraphic): string {
    const sp = this.spec;
    const ser = sp.series.filter((sr) => !state.only || state.only.includes(sr.id));
    const first = sp.x[0]!;
    const last = sp.x[sp.x.length - 1]!;
    const parts = ser.map((sr) => {
      const i0 = sr.values.findIndex((v) => v !== null);
      let i1 = sr.values.length - 1;
      while (i1 >= 0 && sr.values[i1] === null) i1--;
      return `${sr.label}: ${fmtVal(sr.values[i0], sp.unit, sp.format)} in ${xLabel(sp.x[i0]!)}, ${fmtVal(sr.values[i1], sp.unit, sp.format)} in ${xLabel(sp.x[i1]!)}`;
    });
    return `Line chart, ${sp.title ?? ''}, ${xLabel(first)} to ${xLabel(last)}. ${parts.join('. ')}.`;
  }
}

/* ---- rank strip (HTML) ----------------------------------------------------- */

class RankStrip extends BaseChart<RankStripSpec> {
  constructor(spec: RankStripSpec, state: ChartGraphic) {
    super(spec, state, 'rank');
  }

  render(): void {
    const sp = this.spec;
    this.el.querySelector('svg.story-chart__svg')?.remove();
    this.el.querySelector('.story-chart__html')?.remove();
    const exc = !!this.state.exceptions;
    const grid = h('ol', { class: `rank-strip${exc ? ' is-exceptions' : ''}`, 'aria-hidden': 'true' });
    sp.x.forEach((y, i) => {
      const r = sp.ranks[i]!;
      const first = r === 1;
      const leader = sp.leaders[i]?.id;
      const cell = h(
        'li',
        { class: `rank-cell${first ? ' is-first' : ' is-other'}` },
        h('span', { class: 'rank-cell__box num' }, String(r)),
        h('span', { class: 'rank-cell__year num' }, `’${String(y).slice(-2)}`),
        !first && exc && leader ? h('span', { class: 'rank-cell__leader' }, LEADER_SHORT(leader)) : '',
      );
      cell.title = `FY ${y}: ${sp.focus_label} ranked ${r} of ${sp.of[i]}`;
      grid.append(cell);
    });
    const key = h(
      'div',
      { class: 'rank-key story-chart__html-key' },
      h('span', { class: 'rank-key__item' }, h('span', { class: 'rank-key__sw is-first' }), `${sp.focus_label} first`),
      h('span', { class: 'rank-key__item' }, h('span', { class: 'rank-key__sw is-other' }), exc ? 'Another district first (named below)' : 'Not first'),
    );
    const wrap = h('div', { class: 'story-chart__html' }, grid, key);
    this.el.prepend(wrap);
  }

  describe(): string {
    const sp = this.spec;
    const firsts = sp.ranks.filter((r) => r === 1).length;
    return `Rank strip, ${sp.title ?? ''}: ${sp.focus_label} ranked first in ${firsts} of ${sp.ranks.length} years, FY ${sp.x[0]} to FY ${sp.x[sp.x.length - 1]}. ` +
      sp.x.map((y, i) => `FY ${y}: ${sp.ranks[i]}`).join(', ') + '.';
  }
}

function ordinalOf(n: number): string {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suf}`;
}

function LEADER_SHORT(id: string): string {
  return districtShort(id);
}

/* ---- bars ---------------------------------------------------------------- */

class Bars extends BaseChart<BarsSpec> {
  constructor(spec: BarsSpec, state: ChartGraphic) {
    super(spec, state, spec.compact ? 'columns' : 'bars');
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    if (this.spec.compact) this.renderColumns();
    else this.renderBars();
  }

  private renderBars(): void {
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const lw = narrow ? 74 : 110;
    const m = { t: 8, r: 54, b: 8, l: lw };
    const n = sp.items.length;
    const rowH = Math.min(44, (this.hgt - m.t - m.b) / n);
    const max = sp.x_max ?? Math.max(...sp.items.map((i) => i.value));
    const X = lin(0, max, m.l, this.w - m.r);
    const top = m.t + Math.max(0, (this.hgt - m.t - m.b - rowH * n) / 2);
    sp.items.forEach((it, i) => {
      const y = top + i * rowH;
      const bh = Math.max(6, Math.min(22, rowH * 0.56));
      const by = y + (rowH - bh) / 2;
      const cls = it.role === 'national' ? 'ch-national' : roleClass(it.role);
      const muted = !this.isHi(it.id);
      svg.append(
        s('rect', { class: `ch-track`, x: m.l, y: by, width: X(max) - m.l, height: bh, rx: 2 }),
        s('rect', { class: `ch-bar ${cls}${muted ? ' is-muted' : ''}`, x: m.l, y: by, width: Math.max(1, X(it.value) - m.l), height: bh, rx: 2 }),
        s('text', { class: `ch-bar-label${it.role === 'national' ? ' is-national' : ''}`, x: m.l - 8, y: by + bh / 2, dy: '0.32em', 'text-anchor': 'end' }, it.label),
        s('text', { class: 'ch-bar-value', x: X(it.value) + 6, y: by + bh / 2, dy: '0.32em' }, fmtShort(it.value, sp.unit, sp.format)),
      );
    });
  }

  /** Many districts: thin horizontal bars sorted high to low, focus districts labeled at the bar ends. */
  private renderColumns(): void {
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const m = { t: 8, r: narrow ? 92 : 130, b: 24, l: 8 };
    const iw = this.w - m.l - m.r;
    const ih = this.hgt - m.t - m.b;
    const n = sp.items.length;
    const max = Math.max(...sp.items.map((i) => i.value), sp.reference?.value ?? 0);
    const [, xmax] = d3nice(0, max, 4);
    const X = lin(0, xmax, m.l, m.l + iw);
    const xt = d3ticks(0, xmax, narrow ? 3 : 4);
    const step = xt.length > 1 ? xt[1]! - xt[0]! : 1;
    const grid = s('g', { class: 'ch-grid' });
    for (const tv of xt) {
      grid.append(s('line', { x1: X(tv), x2: X(tv), y1: m.t, y2: m.t + ih }));
      grid.append(s('text', { x: X(tv), y: m.t + ih + 15, 'text-anchor': tv === 0 ? 'start' : 'middle', class: 'ch-tick' }, tickFmt(tv, step, sp.unit)));
    }
    svg.append(grid);
    const bh = ih / n;
    const gap = bh > 4 ? 1 : bh > 2.5 ? 0.5 : 0;
    const labels: Array<{ x: number; y: number; y0: number; text: string }> = [];
    sp.items.forEach((it, i) => {
      const y = m.t + i * bh;
      const focus = it.role === 'focus';
      const rect = s('rect', { class: `ch-col ${focus ? 'ch-c1' : 'ch-context'}${!this.isHi(it.id) ? ' is-muted' : ''}`, x: m.l, y: y + gap / 2, width: Math.max(0.5, X(it.value) - m.l), height: Math.max(0.6, bh - gap) });
      // A full-width invisible row makes thin bars easy to hover.
      const hitRow = s('rect', { class: 'ch-hit-row', x: m.l, y, width: iw, height: Math.max(1, bh) });
      hitRow.addEventListener('pointerenter', (e) => {
        const r = this.el.getBoundingClientRect();
        this.tip.show(h('div', null, h('p', { class: 'chart-tip__x' }, it.label), h('p', { class: 'chart-tip__row' }, h('span', null, `${ordinalOf(i + 1)} of ${n}`), h('strong', { class: 'num' }, fmtVal(it.value, sp.unit, sp.format)))), e.clientX - r.left, e.clientY - r.top);
      });
      hitRow.addEventListener('pointerleave', () => this.tip.hide());
      svg.append(rect, hitRow);
      if (focus) labels.push({ x: X(it.value), y: y + bh / 2, y0: y + bh / 2, text: `${it.label} ${fmtShort(it.value, sp.unit, sp.format)}` });
    });
    if (labels.length) {
      const lx = Math.max(...labels.map((l) => l.x)) + 14;
      spread(labels, 14, m.t + 5, m.t + ih - 5);
      for (const lb of labels) {
        svg.append(
          s('path', { class: 'ch-leader ch-c1', d: `M${lb.x + 2},${lb.y0}L${lx - 10},${lb.y0}L${lx - 4},${lb.y}`, fill: 'none' }),
          s('text', { class: 'ch-col-label', x: lx, y: lb.y, dy: '0.32em' }, lb.text),
        );
      }
    }
    if (sp.reference) {
      const x = X(sp.reference.value);
      svg.append(
        s('line', { class: 'ch-ref', x1: x, x2: x, y1: m.t, y2: m.t + ih }),
        s('text', { class: 'ch-ref-label', x: x + 5, y: m.t + ih - 6 }, `${sp.reference.label}: ${fmtShort(sp.reference.value, sp.unit, sp.format)}`),
      );
    }
    svg.append(s('line', { class: 'ch-baseline', x1: m.l, x2: m.l, y1: m.t, y2: m.t + ih }));
  }

  describe(): string {
    const sp = this.spec;
    const focus = sp.items.filter((i) => i.role === 'focus' || i.role === 'national');
    const shown = (focus.length ? focus : sp.items).slice(0, 8);
    return `Bar chart, ${sp.title ?? ''}. ${sp.compact ? `${sp.items.length} districts, highest ${sp.items[0]?.label} at ${fmtVal(sp.items[0]?.value, sp.unit, sp.format)}. ` : ''}${shown.map((i) => `${i.label}: ${fmtVal(i.value, sp.unit, sp.format)}`).join('. ')}${sp.reference ? `. ${sp.reference.label}: ${fmtVal(sp.reference.value, sp.unit, sp.format)}` : ''}.`;
  }
}

/* ---- slope chart ----------------------------------------------------------- */

class Slope extends BaseChart<SlopeSpec> {
  constructor(spec: SlopeSpec, state: ChartGraphic) {
    super(spec, state, 'slope');
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const side = narrow ? 92 : 150;
    const m = { t: 40, b: 12, l: side, r: side };
    const ih = this.hgt - m.t - m.b;
    const max = Math.max(...sp.items.flatMap((i) => [i.before, i.after]));
    const Y = lin(0, Math.ceil(max / 10) * 10, m.t + ih, m.t);
    const x0 = m.l;
    const x1 = this.w - m.r;
    svg.append(
      s('text', { class: 'ch-col-head', x: x0, y: 14, 'text-anchor': 'middle' }, 'Before'),
      s('text', { class: 'ch-col-sub', x: x0, y: 28, 'text-anchor': 'middle' }, sp.left_label),
      s('text', { class: 'ch-col-head', x: x1, y: 14, 'text-anchor': 'middle' }, 'After'),
      s('text', { class: 'ch-col-sub', x: x1, y: 28, 'text-anchor': 'middle' }, sp.right_label),
      s('line', { class: 'ch-axis-v', x1: x0, x2: x0, y1: m.t - 4, y2: m.t + ih }),
      s('line', { class: 'ch-axis-v', x1: x1, x2: x1, y1: m.t - 4, y2: m.t + ih }),
    );
    const L = sp.items.map((it) => ({ y: Y(it.before), it }));
    const R = sp.items.map((it) => ({ y: Y(it.after), it }));
    spread(L, 14, m.t, m.t + ih);
    spread(R, 14, m.t, m.t + ih);
    const ly = new Map(L.map((l) => [l.it.id, l.y]));
    const ry = new Map(R.map((r) => [r.it.id, r.y]));
    const cls = (id: string) => (id === 'txed' ? 'ch-c1' : id === 'ded' ? 'ch-c2' : id === '_other' ? 'ch-context' : 'ch-focus2');
    const ordered = [...sp.items].sort((a, b) => Number(this.isHi(a.id)) - Number(this.isHi(b.id)));
    for (const it of ordered) {
      const muted = !this.isHi(it.id);
      const c = cls(it.id);
      svg.append(
        s('line', { class: `ch-slope ${c}${muted ? ' is-muted' : ''}`, x1: x0, x2: x1, y1: Y(it.before), y2: Y(it.after) }),
        s('circle', { class: `ch-end ${c}${muted ? ' is-muted' : ''}`, cx: x0, cy: Y(it.before), r: 3.5 }),
        s('circle', { class: `ch-end ${c}${muted ? ' is-muted' : ''}`, cx: x1, cy: Y(it.after), r: 3.5 }),
        s('text', { class: `ch-slope-label${muted ? ' is-muted' : ''}`, x: x0 - 8, y: ly.get(it.id)!, dy: '0.32em', 'text-anchor': 'end' }, narrow ? fmtShort(it.before, sp.unit, sp.format) : `${it.label} ${fmtShort(it.before, sp.unit, sp.format)}`),
        s('text', { class: `ch-slope-label${muted ? ' is-muted' : ''}`, x: x1 + 8, y: ry.get(it.id)!, dy: '0.32em' }, `${fmtShort(it.after, sp.unit, sp.format)} ${it.label}`),
      );
    }
  }

  describe(): string {
    const sp = this.spec;
    return `Slope chart, ${sp.title ?? ''}. ` + sp.items.map((i) => `${i.label}: ${fmtVal(i.before, sp.unit, sp.format)} before, ${fmtVal(i.after, sp.unit, sp.format)} after`).join('. ') + '.';
  }
}

/* ---- stacked area ---------------------------------------------------------- */

class Stack extends BaseChart<StackSpec> {
  constructor(spec: StackSpec, state: ChartGraphic) {
    super(spec, state, 'stack');
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const m = { t: 22, r: narrow ? 8 : 150, b: narrow ? 92 : 26, l: narrow ? 34 : 44 };
    const iw = this.w - m.l - m.r;
    const ih = this.hgt - m.t - m.b;
    const X = lin(0, sp.x.length - 1, m.l, m.l + iw);
    const Y = lin(0, sp.y_max ?? 100, m.t + ih, m.t);
    const cum = sp.x.map(() => 0);
    const classes = ['ch-stack-0', 'ch-stack-1', 'ch-stack-2', 'ch-stack-3'];
    const labels: Array<{ y: number; text: string; cls: string; muted: boolean }> = [];
    sp.layers.forEach((ly, k) => {
      const lo = cum.map((c) => Y(c));
      const hi = ly.values.map((v, i) => Y(cum[i]! + (v ?? 0)));
      ly.values.forEach((v, i) => (cum[i] = cum[i]! + (v ?? 0)));
      const muted = !this.isHi(ly.id);
      svg.append(s('path', { class: `ch-area ${classes[k]}${muted ? ' is-muted' : ''}`, d: areaFor(sp.x.map((_, i) => X(i)), lo, hi) }));
      const li = sp.x.length - 1;
      labels.push({ y: (lo[li]! + hi[li]!) / 2, text: `${ly.label} ${fmtShort(ly.values[li] ?? 0, sp.unit, sp.format)}`, cls: classes[k]!, muted });
    });
    const yt = [0, 25, 50, 75, 100];
    const grid = s('g', { class: 'ch-grid ch-grid--over' });
    for (const t of yt) grid.append(s('text', { x: m.l - 6, y: Y(t), dy: '0.32em', 'text-anchor': 'end', class: 'ch-tick' }, `${t}%`));
    svg.append(grid);
    const xt = s('g', { class: 'ch-xaxis' });
    sp.x.forEach((x, i) => {
      if (x % (narrow ? 5 : 2) !== 0 && i !== 0) return;
      xt.append(s('text', { x: X(i), y: m.t + ih + 16, 'text-anchor': 'middle', class: 'ch-tick' }, String(x)));
    });
    svg.append(xt);
    if (sp.mark_x !== undefined) {
      const i = sp.x.indexOf(sp.mark_x);
      if (i >= 0) {
        const xm = (X(i - 1) + X(i)) / 2;
        svg.append(s('line', { class: 'ch-mark ch-mark--light', x1: xm, x2: xm, y1: m.t - 4, y2: m.t + ih }), s('text', { class: 'ch-mark-label caps-svg', x: xm + 4, y: m.t - 8 }, 'New method'));
      }
    }
    if (narrow) {
      // Legend below the chart on small screens.
      const g = s('g', { class: 'ch-legend' });
      [...labels].reverse().forEach((lb, k) => {
        const y = m.t + ih + 32 + k * 15;
        g.append(s('rect', { class: `ch-area ${lb.cls}${lb.muted ? ' is-muted' : ''}`, x: m.l, y: y - 9, width: 10, height: 10, rx: 2 }), s('text', { class: `ch-direct${lb.muted ? ' is-muted' : ''}`, x: m.l + 16, y }, lb.text));
      });
      svg.append(g);
    } else {
      spread(labels, 26, m.t + 6, m.t + ih - 6);
      for (const lb of labels) {
        const t = s('text', { class: `ch-direct${lb.muted ? ' is-muted' : ''}`, x: m.l + iw + 10, y: lb.y, dy: '0.32em' });
        const parts = lb.text.split(' ');
        const val = parts.pop()!;
        t.append(s('tspan', { x: m.l + iw + 10, dy: '-0.3em' }, parts.join(' ')), s('tspan', { x: m.l + iw + 10, dy: '1.15em', class: 'ch-direct-val' }, val));
        svg.append(t);
      }
    }
    const cross = s('line', { class: 'ch-cross', y1: m.t, y2: m.t + ih, x1: 0, x2: 0, visibility: 'hidden' });
    const hit = s('rect', { class: 'ch-hit', x: m.l, y: m.t, width: iw, height: ih });
    svg.append(cross, hit);
    const move = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(sp.x.length - 1, Math.round(((e.clientX - r.left - m.l) / iw) * (sp.x.length - 1))));
      cross.setAttribute('x1', String(X(i)));
      cross.setAttribute('x2', String(X(i)));
      cross.setAttribute('visibility', 'visible');
      const box = h('div', null, h('p', { class: 'chart-tip__x' }, `FY ${sp.x[i]}`));
      [...sp.layers].reverse().forEach((ly, k) => box.append(h('p', { class: 'chart-tip__row' }, h('span', { class: `chart-tip__key ${classes[sp.layers.length - 1 - k]}` }), h('span', null, ly.label), h('strong', { class: 'num' }, fmtVal(ly.values[i], sp.unit, sp.format)))));
      if (sp.mark_x !== undefined && sp.x[i]! >= sp.mark_x) box.append(h('p', { class: 'chart-tip__note' }, 'Derived: rebuilt from the new method’s components'));
      const er = this.el.getBoundingClientRect();
      this.tip.show(box, e.clientX - er.left, e.clientY - er.top);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      this.tip.hide();
    });
  }

  describe(): string {
    const sp = this.spec;
    const i0 = 0;
    const i1 = sp.x.length - 1;
    return `Stacked area chart, ${sp.title ?? ''}, FY ${sp.x[i0]} to FY ${sp.x[i1]}. ` + sp.layers.map((l) => `${l.label}: ${fmtVal(l.values[i0], sp.unit, sp.format)} to ${fmtVal(l.values[i1], sp.unit, sp.format)}`).join('. ') + '.';
  }
}

/* ---- small multiples --------------------------------------------------------- */

class Multiples extends BaseChart<MultiplesSpec> {
  constructor(spec: MultiplesSpec, state: ChartGraphic) {
    super(spec, state, 'multiples');
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    const sp = this.spec;
    const svg = this.svg();
    const cols = this.w < 520 ? 2 : 3;
    const n = sp.panels.length + 1;
    const rows = Math.ceil(n / cols);
    const pw = this.w / cols;
    const ph = this.hgt / rows;
    const all = [...sp.panels.flatMap((p) => p.values), ...sp.national.values].filter((v): v is number => v !== null);
    const yt = d3ticks(0, Math.max(...all), 3);
    const ymax = Math.max(Math.max(...all), yt[yt.length - 1] ?? 0);
    const step = yt.length > 1 ? yt[1]! - yt[0]! : 1;
    sp.panels.forEach((p, k) => {
      const ox = (k % cols) * pw;
      const oy = Math.floor(k / cols) * ph;
      const m = { t: 22, r: 10, b: 18, l: 34 };
      const X = lin(0, sp.x.length - 1, ox + m.l, ox + pw - m.r);
      const Y = lin(0, ymax, oy + ph - m.b, oy + m.t);
      const muted = !this.isHi(p.id);
      const g = s('g', { class: `ch-panel${muted ? ' is-muted' : ''}` });
      g.append(s('text', { class: 'ch-panel-title', x: ox + m.l, y: oy + 13 }, p.label));
      for (const t of yt) {
        g.append(s('line', { class: 'ch-grid-line', x1: ox + m.l, x2: ox + pw - m.r, y1: Y(t), y2: Y(t) }));
        g.append(s('text', { class: 'ch-tick', x: ox + m.l - 5, y: Y(t), dy: '0.32em', 'text-anchor': 'end' }, tickFmt(t, step, sp.unit)));
      }
      g.append(
        s('text', { class: 'ch-tick', x: X(0), y: oy + ph - 4, 'text-anchor': 'start' }, String(sp.x[0])),
        s('text', { class: 'ch-tick', x: X(sp.x.length - 1), y: oy + ph - 4, 'text-anchor': 'end' }, String(sp.x[sp.x.length - 1])),
        s('path', { class: 'ch-line ch-national ch-line--thin', d: pathFor(sp.x.map((_, i) => X(i)), sp.national.values.map((v) => (v === null ? null : Y(v)))) }),
        s('path', { class: 'ch-line ch-c1', d: pathFor(sp.x.map((_, i) => X(i)), p.values.map((v) => (v === null ? null : Y(v)))) }),
      );
      const li = p.values.length - 1;
      const lv = p.values[li];
      if (lv !== null && lv !== undefined) {
        g.append(s('circle', { class: 'ch-end ch-c1', cx: X(li), cy: Y(lv), r: 2.5 }), s('text', { class: 'ch-end-label', x: X(li) - 4, y: Y(lv) - 6, 'text-anchor': 'end' }, fmtShort(lv, sp.unit, sp.format)));
      }
      svg.append(g);
    });
    // Key in the last cell.
    const k = sp.panels.length;
    const ox = (k % cols) * pw + 34;
    const oy = Math.floor(k / cols) * ph + 30;
    svg.append(
      s('line', { class: 'ch-line ch-c1', x1: ox, x2: ox + 22, y1: oy, y2: oy }),
      s('text', { class: 'ch-direct', x: ox + 28, y: oy, dy: '0.32em' }, 'District'),
      s('line', { class: 'ch-line ch-national ch-line--thin', x1: ox, x2: ox + 22, y1: oy + 18, y2: oy + 18 }),
      s('text', { class: 'ch-direct', x: ox + 28, y: oy + 18, dy: '0.32em' }, sp.national.label),
    );
  }

  describe(): string {
    const sp = this.spec;
    const li = sp.x.length - 1;
    return `Small multiples, ${sp.title ?? ''}, FY ${sp.x[0]} to FY ${sp.x[li]}. In FY ${sp.x[li]}: ` + sp.panels.map((p) => `${p.label} ${fmtVal(p.values[li], sp.unit, sp.format)}`).join(', ') + `; ${sp.national.label} ${fmtVal(sp.national.values[li], sp.unit, sp.format)}.`;
  }
}

/* ---- dot plot ---------------------------------------------------------------- */

class Dots extends BaseChart<DotsSpec> {
  constructor(spec: DotsSpec, state: ChartGraphic) {
    super(spec, state, 'dots');
  }

  render(): void {
    if (!this.w || !this.hgt) return;
    const sp = this.spec;
    const svg = this.svg();
    const narrow = this.w < 520;
    const m = { t: 30, r: 16, b: 40, l: narrow ? 40 : 48 };
    const iw = this.w - m.l - m.r;
    const ih = this.hgt - m.t - m.b;
    const [, xmax] = d3nice(0, Math.max(...sp.items.map((i) => i.x)), narrow ? 4 : 6);
    const [ymin] = d3nice(Math.min(...sp.items.map((i) => i.y)), 100, 4);
    const xt = d3ticks(0, xmax, narrow ? 4 : 6);
    const X = lin(0, xmax, m.l, m.l + iw);
    const yt = d3ticks(ymin, 100, 4);
    const Y = lin(ymin, 100, m.t + ih, m.t);
    const grid = s('g', { class: 'ch-grid' });
    for (const t of yt) grid.append(s('line', { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t) }), s('text', { class: 'ch-tick', x: m.l - 6, y: Y(t), dy: '0.32em', 'text-anchor': 'end' }, `${t}%`));
    for (const t of xt) grid.append(s('text', { class: 'ch-tick', x: X(t), y: m.t + ih + 15, 'text-anchor': 'middle' }, `${formatNumber(t, t % 1 ? 1 : 0)}%`));
    grid.append(s('text', { class: 'ch-axis-title', x: m.l + iw, y: m.t + ih + 32, 'text-anchor': 'end' }, `${sp.x_label} →`));
    grid.append(s('text', { class: 'ch-axis-title', x: m.l - (narrow ? 34 : 42), y: 12 }, `↑ ${sp.y_label}`));
    svg.append(grid);
    if (sp.reference) {
      svg.append(
        s('line', { class: 'ch-ref', x1: X(sp.reference.x), x2: X(sp.reference.x), y1: m.t, y2: m.t + ih }),
        s('line', { class: 'ch-ref', x1: m.l, x2: m.l + iw, y1: Y(sp.reference.y), y2: Y(sp.reference.y) }),
        s('text', { class: 'ch-ref-label', x: X(sp.reference.x) + 5, y: m.t + ih - 6 }, `${sp.reference.label} (dashed lines)`),
      );
    }
    const items = [...sp.items].sort((a, b) => (a.role === 'focus' ? 1 : 0) - (b.role === 'focus' ? 1 : 0));
    const labels: Array<{ y: number; x: number; text: string; y0: number }> = [];
    for (const it of items) {
      const focus = it.role === 'focus';
      const c = s('circle', { class: `ch-dot ${focus ? 'ch-c1' : 'ch-context'}`, cx: X(it.x), cy: Y(it.y), r: focus ? 5 : 4 });
      c.addEventListener('pointerenter', (e) => {
        const r = this.el.getBoundingClientRect();
        this.tip.show(
          h('div', null, h('p', { class: 'chart-tip__x' }, it.label), h('p', { class: 'chart-tip__row' }, h('span', null, 'Trial rate'), h('strong', { class: 'num' }, `${formatNumber(it.x, 2)}%`)), h('p', { class: 'chart-tip__row' }, h('span', null, 'Pleaded guilty'), h('strong', { class: 'num' }, `${formatNumber(it.y, 1)}%`)), h('p', { class: 'chart-tip__row' }, h('span', null, 'Defendants'), h('strong', { class: 'num' }, formatNumber(it.n, 0)))),
          e.clientX - r.left,
          e.clientY - r.top,
        );
      });
      c.addEventListener('pointerleave', () => this.tip.hide());
      svg.append(c);
      if (focus) labels.push({ x: X(it.x), y: Y(it.y), y0: Y(it.y), text: it.label });
    }
    spread(labels, 13, m.t + 6, m.t + ih - 6);
    for (const lb of labels) {
      svg.append(s('line', { class: 'ch-leader ch-c1', x1: lb.x + 6, x2: lb.x + 22, y1: lb.y0, y2: lb.y }), s('text', { class: 'ch-dot-label', x: lb.x + 25, y: lb.y, dy: '0.32em' }, lb.text));
    }
  }

  describe(): string {
    const sp = this.spec;
    const f = sp.items.filter((i) => i.role === 'focus');
    return `Dot plot, ${sp.title ?? ''}. ${sp.items.length} districts. ` + f.map((i) => `${i.label}: trial rate ${formatNumber(i.x, 2)}%, guilty pleas ${formatNumber(i.y, 1)}%`).join('. ') + (sp.reference ? `. ${sp.reference.label}: trial rate ${formatNumber(sp.reference.x, 2)}%, guilty pleas ${formatNumber(sp.reference.y, 1)}%.` : '.');
  }
}

/* ---- factory ------------------------------------------------------------------ */

export function createChart(spec: ChartSpec, state: ChartGraphic): ChartView | null {
  switch (spec.kind) {
    case 'line':
      return new LineChart(spec, state);
    case 'rankstrip':
      return new RankStrip(spec, state);
    case 'bars':
      return new Bars(spec, state);
    case 'slope':
      return new Slope(spec, state);
    case 'stack':
      return new Stack(spec, state);
    case 'multiples':
      return new Multiples(spec, state);
    case 'dots':
      return new Dots(spec, state);
    default:
      return null;
  }
}

/** A plain data table for a chart (for "How we did this" and screen readers). */
export function chartTable(spec: ChartSpec): HTMLTableElement | null {
  const t = h('table', { class: 'story-table' });
  const head = (cells: string[]) => t.append(h('thead', null, h('tr', null, ...cells.map((c, i) => h('th', { scope: 'col', class: i ? 'is-num' : '' }, c)))));
  const body = h('tbody');
  const row = (hdr: string, cells: string[]) => body.append(h('tr', null, h('th', { scope: 'row' }, hdr), ...cells.map((c) => h('td', { class: 'is-num num' }, c))));
  const fv = (v: number | null | undefined, unit: string, fmt?: string) => (v === null || v === undefined ? 'No data' : fmtShort(v, unit, fmt));
  switch (spec.kind) {
    case 'line': {
      head(['Period', ...spec.series.map((s2) => s2.label), ...(spec.band ? [spec.band.label] : [])]);
      spec.x.forEach((x, i) => row(xLabel(x), [...spec.series.map((sr) => fv(sr.values[i], spec.unit, spec.format)), ...(spec.band ? [spec.band.lo[i] === null ? 'No data' : `${fv(spec.band.lo[i], spec.unit, spec.format)} to ${fv(spec.band.hi[i], spec.unit, spec.format)}`] : [])]));
      break;
    }
    case 'rankstrip':
      head(['Fiscal year', `${spec.focus_label} standing`, 'Districts ranked']);
      spec.x.forEach((x, i) => row(`FY ${x}`, [String(spec.ranks[i]), String(spec.of[i])]));
      break;
    case 'bars':
      head(['District', 'Value']);
      spec.items.forEach((it) => row(it.label, [fv(it.value, spec.unit, spec.format)]));
      if (spec.reference) row(spec.reference.label, [fv(spec.reference.value, spec.unit, spec.format)]);
      break;
    case 'slope':
      head(['District', spec.left_label, spec.right_label]);
      spec.items.forEach((it) => row(it.label, [fv(it.before, spec.unit, spec.format), fv(it.after, spec.unit, spec.format)]));
      break;
    case 'stack':
      head(['Fiscal year', ...spec.layers.map((l) => l.label)]);
      spec.x.forEach((x, i) => row(`FY ${x}`, spec.layers.map((l) => fv(l.values[i], spec.unit, spec.format))));
      break;
    case 'multiples':
      head(['Fiscal year', ...spec.panels.map((p) => p.label), spec.national.label]);
      spec.x.forEach((x, i) => row(`FY ${x}`, [...spec.panels.map((p) => fv(p.values[i], spec.unit, spec.format)), fv(spec.national.values[i], spec.unit, spec.format)]));
      break;
    case 'dots':
      head(['District', spec.x_label, spec.y_label, 'Defendants terminated']);
      spec.items.forEach((it) => row(it.label, [`${formatNumber(it.x, 2)}%`, `${formatNumber(it.y, 1)}%`, formatNumber(it.n, 0)]));
      break;
    default:
      return null;
  }
  t.append(body);
  return t;
}
