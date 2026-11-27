// Search (#/search?q=): find "your federal court" by city, county, ZIP code or
// courthouse (from the courthouses lane's search files), or by state or district
// name (from the registry, always available).

import '../styles/pages.css';
import { h, debounce } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { DISTRICTS, registryDistrict, circuitLabel } from '../data/districts.ts';
import { foldKey, loadSearchIndex } from '../data/loaders.ts';
import type { SearchEntry } from '../data/types.ts';
import { loadAtlasGeometry } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import { atlasProjection } from '../map/projection.ts';
import { pageHead } from './_page.ts';

export const title = 'Find your federal court';

const KIND_LABEL: Record<string, string> = {
  city: 'City',
  place: 'Place',
  county: 'County',
  zip: 'ZIP code',
  courthouse: 'Courthouse',
  district: 'District',
  state: 'State',
};

function registryEntries(): SearchEntry[] {
  const out: SearchEntry[] = [];
  const states = new Map<string, string[]>();
  for (const d of DISTRICTS) {
    out.push({ label: d.name, kind: 'district', district_id: d.id, state: d.state, detail: d.short, key: foldKey(`${d.name} ${d.short} ${d.id}`) });
    (states.get(d.stateName) ?? states.set(d.stateName, []).get(d.stateName)!).push(d.id);
  }
  for (const [name, ids] of states) {
    out.push({ label: name, kind: 'state', district_id: ids[0]!, district_ids: ids.length > 1 ? ids : undefined, key: foldKey(name) });
  }
  return out;
}

function score(e: SearchEntry, q: string, words: string[]): number {
  if (!q) return 0;
  if (e.kind === 'zip') return e.key === q || e.key.startsWith(q) ? (e.key === q ? 100 : 40) : 0;
  if (e.key === q) return 90;
  if (e.key.startsWith(q)) return 70 - Math.min(20, e.key.length - q.length) / 2;
  const keyWords = e.key.split(' ');
  if (words.every((w) => keyWords.some((k) => k.startsWith(w)))) return 40;
  if (e.key.includes(q)) return 15;
  return 0;
}

