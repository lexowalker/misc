// District profile (#/district/:id). The full magazine profile is a later lane; this
// page already shows what is real today: the statutory identity of the court, a
// locator map, and (when published) its places of holding court and divisions.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { registryDistrict, circuitLabel } from '../data/districts.ts';
import { loadCourthouses, loadDivisions } from '../data/loaders.ts';
import { loadAtlasGeometry } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import { atlasProjection } from '../map/projection.ts';
import { term } from '../components/glossary.ts';
import { emptyState } from '../components/states.ts';
import { comingSoon } from './_page.ts';

export function title(ctx: PageContext): string {
  return registryDistrict(ctx.params.id ?? '')?.name ?? 'District';
}

export async function render(ctx: PageContext): Promise<void> {
  const id = ctx.params.id ?? '';
  const d = registryDistrict(id);
  const page = h('div', { class: 'page district-page' });
  ctx.root.append(page);
  if (!d) {
    page.append(
      h('h1', { class: 'page-head__title' }, 'No such district'),
      h('p', { class: 'dek' }, `“${id}” is not one of the 94 federal judicial districts.`),
      h('p', null, h('a', { href: '#/search' }, 'Search for a district →')),
    );
    return;
  }
  const territorial = d.article === 'IV';
  const head = h(
    'header',
    { class: 'district-head' },
    h(
      'nav',
      { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#/' }, 'Map'),
      h('span', { 'aria-hidden': 'true' }, ' / '),
      h('span', null, d.stateName),
    ),
    h('p', { class: 'kicker' }, `U.S. District Court · ${circuitLabel(d.circuit)}`),
    h('h1', { class: 'page-head__title' }, d.name),
    h('p', { class: 'district-head__short' }, d.short),
  );

  const locatorSlot = h('figure', { class: 'district-locator' });
  const facts = h(
    'dl',
    { class: 'facts' },
    h('dt', null, 'State or territory'),
    h('dd', null, d.stateName),
    h('dt', null, 'Appeals go to'),
    h('dd', null, d.circuit === 'DC' ? 'U.S. Court of Appeals for the D.C. Circuit' : `U.S. Court of Appeals for the ${circuitLabel(d.circuit)}`),
    h('dt', null, 'Type of court'),
    h('dd', null, territorial ? term('article-iv', 'Article IV territorial court') : term('article-iii', 'Article III court')),
  );
  const places = h('section', { class: 'district-places', 'aria-labelledby': 'places-h' }, h('h2', { id: 'places-h', class: 'section-title' }, 'Places of holding court'));
  const divisions = h('section', { class: 'district-divisions', 'aria-labelledby': 'div-h' }, h('h2', { id: 'div-h', class: 'section-title' }, 'Divisions'));
  page.append(
    head,
    h('div', { class: 'district-hero' }, locatorSlot, h('div', { class: 'district-hero__facts' }, facts, places, divisions)),
    comingSoon({
      title: 'The full profile is in production',
      body: 'This page will become a complete portrait of the court, built only from sourced data.',
      items: [
        'Key statistics with national rank and trend sparklines',
        'The bench over time: every judge, with appointing president and senior-status bands',
        'Case mix by nature of suit and offense type',
        'Recent real cases from CourtListener',
        'What makes this district distinctive, drawn from its outlier statistics',
      ],
      links: [
        ['#/', 'Back to the map'],
        [`#/compare?d=${d.id}`, 'Compare with other districts'],
      ],
    }),
  );

  const [geo, ch, dv] = await Promise.all([loadAtlasGeometry(), loadCourthouses(), loadDivisions()]);
  const mine = ch.status === 'ok' ? ch.data.filter((c) => c.district_id === d.id) : [];
  if (geo.status === 'ok') {
    const proj = atlasProjection();
    const pts = mine.map((c) => proj.project(c.lon, c.lat, c.state)).filter((p): p is [number, number] => !!p).map(([x, y]) => ({ x, y }));
    const svg = renderLocator({ geometry: geo.geometry, districtId: d.id, points: pts });
    if (svg) locatorSlot.append(svg, h('figcaption', { class: 'caption' }, `${d.name}${pts.length ? ', with its places of holding court' : ''}.`));
  } else {
    locatorSlot.append(emptyState({ title: 'Map not yet built', file: 'public/data/geo/districts-lo.topo.json', icon: 'map', compact: true }));
  }

  if (ch.status === 'ok') {
    const byCity = new Map<string, string[]>();
    for (const c of mine) {
      const k = `${c.city}, ${c.state}`;
      const arr = byCity.get(k) ?? byCity.set(k, []).get(k)!;
      if (c.name && !arr.includes(c.name)) arr.push(c.name);
    }
    places.append(
      byCity.size
        ? h(
            'ul',
            { class: 'place-list' },
            ...[...byCity.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([city, names]) => h('li', null, h('span', { class: 'place-list__city' }, city), names.length ? h('span', { class: 'place-list__name' }, names.join('; ')) : null)),
          )
        : h('p', { class: 'muted' }, 'No places recorded for this district in the published file.'),
    );
  } else {
    places.append(h('p', { class: 'muted' }, 'Not yet built (', h('code', null, 'geo/courthouses.json'), ').'));
  }

  if (dv.status === 'ok' && dv.data.districts[d.id]) {
    const g = dv.data.districts[d.id]!;
    const statute = g.statute_sections.length ? ` (${g.statute_sections.join('; ')})` : '';
    if (g.has_statutory_divisions && g.divisions.length) {
      divisions.append(
        h(
          'ul',
          { class: 'place-list' },
          ...[...g.divisions]
            .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
            .map((x) =>
              h(
                'li',
                null,
                h('span', { class: 'place-list__city' }, x.name),
                x.places?.length ? h('span', { class: 'place-list__name' }, `Court held at ${x.places.join(', ')}`) : null,
                x.counties.length ? h('span', { class: 'place-list__name' }, `${x.counties.length} ${x.counties.length === 1 ? 'county' : 'counties'}: ${x.counties.join(', ')}`) : null,
              ),
            ),
        ),
        h('p', { class: 'caption' }, `Source: ${g.statute_sections.join('; ') || '28 U.S.C. §§ 81–131'}.`),
      );
    } else {
      divisions.append(
        h('p', { class: 'muted' }, `The statute${statute} does not divide this district into divisions.`),
        g.places_of_holding_court.length
          ? h('p', { class: 'muted' }, `It names these places of holding court: ${g.places_of_holding_court.join(', ')}.`)
          : '',
      );
    }
    if (g.counties.length) {
      const det = h(
        'details',
        { class: 'county-list' },
        h('summary', null, `${g.counties.length} ${g.counties.length === 1 ? 'county or equivalent' : 'counties and equivalents'}`),
        h('p', null, g.counties.map((c) => c.name).join(', ')),
      );
      divisions.append(det);
    }
  } else {
    divisions.append(h('p', { class: 'muted' }, 'Not yet built (', h('code', null, 'geo/divisions.json'), ').'));
  }
}
