// The atlas choropleth: D3 SVG map of the 94 districts with framed insets, smooth
// zoom/pan (wheel, double-click, drag, pinch), Home/+/- controls, lazy hi-res swap,
// courthouse dots with progressive collision-avoided labels, hover/tap tooltip,
// keyboard access and quantile classes driven by CSS (theme-aware without re-render).

import { select, type Selection } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform, type D3ZoomEvent } from 'd3-zoom';
import 'd3-transition';
import { h, s, durationMs, rafThrottle, debounce, html } from '../lib/dom.ts';
import { formatValue, periodLabel, rankText } from '../lib/format.ts';
import type { Courthouse, ValuesFile, Variable } from '../data/types.ts';
import { getRank, getValue, loadCourthouses, rankedCount } from '../data/loaders.ts';
import { Tooltip } from '../components/tooltip.ts';
import { hatchPattern } from '../components/legend.ts';
import { emptyState } from '../components/states.ts';
import { circuitLabel } from '../data/districts.ts';
import { VIEW_H, VIEW_W, atlasProjection } from './projection.ts';
import { loadAtlasGeometry, loadHiGeometry, type AtlasGeometry, type DistrictShape, type GeometryResult } from './geo.ts';
import type { QuantileScale } from './scale.ts';
import { measureText, placeLabels, type LabelCandidate } from './labels.ts';

export interface AtlasMapOptions {
  /** Accessible name for the whole map. */
  ariaLabel?: string;
  /** Called when a district is activated (click, Enter, tooltip link). Default: navigate to its profile. */
  onSelect?: (id: string) => void;
  hrefFor?: (id: string) => string;
  /** Show courthouse dots and labels (default true). */
  courthouses?: boolean;
  /** Maximum zoom factor (default 24). */
  maxZoom?: number;
  /**
   * Custom tooltip body (everything under the district name). Return null to fall
   * back to the default body. The pinned "Open district profile" link is still added.
   */
  tooltipBody?: (id: string, data: MapData) => Node | null;
  /** Custom accessible name for a district path. Return null to use the default. */
  ariaLabelFor?: (id: string, data: MapData) => string | null;
  /** Extra sentence for the map's screen-reader help text (e.g. how ranks are counted). */
  ariaHelp?: string;
  /**
   * Draw cities with only a courthouse building (FJC list) as open rings, and places of
   * holding court named by statute as solid dots (default false: all solid).
   */
  courthouseKinds?: boolean;
}

export interface MapData {
  variable: Variable | null;
  values: ValuesFile | null;
  year: number | null;
  scale: QuantileScale | null;
}

interface CityPoint {
  id: string;
  city: string;
  state: string;
  district_id: string;
  x: number;
  y: number;
  priority: number;
  names: string[];
}

