// Stories index (#/stories). The essays are written in a later lane, grounded only in
// the atlas's own data; until then this lists what is planned, without numbers.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { pageHead } from './_page.ts';
import { STORIES } from '../content/stories.ts';

export const title = 'Stories';

export function render(ctx: PageContext): void {
  const page = h('div', { class: 'page stories-page' });
  page.append(
    pageHead({
      kicker: 'Guided stories',
      title: 'Stories from the data',
      dek: 'Scrolling essays in which the map moves with the text. Each is grounded only in the atlas’s own sourced data and is checked line by line before publication.',
    }),
    h(
      'ol',
      { class: 'story-list' },
      ...STORIES.map((s, i) =>
        h(
          'li',
          { class: 'story-card' },
          h('span', { class: 'story-card__num num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
          h(
            'div',
            null,
            h('h2', { class: 'story-card__title' }, h('a', { href: `#/stories/${s.slug}` }, s.title)),
            h('p', { class: 'story-card__dek' }, s.dek),
            h('p', { class: 'story-card__status caps' }, 'In production'),
          ),
        ),
      ),
    ),
  );
  ctx.root.append(page);
}
