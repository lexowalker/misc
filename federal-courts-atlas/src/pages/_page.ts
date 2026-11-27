// Shared page scaffolding: headline block and the polished "coming soon" panel.

import { h } from '../lib/dom.ts';

export function pageHead(o: { kicker?: string; title: string; dek?: string | Node; className?: string }): HTMLElement {
  return h(
    'header',
    { class: `page-head ${o.className ?? ''}`.trim() },
    o.kicker ? h('p', { class: 'kicker page-head__kicker' }, o.kicker) : null,
    h('h1', { class: 'page-head__title' }, o.title),
    o.dek ? h('p', { class: 'dek page-head__dek' }, o.dek) : null,
  );
}

/** "Coming soon" panel. Lists what the page will hold; shows no numbers. */
export function comingSoon(o: { title: string; body: string; items?: string[]; links?: Array<[string, string]> }): HTMLElement {
  return h(
    'section',
    { class: 'soon', 'aria-label': 'Coming soon' },
    h('span', { class: 'soon__badge' }, 'In production'),
    h('h2', { class: 'soon__title' }, o.title),
    h('p', { class: 'soon__body' }, o.body),
    o.items?.length ? h('ul', { class: 'soon__list' }, ...o.items.map((i) => h('li', null, i))) : null,
    o.links?.length
      ? h('p', { class: 'soon__links' }, ...o.links.flatMap(([href, label], i) => [i ? h('span', { class: 'soon__sep', 'aria-hidden': 'true' }, ' · ') : '', h('a', { href }, label)]))
      : null,
  );
}
