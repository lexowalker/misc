// Place search combobox ("Find your federal court"). WAI-ARIA combobox with a listbox:
// the input keeps focus and aria-activedescendant points at the active option, so
// screen readers announce each option while the reader types and arrows through.
// Every option opens one district; a place that reaches into several districts gets
// one option per district, primary first ("Also reaches into ...").
//
// mode 'popup' (home): the list drops down under the input and closes on blur/Escape.
// mode 'inline' (#/search): the list stays open in the page flow while there is a query.

import '../styles/place-search.css';
import { h, debounce, uniqueId } from '../lib/dom.ts';
import { registryDistrict } from '../data/districts.ts';
import { foldKey } from '../data/loaders.ts';
import { loadPlaceIndex, parseStateSuffix, registryIndex, STATE_NAMES, type PlaceDistrict, type PlaceHit, type PlaceIndex } from '../data/place-index.ts';

export interface PlaceSearchOptions {
  mode: 'popup' | 'inline';
  /** Visible label text. */
  label: string;
  /** Visually hide the label (it stays the accessible name). */
  labelHidden?: boolean;
  placeholder?: string;
  /** Maximum places listed (default 8 popup, 20 inline). */
  limit?: number;
  initialQuery?: string;
  /** Load the index right away (default: on first focus or keystroke). */
  preload?: boolean;
  /** Choosing an option. Default: open the district profile. */
  onChoose?: (hit: PlaceHit, districtId: string) => void;
  /** The active (highlighted) option changed. */
  onActive?: (hit: PlaceHit | null, districtId: string | null) => void;
  /** New result list for a query (after each search). */
  onResults?: (hits: PlaceHit[], query: string, total: number) => void;
  /** Query text changed (debounced), e.g. to sync the URL. */
  onQuery?: (query: string) => void;
  /** Footer link to the full search page in popup mode (default true). */
  seeAllLink?: boolean;
  className?: string;
}

const KIND_LABEL: Record<string, string> = {
  city: 'City or town',
  county: 'County',
  zip: 'ZIP code',
  courthouse: 'Federal courthouse',
  district: 'District court',
  state: 'State',
};

const PLACE_TYPE: Record<string, string> = { c: 'City or town', p: 'Community (Census place)', m: 'Town or township', i: 'Island place' };

export function kindLabel(hit: PlaceHit): string {
  if (hit.kind === 'city' && hit.placeType) return PLACE_TYPE[hit.placeType] ?? KIND_LABEL.city!;
  return KIND_LABEL[hit.kind] ?? hit.kind;
}

/** "Alexandria, Virginia" / "ZIP code 22314" / "Texas". */
export function hitTitle(hit: PlaceHit, longState = false): string {
  if (hit.kind === 'zip') return `ZIP code ${hit.name}`;
  if (hit.kind === 'state' || hit.kind === 'district') return hit.name;
  if (!hit.state || hit.name.includes(',')) return hit.name;
  return `${hit.name}, ${longState ? (STATE_NAMES[hit.state] ?? hit.state) : hit.state}`;
}

/** Plain-English note for a secondary district. */
export function alsoText(hit: PlaceHit, d: PlaceDistrict): string {
  if (hit.kind === 'zip' && d.share !== undefined) return `${sharePct(d.share)} of this ZIP code's land area`;
  if (hit.kind === 'county' && hit.splitCounty) return 'Part of the county, split by statute';
  if (hit.kind === 'state') return '';
  return 'Part of the place reaches into this district';
}

export function sharePct(share: number): string {
  const p = share * 100;
  if (p > 0 && p < 1) return 'Under 1%';
  if (p < 100 && p > 99) return 'Over 99%';
  return `${Math.round(p)}%`;
}

function highlight(text: string, q: string): Node[] {
  if (!q) return [document.createTextNode(text)];
  // Match on the folded form, then map back onto the original characters.
  const folded = foldKey(text);
  const i = folded.indexOf(q);
  if (i < 0 || folded.length !== text.length) return [document.createTextNode(text)];
  return [document.createTextNode(text.slice(0, i)), h('mark', null, text.slice(i, i + q.length)), document.createTextNode(text.slice(i + q.length))];
}

const ICON =
  '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.6" cy="8.6" r="5.6"/><path d="m12.8 12.8 4 4"/></svg>';

interface OptionRef {
  el: HTMLLIElement;
  hit: PlaceHit;
  district: string;
}

