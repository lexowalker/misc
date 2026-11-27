// Search (#/search?q=): find "your federal court" by city, county, ZIP code or courthouse
// (the courthouses lane's search files) or by state or district name (the registry).
// The combobox lists every district a place reaches into, primary first; the panel
// beside it previews the highlighted match with locator maps. Enter or a click opens
// the district.

import '../styles/pages.css';
import '../styles/search.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { registryDistrict, circuitLabel } from '../data/districts.ts';
import type { PlaceHit, PlaceIndex } from '../data/place-index.ts';
import { STATE_NAMES, loadPlaceIndex } from '../data/place-index.ts';
import { loadAtlasGeometry, type GeometryResult } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import { atlasProjection } from '../map/projection.ts';
import { PlaceSearch, alsoText, hitTitle, kindLabel, sharePct } from '../components/place-search.ts';
import { pageHead } from './_page.ts';

export const title = 'Find your federal court';

// Example queries (place names and ZIP codes only; no statistics).
const EXAMPLES = ['Alexandria, VA', '22314', 'Cook County', 'Brooklyn', 'Dallas, TX', '28376'];

function locationNote(hit: PlaceHit): string {
  switch (hit.kind) {
    case 'city':
      return 'Matched to the district that holds the Census internal point of this place.';
    case 'county':
      return hit.splitCounty
        ? 'The statute splits this county between districts. Your district depends on the exact location.'
        : 'Federal law assigns every county to one district.';
    case 'zip':
      return 'ZIP codes are matched through Census ZIP Code Tabulation Areas (2020), which approximate them. Shares are of land area.';
    case 'courthouse':
      return 'A federal courthouse building in current district-court use, from the Federal Judicial Center list. The dot marks its city.';
    case 'state':
      return 'Every place in the state falls in exactly one of these districts.';
    default:
      return '';
  }
}

