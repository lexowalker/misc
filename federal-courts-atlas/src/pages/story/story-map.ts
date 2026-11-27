// StoryMap: the atlas choropleth as a scrollytelling graphic. Same geometry, projection,
// insets, ramp and No-data hatch as the home map (src/map), but built for a sticky graphic:
// no zoom controls and no 94 tab stops (the step text carries the story and the page has a
// text alternative), outlined and labeled focus districts, and an animated frame that moves
// between national view and a set of districts. Under prefers-reduced-motion every change
// is instant (the duration tokens are 0).

import { h, s, durationMs, uniqueId } from '../../lib/dom.ts';
import { formatValue } from '../../lib/format.ts';
import { districtShort } from '../../data/districts.ts';
import { Tooltip } from '../../components/tooltip.ts';
import { hatchPattern, renderLegend } from '../../components/legend.ts';
import { emptyState } from '../../components/states.ts';
import { loadAtlasGeometry, type AtlasGeometry } from '../../map/geo.ts';
import { atlasProjection, VIEW_H, VIEW_W } from '../../map/projection.ts';
import { quantileScale, type QuantileScale } from '../../map/scale.ts';
import type { MapGraphic } from '../../content/stories.ts';
import type { StoryLayer } from './types.ts';

interface Frame {
  k: number;
  x: number;
  y: number;
}