export class PlaceSearch {
  readonly el: HTMLElement;
  readonly input: HTMLInputElement;
  private o: PlaceSearchOptions;
  private list: HTMLUListElement;
  private popup: HTMLDivElement;
  private status: HTMLParagraphElement;
  private foot: HTMLDivElement;
  private options: OptionRef[] = [];
  private active = -1;
  private index: PlaceIndex = registryIndex();
  private indexState: 'idle' | 'loading' | 'ok' | 'missing' | 'error' = 'idle';
  private lastQuery = '';
  private lastHits: PlaceHit[] = [];
  private expanded = false;
  private destroyed = false;
  private uid = uniqueId('psearch');

  constructor(container: HTMLElement, o: PlaceSearchOptions) {
    this.o = o;
    const inputId = `${this.uid}-input`;
    const listId = `${this.uid}-list`;
    this.input = h('input', {
      id: inputId,
      type: 'text',
      class: 'psearch__input',
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': listId,
      'aria-describedby': `${this.uid}-hint`,
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
      placeholder: o.placeholder ?? 'City, county, ZIP or courthouse',
    });
    this.list = h('ul', { id: listId, role: 'listbox', class: 'psearch__list', 'aria-label': 'Matching places' });
    this.status = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
    this.foot = h('div', { class: 'psearch__foot' });
    this.popup = h('div', { class: 'psearch__popup', hidden: true }, this.list, this.foot);
    const clear = h('button', { type: 'button', class: 'psearch__clear', 'aria-label': 'Clear search', hidden: true }, '×');
    clear.addEventListener('click', () => {
      this.input.value = '';
      clear.hidden = true;
      this.run('');
      this.o.onQuery?.('');
      this.input.focus();
    });
    this.el = h(
      'div',
      { class: `psearch psearch--${o.mode} ${o.className ?? ''}`.trim() },
      h('label', { for: inputId, class: `psearch__label${o.labelHidden ? ' visually-hidden' : ''}` }, o.label),
      h(
        'div',
        { class: 'psearch__field' },
        h('span', { class: 'psearch__icon', 'aria-hidden': 'true', html: ICON }),
        this.input,
        clear,
      ),
      h('p', { id: `${this.uid}-hint`, class: 'visually-hidden' }, 'Type a place. Use the up and down arrow keys to review matches and Enter to open a district.'),
      this.popup,
      this.status,
    );
    container.append(this.el);

    const sync = debounce(() => {
      this.run(this.input.value);
      this.o.onQuery?.(this.input.value.trim());
    }, 90);
    this.input.addEventListener('input', () => {
      clear.hidden = !this.input.value;
      this.ensureIndex();
      sync();
    });
    this.input.addEventListener('focus', () => {
      this.ensureIndex();
      if (this.o.mode === 'popup' && this.options.length) this.setExpanded(true);
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.list.addEventListener('mousedown', (e) => e.preventDefault());
    this.list.addEventListener('click', (e) => {
      const li = (e.target as Element).closest<HTMLLIElement>('[role="option"]');
      if (!li) return;
      const i = this.options.findIndex((o) => o.el === li);
      if (i >= 0) this.choose(i);
    });
    this.list.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const li = (e.target as Element).closest<HTMLLIElement>('[role="option"]');
      const i = li ? this.options.findIndex((o) => o.el === li) : -1;
      if (i >= 0 && i !== this.active) this.setActive(i, false);
    });
    if (o.mode === 'popup') {
      this.el.addEventListener('focusout', (e) => {
        const to = e.relatedTarget as Node | null;
        if (!to || !this.el.contains(to)) this.setExpanded(false);
      });
    }
    if (o.preload) this.ensureIndex();
    if (o.initialQuery) {
      this.input.value = o.initialQuery;
      clear.hidden = false;
      this.run(o.initialQuery);
    }
  }

  /** Set the query programmatically (e.g. an example link) and search. */
  setQuery(q: string, focus = true): void {
    this.input.value = q;
    (this.el.querySelector('.psearch__clear') as HTMLButtonElement).hidden = !q;
    this.ensureIndex();
    this.run(q);
    this.o.onQuery?.(q.trim());
    if (focus) this.input.focus({ preventScroll: true });
  }

  get indexStatus(): string {
    return this.indexState;
  }

  getIndex(): PlaceIndex {
    return this.index;
  }

  private ensureIndex(): void {
    if (this.indexState !== 'idle') return;
    this.indexState = 'loading';
    this.el.dataset.index = 'loading';
    void loadPlaceIndex().then((r) => {
      if (this.destroyed) return;
      if (r.status === 'ok') {
        this.index = r.data;
        this.indexState = 'ok';
      } else {
        this.indexState = r.status;
      }
      this.el.dataset.index = this.indexState;
      // Re-run whatever the reader has typed meanwhile against the full index.
      if (this.input.value.trim()) this.run(this.input.value, true);
      else this.o.onResults?.([], '', 0);
    });
  }

