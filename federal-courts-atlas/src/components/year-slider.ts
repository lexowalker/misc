// Year slider + play/pause for the time machine. Native range input (full keyboard
// support: arrows, Home/End, PageUp/PageDown), aria-valuetext with the period label,
// and annotation markers for landmark events placed on the right fiscal/calendar year.

import { h, html, uniqueId, prefersReducedMotion } from '../lib/dom.ts';
import { periodLabel } from '../lib/format.ts';
import { EVENTS, periodYear, type AtlasEvent } from '../content/events.ts';

export interface YearSliderOptions {
  years: number[];
  value?: number;
  periodType?: string;
  events?: AtlasEvent[] | false;
  /** Milliseconds per year while playing. */
  interval?: number;
  onChange: (year: number) => void;
  label?: string;
}

const PLAY = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L6.9 3.7a.6.6 0 0 0-.9.5Z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="0.8" fill="currentColor"/><rect x="11.6" y="4" width="3.4" height="12" rx="0.8" fill="currentColor"/></svg>';

export class YearSlider {
  readonly el: HTMLElement;
  private o: YearSliderOptions;
  private input: HTMLInputElement;
  private btn: HTMLButtonElement;
  private out: HTMLOutputElement;
  private timer: ReturnType<typeof setInterval> | undefined;
  private idx: number;
  private track: HTMLDivElement;
  private eventEls: HTMLButtonElement[] = [];
  private tickEls: HTMLElement[] = [];
  private resizeObs: ResizeObserver | null = null;

  constructor(o: YearSliderOptions) {
    this.o = o;
    const years = o.years;
    this.idx = Math.max(0, o.value !== undefined ? years.indexOf(o.value) : years.length - 1);
    if (this.idx < 0) this.idx = years.length - 1;
    const id = uniqueId('year');
    this.btn = h('button', { type: 'button', class: 'year-slider__play', 'aria-label': 'Play animation through the years' }, html(PLAY));
    this.btn.addEventListener('click', () => (this.timer ? this.pause() : this.play()));
    this.input = h('input', {
      id,
      type: 'range',
      class: 'year-slider__input',
      min: 0,
      max: Math.max(0, years.length - 1),
      step: 1,
      value: this.idx,
      'aria-label': o.label ?? 'Year',
    });
    this.input.addEventListener('input', () => {
      this.pause();
      this.set(Number(this.input.value), true);
    });
    this.out = h('output', { class: 'year-slider__value num', for: id, 'aria-hidden': 'true' });

    const track = h('div', { class: 'year-slider__track' });
    this.track = track;
    const markers = h('div', { class: 'year-slider__events' });
    // Phones: the labelled markers above the track do not fit, so the track shows plain diamonds (pips,
    // decorative) and the events are listed under the slider as buttons with visible labels (keys). CSS
    // shows one set or the other, with display:none, so assistive technology meets each event once.
    const pips = h('div', { class: 'year-slider__pips', 'aria-hidden': 'true' });
    const keys = h('ul', { class: 'year-slider__keys', role: 'list' });
    const pos = (i: number) => (years.length > 1 ? (i / (years.length - 1)) * 100 : 50);
    if (o.events !== false) {
      for (const ev of o.events ?? EVENTS) {
        const y = periodYear(ev.date, o.periodType);
        if (y < years[0]! || y > years[years.length - 1]!) continue;
        let i = years.indexOf(y);
        if (i < 0) {
          // Interpolate between neighbors when the exact year is missing from the series.
          const after = years.findIndex((v) => v > y);
          i = after - 1 + (y - years[after - 1]!) / (years[after]! - years[after - 1]!);
        }
        const m = h(
          'button',
          {
            type: 'button',
            class: 'year-slider__event',
            style: `left:${pos(i)}%`,
            title: `${ev.label} (${periodLabel(y, o.periodType)}): ${ev.description}`,
            'aria-label': `Jump to ${periodLabel(y, o.periodType)}: ${ev.label}. ${ev.description}`,
          },
          h('span', { class: 'year-slider__event-label' }, ev.short),
        );
        const jump = () => {
          this.pause();
          const exact = years.indexOf(y);
          this.set(exact >= 0 ? exact : Math.round(i), true);
        };
        m.addEventListener('click', jump);
        markers.append(m);
        this.eventEls.push(m);
        pips.append(h('span', { class: 'year-slider__pip', style: `left:${pos(i)}%` }));
        // The key's name is its visible text (label in name); the marker's longer wording is its description.
        const descId = uniqueId('year-ev');
        const key = h(
          'button',
          { type: 'button', class: 'year-slider__key', 'aria-describedby': descId },
          h('span', { class: 'year-slider__key-mark', 'aria-hidden': 'true' }),
          h('span', { class: 'year-slider__key-label' }, ev.short),
          ' ',
          h('span', { class: 'year-slider__key-year num' }, periodLabel(y, o.periodType)),
          h('span', { id: descId, class: 'visually-hidden' }, `Jump to ${periodLabel(y, o.periodType)}: ${ev.label}. ${ev.description}`),
        );
        key.addEventListener('click', jump);
        keys.append(h('li', null, key));
      }
    }
    const ticks = h('div', { class: 'year-slider__ticks', 'aria-hidden': 'true' });
    const minGap = Math.max(2, Math.ceil(years.length / 8));
    years.forEach((y, i) => {
      const end = i === 0 || i === years.length - 1;
      // Label the ends and round years, but never two labels closer than minGap steps.
      const major = end || (y % 5 === 0 && i >= minGap && years.length - 1 - i >= minGap);
      const tick = h('span', { class: `year-slider__tick${major ? ' is-major' : ''}`, style: `left:${pos(i)}%` }, major ? String(y) : '');
      ticks.append(tick);
      if (major) this.tickEls.push(tick);
    });
    track.append(markers, pips, this.input, ticks);
    this.el = h('div', { class: 'year-slider', role: 'group', 'aria-label': o.label ?? 'Time machine' }, this.btn, track, this.out);
    if (this.eventEls.length) this.el.append(keys);
    this.set(this.idx, false);
    // Event labels that would overlap (e.g. First Step Act, FY 2019, beside COVID-19, FY 2020) are lifted
    // onto a second row, and year labels that would touch are left out, once the slider has a width.
    if (typeof ResizeObserver === 'function') {
      this.resizeObs = new ResizeObserver(() => {
        if (this.eventEls.length > 1) this.layoutEvents();
        this.layoutTicks();
      });
      this.resizeObs.observe(track);
    }
  }

