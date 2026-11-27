// A guided story (#/stories/:slug): a scrollytelling essay. The words live in
// src/content/stories.ts; every number, chart series and map layer comes from
// public/data/stories/<slug>.json (written by pipeline/stories from data/processed).
//
// Layout: a sticky graphic (the atlas map or a chart) beside the steps on wide screens,
// above them on narrow ones. Steps are real text in reading order. The graphic has an
// accessible name that describes what it shows at each step, and every chart's data is
// available as a table in "How we did this". Under prefers-reduced-motion the graphic
// still follows the text but changes instantly (no fades, no zooming).

import '../styles/pages.css';
import '../styles/stories.css';
import { h, prefersReducedMotion, rafThrottle } from '../lib/dom.ts';
import { formatDate } from '../lib/format.ts';
import type { PageContext } from '../app/router.ts';
import { loadJson } from '../data/fetch.ts';
import { emptyState, errorState, loadingState } from '../components/states.ts';
import { STORY_CONTENT, storyContent, type ChartGraphic, type Graphic, type MapGraphic, type StoryContent } from '../content/stories.ts';
import type { StoryFile, ChartSpec, SourceProv } from './story/types.ts';
import { fillText, hideNumPop, MissingNumberError, renderProse } from './story/prose.ts';
import { chartTable, createChart, type ChartView } from './story/charts.ts';
import { StoryMap } from './story/story-map.ts';

export function title(ctx: PageContext): string {
  return storyContent(ctx.params.slug ?? '')?.short ?? 'Story';
}

function graphicKey(g: Graphic): string {
  return g.kind === 'map' ? 'map' : `chart:${g.chart}`;
}