export async function render(ctx: PageContext): Promise<() => void> {
  const page = h('div', { class: 'page find-page' });
  const searchSlot = h('div', { class: 'find__search' });
  const help = h('p', { class: 'find__help', id: 'find-help' });
  const examples = h('div', { class: 'find__examples' });
  const detail = h('section', { class: 'find__detail', 'aria-label': 'Highlighted match', 'aria-live': 'polite' });
  page.append(
    pageHead({
      kicker: 'Search',
      title: 'Find your federal court',
      dek: 'Every place in the United States falls within exactly one federal judicial district. Search by city, county, ZIP code or courthouse, or by state or district name.',
    }),
    h('div', { class: 'find__layout' }, h('div', { class: 'find__col' }, searchSlot, help, examples), detail),
  );
  ctx.root.append(page);

  let geo: GeometryResult | null = null;
  let index: PlaceIndex | null = null;
  let destroyed = false;

  const renderDetail = (hit: PlaceHit | null, activeDistrict: string | null) => {
    detail.replaceChildren();
    detail.classList.remove('is-multi');
    if (!hit) {
      detail.append(
        h(
          'div',
          { class: 'find__empty' },
          h('p', { class: 'find__empty-title' }, 'Your district appears here'),
          h('p', null, 'Start typing a place. The map shows where the district lies, and the link opens its profile.'),
        ),
      );
      return;
    }
    const ds = hit.districts;
    const multi = ds.length > 1;
    detail.classList.toggle('is-multi', multi);
    const point = (() => {
      if (hit.lat === undefined || hit.lon === undefined) {
        if (hit.kind === 'courthouse' && hit.detail && hit.state) return index?.cityPoint(hit.detail, hit.state) ?? null;
        return null;
      }
      return { lat: hit.lat, lon: hit.lon };
    })();
    const head = h(
      'header',
      { class: 'find__detail-head' },
      h('p', { class: 'kicker' }, kindLabel(hit)),
      h('h2', { class: 'find__detail-title' }, hitTitle(hit, true)),
      hit.kind === 'courthouse' && hit.detail ? h('p', { class: 'find__detail-sub' }, `${hit.detail}, ${STATE_NAMES[hit.state ?? ''] ?? hit.state}`) : null,
      multi
        ? h(
            'p',
            { class: 'find__detail-sub' },
            hit.kind === 'state'
              ? `${hit.name} is divided into ${ds.length} districts.`
              : `This ${hit.kind === 'zip' ? 'ZIP code' : hit.kind === 'county' ? 'county' : 'place'} reaches into ${ds.length} districts. Your district depends on the exact address.`,
          )
        : null,
      hit.courtCity ? h('p', { class: 'find__court' }, h('span', { class: 'find__court-dot', 'aria-hidden': 'true' }), 'The law names this city as a place where the district court sits.') : null,
    );
    detail.append(head);
    const cards = h('div', { class: 'find__cards' });
    ds.forEach((d, i) => {
      const reg = registryDistrict(d.id);
      if (!reg) return;
      const card = h('article', { class: `find-card${d.id === activeDistrict ? ' is-active' : ''}`, 'data-district': d.id });
      if (geo?.status === 'ok') {
        const pts: Array<{ x: number; y: number }> = [];
        if (point && (i === 0 || hit.kind !== 'city')) {
          const xy = atlasProjection().project(point.lon, point.lat, hit.state ?? reg.state);
          if (xy) pts.push({ x: xy[0], y: xy[1] });
        }
        const svg = renderLocator({ geometry: geo.geometry, districtId: d.id, points: pts, aspect: multi ? 1.25 : 1.45, keyMap: !multi || ds.length <= 2 });
        if (svg) {
          svg.setAttribute('aria-hidden', 'true');
          card.append(h('div', { class: 'find-card__map' }, svg));
        }
      }
      const role =
        hit.kind === 'state' || hit.kind === 'district'
          ? 'District court'
          : !multi
            ? 'Your federal district court'
            : d.role === 'primary'
              ? hit.kind === 'zip'
                ? `Largest share: ${sharePct(d.share ?? 0)} of land area`
                : 'Main district'
              : alsoText(hit, d);
      card.append(
        h('p', { class: 'find-card__role caps' }, role),
        h('h3', { class: 'find-card__name' }, reg.name),
        h('p', { class: 'find-card__meta' }, `${reg.short} · ${circuitLabel(reg.circuit)}`),
        h('p', null, h('a', { class: 'btn btn--primary find-card__go', href: `#/district/${d.id}` }, 'Open district profile', h('span', { 'aria-hidden': 'true' }, ' →'))),
      );
      cards.append(card);
    });
    detail.append(cards);
    const note = locationNote(hit);
    if (note) detail.append(h('p', { class: 'find__note' }, note));
  };

  const updateHelp = (status: string) => {
    help.classList.toggle('find__help--notice', status !== 'ok' && status !== 'loading' && status !== 'idle');
    if (status === 'ok' && index) {
      const c = index.counts;
      help.textContent = `Searches ${c.places.toLocaleString('en-US')} places, ${c.counties.toLocaleString('en-US')} counties, ${c.zips.toLocaleString('en-US')} ZIP code areas and ${c.courthouses.toLocaleString('en-US')} court locations, plus every state and district.`;
    } else if (status === 'loading' || status === 'idle') {
      help.textContent = 'Loading the list of places...';
    } else {
      help.replaceChildren(
        h('strong', null, 'City, county and ZIP search is unavailable. '),
        'The place list could not be loaded. You can still search by state or district name.',
      );
    }
  };

  const search = new PlaceSearch(searchSlot, {
    mode: 'inline',
    // Phones list fewer matches so the preview stays close.
    limit: typeof matchMedia === 'function' && matchMedia('(max-width: 40rem)').matches ? 8 : 20,
    label: 'Search for a place, ZIP code, courthouse, state or district',
    labelHidden: true,
    preload: true,
    initialQuery: ctx.query.get('q') ?? '',
    onQuery: (q) => replaceQuery({ q: q || null }),
    onActive: (hit, d) => renderDetail(hit, d),
    onResults: (hits, q) => {
      examples.hidden = hits.length > 0 || !!q;
    },
  });
  updateHelp('loading');
  void loadPlaceIndex().then((r) => {
    if (destroyed) return;
    if (r.status === 'ok') index = r.data;
    updateHelp(r.status);
  });

  examples.append(
    h('p', { class: 'caps find__examples-label' }, 'Try'),
    h(
      'ul',
      { class: 'find__examples-list' },
      ...EXAMPLES.map((ex) => {
        const b = h('button', { type: 'button', class: 'find__example' }, ex);
        b.addEventListener('click', () => search.setQuery(ex));
        return h('li', null, b);
      }),
    ),
  );
  examples.hidden = !!search.input.value.trim();

  geo = await loadAtlasGeometry();
  if (destroyed) return () => {};
  // Re-render the preview with maps now that the geometry is here.
  const first = search.results[0];
  renderDetail(first ?? null, first?.districts[0]?.id ?? null);
  if (!search.input.value) search.input.focus({ preventScroll: true });

  return () => {
    destroyed = true;
    search.destroy();
  };
}
