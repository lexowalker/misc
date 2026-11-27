// Geography: statutory divisions with their counties and places of holding court,
// statutory carve-outs, the full county list, and the courthouse buildings the court
// uses. From public/data/districts.json (boundaries lane, statute text) and
// public/data/geo/courthouses.json (courthouses lane, FJC list).

import { h } from '../../lib/dom.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { term } from '../../components/glossary.ts';
import { FIPS_STATE } from '../../data/districts.ts';
import type { Courthouse, District } from '../../data/types.ts';

type Building = Courthouse & { fjc_url?: string | null; district_court_since?: number | null; building_year?: number | null };

const PORTION: Record<string, string> = {
  yellowstone: 'Yellowstone National Park portion',
  fort_bragg_camp_mackall: 'Fort Bragg and Camp MacKall portion',
  fci_butner: 'Federal Correctional Institution, Butner portion',
};

function joinAnd(list: string[]): string {
  if (list.length <= 1) return list.join('');
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function statuteSources(d: District): string[] {
  const secs = d.statute_sections ?? [];
  const ids = new Set<string>();
  for (const s of secs) ids.add(/48 U\.S\.C/.test(s) ? 'olrc_usc48_xml' : 'olrc_usc28_xml');
  if (!ids.size) ids.add('olrc_usc28_xml');
  return [...ids];
}

export function renderGeography(host: HTMLElement, d: District, courthouses: Courthouse[]): void {
  const counties = (d.counties ?? []).map((c) => (typeof c === 'string' ? { geoid: c, name: c } : { geoid: c.geoid, name: c.name ?? c.geoid }));
  const nameOf = new Map(counties.map((c) => [c.geoid, c.name]));
  const divisions = (d.divisions ?? []).filter((x): x is { name: string; counties?: string[]; places?: string[]; ordinal?: number; statute_section?: string } => typeof x === 'object' && !!x);
  const places = d.places_of_holding_court ?? [];
  const statute = (d.statute_sections ?? []).join('; ');

  // --- Divisions or places of holding court
  const left = h('div', { class: 'geo__col' });
  if (d.has_statutory_divisions && divisions.length) {
    left.append(
      h('h3', { class: 'geo__title' }, `${divisions.length} statutory ${divisions.length === 1 ? 'division' : 'divisions'}`),
      h('p', { class: 'geo__dek' }, 'The statute splits the district into ', term('division', 'divisions'), ', each with its own counties and places where court is held.'),
      h(
        'ol',
        { class: 'divisions' },
        ...[...divisions]
          .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
          .map((x) => {
            const names = (x.counties ?? []).map((g) => nameOf.get(g) ?? g);
            return h(
              'li',
              { class: 'division' },
              h('p', { class: 'division__name' }, x.name),
              x.places?.length ? h('p', { class: 'division__places' }, h('span', { class: 'caps' }, 'Court held at'), ' ', joinAnd(x.places)) : h('p', { class: 'division__places' }, h('span', { class: 'caps' }, 'Court held at'), ' ', h('span', { class: 'muted' }, 'No city named in the statute')),
              names.length ? h('p', { class: 'division__counties' }, h('span', { class: 'caps' }, `${names.length} ${names.length === 1 ? 'county' : 'counties'}`), ' ', names.join(', ')) : null,
            );
          }),
      ),
    );
  } else {
    left.append(
      h('h3', { class: 'geo__title' }, 'Places of holding court'),
      h(
        'p',
        { class: 'geo__dek' },
        `The statute${statute ? ` (${statute})` : ''} does not split this district into divisions. `,
        places.length ? `It names ${places.length === 1 ? 'one place' : `${places.length} places`} where court is held.` : 'No separate place of holding court is listed for it.',
      ),
      places.length ? h('ul', { class: 'place-chips' }, ...places.map((p) => h('li', null, p))) : '',
    );
  }
  const partial = d.partial_counties_included ?? [];
  if (partial.length) {
    left.append(
      h(
        'div',
        { class: 'geo__carve' },
        h('p', { class: 'geo__carve-title' }, 'Also part of this district by statute'),
        h(
          'ul',
          null,
          ...partial.map((p) =>
            h('li', null, `${p.name}, ${FIPS_STATE[p.geoid.slice(0, 2)] ?? ''}`.replace(/, $/, ''), p.portion ? h('span', { class: 'muted' }, ` (${PORTION[p.portion] ?? p.portion.replace(/_/g, ' ')})`) : null, p.statute ? h('span', { class: 'muted' }, `, ${p.statute}`) : null),
          ),
        ),
      ),
    );
  }
  left.append(h('div', { class: 'geo__source' }, sourceChip({ sourceIds: statuteSources(d), compact: true }), statute ? h('span', { class: 'geo__statute' }, statute) : null));

  // --- Courthouse buildings
  const right = h('div', { class: 'geo__col' });
  const buildings = (courthouses as Building[]).filter((c) => c.kind === 'courthouse').sort((a, b) => a.city.localeCompare(b.city) || String(a.name).localeCompare(String(b.name)));
  right.append(h('h3', { class: 'geo__title' }, 'Courthouses in use'));
  if (buildings.length) {
    right.append(
      h('p', { class: 'geo__dek' }, 'Federal buildings the district court uses today, from the Federal Judicial Center’s list of federal courthouses.'),
      h(
        'ul',
        { class: 'buildings' },
        ...buildings.map((b) =>
          h(
            'li',
            { class: 'building' },
            h('p', { class: 'building__name' }, b.fjc_url ? h('a', { href: b.fjc_url, target: '_blank', rel: 'noopener' }, b.name ?? `${b.city}, ${b.state}`) : (b.name ?? `${b.city}, ${b.state}`)),
            h('p', { class: 'building__meta' }, `${b.city}, ${b.state}`, typeof b.district_court_since === 'number' ? ` · District court use since ${b.district_court_since}` : ''),
          ),
        ),
      ),
      h('div', { class: 'geo__source' }, sourceChip({ sourceIds: [...new Set(buildings.map((b) => b.source_id).filter((x): x is string => !!x))], compact: true })),
      h('p', { class: 'caption' }, 'Street addresses are not shown: the court finder pages that list them could not be retrieved. Map points mark the city, not the building.'),
    );
  } else {
    right.append(h('p', { class: 'geo__dek muted' }, 'The FJC list of federal courthouses has no building in current use by this court.'));
  }

  // --- All counties
  const countyBlock = counties.length
    ? h(
        'details',
        { class: 'county-list geo__counties' },
        h('summary', null, `All ${counties.length} ${counties.length === 1 ? 'county or county equivalent' : 'counties and county equivalents'}`),
        h('ul', { class: 'county-cols' }, ...[...counties].sort((a, b) => a.name.localeCompare(b.name)).map((c) => h('li', null, c.name))),
        h('div', { class: 'geo__source' }, sourceChip({ sourceIds: [...statuteSources(d), 'census_cb2025_county_500k'], compact: true })),
      )
    : null;

  if (countyBlock) left.append(countyBlock);
  host.append(h('div', { class: 'geo' }, left, right));
}