export async function render(ctx: PageContext): Promise<void> {
  const page = h('div', { class: 'page search-page' });
  const input = h('input', {
    id: 'search-q',
    type: 'search',
    class: 'search-input',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'City, county, ZIP code or courthouse',
    'aria-describedby': 'search-help',
    'aria-controls': 'search-results',
  });
  const form = h(
    'form',
    { class: 'search-form', role: 'search', onsubmit: ((e: Event) => e.preventDefault()) as EventListener },
    h('label', { for: 'search-q', class: 'visually-hidden' }, 'Search for a place, ZIP code, courthouse, state or district'),
    h('span', { class: 'search-form__icon', 'aria-hidden': 'true' }),
    input,
  );
  const help = h('p', { id: 'search-help', class: 'search-help' });
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const results = h('ul', { id: 'search-results', class: 'search-results', 'aria-label': 'Search results' });
  const detail = h('div', { class: 'search-detail', 'aria-live': 'polite' });
  page.append(
    pageHead({ kicker: 'Search', title: 'Find your federal court', dek: 'Every place in the United States falls within exactly one federal judicial district. Search by city, county, ZIP code or courthouse, or by state or district name.' }),
    h('div', { class: 'search-layout' }, h('div', { class: 'search-col' }, form, help, status, results), detail),
  );
  ctx.root.append(page);

  const base = registryEntries();
  let entries = base;
  const idx = await loadSearchIndex();
  if (idx.status === 'ok') {
    entries = [...idx.data.entries, ...base];
    help.textContent = `Searching ${idx.data.entries.length.toLocaleString('en-US')} places, ZIP codes and courthouses, plus every state and district.`;
  } else {
    help.append(
      h('strong', null, 'City, county and ZIP search is not built yet. '),
      'You can already search by state or district name. The place index appears once the courthouse and geography pipeline publishes it.',
    );
    help.classList.add('search-help--notice');
  }

  const geo = await loadAtlasGeometry();

  const showDetail = (e: SearchEntry) => {
    const ids = e.district_ids ?? [e.district_id];
    detail.replaceChildren();
    detail.classList.toggle('search-detail--multi', ids.length > 1);
    if (ids.length > 1) {
      detail.append(
        h('p', { class: 'search-detail__note' }, e.kind === 'state' ? `${e.label} is divided into ${ids.length} districts:` : `${e.label} spans more than one district. Your district depends on the exact address:`),
      );
    }
    for (const id of ids) {
      const d = registryDistrict(id);
      if (!d) continue;
      const card = h('article', { class: 'search-card' });
      if (geo.status === 'ok') {
        const pts: Array<{ x: number; y: number }> = [];
        if (e.lat !== undefined && e.lon !== undefined) {
          const xy = atlasProjection().project(e.lon, e.lat, e.state ?? d.state);
          if (xy) pts.push({ x: xy[0], y: xy[1] });
        }
        const svg = renderLocator({ geometry: geo.geometry, districtId: id, points: pts, aspect: ids.length > 1 ? 1.2 : 1.4, keyMap: ids.length === 1 });
        if (svg) card.append(h('div', { class: 'search-card__map' }, svg));
      }
      card.append(
        h('p', { class: 'kicker' }, e.kind === 'state' || e.kind === 'district' ? 'District' : ids.length > 1 ? 'Possible district' : 'Your federal court'),
        h('h2', { class: 'search-card__name' }, d.name),
        h('p', { class: 'search-card__meta' }, `${d.short} · ${circuitLabel(d.circuit)}`),
        h('p', null, h('a', { class: 'btn btn--primary', href: `#/district/${id}` }, 'Open district profile')),
      );
      detail.append(card);
    }
  };

  const run = (raw: string) => {
    const q = foldKey(raw);
    const words = q.split(' ').filter(Boolean);
    results.replaceChildren();
    if (!q) {
      status.textContent = '';
      detail.replaceChildren();
      return;
    }
    const scored = entries
      .map((e) => [score(e, q, words), e] as const)
      .filter(([sc]) => sc > 0)
      .sort((a, b) => b[0] - a[0] || a[1].label.localeCompare(b[1].label));
    const seen = new Set<string>();
    const top: SearchEntry[] = [];
    for (const [, e] of scored) {
      const k = `${e.kind}|${e.label}|${e.district_id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      top.push(e);
      if (top.length >= 12) break;
    }
    status.textContent = top.length ? `${top.length} result${top.length === 1 ? '' : 's'}` : 'No matches';
    if (!top.length) {
      results.append(h('li', { class: 'search-results__empty' }, idx.status === 'ok' ? 'No matching place. Try a city, county, ZIP code, state or district.' : 'No matching state or district.'));
      detail.replaceChildren();
      return;
    }
    top.forEach((e, i) => {
      const ids = e.district_ids ?? [e.district_id];
      const btn = h(
        'button',
        { type: 'button', class: 'search-result' },
        h('span', { class: 'search-result__label' }, e.label),
        h('span', { class: 'search-result__meta' }, `${KIND_LABEL[e.kind] ?? e.kind}${e.detail && e.kind !== 'district' ? ` · ${e.detail}` : ''}`),
        h('span', { class: 'search-result__district' }, ids.length > 1 ? `${ids.length} districts` : registryDistrict(e.district_id)?.short ?? e.district_id),
      );
      btn.addEventListener('click', () => {
        results.querySelectorAll('.search-result').forEach((b) => b.removeAttribute('aria-current'));
        btn.setAttribute('aria-current', 'true');
        showDetail(e);
      });
      results.append(h('li', null, btn));
      if (i === 0) {
        btn.setAttribute('aria-current', 'true');
        showDetail(e);
      }
    });
  };

  const sync = debounce(() => {
    replaceQuery({ q: input.value.trim() || null });
    run(input.value);
  }, 140);
  input.addEventListener('input', sync);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      results.querySelector<HTMLButtonElement>('.search-result')?.focus();
    }
  });
  results.addEventListener('keydown', (e) => {
    const items = [...results.querySelectorAll<HTMLButtonElement>('.search-result')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' && i < items.length - 1) {
      e.preventDefault();
      items[i + 1]!.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (i > 0 ? items[i - 1]! : input).focus();
    }
  });
  const q0 = ctx.query.get('q') ?? '';
  input.value = q0;
  if (q0) run(q0);
  else input.focus({ preventScroll: true });
}