  private run(raw: string, keepActive = false): void {
    const q = raw.trim();
    const prevKey = keepActive && this.active >= 0 ? `${this.options[this.active]?.hit.key}|${this.options[this.active]?.district}` : null;
    this.lastQuery = q;
    this.list.replaceChildren();
    this.options = [];
    this.active = -1;
    this.input.removeAttribute('aria-activedescendant');
    if (!q) {
      this.lastHits = [];
      this.foot.replaceChildren();
      this.setExpanded(false);
      this.status.textContent = '';
      this.o.onResults?.([], '', 0);
      this.o.onActive?.(null, null);
      return;
    }
    const limit = this.o.limit ?? (this.o.mode === 'popup' ? 8 : 20);
    const { hits, total, stateFilter } = this.index.search(q, limit);
    this.lastHits = hits;
    const fq = stateFilter ? parseStateSuffix(foldKey(q), q).q : foldKey(q);
    hits.forEach((hit, hi) => {
      hit.districts.forEach((d, di) => {
        const el = this.renderOption(hit, d, di, fq, hi);
        this.list.append(el);
        this.options.push({ el, hit, district: d.id });
      });
    });
    const loading = this.indexState === 'loading' || this.indexState === 'idle';
    if (!hits.length) {
      const msg = /^\d{1,2}$/.test(q)
        ? 'Type at least three digits of a ZIP code.'
        : /^\d{5}$/.test(q)
          ? `No ZIP code area matches ${q}. Some ZIP codes (post office boxes, single buildings) have no Census ZIP code area. Try a city or county.`
          : loading
            ? 'Loading the place list...'
            : this.indexState === 'ok'
              ? 'No matching place. Try a city, county, ZIP code, courthouse, state or district.'
              : 'Only states and district names can be searched right now: the place list did not load.';
      this.list.append(h('li', { class: 'psearch__empty', role: 'presentation' }, msg));
    }
    this.foot.replaceChildren();
    if (this.o.mode === 'inline' && total > hits.length) {
      this.foot.append(
        h(
          'p',
          { class: 'psearch__more-note' },
          `Showing ${hits.length} of ${total.toLocaleString('en-US')} matches. `,
          hits[0]?.kind === 'zip'
            ? 'Type all five digits to narrow the list.'
            : hits[0]?.state && !hits[0].name.includes(',')
              ? `Add a state to narrow the list, for example "${hits[0].name}, ${hits[0].state}".`
              : 'Add a state to narrow the list.',
        ),
      );
    }
    if (this.o.mode === 'popup' && this.o.seeAllLink !== false && hits.length) {
      const more = total > hits.length ? `See all ${total.toLocaleString('en-US')} matches` : 'See matches on the search page';
      this.foot.append(h('a', { class: 'psearch__more', href: `#/search?q=${encodeURIComponent(q)}`, tabindex: '-1' }, more, h('span', { 'aria-hidden': 'true' }, ' →')));
    }
    this.setExpanded(true);
    const n = hits.length;
    this.status.textContent = n
      ? `${n} ${n === 1 ? 'place' : 'places'}${total > n ? ` of ${total.toLocaleString('en-US')}` : ''}, ${this.options.length} district ${this.options.length === 1 ? 'option' : 'options'}.`
      : 'No matches.';
    this.el.dataset.results = String(n);
    this.o.onResults?.(hits, q, total);
    if (prevKey) {
      const i = this.options.findIndex((o) => `${o.hit.key}|${o.district}` === prevKey);
      if (i >= 0) this.setActive(i, false);
    }
    if (this.active < 0) this.o.onActive?.(hits[0] ?? null, hits[0]?.districts[0]?.id ?? null);
  }