const IDENTITY: Frame = { k: 1, x: 0, y: 0 };

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class StoryMap {
  readonly el: HTMLDivElement;
  readonly ready: Promise<boolean>;
  private svg: SVGSVGElement;
  private zoomG: SVGGElement;
  private districtG: SVGGElement;
  private outlineG: SVGGElement;
  private labelG: SVGGElement;
  private legendSlot: HTMLDivElement;
  private tip: Tooltip;
  private geo: AtlasGeometry | null = null;
  private paths = new Map<string, SVGPathElement>();
  private layers: Record<string, StoryLayer>;
  private scales = new Map<string, QuantileScale | null>();
  private frame: Frame = IDENTITY;
  private raf = 0;
  private state: MapGraphic | null = null;

  constructor(container: HTMLElement, layers: Record<string, StoryLayer>) {
    this.layers = layers;
    const hatchId = uniqueId('smap-hatch');
    this.el = h('div', { class: 'story-map' });
    this.legendSlot = h('div', { class: 'story-map__legend' });
    this.svg = s('svg', { class: 'story-map__svg', viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMin meet' });
    this.svg.append(s('defs', null, hatchPattern(hatchId, 4)));
    this.el.style.setProperty('--hatch', `url(#${hatchId})`);
    this.zoomG = s('g', { class: 'story-map__zoom' });
    this.districtG = s('g', { class: 'story-map__districts' });
    this.outlineG = s('g', { class: 'story-map__outlines' });
    this.labelG = s('g', { class: 'story-map__labels' });
    const frames = s('g', { class: 'story-map__frames' });
    for (const r of atlasProjection().regions) {
      if (!r.box) continue;
      const [[x0, y0], [x1, y1]] = r.box;
      frames.append(s('rect', { class: 'inset-frame', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 3 }));
    }
    this.zoomG.append(frames, this.districtG);
    this.svg.append(this.zoomG, this.outlineG, this.labelG);
    this.el.append(this.legendSlot, h('div', { class: 'story-map__canvas' }, this.svg));
    this.tip = new Tooltip(this.el, 'chart-tip');
    container.append(this.el);
    this.ready = this.init();
  }

  private async init(): Promise<boolean> {
    const r = await loadAtlasGeometry();
    if (r.status !== 'ok' || r.geometry.kind !== 'districts') {
      this.el.append(emptyState({ title: 'The map could not be loaded', body: 'District boundaries are not available.', icon: 'map' }));
      return false;
    }
    const g = r.geometry;
    this.geo = g;
    for (const d of g.districts) {
      const p = s('path', { class: 'district base', d: d.d, 'data-id': d.id });
      p.addEventListener('pointerenter', (e) => this.hover(d.id, e));
      p.addEventListener('pointermove', (e) => this.hover(d.id, e));
      p.addEventListener('pointerleave', () => this.tip.hide());
      this.paths.set(d.id, p);
      this.districtG.append(p);
    }
    this.zoomG.append(
      s('path', { class: 'mesh mesh--district', d: g.districtMesh }),
      s('path', { class: 'mesh mesh--state', d: g.stateMesh }),
    );
    if (this.state) this.set(this.state, true);
    return true;
  }

  private scaleFor(key: string): QuantileScale | null {
    if (this.scales.has(key)) return this.scales.get(key)!;
    const lay = this.layers[key];
    const vals: number[] = [];
    if (lay) for (const ys of Object.values(lay.values)) for (const v of Object.values(ys)) vals.push(v);
    const sc = quantileScale(vals);
    this.scales.set(key, sc);
    return sc;
  }

  value(id: string): number | null {
    const st = this.state;
    if (!st) return null;
    const v = this.layers[st.layer]?.values[id]?.[String(st.year)];
    return typeof v === 'number' ? v : null;
  }

  private hover(id: string, e: PointerEvent): void {
    const st = this.state;
    const lay = st ? this.layers[st.layer] : null;
    const shape = this.geo?.byId.get(id);
    if (!st || !lay || !shape) return;
    const v = this.value(id);
    const box = h(
      'div',
      null,
      h('p', { class: 'chart-tip__x' }, shape.name),
      h('p', { class: 'chart-tip__row' }, h('span', null, `FY ${st.year}`), h('strong', { class: 'num' }, formatValue(v, { unit: lay.unit, format: lay.format }))),
    );
    const r = this.el.getBoundingClientRect();
    this.tip.show(box, e.clientX - r.left, e.clientY - r.top);
  }

  /** Apply a map state. `instant` skips the frame animation. */
  set(st: MapGraphic, instant = false): void {
    this.state = st;
    if (!this.geo) return;
    const lay = this.layers[st.layer];
    const sc = this.scaleFor(st.layer);
    const focus = new Set(st.focus ?? []);
    for (const [id, p] of this.paths) {
      const v = lay?.values[id]?.[String(st.year)];
      const q = typeof v === 'number' ? sc?.classOf(v) ?? null : null;
      p.setAttribute('class', `district ${q === null ? 'nodata' : `q${q}`}${focus.size && !focus.has(id) ? ' is-context' : ''}`);
    }
    this.renderLegend(st, sc, lay);
    this.moveTo(this.frameFor(st.zoom), instant);
  }

  private renderLegend(st: MapGraphic, sc: QuantileScale | null, lay: StoryLayer | undefined): void {
    if (!lay) {
      this.legendSlot.replaceChildren();
      return;
    }
    const yrs = lay.years;
    const note = yrs.length > 1 ? `Colors use the same breaks for every year from FY ${yrs[0]} to FY ${yrs[yrs.length - 1]}.` : undefined;
    this.legendSlot.replaceChildren(
      h('div', { class: 'story-map__legend-head' }, h('span', { class: 'story-map__legend-title' }, lay.label), h('span', { class: 'story-map__legend-year num' }, `FY ${st.year}`)),
      renderLegend({ scale: sc, variable: { unit: lay.unit, format: lay.format, label: lay.label, higher_means: lay.higher_means ?? '' }, note, compact: true }),
    );
  }

  private frameFor(ids?: string[]): Frame {
    if (!ids?.length || !this.geo) return IDENTITY;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const id of ids) {
      const b = this.geo.byId.get(id)?.bounds;
      if (!b) continue;
      x0 = Math.min(x0, b[0][0]);
      y0 = Math.min(y0, b[0][1]);
      x1 = Math.max(x1, b[1][0]);
      y1 = Math.max(y1, b[1][1]);
    }
    if (!Number.isFinite(x0)) return IDENTITY;
    const k = Math.max(1, Math.min(8, 0.82 / Math.max((x1 - x0) / VIEW_W, (y1 - y0) / VIEW_H)));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // Keep the frame inside the map.
    const x = Math.min(0, Math.max(VIEW_W - VIEW_W * k, VIEW_W / 2 - cx * k));
    const y = Math.min(0, Math.max(VIEW_H - VIEW_H * k, VIEW_H / 2 - cy * k));
    return { k, x, y };
  }

  private moveTo(target: Frame, instant: boolean): void {
    cancelAnimationFrame(this.raf);
    const dur = instant ? 0 : durationMs('--dur-map', 750);
    const from = { ...this.frame };
    if (dur <= 0 || (from.k === target.k && from.x === target.x && from.y === target.y)) {
      this.apply(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      this.apply({ k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
      if (t < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private apply(f: Frame): void {
    this.frame = f;
    this.zoomG.setAttribute('transform', `translate(${f.x.toFixed(2)},${f.y.toFixed(2)}) scale(${f.k.toFixed(4)})`);
    this.renderFocus();
  }

  /** Outlines and labels live outside the zoom group so strokes and type keep their size. */
  private renderFocus(): void {
    this.outlineG.replaceChildren();
    this.labelG.replaceChildren();
    const st = this.state;
    if (!st?.focus?.length || !this.geo) return;
    const f = this.frame;
    const tr = `translate(${f.x.toFixed(2)},${f.y.toFixed(2)}) scale(${f.k.toFixed(4)})`;
    const labels: Array<{ x: number; y: number; ax: number; ay: number; text: string; anchor: string }> = [];
    for (const id of st.focus) {
      const shape = this.geo.byId.get(id);
      if (!shape) continue;
      this.outlineG.append(
        s('path', { class: 'story-map__halo', d: shape.d, transform: tr }),
        s('path', { class: 'story-map__outline', d: shape.d, transform: tr }),
      );
      const [cx, cy] = shape.centroid;
      const sx = f.x + cx * f.k;
      const sy = f.y + cy * f.k;
      const [[bx0, by0], [bx1, by1]] = shape.bounds;
      const wpx = (bx1 - bx0) * f.k;
      const hpx = (by1 - by0) * f.k;
      const text = districtShort(id);
      // Large enough shapes carry their label inside; small ones get a leader to the east.
      if (wpx > text.length * 7.5 && hpx > 22) labels.push({ x: sx, y: sy, ax: sx, ay: sy, text, anchor: 'middle' });
      else labels.push({ x: f.x + bx1 * f.k + 26, y: sy - 14, ax: sx, ay: sy, text, anchor: 'start' });
    }
    // Nudge overlapping labels apart vertically.
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) {
      const a = labels[i - 1]!;
      const b = labels[i]!;
      if (Math.abs(b.x - a.x) < 90 && b.y - a.y < 20) b.y = a.y + 20;
    }
    for (const lb of labels) {
      if (lb.anchor === 'start') this.labelG.append(s('path', { class: 'story-map__leader', d: `M${lb.ax},${lb.ay}L${lb.x - 4},${lb.y}` }));
      this.labelG.append(s('text', { class: 'story-map__label', x: lb.x, y: lb.y, dy: '0.35em', 'text-anchor': lb.anchor }, lb.text));
    }
  }

  describe(st: MapGraphic): string {
    const lay = this.layers[st.layer];
    if (!lay) return 'Map of the 94 federal judicial districts.';
    let missing = 0;
    for (const id of this.paths.keys()) if (lay.values[id]?.[String(st.year)] === undefined) missing += 1;
    const focus = (st.focus ?? []).map((id) => `${districtShort(id)}: ${formatValue(lay.values[id]?.[String(st.year)] ?? null, { unit: lay.unit, format: lay.format })}`);
    return `Map of the 94 federal judicial districts shaded in five steps by ${lay.label.toLowerCase()}, FY ${st.year}. ${focus.length ? `Outlined: ${focus.join('; ')}. ` : ''}${missing ? `${missing} districts have no data.` : ''}`.trim();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.tip.destroy();
    this.el.remove();
  }
}