/** Group per-file sources into readable citations ("22 files, FY 2004 to FY 2025"). */
function sourceGroups(ids: string[], prov: Record<string, SourceProv>) {
  const groups = new Map<string, { publisher: string; name: string; years: number[]; urls: string[]; ids: string[]; retrieved: string }>();
  for (const id of ids) {
    const p = prov[id];
    if (!p) continue;
    const name = (p.dataset ?? id)
      .replace(/,? (fiscal year|12-month period).*$/i, '')
      .replace(/,\s*[a-z]{2,5}$/, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const publisher = (p.publisher ?? '').replace(/\s*\(.*?\)/, '').replace(/,? via .*$/, '').trim();
    const key = `${publisher}|${name}`;
    const g = groups.get(key) ?? { publisher, name, years: [], urls: [], ids: [], retrieved: '' };
    const y = /FY\s?(\d{4})/.exec(p.vintage ?? '');
    if (y) g.years.push(Number(y[1]));
    if (p.url) g.urls.push(p.url);
    g.ids.push(id);
    if ((p.retrieved_at ?? '') > g.retrieved) g.retrieved = p.retrieved_at ?? '';
    groups.set(key, g);
  }
  return [...groups.values()];
}

class StoryView {
  private root: HTMLElement;
  private content: StoryContent;
  private data: StoryFile;
  private frame!: HTMLDivElement;
  private figTitle!: HTMLElement;
  private figCaption!: HTMLElement;
  private figSource!: HTMLElement;
  private steps: HTMLElement[] = [];
  private views = new Map<string, { el: HTMLElement; chart?: ChartView }>();
  private map: StoryMap | null = null;
  private active = -1;
  private onScroll: () => void;
  private cleanupFns: Array<() => void> = [];

  constructor(root: HTMLElement, content: StoryContent, data: StoryFile) {
    this.root = root;
    this.content = content;
    this.data = data;
    this.onScroll = rafThrottle(() => this.pick());
  }

  private prose(t: string): DocumentFragment {
    return renderProse(t, { numbers: this.data.numbers, sources: this.data.sources });
  }

  render(): void {
    const c = this.content;
    const d = this.data;
    const idx = STORY_CONTENT.findIndex((s) => s.slug === c.slug);
    const article = h('article', { class: 'story' });

    const head = h(
      'header',
      { class: 'story-head' },
      h('p', { class: 'kicker story-head__kicker' }, h('a', { href: '#/stories' }, 'Guided stories'), h('span', { 'aria-hidden': 'true' }, ' · '), `${idx + 1} of ${STORY_CONTENT.length}`),
      h('h1', { class: 'story-head__title' }, c.title),
      h('p', { class: 'story-head__dek story-dek' }, this.prose(c.dek)),
      h(
        'p',
        { class: 'story-head__meta' },
        'Built only from the atlas’s sourced data. Data retrieved through ',
        h('time', { datetime: d.build_date }, formatDate(d.build_date)),
        '. ',
        h('a', { href: '#how-we-did-this', class: 'story-head__method' }, 'How we did this'),
      ),
    );

    // Sticky graphic.
    this.frame = h('div', { class: 'story-figure__frame', role: 'img', 'aria-label': 'Story graphic' });
    this.figTitle = h('p', { class: 'story-figure__title' });
    this.figCaption = h('p', { class: 'story-figure__caption' });
    this.figSource = h('p', { class: 'story-figure__source' });
    const figure = h(
      'figure',
      { class: 'story-figure' },
      h('div', { class: 'story-figure__head' }, this.figTitle),
      this.frame,
      h('figcaption', { class: 'story-figure__foot' }, this.figCaption, this.figSource),
    );
    const graphic = h('div', { class: 'scrolly__graphic' }, figure);

    const stepsWrap = h('div', { class: 'scrolly__steps' });
    c.steps.forEach((st, i) => {
      const step = h(
        'div',
        { class: 'story-step', 'data-step': String(i) },
        h('div', { class: 'story-step__card' }, h('p', { class: 'story-step__text' }, this.prose(st.text))),
      );
      this.steps.push(step);
      stepsWrap.append(step);
    });
    const scrolly = h('section', { class: 'scrolly', 'aria-label': 'Story' }, graphic, stepsWrap);

    article.append(head, scrolly, this.methodSection(), this.navSection(idx));
    this.root.append(article);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll);
    this.cleanupFns.push(() => {
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onScroll);
    });
    this.activate(0, true);
    requestAnimationFrame(() => this.pick());
  }

  /** The active step is the last one whose top has passed the trigger line. */
  private pick(): void {
    const narrow = window.matchMedia('(max-width: 59.99rem)').matches;
    // Narrow screens: the text is read in the band below the sticky graphic, so the trigger line sits
    // halfway down that band. Wide screens: just below the middle of the viewport.
    const gb = narrow ? (this.frame.closest('.scrolly__graphic')?.getBoundingClientRect().bottom ?? 0) : 0;
    const line = narrow ? Math.max(gb, 0) + (window.innerHeight - Math.max(gb, 0)) * 0.45 : window.innerHeight * 0.55;
    let idx = 0;
    this.steps.forEach((el, i) => {
      if (el.getBoundingClientRect().top < line) idx = i;
    });
    if (idx !== this.active) this.activate(idx);
  }

  private activate(i: number, first = false): void {
    const prev = this.active;
    this.active = i;
    this.steps.forEach((el, k) => el.classList.toggle('is-active', k === i));
    hideNumPop();
    const g = this.content.steps[i]!.graphic;
    const key = graphicKey(g);
    const prevKey = prev >= 0 ? graphicKey(this.content.steps[prev]!.graphic) : null;
    const instant = first || prefersReducedMotion();
    let view = this.views.get(key);
    if (!view) {
      const made = this.createView(g);
      if (!made) return;
      view = made;
      this.views.set(key, view);
    }
    for (const [k, v] of this.views) {
      v.el.classList.toggle('is-active', k === key);
      v.el.setAttribute('aria-hidden', String(k !== key));
    }
    if (g.kind === 'map') this.map?.set(g, instant || prevKey !== 'map');
    else view.chart?.update(g);
    this.updateFigure(g);
  }

  private createView(g: Graphic): { el: HTMLElement; chart?: ChartView } | null {
    if (g.kind === 'map') {
      const el = h('div', { class: 'story-view story-view--map' });
      this.frame.append(el);
      this.map = new StoryMap(el, this.data.layers);
      void this.map.ready.then(() => {
        const cur = this.content.steps[this.active]?.graphic;
        if (cur?.kind === 'map') {
          this.map?.set(cur, true);
          this.updateFigure(cur);
        }
      });
      return { el };
    }
    const spec = this.data.charts[g.chart];
    const el = h('div', { class: 'story-view story-view--chart' });
    this.frame.append(el);
    if (!spec) {
      el.append(emptyState({ title: 'Chart not available', body: `The data file has no chart “${g.chart}”.`, icon: 'error' }));
      return { el };
    }
    const chart = createChart(spec, g);
    if (chart) el.append(chart.el);
    return { el, chart: chart ?? undefined };
  }

  private updateFigure(g: Graphic): void {
    if (g.kind === 'map') {
      const lay = this.data.layers[g.layer];
      this.figTitle.textContent = lay ? `${lay.label}, FY ${g.year}` : 'Map';
      this.figCaption.replaceChildren(lay?.note ?? '');
      this.figSource.replaceChildren(this.sourceNote(lay?.source_ids ?? [], !!lay?.derived, lay?.formula, lay?.how));
      this.frame.setAttribute('aria-label', this.map?.describe(g as MapGraphic) ?? 'Map');
      return;
    }
    const spec = this.data.charts[g.chart];
    this.figTitle.textContent = spec?.title ?? '';
    const cap = this.content.captions?.[g.chart];
    this.figCaption.replaceChildren(cap ? this.prose(cap) : '');
    this.figSource.replaceChildren(spec ? this.sourceNote(spec.source_ids, spec.derived, spec.formula, spec.how) : '');
    const view = this.views.get(graphicKey(g));
    this.frame.setAttribute('aria-label', view?.chart?.describe(g as ChartGraphic) ?? spec?.title ?? 'Chart');
  }

  private sourceNote(ids: string[], derived: boolean, formula?: string, how?: string): DocumentFragment {
    const frag = document.createDocumentFragment();
    const groups = sourceGroups(ids, this.data.sources);
    frag.append(h('span', { class: 'caps' }, 'Source'), ' ', groups.map((g) => g.publisher.replace(/^Administrative Office of the U\.S\. Courts$/, 'Administrative Office of the U.S. Courts') + (g.name ? `, ${shortDataset(g.name)}` : '')).join('; '), '.');
    if (derived && formula) {
      const id = `fig-formula-${Math.random().toString(36).slice(2, 8)}`;
      const btn = h('button', { type: 'button', class: 'story-figure__derived', 'aria-expanded': 'false', 'aria-controls': id }, 'Derived: show formula');
      const box = h('span', { class: 'story-figure__formula', id, hidden: true }, h('code', null, formula), how ? h('span', null, ` ${how}`) : '');
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? 'Derived: hide formula' : 'Derived: show formula';
        box.hidden = !open;
      });
      btn.addEventListener('pointerenter', () => btn.setAttribute('title', formula));
      frag.append(' ', btn, box);
    }
    return frag;
  }

  private methodSection(): HTMLElement {
    const c = this.content;
    const d = this.data;
    const sec = h('section', { class: 'story-method', id: 'how-we-did-this', 'aria-labelledby': 'how-we-did-this-h' });
    sec.append(h('h2', { class: 'story-method__title', id: 'how-we-did-this-h' }, 'How we did this'), h('p', { class: 'story-method__intro' }, this.prose(c.method.intro)));
    sec.append(h('ul', { class: 'story-method__notes' }, ...c.method.notes.map((n) => h('li', null, this.prose(n)))));
    sec.append(
      h(
        'p',
        { class: 'story-method__numbers' },
        'Every number in this story is filled in from the atlas’s data when the page loads. Numbers marked with a dotted underline are ',
        h('strong', null, 'derived'),
        ' (computed by the atlas, for example a share or a count of years): select one to see its formula. Hover any number to see its source.',
      ),
    );

    // Data behind the charts.
    const used = new Set<string>();
    for (const st of c.steps) if (st.graphic.kind === 'chart') used.add(st.graphic.chart);
    const tables = h('div', { class: 'story-method__tables' }, h('h3', { class: 'story-method__sub' }, 'Data behind the charts'));
    for (const id of used) {
      const spec = d.charts[id] as ChartSpec | undefined;
      if (!spec) continue;
      const t = chartTable(spec);
      if (!t) continue;
      const det = h('details', { class: 'story-data' }, h('summary', null, spec.title ?? id), h('div', { class: 'story-data__scroll', tabindex: '0', role: 'region', 'aria-label': spec.title ?? id }, t));
      if (spec.derived && spec.formula) det.append(h('p', { class: 'story-data__formula' }, h('span', { class: 'caps' }, 'Derived'), ' ', h('code', null, spec.formula)));
      tables.append(det);
    }
    const maps = new Set<string>();
    for (const st of c.steps) if (st.graphic.kind === 'map') maps.add(`${st.graphic.layer}`);
    if (maps.size) {
      tables.append(
        h(
          'p',
          { class: 'story-method__maps' },
          'Hovering a district on a story map shows its value. ',
          maps.has('imm_share')
            ? 'This story’s map counts felony defendants only, so its immigration shares differ from the all-defendant measure on the atlas’s '
            : 'The same measure, with every district’s figure for every year, is on the atlas’s ',
          h('a', { href: '#/' }, 'map'),
          '. Every source is listed on the ',
          h('a', { href: '#/sources' }, 'sources'),
          ' page.',
        ),
      );
    }
    sec.append(tables);

    // Sources.
    const groups = sourceGroups(Object.keys(d.sources), d.sources);
    const list = h('ul', { class: 'story-sources' });
    for (const g of groups) {
      const yrs = [...new Set(g.years)].sort((a, b) => a - b);
      const span = yrs.length > 1 ? `, ${g.ids.length} files, FY ${yrs[0]} to FY ${yrs[yrs.length - 1]}` : yrs.length ? `, FY ${yrs[0]}` : '';
      list.append(
        h(
          'li',
          null,
          h('span', { class: 'story-sources__pub' }, g.publisher),
          ', ',
          g.urls[0] ? h('a', { href: g.urls[0], target: '_blank', rel: 'noopener' }, g.name) : g.name,
          span,
          g.retrieved ? `. Retrieved ${formatDate(g.retrieved)}.` : '.',
        ),
      );
    }
    sec.append(h('h3', { class: 'story-method__sub' }, 'Sources'), list);
    return sec;
  }

  private navSection(idx: number): HTMLElement {
    const prev = STORY_CONTENT[idx - 1];
    const next = STORY_CONTENT[idx + 1];
    return h(
      'nav',
      { class: 'story-nav', 'aria-label': 'More stories' },
      prev ? h('a', { class: 'story-nav__link story-nav__link--prev', href: `#/stories/${prev.slug}` }, h('span', { class: 'caps' }, 'Previous story'), h('span', { class: 'story-nav__title' }, prev.short)) : h('span'),
      h('a', { class: 'story-nav__all', href: '#/stories' }, 'All stories'),
      next ? h('a', { class: 'story-nav__link story-nav__link--next', href: `#/stories/${next.slug}` }, h('span', { class: 'caps' }, 'Next story'), h('span', { class: 'story-nav__title' }, next.short)) : h('span'),
    );
  }

  destroy(): void {
    for (const f of this.cleanupFns) f();
    for (const v of this.views.values()) v.chart?.destroy();
    this.map?.destroy();
    hideNumPop();
  }
}

