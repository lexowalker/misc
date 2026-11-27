// Home variable switcher: four family tabs (Speed, Workload, Sentencing, Case mix), a strip
// of small-multiple thumbnail maps (toggle buttons with aria-pressed), and an accessible
// <select> listing every measure. Thumbnails are drawn only after the main map has
// painted, and only as they scroll into view, so they never delay the first map paint.

import { h, uniqueId } from '../lib/dom.ts';
import type { Variable } from '../data/types.ts';
import { getValue, latestYear, loadValues } from '../data/loaders.ts';
import { loadAtlasGeometry, type AtlasGeometry } from '../map/geo.ts';
import { renderThumbnail } from '../map/thumbnail.ts';
import { scaleForValues } from '../map/scale.ts';
import { periodLabel } from '../lib/format.ts';
import { term } from '../components/glossary.ts';
import { termsForVariables } from '../content/variable-terms.ts';

export const FAMILY_ORDER = ['speed', 'workload', 'sentencing', 'casemix'] as const;
export const FAMILY_LABEL: Record<string, string> = { speed: 'Speed', workload: 'Workload', sentencing: 'Sentencing', casemix: 'Case mix' };
const FAMILY_DEK: Record<string, string> = {
  speed: 'How long cases take',
  workload: 'How much work each court carries',
  sentencing: 'How people convicted are sentenced',
  casemix: 'What kinds of cases come in',
};

const ARROW_L = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function familyOf(v: Variable): string {
  return (FAMILY_ORDER as readonly string[]).includes(v.family) ? v.family : 'other';
}

export class VariableSwitcher {
  readonly el: HTMLElement;
  readonly select: HTMLSelectElement;
  private vars: Variable[];
  private byFamily = new Map<string, Variable[]>();
  private tabs = new Map<string, HTMLButtonElement>();
  private strips = new Map<string, HTMLDivElement>();
  private thumbs = new Map<string, HTMLButtonElement>();
  private panel: HTMLDivElement;
  private panelDek: HTMLParagraphElement;
  private termsRow: HTMLParagraphElement;
  private termsByFamily = new Map<string, Array<Node | string>>();
  private scroller: HTMLDivElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private family = 'speed';
  private activeId: string;
  private onPick: (v: Variable) => void;
  private thumbsOn = false;
  private geometry: AtlasGeometry | null = null;
  private io: IntersectionObserver | null = null;
  private rendered = new Set<string>();
  private uid = uniqueId('vswitch');

  constructor(container: HTMLElement, vars: Variable[], activeId: string, onPick: (v: Variable) => void) {
    this.vars = vars;
    this.activeId = activeId;
    this.onPick = onPick;
    for (const v of vars) {
      const f = familyOf(v);
      (this.byFamily.get(f) ?? this.byFamily.set(f, []).get(f)!).push(v);
    }
    const families = [...FAMILY_ORDER, 'other'].filter((f) => this.byFamily.has(f));

    // Accessible select: every measure, grouped by family.
    this.select = h('select', { id: 'variable-select', class: 'vswitch__select' });
    for (const f of families) {
      const og = h('optgroup', { label: FAMILY_LABEL[f] ?? 'Other' });
      for (const v of this.byFamily.get(f)!) og.append(h('option', { value: v.id }, v.label));
      this.select.append(og);
    }
    this.select.value = activeId;
    this.select.addEventListener('change', () => {
      const v = this.vars.find((x) => x.id === this.select.value);
      if (v) this.pick(v, false);
    });

    // Family tabs.
    const tablist = h('div', { class: 'vswitch__tabs', role: 'tablist', 'aria-label': 'Families of measures' });
    const panelId = `${this.uid}-panel`;
    for (const f of families) {
      const n = this.byFamily.get(f)!.length;
      const tab = h(
        'button',
        { type: 'button', role: 'tab', id: `${this.uid}-tab-${f}`, class: 'vswitch__tab', 'aria-selected': 'false', 'aria-controls': panelId, tabindex: '-1', 'data-family': f },
        h('span', { class: 'vswitch__tab-name' }, FAMILY_LABEL[f] ?? 'Other'),
        h('span', { class: 'vswitch__tab-count num' }, String(n)),
      );
      tab.addEventListener('click', () => this.showFamily(f, true));
      tablist.append(tab);
      this.tabs.set(f, tab);
    }
    tablist.addEventListener('keydown', (e) => {
      const order = [...this.tabs.keys()];
      const i = order.indexOf(this.family);
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % order.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + order.length) % order.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = order.length - 1;
      if (j < 0) return;
      e.preventDefault();
      this.showFamily(order[j]!, true);
      this.tabs.get(order[j]!)!.focus();
    });