const HI_RES_K = 2.4;
const HI_PREFETCH_K = 1.6;
const LABELS_K = 1.7;
const ICON = {
  home: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3.5 9.2 10 3.8l6.5 5.4V16a.8.8 0 0 1-.8.8h-3.4v-4.6H7.7v4.6H4.3a.8.8 0 0 1-.8-.8V9.2Z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

let mapSeq = 0;

export class AtlasMap {
  readonly el: HTMLDivElement;
  readonly ready: Promise<GeometryResult>;
  private opts: AtlasMapOptions;
  private canvas: HTMLDivElement;
  private svg: SVGSVGElement;
  private svgSel: Selection<SVGSVGElement, unknown, null, undefined>;
  private zoomLayer: SVGGElement;
  private districtLayer: SVGGElement;
  private countyMesh: SVGPathElement;
  private districtMesh: SVGPathElement;
  private stateMesh: SVGPathElement;
  private hoverHalo: SVGPathElement;
  private hoverLine: SVGPathElement;
  private dotRing: SVGPathElement;
  private dots: SVGPathElement;
  private dotsOpen: SVGPathElement;
  private labelLayer: SVGGElement;
  private insetLabels: SVGGElement;
  /** Phones: names of the insets too small to hold a label, set below the inset cluster with leader lines. */
  private insetKey: SVGSVGElement;
  private cityLabels: SVGGElement;
  private chipLayer: SVGGElement;
  private chips = new Map<string, { rect: SVGRectElement; leader: SVGLineElement | null; label: SVGTextElement | null; off: [number, number] }>();
  private tooltip: Tooltip;
  private hint: HTMLDivElement;
  private zoom: ZoomBehavior<SVGSVGElement, unknown>;
  private transform: ZoomTransform = zoomIdentity;
  private geometry: AtlasGeometry | null = null;
  private lo: AtlasGeometry | null = null;
  private hi: AtlasGeometry | null = null;
  private hiState: 'idle' | 'loading' | 'missing' | 'ready' = 'idle';
  private hiPromise: Promise<void> | null = null;
  private paths = new Map<string, SVGPathElement>();
  private data: MapData = { variable: null, values: null, year: null, scale: null };
  private hovered: string | null = null;
  private focused: string | null = null;
  private lastPointerType = 'mouse';
  private cities: CityPoint[] = [];
  private wheelArmed = false;
  private hintTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObs: ResizeObserver | null = null;
  private destroyed = false;
  private uid: string;

  constructor(container: HTMLElement, opts: AtlasMapOptions = {}) {
    this.opts = opts;
    mapSeq += 1;
    this.uid = `atlas-map-${mapSeq}`;
    this.el = h('div', { class: 'atlas-map', 'data-state': 'loading' });
    this.canvas = h('div', { class: 'atlas-map__canvas' });
    this.svg = s('svg', {
      class: 'atlas-map__svg',
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      role: 'group',
      'aria-label': opts.ariaLabel ?? 'Map of the 94 federal judicial districts',
      'aria-describedby': `${this.uid}-help`,
    });
    const hatchId = `${this.uid}-hatch`;
    this.svg.append(
      s('defs', null, hatchPattern(hatchId, 4)),
      s('rect', { class: 'atlas-map__bg', x: -VIEW_W, y: -VIEW_H, width: VIEW_W * 3, height: VIEW_H * 3 }),
    );
    this.el.style.setProperty('--hatch', `url(#${hatchId})`);
    this.zoomLayer = s('g', { class: 'atlas-map__zoom' });
    this.districtLayer = s('g', { class: 'atlas-map__districts' });
    this.countyMesh = s('path', { class: 'mesh mesh--county', 'aria-hidden': 'true' });
    this.districtMesh = s('path', { class: 'mesh mesh--district', 'aria-hidden': 'true' });
    this.stateMesh = s('path', { class: 'mesh mesh--state', 'aria-hidden': 'true' });
    this.hoverHalo = s('path', { class: 'outline outline--halo', 'aria-hidden': 'true' });
    this.hoverLine = s('path', { class: 'outline outline--line', 'aria-hidden': 'true' });
    this.dotRing = s('path', { class: 'dots dots--ring', 'aria-hidden': 'true' });
    this.dots = s('path', { class: 'dots dots--fill', 'aria-hidden': 'true' });
    this.dotsOpen = s('path', { class: 'dots dots--open', 'aria-hidden': 'true' });
    const frames = s('g', { class: 'atlas-map__frames', 'aria-hidden': 'true' });
    for (const r of atlasProjection().regions) {
      if (!r.box) continue;
      const [[x0, y0], [x1, y1]] = r.box;
      frames.append(s('rect', { class: 'inset-frame', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 3 }));
    }
    this.zoomLayer.append(frames, this.districtLayer, this.countyMesh, this.districtMesh, this.stateMesh, this.hoverHalo, this.hoverLine, this.dotRing, this.dots, this.dotsOpen);
    this.labelLayer = s('g', { class: 'atlas-map__labels', 'aria-hidden': 'true' });
    this.insetLabels = s('g', { class: 'inset-labels' });
    this.cityLabels = s('g', { class: 'city-labels' });
    this.chipLayer = s('g', { class: 'district-chips' });
    this.labelLayer.append(this.insetLabels, this.cityLabels, this.chipLayer);
    this.svg.append(this.zoomLayer, this.labelLayer);
    this.canvas.append(this.svg);

    const help = h(
      'p',
      { id: `${this.uid}-help`, class: 'visually-hidden' },
      'Use Tab to move between districts and Enter to open one. Plus and minus keys zoom, arrow keys pan, and 0 resets the view.',
      opts.ariaHelp ? ` ${opts.ariaHelp}` : '',
    );
    this.hint = h('div', { class: 'atlas-map__hint', 'aria-hidden': 'true' });
    const controls = h(
      'div',
      { class: 'atlas-map__controls', role: 'group', 'aria-label': 'Map zoom' },
      this.controlButton('Reset map view', ICON.home, () => this.reset()),
      this.controlButton('Zoom in', ICON.plus, () => this.zoomBy(1.8)),
      this.controlButton('Zoom out', ICON.minus, () => this.zoomBy(1 / 1.8)),
    );
    this.insetKey = s('svg', { class: 'atlas-map__inset-key', 'aria-hidden': 'true' });
    this.el.append(this.canvas, this.insetKey, controls, this.hint, help);
    this.tooltip = new Tooltip(this.el, 'map-tip');
    container.append(this.el);

    this.svgSel = select(this.svg);
    this.zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, opts.maxZoom ?? 24])
      .extent([[0, 0], [VIEW_W, VIEW_H]])
      .translateExtent([[0, 0], [VIEW_W, VIEW_H]])
      .filter((event: Event) => this.zoomFilter(event))
      .on('start', () => this.el.classList.add('is-zooming'))
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => this.onZoom(e.transform))
      .on('end', () => this.onZoomEnd());
    this.svgSel.call(this.zoom).on('dblclick.zoom', null);
    // Our own double-click: zoom around the pointer (d3's default is fine but we want the smooth transition).
    this.svgSel.on('dblclick.atlas', (event: MouseEvent) => {
      event.preventDefault();
      const r = this.svg.getBoundingClientRect();
      const ctm = this.svg.getScreenCTM();
      const k = ctm ? ctm.a : r.width / VIEW_W;
      const p: [number, number] = [(event.clientX - r.left) / k, (event.clientY - r.top) / k];
      this.svgSel.transition().duration(durationMs('--dur-map', 600)).call(this.zoom.scaleBy, event.shiftKey ? 0.5 : 2, p);
    });
    this.updateTouchAction();

    this.bindEvents();
    this.ready = this.init();
  }

  /* ------------------------------------------------------------------ */

  private controlButton(label: string, icon: string, fn: () => void): HTMLButtonElement {
    const b = h('button', { type: 'button', class: 'map-control', 'aria-label': label, title: label }, html(icon));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      this.wheelArmed = true;
      fn();
    });
    return b;
  }

  private async init(): Promise<GeometryResult> {
    const r = await loadAtlasGeometry();
    if (this.destroyed) return r;
    if (r.status !== 'ok') {
      this.el.dataset.state = r.status;
      this.canvas.append(
        r.status === 'missing'
          ? emptyState({
              title: 'District boundaries not yet built',
              body: 'The map appears once the boundaries pipeline publishes the 94 district shapes.',
              file: 'public/data/geo/districts-lo.topo.json',
              icon: 'map',
            })
          : emptyState({ title: 'The map could not be loaded', body: r.error, icon: 'error' }),
      );
      return r;
    }
    this.lo = r.geometry;
    this.geometry = r.geometry;
    this.renderGeometry(r.geometry);
    this.el.dataset.state = 'ready';
    this.el.dataset.geometry = r.geometry.kind;
    if (import.meta.env.DEV && r.geometry.kind === 'dev-states') {
      this.el.append(
        h(
          'div',
          { class: 'atlas-map__dev', role: 'note' },
          h('strong', null, 'Dev preview'),
          ' State outlines from the us-atlas package. District boundaries are not built yet; this fallback never ships in a production build.',
        ),
      );
    }
    this.applyData();
    this.resizeObs = new ResizeObserver(debounce(() => this.layoutLabels(), 60));
    this.resizeObs.observe(this.canvas);
    this.layoutLabels();
    if (this.opts.courthouses !== false) void this.loadCities();
    performance.mark('atlas:map-dom-ready');
    // Two frames later the browser has painted the map.
    requestAnimationFrame(() => requestAnimationFrame(() => performance.mark('atlas:first-map-paint')));
    return r;
  }

  private renderGeometry(g: AtlasGeometry): void {
    this.districtLayer.replaceChildren();
    this.paths.clear();
    for (const d of g.districts) {
      const p = s('path', {
        class: 'district base',
        d: d.d,
        'data-id': d.id,
        tabindex: d.navigable ? '0' : '-1',
        role: d.navigable ? 'link' : 'img',
        'aria-label': d.name,
      });
      if (d.region === 'gu' || d.region === 'mp' || d.id === 'vid') p.classList.add('district--tiny');
      this.paths.set(d.id, p);
      this.districtLayer.append(p);
    }
    this.setMeshes(g);
    this.renderChips(g);
  }

  /**
   * Proxy chips for districts too small to see or hover at national scale (newspaper
   * convention): a small square carrying the district's color, offset from it
   * (D.C. offshore with a leader line). They hide once the map is zoomed in.
   */
  private renderChips(g: AtlasGeometry): void {
    this.chipLayer.replaceChildren();
    this.chips.clear();
    const specs: Array<[string, [number, number], string | null]> = [
      ['dcd', [58, 14], 'D.C.'],
      ['vid', [3, 13], null],
      ['nmid', [0, 0], null],
    ];
    for (const [id, off, text] of specs) {
      const d = g.byId.get(id);
      if (!d) continue;
      const leader = text ? s('line', { class: 'chip-leader' }) : null;
      const rect = s('rect', { class: 'district-chip base', 'data-id': id, rx: 1.5, 'aria-hidden': 'true' });
      const label = text ? s('text', { class: 'chip-label' }, text) : null;
      if (leader) this.chipLayer.append(leader);
      this.chipLayer.append(rect);
      if (label) this.chipLayer.append(label);
      this.chips.set(id, { rect, leader, label, off });
    }
  }

  private setMeshes(g: AtlasGeometry): void {
    this.districtMesh.setAttribute('d', g.districtMesh);
    this.stateMesh.setAttribute('d', g.stateMesh);
    this.countyMesh.setAttribute('d', g.countyMesh);
  }

  /* ---- data ----------------------------------------------------------- */

  setData(data: Partial<MapData>): void {
    this.data = { ...this.data, ...data };
    this.applyData();
  }

  getData(): MapData {
    return this.data;
  }

  private applyData(): void {
    if (!this.geometry) return;
    const { variable, values, year, scale } = this.data;
    const hasVar = !!(variable && values);
    this.el.dataset.hasData = String(hasVar);
    for (const [id, p] of this.paths) {
      let cls = 'district';
      if (p.classList.contains('district--tiny')) cls += ' district--tiny';
      if (!hasVar) cls += ' base';
      else {
        const v = getValue(values, id, year);
        const q = scale?.classOf(v) ?? null;
        cls += q === null ? ' nodata' : ` q${q}`;
      }
      if (p.classList.contains('is-match')) cls += ' is-match';
      p.setAttribute('class', cls);
      p.setAttribute('aria-label', this.ariaFor(id));
      const chip = this.chips.get(id);
      if (chip) chip.rect.setAttribute('class', cls.replace('district--tiny', '').replace(/^district/, 'district-chip'));
    }
    // Keep an open tooltip (hovered, focused or pinned) in sync with the new data/year.
    if (this.hovered && this.tooltip.open) this.refreshTooltip();
  }

  private shape(id: string): DistrictShape | undefined {
    return this.geometry?.byId.get(id) ?? this.lo?.byId.get(id);
  }

  private ariaFor(id: string): string {
    const custom = this.opts.ariaLabelFor?.(id, this.data);
    if (custom) return custom;
    const d = this.shape(id);
    const name = d?.name ?? id;
    const { variable, values, year } = this.data;
    if (!variable || !values) return d?.circuit ? `${name}, ${circuitLabel(d.circuit)}` : name;
    const v = getValue(values, id, year);
    const parts = [`${name}, ${variable.label}: ${formatValue(v, variable)}`];
    const rt = rankText(getRank(values, id, year), rankedCount(values, year));
    if (v !== null && rt) parts.push(rt);
    if (year !== null) parts.push(periodLabel(year, values.period_type));
    return parts.join(', ');
  }

  /** Highlight one quantile step (legend hover); null clears. */
  highlightStep(step: number | null): void {
    this.el.classList.toggle('is-filtering', step !== null);
    for (const p of this.paths.values()) p.classList.toggle('is-match', step !== null && p.classList.contains(`q${step}`));
    for (const c of this.chips.values()) c.rect.classList.toggle('is-match', step !== null && c.rect.classList.contains(`q${step}`));
  }

  /* ---- tooltip ------------------------------------------------------- */

  private tooltipContent(id: string, pinned: boolean): HTMLElement {
    const d = this.shape(id);
    const { variable, values, year } = this.data;
    const box = h('div', { class: 'map-tip__inner' });
    box.append(h('p', { class: 'map-tip__name' }, d?.name ?? id));
    const custom = this.opts.tooltipBody?.(id, this.data) ?? null;
    if (custom) {
      box.append(custom);
    } else if (variable && values) {
      const v = getValue(values, id, year);
      const valueEl = h('p', { class: `map-tip__value${v === null ? ' is-missing' : ''}` });
      if (v === null) valueEl.append('No data');
      else {
        const full = formatValue(v, variable);
        const num = formatValue(v, variable, { unit: false });
        const rest = full.startsWith(num) ? full.slice(num.length) : '';
        valueEl.append(h('span', { class: 'num' }, rest ? num : full), rest ? h('span', { class: 'map-tip__unit' }, rest) : '');
      }
      box.append(h('p', { class: 'map-tip__label' }, variable.short_label ?? variable.label), valueEl);
      const meta: string[] = [];
      const rt = v !== null ? rankText(getRank(values, id, year), rankedCount(values, year)) : null;
      if (rt) meta.push(rt);
      if (year !== null) meta.push(periodLabel(year, values.period_type));
      if (meta.length) box.append(h('p', { class: 'map-tip__meta' }, meta.join(' · ')));
    } else if (d?.circuit) {
      box.append(h('p', { class: 'map-tip__meta' }, circuitLabel(d.circuit)));
    }
    if (pinned && d?.navigable) {
      const href = this.opts.hrefFor?.(id) ?? `#/district/${id}`;
      const a = h('a', { class: 'map-tip__link', href }, 'Open district profile', h('span', { 'aria-hidden': 'true' }, ' →'));
      a.addEventListener('click', (e) => {
        if (this.opts.onSelect) {
          e.preventDefault();
          this.opts.onSelect(id);
        }
      });
      box.append(a);
    }
    return box;
  }

  private refreshTooltip(): void {
    if (!this.hovered) return;
    this.tooltip.el.replaceChildren(this.tooltipContent(this.hovered, this.tooltip.pinned));
  }

  private pointIn(event: PointerEvent | MouseEvent): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [event.clientX - r.left, event.clientY - r.top];
  }

  private setOutline(id: string | null): void {
    const d = id ? this.pathD(id) : '';
    this.hoverHalo.setAttribute('d', d);
    this.hoverLine.setAttribute('d', d);
  }

  private pathD(id: string): string {
    return this.paths.get(id)?.getAttribute('d') ?? '';
  }

  private hover(id: string | null, event?: PointerEvent): void {
    if (this.tooltip.pinned && id !== this.hovered) return;
    if (id !== this.hovered) {
      this.hovered = id;
      this.setOutline(id);
      if (!id) {
        this.tooltip.hide();
        return;
      }
      if (event) {
        const [x, y] = this.pointIn(event);
        this.tooltip.show(this.tooltipContent(id, false), x, y);
      }
    } else if (id && event) {
      const [x, y] = this.pointIn(event);
      this.tooltip.move(x, y);
    }
  }

  /** Tooltip anchored at a district's centroid (keyboard focus, tap). */
  private showAtCentroid(id: string, pinned: boolean): void {
    const d = this.shape(id);
    if (!d) return;
    const ctm = this.svg.getScreenCTM();
    const r = this.el.getBoundingClientRect();
    if (!ctm) return;
    const [cx, cy] = this.transform.apply(d.centroid);
    const pt = new DOMPoint(cx, cy).matrixTransform(ctm);
    this.hovered = id;
    this.setOutline(id);
    this.tooltip.show(this.tooltipContent(id, pinned), pt.x - r.left, pt.y - r.top, { pinned });
  }

  /* ---- events -------------------------------------------------------- */

  private idFromEvent(e: Event): string | null {
    const t = e.target as Element | null;
    const p = t?.closest?.('path.district, rect.district-chip') as SVGElement | null;
    return p?.dataset.id ?? null;
  }

  private bindEvents(): void {
    const layer = this.districtLayer;
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => {
      this.lastPointerType = e.pointerType;
    });
    svg.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || this.el.classList.contains('is-zooming')) return;
      this.hover(this.idFromEvent(e), e);
    });
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch' && !this.tooltip.pinned) this.hover(null);
    });
    svg.addEventListener('click', (e) => {
      const id = this.idFromEvent(e);
      if (!id) return;
      const d = this.shape(id);
      if (this.lastPointerType === 'touch') {
        // Tap: show a pinned tooltip with a link; a second tap on the same district opens it.
        if (this.tooltip.pinned && this.hovered === id && d?.navigable) return this.select(id);
        this.tooltip.pinned = false;
        this.showAtCentroid(id, true);
        return;
      }
      if (d?.navigable) this.select(id);
    });
    // Tap outside a district closes a pinned tooltip.
    this.svg.addEventListener('click', (e) => {
      if (!this.idFromEvent(e) && this.tooltip.pinned) {
        this.tooltip.hide();
        this.hovered = null;
        this.setOutline(null);
      }
    });
    layer.addEventListener('keydown', (e) => {
      const id = this.idFromEvent(e);
      if (!id) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.shape(id)?.navigable) this.select(id);
      }
    });
    layer.addEventListener('focusin', (e) => {
      const id = this.idFromEvent(e);
      if (!id) return;
      this.focused = id;
      this.ensureVisible(id);
      this.tooltip.pinned = false;
      this.showAtCentroid(id, false);
    });
    layer.addEventListener('focusout', () => {
      this.focused = null;
      if (!this.tooltip.pinned) {
        this.hovered = null;
        this.setOutline(null);
        this.tooltip.hide();
      }
    });
    this.el.addEventListener('keydown', (e) => this.onKey(e));
    this.el.addEventListener('pointerdown', () => {
      this.wheelArmed = true;
    });
    this.el.addEventListener('pointerleave', () => {
      this.wheelArmed = false;
    });
    this.el.addEventListener('focusin', () => {
      this.wheelArmed = true;
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const pan = 60;
    const ctm = this.svg.getScreenCTM();
    const unit = ctm ? pan / ctm.a : pan;
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        this.zoomBy(1.6);
        break;
      case '-':
      case '_':
        e.preventDefault();
        this.zoomBy(1 / 1.6);
        break;
      case '0':
        e.preventDefault();
        this.reset();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? unit : e.key === 'ArrowRight' ? -unit : 0;
        const dy = e.key === 'ArrowUp' ? unit : e.key === 'ArrowDown' ? -unit : 0;
        this.svgSel.transition().duration(durationMs('--dur-fast', 140)).call(this.zoom.translateBy, dx / this.transform.k, dy / this.transform.k);
        break;
      }
      case 'Escape':
        if (this.tooltip.open) {
          this.tooltip.hide();
          this.hovered = null;
          this.setOutline(null);
        }
        break;
      default:
    }
  }

  private select(id: string): void {
    if (this.opts.onSelect) this.opts.onSelect(id);
    else location.hash = this.opts.hrefFor?.(id) ?? `#/district/${id}`;
  }

  /* ---- zoom ---------------------------------------------------------- */

  private zoomFilter(event: Event): boolean {
    const type = event.type;
    if (type === 'wheel') {
      const we = event as WheelEvent;
      if (we.ctrlKey || we.metaKey || this.wheelArmed || this.transform.k > 1.01) return true;
      this.showHint('Click the map or hold Ctrl/⌘ while scrolling to zoom');
      return false;
    }
    if (type.startsWith('touch')) {
      const te = event as TouchEvent;
      // One finger at national view scrolls the page; pinch always zooms; drag pans once zoomed.
      return te.touches.length > 1 || this.transform.k > 1.01;
    }
    if (type === 'mousedown') return (event as MouseEvent).button === 0 && !(event as MouseEvent).ctrlKey;
    return true;
  }

  private showHint(text: string): void {
    this.hint.textContent = text;
    this.hint.dataset.show = 'true';
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => (this.hint.dataset.show = 'false'), 1400);
  }

  private updateTouchAction(): void {
    // Let the page scroll vertically over the map until the reader zooms in.
    this.svg.style.touchAction = this.transform.k > 1.01 ? 'none' : 'pan-y';
  }

  private onZoom(t: ZoomTransform): void {
    this.transform = t;
    this.zoomLayer.setAttribute('transform', t.toString());
    this.el.dataset.zoomed = String(t.k > 1.01);
    this.updateLabelPositions();
    if (this.tooltip.open && !this.tooltip.pinned && this.focused) this.showAtCentroid(this.focused, false);
    else if (this.tooltip.pinned) this.tooltip.hide();
  }

  private onZoomEnd(): void {
    this.el.classList.remove('is-zooming');
    this.updateTouchAction();
    this.layoutLabels();
    void this.checkResolution();
  }

  private chipPx = 10;

  private updateLabelPositions = rafThrottle(() => {
    const t = this.transform;
    for (const node of this.labelLayer.querySelectorAll<SVGTextElement>('text[data-x]')) {
      const x = t.applyX(Number(node.dataset.x));
      const y = t.applyY(Number(node.dataset.y));
      node.setAttribute('x', String(x + Number(node.dataset.dx)));
      node.setAttribute('y', String(y + Number(node.dataset.dy)));
    }
    // Chips: anchored to their district's centroid, offset in base units (not scaled by zoom).
    const ctm = this.svg.getScreenCTM();
    const sc = ctm?.a || 1;
    const size = this.chipPx / sc;
    for (const [id, c] of this.chips) {
      const d = this.shape(id);
      if (!d) continue;
      const [cx, cy] = t.apply(d.centroid);
      const x = cx + c.off[0];
      const y = cy + c.off[1];
      c.rect.setAttribute('x', String(x - size / 2));
      c.rect.setAttribute('y', String(y - size / 2));
      c.rect.setAttribute('width', String(size));
      c.rect.setAttribute('height', String(size));
      if (c.leader) {
        c.leader.setAttribute('x1', String(cx));
        c.leader.setAttribute('y1', String(cy));
        c.leader.setAttribute('x2', String(x - size / 2));
        c.leader.setAttribute('y2', String(y));
      }
      if (c.label) {
        c.label.setAttribute('x', String(x + size / 2 + 3 / sc));
        c.label.setAttribute('y', String(y + 3.5 / sc));
        c.label.setAttribute('font-size', String(10 / sc));
      }
    }
  });

  zoomBy(factor: number): void {
    this.svgSel.transition().duration(durationMs('--dur-map', 600)).call(this.zoom.scaleBy, factor);
  }

  reset(): void {
    this.tooltip.hide();
    this.svgSel.transition().duration(durationMs('--dur-map', 600)).call(this.zoom.transform, zoomIdentity);
  }

  /** Smoothly zoom to frame a district. */
  zoomToDistrict(id: string, maxK = 8): void {
    const d = this.shape(id);
    if (!d) return;
    const [[x0, y0], [x1, y1]] = d.bounds;
    const k = Math.min(maxK, 0.8 / Math.max((x1 - x0) / VIEW_W, (y1 - y0) / VIEW_H));
    const t = zoomIdentity
      .translate(VIEW_W / 2, VIEW_H / 2)
      .scale(Math.max(1, k))
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    this.svgSel.transition().duration(durationMs('--dur-map', 750)).call(this.zoom.transform, t);
  }

  private ensureVisible(id: string): void {
    if (this.transform.k <= 1.01) return;
    const d = this.shape(id);
    if (!d) return;
    const [cx, cy] = this.transform.apply(d.centroid);
    if (cx < 20 || cy < 20 || cx > VIEW_W - 20 || cy > VIEW_H - 20) {
      const k = this.transform.k;
      const t = zoomIdentity.translate(VIEW_W / 2, VIEW_H / 2).scale(k).translate(-d.centroid[0], -d.centroid[1]);
      this.svgSel.transition().duration(durationMs('--dur-base', 220)).call(this.zoom.transform, t);
    }
  }

  private ensureHi(): Promise<void> {
    if (this.hiState !== 'idle') return this.hiPromise ?? Promise.resolve();
    this.hiState = 'loading';
    this.hiPromise = loadHiGeometry().then((r) => {
      if (r.status === 'ok') {
        this.hi = r.geometry;
        this.hiState = 'ready';
      } else this.hiState = 'missing';
    });
    return this.hiPromise;
  }

  private async checkResolution(): Promise<void> {
    const k = this.transform.k;
    if (this.lo?.kind !== 'districts') return;
    // Prefetch one zoom step early so the swap itself is instant.
    if (k >= HI_PREFETCH_K) void this.ensureHi();
    if (k >= HI_RES_K && this.geometry === this.lo) {
      await this.ensureHi();
      if (this.destroyed) return;
      if (this.hi && this.transform.k >= HI_RES_K && this.geometry !== this.hi) this.swapGeometry(this.hi);
    } else if (k < HI_RES_K - 0.4 && this.geometry === this.hi && this.lo) {
      this.swapGeometry(this.lo);
    }
  }

  private swapGeometry(g: AtlasGeometry): void {
    this.geometry = g;
    for (const [id, p] of this.paths) {
      const shape = g.byId.get(id);
      if (shape) p.setAttribute('d', shape.d);
    }
    this.setMeshes(g);
    this.el.dataset.resolution = g.resolution;
    if (this.hovered) this.setOutline(this.hovered);
  }

  /* ---- courthouses + labels ------------------------------------------ */

  private async loadCities(): Promise<void> {
    const r = await loadCourthouses();
    if (this.destroyed || r.status !== 'ok') return;
    const proj = atlasProjection();
    const byCity = new Map<string, CityPoint & { kinds: Set<string> }>();
    for (const c of r.data as Courthouse[]) {
      const key = `${c.city}|${c.state}`.toLowerCase();
      let p = byCity.get(key);
      if (!p) {
        const xy = proj.project(c.lon, c.lat, c.state);
        if (!xy) continue;
        p = { id: key, city: c.city, state: c.state, district_id: c.district_id, x: xy[0], y: xy[1], priority: 0, names: [], kinds: new Set() };
        byCity.set(key, p);
      }
      p.priority += 1;
      p.kinds.add(c.kind);
      if (c.name) p.names.push(c.name);
    }
    const all = [...byCity.values()];
    this.cities = all.map((p) => ({ ...p, priority: p.priority + (p.kinds.has('courthouse') ? 2 : 0) }));
    const dot = (c: { x: number; y: number }) => `M${c.x.toFixed(1)} ${c.y.toFixed(1)}h0`;
    this.dotRing.setAttribute('d', all.map(dot).join(''));
    this.dots.setAttribute('d', all.map(dot).join(''));
    if (this.opts.courthouseKinds) {
      // Solid: a place of holding court named by statute. Open ring (a background-colored
      // center drawn over the dot): a city with only a courthouse building on the FJC list.
      const open = all.filter((c) => !c.kinds.has('place_of_holding_court'));
      this.dotsOpen.setAttribute('d', open.map(dot).join(''));
      this.el.dataset.courthousesOpen = String(open.length);
    }
    this.el.dataset.courthouses = String(this.cities.length);
    this.layoutLabels();
  }

  /**
   * On a phone the Guam, Northern Mariana Islands and Puerto Rico + Virgin Islands frames are too small for a
   * name inside. At national view their names sit in a row in the free space under the inset cluster (left of
   * the zoom buttons), each joined to its frame by a short leader line. Hidden once zoomed (the frames then
   * grow and carry their own labels) or when there is no free row (wide screens, where every frame has a label).
   */
  private layoutInsetKey(items: Array<{ text: string; cx: number; bottom: number }>, px: number, font: string, width: number): void {
    const key = this.insetKey;
    key.replaceChildren();
    const t = this.transform;
    const svgH = this.svg.clientHeight;
    const room = this.el.clientHeight - svgH;
    const national = Math.abs(t.k - 1) < 0.01 && Math.abs(t.x) < 1 && Math.abs(t.y) < 1;
    if (!items.length || !national || room < px + 14) {
      key.style.display = 'none';
      return;
    }
    key.style.display = '';
    const controls = this.el.querySelector<HTMLElement>('.atlas-map__controls');
    const elBox = this.el.getBoundingClientRect();
    const limit = Math.min(width, controls ? controls.getBoundingClientRect().left - elBox.left - 8 : width);
    const rowY = svgH + 8 + px; // text baseline
    const gap = 10;
    const placed = items
      .sort((a, b) => a.cx - b.cx)
      .map((it) => ({ ...it, w: measureText(it.text, font) * 1.1, x: 0 }));
    let right = 2;
    for (const p of placed) {
      p.x = Math.max(p.cx - p.w / 2, right);
      right = p.x + p.w + gap;
    }
    // Pull the row back from the zoom buttons if it runs into them.
    let over = right - gap - limit;
    for (let i = placed.length - 1; i >= 0 && over > 0; i--) {
      const p = placed[i]!;
      const minX = i === 0 ? 2 : placed[i - 1]!.x + placed[i - 1]!.w + gap;
      const shift = Math.min(over, p.x - minX);
      if (shift > 0) {
        for (let j = i; j < placed.length; j++) placed[j]!.x -= shift;
        over -= shift;
      }
    }
    if (over > 0) {
      key.style.display = 'none';
      return;
    }
    for (const p of placed) {
      const lx = p.x + p.w / 2;
      key.append(
        s('path', { class: 'inset-key__leader', d: `M${p.cx.toFixed(1)} ${(p.bottom + 1).toFixed(1)}L${p.cx.toFixed(1)} ${(p.bottom + 4).toFixed(1)}L${lx.toFixed(1)} ${(rowY - px - 1).toFixed(1)}` }),
      );
      const tx = s('text', { class: 'inset-key__label', x: p.x.toFixed(1), y: rowY.toFixed(1), 'font-size': px });
      tx.textContent = p.text;
      key.append(tx);
    }
  }

  private layoutLabels(): void {
    if (!this.geometry) return;
    const ctm = this.svg.getScreenCTM();
    const sc = ctm?.a || this.svg.clientWidth / VIEW_W || 1;
    const t = this.transform;
    const width = this.svg.clientWidth || VIEW_W * sc;
    const height = this.svg.clientHeight || VIEW_H * sc;
    // Inset labels: fixed screen size, inside each frame's top-left corner; the short
    // form is used when the full name does not fit, and nothing when neither fits.
    this.insetLabels.replaceChildren();
    const insetPx = width < 520 ? 8.5 : 9.5;
    const insetFont = `600 ${insetPx}px ${getComputedStyle(this.el).getPropertyValue('--font-sans') || 'sans-serif'}`;
    const reserved: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const unlabelled: Array<{ text: string; cx: number; bottom: number }> = [];
    for (const r of atlasProjection().regions) {
      if (!r.box) continue;
      const [[x0, y0], [x1]] = r.box;
      const frameW = (x1 - x0) * sc * t.k;
      const full = r.label.toUpperCase();
      const short = ({ ak: 'AK', hi: 'HI', gu: 'GU', mp: 'MP', prvi: 'PR · VI' } as Record<string, string>)[r.id] ?? full;
      const fits = (txt: string) => measureText(txt, insetFont) * 1.1 + 8 <= frameW;
      // On a phone the label is taller than the row the projection reserves above the shapes, so it can land on
      // the land itself (P.R. & V.I. at 375 px). Sample the label's box against the region's own district shapes
      // and treat a hit like a label that does not fit.
      const fx = t.applyX(x0) * sc;
      const fy = t.applyY(y0) * sc;
      const regionPaths = this.geometry.districts
        .filter((d) => d.region === r.id)
        .map((d) => this.paths.get(d.id))
        .filter((p): p is SVGPathElement => !!p);
      const onLand = (txt: string) => {
        const w = measureText(txt, insetFont) * 1.1;
        for (let i = 0; i <= 6; i++) {
          for (let j = 0; j <= 2; j++) {
            const px = fx + 4 + (w * i) / 6;
            const py = fy + 3 + (insetPx * j) / 2;
            const pt = new DOMPoint((px / sc - t.x) / t.k, (py / sc - t.y) / t.k);
            if (regionPaths.some((p) => p.isPointInFill(pt))) return true;
          }
        }
        return false;
      };
      const ok = (txt: string) => fits(txt) && !onLand(txt);
      const text = ok(full) ? full : ok(short) ? short : '';
      if (!text) {
        unlabelled.push({ text: full, cx: t.applyX((x0 + r.box[1][0]) / 2) * sc, bottom: t.applyY(r.box[1][1]) * sc });
        continue;
      }
      const node = s('text', {
        class: 'inset-label',
        'data-x': x0,
        'data-y': y0,
        'data-dx': 4 / sc,
        'data-dy': (insetPx + 3) / sc,
        'font-size': insetPx / sc,
      });
      node.textContent = text;
      this.insetLabels.append(node);
      const sx = t.applyX(x0) * sc;
      const sy = t.applyY(y0) * sc;
      reserved.push({ x0: sx, y0: sy, x1: sx + measureText(text, insetFont) * 1.1 + 8, y1: sy + insetPx + 6 });
    }

    this.layoutInsetKey(unlabelled, insetPx, insetFont, width);

    // Proxy chips: visible at national scale only (zoomed in, the real shapes are big enough).
    this.chipPx = width < 520 ? 9 : 10;
    this.chipLayer.style.display = t.k >= 4 ? 'none' : '';

    // City labels: only once zoomed in, priority-ordered, collision-avoided.
    this.cityLabels.replaceChildren();
    if (t.k >= LABELS_K && this.cities.length) {
      const fontPx = t.k >= 4 ? 12 : 11;
      const font = `500 ${fontPx}px ${getComputedStyle(this.el).getPropertyValue('--font-sans') || 'sans-serif'}`;
      const cands: LabelCandidate[] = [];
      for (const c of this.cities) {
        const x = t.applyX(c.x) * sc;
        const y = t.applyY(c.y) * sc;
        if (x < 0 || y < 0 || x > width || y > height) continue;
        cands.push({ id: c.id, text: c.city, x, y, priority: c.priority });
      }
      const maxLabels = t.k < 3 ? 18 : t.k < 6 ? 60 : 200;
      const placed = placeLabels(cands, { font, fontSize: fontPx, width, height, reserved }).slice(0, maxLabels);
      const byId = new Map(this.cities.map((c) => [c.id, c]));
      for (const p of placed) {
        const c = byId.get(p.id)!;
        const node = s('text', {
          class: 'city-label',
          'data-x': c.x,
          'data-y': c.y,
          'data-dx': p.dx / sc,
          'data-dy': p.dy / sc,
          'text-anchor': p.anchor,
          'font-size': fontPx / sc,
        });
        node.textContent = p.text;
        this.cityLabels.append(node);
      }
    }
    this.updateLabelPositions();
  }

  /* ---- lifecycle ----------------------------------------------------- */

  focusDistrict(id: string): void {
    this.paths.get(id)?.focus();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObs?.disconnect();
    this.svgSel.interrupt();
    this.svgSel.on('.zoom', null);
    this.tooltip.destroy();
    this.el.remove();
  }
}
