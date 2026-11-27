// Single story (#/stories/:slug): placeholder until the stories lane writes it.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { STORIES } from '../content/stories.ts';
import { comingSoon, pageHead } from './_page.ts';

export function title(ctx: PageContext): string {
  return STORIES.find((s) => s.slug === ctx.params.slug)?.title ?? 'Story';
}

export function render(ctx: PageContext): void {
  const s = STORIES.find((x) => x.slug === ctx.params.slug);
  const page = h('div', { class: 'page page--narrow story-page' });
  if (!s) {
    page.append(pageHead({ title: 'Story not found', dek: 'There is no story at this address.' }), h('p', null, h('a', { href: '#/stories' }, 'All stories →')));
  } else {
    page.append(
      pageHead({ kicker: 'Guided story', title: s.title, dek: s.dek }),
      comingSoon({
        title: 'This story is being written',
        body: 'It will be built only from the atlas’s published, sourced data, and every sentence is checked against that data before it appears here.',
        links: [
          ['#/stories', 'All stories'],
          ['#/', 'Explore the map'],
        ],
      }),
    );
  }
  ctx.root.append(page);
}
