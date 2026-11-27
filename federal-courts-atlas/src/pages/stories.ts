// Stories index (#/stories): every guided story with a thumbnail map and its dek. Deks are
// templates filled from public/data/stories/index.json (the headline numbers of each story).

import '../styles/pages.css';
import '../styles/stories.css';
import { h, s } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { loadJson } from '../data/fetch.ts';
import { loadAtlasGeometry, type AtlasGeometry } from '../map/geo.ts';
import { renderThumbnail } from '../map/thumbnail.ts';
import { quantileScale } from '../map/scale.ts';
import { STORY_CONTENT } from '../content/stories.ts';
import { errorState } from '../components/states.ts';
import { renderProse } from './story/prose.ts';
import type { StoryIndexEntry, StoryIndexFile } from './story/types.ts';

export const title = 'Stories';

function thumb(geo: AtlasGeometry, entry: StoryIndexEntry, label: string): SVGSVGElement {
  const vals = entry.thumb.values;
  const sc = quantileScale(Object.values(vals));
  const svg = renderThumbnail({
    geometry: geo,
    classOf: (id) => (vals[id] === undefined ? null : sc?.classOf(vals[id]) ?? null),
    title: label,
    className: 'story-tile__map',
  });
  // Outline the story's focus districts on top of the thumbnail.
  for (const id of entry.thumb.focus) {
    const shape = geo.byId.get(id);
    if (shape) svg.append(s('path', { class: 'story-tile__focus', d: shape.d }));
  }
  return svg;
}

export function render(ctx: PageContext): void {
  const page = h('div', { class: 'page stories-index' });
  const list = h('ol', { class: 'story-tiles' });
  page.append(
    h(
      'header',
      { class: 'page-head stories-index__head' },
      h('p', { class: 'kicker page-head__kicker' }, 'Guided stories'),
      h('h1', { class: 'page-head__title' }, 'Stories from the data'),
      h(
        'p',
        { class: 'dek page-head__dek' },
        'Scrolling essays in which the map and charts move with the text. Each is built only from the atlas’s own sourced data, and every number in them is filled in from that data when the page loads.',
      ),
    ),
    list,
  );
  ctx.root.append(page);

  const tiles = STORY_CONTENT.map((c, i) => {
    const media = h('div', { class: 'story-tile__media', 'aria-hidden': 'true' });
    const dek = h('p', { class: 'story-tile__dek' });
    const li = h(
      'li',
      { class: 'story-tile' },
      h(
        'a',
        { class: 'story-tile__link', href: `#/stories/${c.slug}` },
        media,
        h(
          'div',
          { class: 'story-tile__body' },
          h('p', { class: 'story-tile__num caps' }, `Story ${i + 1}`),
          h('h2', { class: 'story-tile__title' }, c.title),
          dek,
          h('p', { class: 'story-tile__more' }, 'Read the story', h('span', { 'aria-hidden': 'true' }, ' →')),
        ),
      ),
    );
    list.append(li);
    return { c, media, dek };
  });

  void Promise.all([loadJson<StoryIndexFile>('stories/index.json'), loadAtlasGeometry()]).then(([idx, geo]) => {
    if (idx.status !== 'ok') {
      list.before(errorState(idx.status === 'missing' ? 'The stories’ data has not been built yet.' : idx.error, 'public/data/stories/index.json'));
      for (const t of tiles) t.dek.remove();
      return;
    }
    for (const t of tiles) {
      const entry = idx.data.stories[t.c.slug];
      if (!entry) {
        t.dek.textContent = '';
        continue;
      }
      try {
        // Index deks are plain (no popovers): the numbers carry their details on the story page.
        t.dek.append(renderProse(t.c.dek, { numbers: entry.numbers, sources: {}, interactive: false }));
      } catch {
        t.dek.remove();
      }
      if (geo.status === 'ok' && entry.thumb.label) {
        t.media.append(thumb(geo.geometry, entry, `${entry.thumb.label}, FY ${entry.thumb.year}`));
        t.media.append(h('p', { class: 'story-tile__map-label' }, `${entry.thumb.label}, FY ${entry.thumb.year}`));
      }
    }
  });
}