    this.panelDek = h('p', { class: 'vswitch__dek' });
    // The thumbnails are buttons, so a glossary term cannot sit inside one: the family's legal terms are listed
    // under the strip instead, each with its definition popover.
    this.termsRow = h('p', { class: 'vswitch__terms' });
    this.scroller = h('div', { class: 'vswitch__scroller' });
    this.prevBtn = h('button', { type: 'button', class: 'vswitch__nav vswitch__nav--prev', tabindex: '-1', 'aria-hidden': 'true', html: ARROW_L });
    this.nextBtn = h('button', { type: 'button', class: 'vswitch__nav vswitch__nav--next', tabindex: '-1', 'aria-hidden': 'true', html: ARROW_R });
    this.prevBtn.addEventListener('click', () => this.page(-1));
    this.nextBtn.addEventListener('click', () => this.page(1));
    this.panel = h('div', { id: panelId, class: 'vswitch__panel', role: 'tabpanel' }, this.panelDek, h('div', { class: 'vswitch__viewport' }, this.prevBtn, this.scroller, this.nextBtn), this.termsRow);
    this.scroller.addEventListener('scroll', () => this.updateNav(), { passive: true });

    const selectId = 'variable-select';
    this.el = h(
      'section',
      { class: 'vswitch', 'aria-label': 'Choose a measure' },
      h(
        'div',
        { class: 'vswitch__bar' },
        tablist,
        h('div', { class: 'vswitch__all' }, h('label', { class: 'vswitch__all-label caps', for: selectId }, 'All measures'), h('div', { class: 'vswitch__select-wrap' }, this.select)),
      ),
      this.panel,
    );
    container.append(this.el);
    const active = this.vars.find((v) => v.id === activeId);
    this.showFamily(active ? familyOf(active) : families[0]!, false);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.updateNav()).observe(this.scroller);
  }

  /** Mark a variable as the one on the map (does not call onPick). */
  setActive(id: string): void {
    this.activeId = id;
    this.select.value = id;
    for (const [vid, b] of this.thumbs) b.setAttribute('aria-pressed', String(vid === id));
    const v = this.vars.find((x) => x.id === id);
    const f = v ? familyOf(v) : this.family;
    for (const [fam, tab] of this.tabs) tab.classList.toggle('has-active', fam === f);
    if (f !== this.family) this.showFamily(f, false);
    this.revealActive();
  }

  /** Start drawing thumbnails (call after the main map has painted). */
  enableThumbnails(): void {
    if (this.thumbsOn) return;
    this.thumbsOn = true;
    void loadAtlasGeometry().then((g) => {
      if (g.status !== 'ok') return;
      this.geometry = g.geometry;
      if (typeof IntersectionObserver === 'function') {
        this.io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              const id = (e.target as HTMLElement).dataset.variable!;
              this.io!.unobserve(e.target);
              void this.drawThumb(id);
            }
          },
          { rootMargin: '0px 0px 120px 0px' },
        );
      }
      this.observeFamily(this.family);
    });
  }

  private observeFamily(f: string): void {
    if (!this.geometry) return;
    for (const v of this.byFamily.get(f) ?? []) {
      if (this.rendered.has(v.id)) continue;
      const b = this.thumbs.get(v.id);
      if (!b) continue;
      if (this.io) this.io.observe(b);
      else void this.drawThumb(v.id);
    }
  }

  private async drawThumb(id: string): Promise<void> {
    if (this.rendered.has(id) || !this.geometry) return;
    this.rendered.add(id);
    const btn = this.thumbs.get(id);
    const v = this.vars.find((x) => x.id === id);
    if (!btn || !v) return;
    const slot = btn.querySelector<HTMLElement>('.vthumb__map')!;
    const r = await loadValues(id);
    const geometry = this.geometry;
    if (r.status !== 'ok') {
      slot.replaceChildren(renderThumbnail({ geometry, title: `${v.label}: no values published` }));
      slot.dataset.state = 'missing';
      return;
    }
    const file = r.data;
    const y = latestYear(file);
    const scale = scaleForValues(file, 'all', y);
    const svg = renderThumbnail({
      geometry,
      title: `${v.label}, ${y !== null ? periodLabel(y, file.period_type) : ''}`,
      classOf: (d) => (scale ? scale.classOf(getValue(file, d, y)) : null),
    });
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
    slot.replaceChildren(svg);
    slot.dataset.state = 'ready';
    if (y !== null) btn.dataset.year = String(y);
  }

  private pick(v: Variable, fromThumb: boolean): void {
    this.setActive(v.id);
    this.onPick(v);
    if (fromThumb) this.thumbs.get(v.id)?.focus({ preventScroll: true });
  }

  private showFamily(f: string, user: boolean): void {
    this.family = f;
    for (const [fam, tab] of this.tabs) {
      const on = fam === f;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    this.panel.setAttribute('aria-labelledby', `${this.uid}-tab-${f}`);
    this.panelDek.textContent = `${FAMILY_DEK[f] ?? ''}. Small maps show each measure's latest year.`;
    let strip = this.strips.get(f);
    if (!strip) {
      strip = this.buildStrip(f);
      this.strips.set(f, strip);
    }
    this.scroller.replaceChildren(strip);
    this.showTerms(f);
    this.scroller.scrollLeft = 0;
    this.observeFamily(f);
    if (!user) this.revealActive();
    this.updateNav();
  }

  private showTerms(f: string): void {
    let nodes = this.termsByFamily.get(f);
    if (!nodes) {
      const ids = termsForVariables((this.byFamily.get(f) ?? []).map((v) => v.id));
      const list: Array<Node | string> = ids.length
        ? [h('span', { class: 'vswitch__terms-label' }, 'Terms in these measures: '), ...ids.flatMap((id, i) => [i ? ', ' : '', term(id, undefined, { label: true })])]
        : [];
      this.termsByFamily.set(f, list);
      nodes = list;
    }
    this.termsRow.replaceChildren(...nodes);
    this.termsRow.hidden = !nodes.length;
  }

  private buildStrip(f: string): HTMLDivElement {
    const strip = h('div', { class: 'vswitch__strip', role: 'group', 'aria-label': `${FAMILY_LABEL[f] ?? 'Other'} measures` });
    for (const v of this.byFamily.get(f) ?? []) {
      const b = h(
        'button',
        {
          type: 'button',
          class: 'vthumb',
          'aria-pressed': String(v.id === this.activeId),
          'data-variable': v.id,
          title: v.label,
        },
        h('span', { class: 'vthumb__map', 'aria-hidden': 'true', 'data-state': 'pending' }),
        h('span', { class: 'vthumb__label' }, v.short_label ?? v.label),
      );
      b.addEventListener('click', () => this.pick(v, true));
      strip.append(b);
      this.thumbs.set(v.id, b);
    }
    strip.addEventListener('keydown', (e) => {
      const items = [...strip.querySelectorAll<HTMLButtonElement>('.vthumb')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = Math.min(items.length - 1, i + 1);
      else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = items.length - 1;
      if (j < 0) return;
      e.preventDefault();
      items[j]!.focus();
    });
    return strip;
  }

  /** Scroll the strip (not the page) so the pressed thumbnail is visible. */
  private revealActive(): void {
    const b = this.thumbs.get(this.activeId);
    if (!b || !this.scroller.contains(b)) return;
    requestAnimationFrame(() => {
      const sl = this.scroller;
      // The scroller is position: relative, so offsetLeft is measured from its padding edge.
      const left = b.offsetLeft;
      if (left < sl.scrollLeft || left + b.offsetWidth > sl.scrollLeft + sl.clientWidth) {
        sl.scrollLeft = Math.max(0, left - 24);
      }
      this.updateNav();
    });
  }

  private page(dir: number): void {
    const sl = this.scroller;
    sl.scrollBy({ left: dir * sl.clientWidth * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  private updateNav(): void {
    const sl = this.scroller;
    const max = sl.scrollWidth - sl.clientWidth;
    const atStart = sl.scrollLeft <= 2;
    const atEnd = sl.scrollLeft >= max - 2;
    this.el.dataset.overflow = String(max > 2);
    this.prevBtn.hidden = max <= 2 || atStart;
    this.nextBtn.hidden = max <= 2 || atEnd;
    this.scroller.classList.toggle('fade-start', max > 2 && !atStart);
    this.scroller.classList.toggle('fade-end', max > 2 && !atEnd);
  }

  destroy(): void {
    this.io?.disconnect();
    this.el.remove();
  }
}