  /**
   * Hide year labels that would touch their neighbor (a long series on a phone); the tick marks stay. When the
   * round-year labels do not all fit, only the ends and the decades are tried, so the labels that remain are
   * evenly spaced; any that still touch are dropped from the left, never the first or last year.
   */
  private layoutTicks(): void {
    const els = this.tickEls;
    els.forEach((e) => e.classList.remove('is-quiet'));
    if (els.length < 3) return;
    const box = (e: HTMLElement) => ({ l: e.offsetLeft - e.offsetWidth / 2, r: e.offsetLeft + e.offsetWidth / 2 });
    const gap = 6;
    const fit = (set: HTMLElement[]): HTMLElement[] => {
      const kept: HTMLElement[] = [set[0]!];
      for (let i = 1; i < set.length; i++) {
        const e = set[i]!;
        const b = box(e);
        if (b.l >= box(kept[kept.length - 1]!).r + gap) {
          kept.push(e);
          continue;
        }
        // The last year is always labelled: drop the label before it instead (never the first).
        if (i === set.length - 1 && kept.length > 1) {
          kept.pop();
          if (b.l >= box(kept[kept.length - 1]!).r + gap) kept.push(e);
        }
      }
      return kept;
    };
    let kept = fit(els);
    if (kept.length < els.length) {
      const decades = els.filter((e, i) => i === 0 || i === els.length - 1 || Number(e.textContent) % 10 === 0);
      kept = fit(decades);
    }
    for (const e of els) if (!kept.includes(e)) e.classList.add('is-quiet');
  }

  private layoutEvents(): void {
    const items = this.eventEls
      .map((el) => {
        el.classList.remove('is-raised');
        const label = el.querySelector<HTMLElement>('.year-slider__event-label');
        const w = label?.offsetWidth ?? 0;
        return { el, w, x: el.offsetLeft };
      })
      .filter((it) => it.w > 0)
      .sort((a, b) => a.x - b.x);
    let lastRight = -Infinity;
    let raised = false;
    for (const it of items) {
      const left = it.x - it.el.offsetWidth / 2;
      if (left < lastRight + 6) {
        it.el.classList.add('is-raised');
        raised = true;
        // A raised label does not block the next one on the base row.
        continue;
      }
      lastRight = left + it.el.offsetWidth;
    }
    this.track.classList.toggle('has-raised', raised);
  }

  get year(): number {
    return this.o.years[this.idx]!;
  }

  setValue(year: number): void {
    const i = this.o.years.indexOf(year);
    if (i >= 0) this.set(i, false);
  }

  private set(i: number, emit: boolean): void {
    this.idx = Math.max(0, Math.min(this.o.years.length - 1, i));
    this.input.value = String(this.idx);
    const label = periodLabel(this.year, this.o.periodType);
    this.input.setAttribute('aria-valuetext', label);
    this.out.textContent = label;
    this.el?.style.setProperty('--progress', `${this.o.years.length > 1 ? (this.idx / (this.o.years.length - 1)) * 100 : 100}%`);
    if (emit) this.o.onChange(this.year);
  }

  play(): void {
    if (this.o.years.length < 2) return;
    if (this.idx >= this.o.years.length - 1) this.set(0, true);
    this.btn.innerHTML = PAUSE;
    this.btn.setAttribute('aria-label', 'Pause animation');
    this.btn.setAttribute('aria-pressed', 'true');
    const step = prefersReducedMotion() ? Math.max(1400, this.o.interval ?? 900) : (this.o.interval ?? 900);
    this.timer = setInterval(() => {
      if (this.idx >= this.o.years.length - 1) return this.pause();
      this.set(this.idx + 1, true);
    }, step);
  }

  pause(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.btn.innerHTML = PLAY;
    this.btn.setAttribute('aria-label', 'Play animation through the years');
    this.btn.setAttribute('aria-pressed', 'false');
  }

  destroy(): void {
    this.pause();
    this.resizeObs?.disconnect();
    this.el.remove();
  }
}