function shortDataset(name: string): string {
  return name
    .replace(/^FJC Integrated Database \(IDB\):.*$/, 'FJC Integrated Database')
    .replace(/^Federal Court Management Statistics:.*$/, 'Federal Court Management Statistics')
    .replace(/^USSC /, '');
}

export function render(ctx: PageContext): () => void {
  const slug = ctx.params.slug ?? '';
  const content = storyContent(slug);
  const page = h('div', { class: 'story-page' });
  ctx.root.append(page);
  if (!content) {
    page.classList.add('page', 'page--narrow');
    page.append(
      h('header', { class: 'page-head' }, h('h1', { class: 'page-head__title' }, 'Story not found'), h('p', { class: 'dek page-head__dek' }, 'There is no story at this address.')),
      h('p', null, h('a', { href: '#/stories' }, 'All stories →')),
    );
    return () => {};
  }
  const loading = loadingState('Loading the story');
  page.append(loading);
  let view: StoryView | null = null;
  let dead = false;
  void loadJson<StoryFile>(`stories/${slug}.json`).then((r) => {
    if (dead) return;
    loading.remove();
    if (r.status !== 'ok') {
      page.classList.add('page', 'page--narrow');
      page.append(
        h('header', { class: 'page-head' }, h('h1', { class: 'page-head__title' }, content.title)),
        r.status === 'missing'
          ? emptyState({ title: 'Story data not built yet', body: 'This story’s numbers have not been published yet.', file: `public/data/stories/${slug}.json`, icon: 'data' })
          : errorState(r.error, `public/data/stories/${slug}.json`),
      );
      return;
    }
    try {
      view = new StoryView(page, content, r.data);
      view.render();
    } catch (e) {
      page.replaceChildren();
      page.classList.add('page', 'page--narrow');
      const msg = e instanceof MissingNumberError ? e.message : String(e);
      page.append(h('header', { class: 'page-head' }, h('h1', { class: 'page-head__title' }, content.title)), errorState(`This story could not be assembled: ${msg}`, `public/data/stories/${slug}.json`));
    }
  });
  return () => {
    dead = true;
    view?.destroy();
  };
}

export { fillText };
