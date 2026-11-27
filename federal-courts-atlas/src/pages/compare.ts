// Compare (#/compare?d=a,b,c). Side-by-side statistics are a later lane; the picker
// and the district shapes (locator maps) work now.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { DISTRICTS, registryDistrict, circuitLabel } from '../data/districts.ts';
import { loadAtlasGeometry, type AtlasGeometry } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import { comingSoon, pageHead } from './_page.ts';

export const title = 'Compare districts';
const MAX = 4;

export async function render(ctx: PageContext): Promise<void> {
  let ids = (ctx.query.get('d') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((id, i, a) => registryDistrict(id) && a.indexOf(id) === i)
    .slice(0, MAX);
  const page = h('div', { class: 'page compare-page' });
  const grid = h('div', { class: 'compare-grid', 'aria-live': 'polite' });
  const select = h('select', { id: 'compare-add', class: 'compare-select' });
  const addBtn = h('button', { type: 'button', class: 'btn btn--primary' }, 'Add');
  const picker = h(
    'div',
    { class: 'compare-picker' },
    h('label', { for: 'compare-add', class: 'caps' }, `Add a district (up to ${MAX})`),
    h('div', { class: 'compare-picker__row' }, h('div', { class: 'select-wrap' }, select), addBtn),
  );
  page.append(
    pageHead({ kicker: 'Compare', title: 'Compare districts side by side', dek: 'Pick two to four districts to see their shapes together. Side-by-side statistics arrive with the data.' }),
    picker,
    grid,
    comingSoon({
      title: 'Side-by-side statistics are in production',
      body: 'Once the data is published, each column will show the same measures for every chosen district, with ranks, trends and the source for every number.',
      items: ['Speed, workload, sentencing and case-mix measures in aligned rows', 'Trend lines on a shared scale', 'Each district’s distinguishing statistics'],
    }),
  );
  ctx.root.append(page);

  const geo = await loadAtlasGeometry();
  const geometry: AtlasGeometry | null = geo.status === 'ok' ? geo.geometry : null;

  const fillSelect = () => {
    select.replaceChildren(h('option', { value: '' }, 'Choose a district…'));
    let state = '';
    let og: HTMLOptGroupElement | null = null;
    for (const d of DISTRICTS) {
      if (d.stateName !== state) {
        state = d.stateName;
        og = h('optgroup', { label: state });
        select.append(og);
      }
      og!.append(h('option', { value: d.id, disabled: ids.includes(d.id) }, d.name));
    }
    select.disabled = ids.length >= MAX;
    addBtn.toggleAttribute('disabled', ids.length >= MAX);
  };

  const draw = () => {
    replaceQuery({ d: ids.join(',') || null });
    grid.replaceChildren();
    if (!ids.length) {
      grid.append(h('p', { class: 'compare-empty' }, 'No districts chosen yet. Use the menu above, or open a district from the map and choose “Compare”.'));
    }
    for (const id of ids) {
      const d = registryDistrict(id)!;
      const remove = h('button', { type: 'button', class: 'compare-card__remove', 'aria-label': `Remove ${d.name}` }, '×');
      remove.addEventListener('click', () => {
        ids = ids.filter((x) => x !== id);
        fillSelect();
        draw();
      });
      const fig = h('div', { class: 'compare-card__map' });
      if (geometry) {
        const svg = renderLocator({ geometry, districtId: id, aspect: 1.15, keyMap: true });
        if (svg) fig.append(svg);
      }
      grid.append(
        h(
          'article',
          { class: 'compare-card' },
          remove,
          fig,
          h('h2', { class: 'compare-card__name' }, h('a', { href: `#/district/${id}` }, d.name)),
          h('p', { class: 'compare-card__meta' }, `${d.short} · ${circuitLabel(d.circuit)}`),
        ),
      );
    }
  };

  addBtn.addEventListener('click', () => {
    const v = select.value;
    if (v && !ids.includes(v) && ids.length < MAX) {
      ids = [...ids, v];
      fillSelect();
      draw();
    }
  });
  fillSelect();
  draw();
}
