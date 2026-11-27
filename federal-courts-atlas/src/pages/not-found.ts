import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { pageHead } from './_page.ts';

export function render(ctx: PageContext): void {
  ctx.root.append(
    h(
      'div',
      { class: 'page page--narrow' },
      pageHead({ kicker: 'Not found', title: 'There is no page at this address', dek: 'The link may be mistyped, or the page may have moved.' }),
      h('p', null, h('a', { class: 'btn btn--primary', href: '#/' }, 'Go to the map')),
    ),
  );
}
