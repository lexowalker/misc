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
    const markers = h('div', { class: 'year-slider__events' });
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
        m.addEventListener('click', () => {
          this.pause();
          const exact = years.indexOf(y);
          this.set(exact >= 0 ? exact : Math.round(i), true);
        });
        markers.append(m);
      }
    }
    const ticks = h('div', { class: 'year-slider__ticks', 'aria-hidden': 'true' });
    const minGap = Math.max(2, Math.ceil(years.length / 8));
    years.forEach((y, i) => {
      const end = i === 0 || i === years.length - 1;
      // Label the ends and round years, but never two labels closer than minGap steps.
      const major = end || (y % 5 === 0 && i >= minGap && years.length - 1 - i >= minGap);
      ticks.append(h('span', { class: `year-slider__tick${major ? ' is-major' : ''}`, style: `left:${pos(i)}%` }, major ? String(y) : ''));
    });
    track.append(markers, this.input, ticks);
    this.el = h('div', { class: 'year-slider', role: 'group', 'aria-label': o.label ?? 'Time machine' }, this.btn, track, this.out);
    this.set(this.idx, false);
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
    this.el.remove();
  }
}
