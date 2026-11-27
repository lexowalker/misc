// The Courtroom (#/courtroom). The three.js scene is a later lane. When it lands,
// import three *inside this module* (e.g. `const THREE = await import('three')`)
// so it stays in the courtroom chunk and never loads with the map.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { comingSoon, pageHead } from './_page.ts';
import { rich } from '../components/glossary.ts';

export const title = 'The Courtroom';

const SEATS = [
  ['The bench', 'the judge, and the court’s workload and speed'],
  ['The jury box', 'how often cases reach a [[jury-trial|jury trial]]'],
  ['The witness stand', 'trials and how cases end'],
  ['The prosecution table', 'criminal filings and offense mix'],
  ['The defense table', 'sentences relative to the [[guideline-range|guideline range]]'],
  ['The gallery', 'the district’s population and caseload per resident'],
  ['The clerk’s desk', 'filings, terminations and [[pending-case|pending cases]]'],
  ['The court reporter', 'the record: sources and vintages for every number'],
];

export function render(ctx: PageContext): void {
  const page = h('div', { class: 'page page--narrow courtroom-page' });
  page.append(
    pageHead({
      kicker: 'Explore',
      title: 'The Courtroom',
      dek: 'A three-dimensional federal courtroom. Choose a seat to see the room from that point of view, alongside real atlas data for the district you pick.',
    }),
    comingSoon({
      title: 'The courtroom is being built',
      body: 'Each seat will connect to sourced data for the selected district:',
      items: [],
    }),
  );
  const list = page.querySelector('.soon__list') ?? page.querySelector('.soon')!.appendChild(h('ul', { class: 'soon__list' }));
  for (const [seat, what] of SEATS) list.append(h('li', null, h('span', null, h('strong', null, seat), ': ', rich(what!))));
  ctx.root.append(page);
}