  private renderOption(hit: PlaceHit, d: PlaceDistrict, di: number, fq: string, hi: number): HTMLLIElement {
    const dist = registryDistrict(d.id);
    const short = dist?.short ?? d.id;
    const name = dist?.name ?? d.id;
    const id = `${this.uid}-opt-${hi}-${di}`;
    const title = hitTitle(hit);
    if (d.role === 'also' || (hit.kind === 'state' && di > 0)) {
      const note = hit.kind === 'state' ? '' : alsoText(hit, d);
      const label = hit.kind === 'state' ? `${hit.name}: ${name}` : `${title} also reaches into the ${name}${note ? `. ${note}` : ''}`;
      return h(
        'li',
        { id, role: 'option', class: 'psearch__opt psearch__opt--also', 'aria-selected': 'false', 'aria-label': label, 'data-district': d.id },
        h('span', { class: 'psearch__also' }, hit.kind === 'state' ? '' : 'Also ', h('strong', null, short)),
        h('span', { class: 'psearch__note' }, note),
      );
    }
    const multi = hit.districts.length > 1;
    const meta = [kindLabel(hit)];
    if (hit.kind === 'courthouse' && hit.detail) meta.push(`${hit.detail}, ${hit.state}`);
    else if (hit.kind !== 'zip' && hit.kind !== 'state' && hit.kind !== 'district' && hit.state) meta.push(STATE_NAMES[hit.state] ?? hit.state);
    if (hit.courtCity) meta.push('court sits here');
    if (hit.kind === 'state') meta.push(`${hit.districts.length} ${hit.districts.length === 1 ? 'district' : 'districts'}`);
    const shareNote = hit.kind === 'zip' && d.share !== undefined && multi ? `${sharePct(d.share)} of land area` : '';
    const label = hit.kind === 'state'
      ? `${hit.name}, state with ${hit.districts.length} ${hit.districts.length === 1 ? 'district' : 'districts'}: ${name}`
      : `${title}, ${meta.join(', ')}: ${name}${shareNote ? `, ${shareNote}` : ''}${multi ? `, plus ${hit.districts.length - 1} more` : ''}`;
    return h(
      'li',
      { id, role: 'option', class: `psearch__opt${multi ? ' psearch__opt--multi' : ''}`, 'aria-selected': 'false', 'aria-label': label, 'data-district': d.id, 'data-kind': hit.kind },
      h(
        'span',
        { class: 'psearch__main' },
        h('span', { class: 'psearch__name' }, ...highlight(hit.name, fq), hit.kind !== 'zip' && hit.kind !== 'state' && hit.kind !== 'district' && hit.state && !hit.name.includes(',') ? h('span', { class: 'psearch__state' }, `, ${hit.state}`) : ''),
        h('span', { class: 'psearch__meta' }, meta.join(' · ')),
      ),
      h('span', { class: 'psearch__dist' }, h('strong', null, short), shareNote ? h('span', { class: 'psearch__share' }, shareNote) : ''),
    );
  }

  private setExpanded(open: boolean): void {
    const show = open && (this.o.mode === 'inline' ? !!this.lastQuery : !!this.lastQuery);
    this.expanded = show;
    this.popup.hidden = !show;
    this.input.setAttribute('aria-expanded', String(show));
    this.el.classList.toggle('is-open', show);
  }

  private setActive(i: number, scroll = true): void {
    if (this.active >= 0) this.options[this.active]?.el.setAttribute('aria-selected', 'false');
    this.active = i;
    const opt = this.options[i];
    if (!opt) {
      this.input.removeAttribute('aria-activedescendant');
      this.o.onActive?.(null, null);
      return;
    }
    opt.el.setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', opt.el.id);
    if (scroll) opt.el.scrollIntoView({ block: 'nearest' });
    this.o.onActive?.(opt.hit, opt.district);
  }

  private choose(i: number): void {
    const opt = this.options[i];
    if (!opt) return;
    this.setActive(i, false);
    if (this.o.mode === 'popup') this.setExpanded(false);
    if (this.o.onChoose) this.o.onChoose(opt.hit, opt.district);
    else location.hash = `#/district/${opt.district}`;
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.options.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.expanded && this.lastQuery) this.setExpanded(true);
        if (n) this.setActive(this.active < n - 1 ? this.active + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.expanded && this.lastQuery) this.setExpanded(true);
        if (n) this.setActive(this.active > 0 ? this.active - 1 : n - 1);
        break;
      case 'Home':
      case 'End':
        // Leave caret movement in the text field alone.
        break;
      case 'Enter':
        if (!this.lastQuery) return;
        e.preventDefault();
        if (this.active >= 0) this.choose(this.active);
        else if (n) this.choose(0);
        break;
      case 'Escape':
        if (this.expanded && this.o.mode === 'popup') {
          e.preventDefault();
          this.setExpanded(false);
          this.setActive(-1);
        } else if (this.input.value) {
          e.preventDefault();
          this.setQuery('');
        }
        break;
      case 'Tab':
        if (this.o.mode === 'popup') this.setExpanded(false);
        break;
      default:
    }
  }

  get results(): PlaceHit[] {
    return this.lastHits;
  }

  destroy(): void {
    this.destroyed = true;
    this.el.remove();
  }
}
