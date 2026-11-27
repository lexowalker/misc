// District profile (#/district/:id): a magazine-style portrait of one court, built only
// from published, sourced files in public/data/. The hero (identity, locator map, key
// facts) renders at once from the registry; at-a-glance figures, "What stands out" and
// the key statistics follow from districts.json and profiles/<id>.json; the bench,
// case mix, geography and recent cases load only as they approach the viewport.

import '../styles/pages.css';
import '../styles/district.css';
import { h } from '../lib/dom.ts';
import { periodLabel } from '../lib/format.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { registryDistrict, circuitLabel, DISTRICTS } from '../data/districts.ts';
import { loadCourthouses, loadDistricts, loadDistrictJudges, loadCases, loadProfile, loadSources, loadVariables } from '../data/loaders.ts';
import type { Courthouse, District, LatestStat, Variable } from '../data/types.ts';
import { loadAtlasGeometry } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import { atlasProjection } from '../map/projection.ts';
import { placeLabels } from '../map/labels.ts';
import { term } from '../components/glossary.ts';
import { sourceChip } from '../components/source-chip.ts';
import { dataNotBuilt, emptyState, errorState, loadingState } from '../components/states.ts';
import { fmtValue, sectionShell, whenNear, type SectionShell } from './district/common.ts';
import { renderKeyStats, renderStandout } from './district/stats.ts';

export function title(ctx: PageContext): string {
  return registryDistrict(ctx.params.id ?? '')?.name ?? 'District';
}

const SECTIONS: Array<[string, string]> = [
  ['standout', 'What stands out'],
  ['stats', 'Key statistics'],
  ['bench', 'The bench'],
  ['mix', 'Case mix'],
  ['geography', 'Geography'],
  ['cases', 'Recent cases'],
];

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function render(ctx: PageContext): Promise<() => void> {
  const id = ctx.params.id ?? '';
  const d = registryDistrict(id);
  const disposers: Array<() => void> = [];
  const cleanup = () => disposers.splice(0).forEach((f) => f());
  const page = h('div', { class: 'page district-page' });
  ctx.root.append(page);
  if (!d) {
    page.append(
      h('h1', { class: 'page-head__title' }, 'No such district'),
      h('p', { class: 'dek' }, `“${id}” is not one of the 94 federal judicial districts.`),
      h('p', null, h('a', { href: '#/search' }, 'Search for a district →')),
    );
    return cleanup;
  }
  const territorial = d.article === 'IV';

  /* ---- Hero ------------------------------------------------------------------------- */
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

  const locatorSlot = h('figure', { class: 'district-locator' }, h('div', { class: 'district-locator__map district-locator__map--loading', 'aria-hidden': 'true' }));
  const facts = h(
    'dl',
    { class: 'facts' },
    h('dt', null, territorial ? 'Territory' : 'State'),
    h('dd', null, d.stateName),
    h('dt', null, 'Appeals go to'),
    h('dd', null, d.circuit === 'DC' ? 'U.S. Court of Appeals for the D.C. Circuit' : `U.S. Court of Appeals for the ${circuitLabel(d.circuit)}`),
    h('dt', null, 'Type of court'),
    h('dd', null, territorial ? term('article-iv', 'Article IV territorial court') : term('article-iii', 'Article III court')),
  );
  const statuteDd = h('dd', null, '…');
  facts.append(h('dt', null, 'Defined by'), statuteDd);
  const glance = h('div', { class: 'glance' }, loadingState('Loading district facts'));
  const actions = h(
    'p',
    { class: 'district-actions' },
    h('a', { class: 'btn btn--primary', href: `#/compare?d=${encodeURIComponent(d.id)}` }, 'Compare with…'),
    h('a', { class: 'btn', href: '#/' }, 'Back to the map'),
  );

  /* ---- In-page navigation --------------------------------------------------------------- */
  const navLinks = SECTIONS.map(([sid, label]) => h('a', { class: 'dnav__link', href: `#/district/${d.id}?s=${sid}`, 'data-sec': sid }, label));
  const dnav = h('nav', { class: 'dnav', 'aria-label': 'On this page' }, h('ul', { class: 'dnav__list' }, ...navLinks.map((a) => h('li', null, a))));

  /* ---- Sections ------------------------------------------------------------------------- */
  const shells: Record<string, SectionShell> = {
    standout: sectionShell('standout', 'In brief', 'What stands out', 'Facts from the latest year where this court sits at an extreme, nationally or in its circuit. Each one cites its source.'),
    stats: sectionShell('stats', 'By the numbers', 'Key statistics', null),
    bench: sectionShell('bench', 'The judges', 'The bench over time', territorial ? null : 'Every Article III judge who has served on this court, from the start of service to its end.'),
    mix: sectionShell('mix', 'The docket', 'Case mix', 'What the court’s civil and criminal dockets are made of, and how sentences compare with the guidelines.'),
    geography: sectionShell('geography', 'The territory', 'Geography', 'Where the court’s authority runs and where it sits.'),
    cases: sectionShell('cases', 'From the docket', 'Recent cases', 'A few real, recent filings from the court, as listed by CourtListener. They are examples, not a sample.'),
  };
  for (const k of ['standout', 'stats']) shells[k]!.body.append(loadingState());
  for (const k of ['bench', 'mix', 'geography', 'cases']) {
    shells[k]!.el.classList.add('dsec--lazy');
    shells[k]!.body.append(loadingState());
  }

  /* ---- Previous / next ------------------------------------------------------------------ */
  const order = DISTRICTS.findIndex((x) => x.id === d.id);
  const fallbackPrev = DISTRICTS[(order - 1 + DISTRICTS.length) % DISTRICTS.length]!.id;
  const fallbackNext = DISTRICTS[(order + 1) % DISTRICTS.length]!.id;
  const pager = h('nav', { class: 'dpager', 'aria-label': 'Other districts' });
  const drawPager = (prevId: string, nextId: string) => {
    const p = registryDistrict(prevId);
    const n = registryDistrict(nextId);
    pager.replaceChildren(
      p ? h('a', { class: 'dpager__link dpager__link--prev', href: `#/district/${p.id}`, rel: 'prev' }, h('span', { class: 'dpager__dir' }, '← Previous district'), h('span', { class: 'dpager__name' }, p.name)) : h('span'),
      h('a', { class: 'dpager__compare btn', href: `#/compare?d=${encodeURIComponent(d.id)}` }, 'Compare with other districts'),
      n ? h('a', { class: 'dpager__link dpager__link--next', href: `#/district/${n.id}`, rel: 'next' }, h('span', { class: 'dpager__dir' }, 'Next district →'), h('span', { class: 'dpager__name' }, n.name)) : h('span'),
    );
  };
  drawPager(fallbackPrev, fallbackNext);

  page.append(
    head,
    h(
      'div',
      { class: 'district-hero' },
      locatorSlot,
      h('div', { class: 'district-hero__facts' }, facts, h('section', { class: 'glance-band', 'aria-labelledby': 'glance-h' }, h('h2', { class: 'glance-band__title', id: 'glance-h' }, 'At a glance'), glance), actions),
    ),
    dnav,
    ...SECTIONS.map(([sid]) => shells[sid]!.el),
    pager,
  );

  /* ---- In-page nav behaviour -------------------------------------------------------------- */
  const goToSection = (sid: string, smooth = true) => {
    const shell = shells[sid];
    if (!shell) return;
    shell.el.scrollIntoView({ behavior: smooth && !prefersReduced() ? 'smooth' : 'auto', block: 'start' });
    shell.head.querySelector<HTMLElement>('.dsec__title')?.focus({ preventScroll: true });
    replaceQuery({ s: sid });
  };
  for (const a of navLinks) {
    a.addEventListener('click', (e) => {
      if ((e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey || (e as MouseEvent).shiftKey) return;
      e.preventDefault();
      goToSection(a.dataset.sec!);
    });
  }
  // Current section: the last section whose top has passed a reading line a third of the way down the
  // visible area below the sticky nav. Above the first section (the hero) nothing is current; at the very
  // bottom of the page the last section that has come into view is current, even when it is too short to
  // reach the line. Computed from positions on scroll (not from intersection events), so it is never stale.
  let currentSec: string | null = null;
  const markCurrent = () => {
    const navBottom = Math.max(0, dnav.getBoundingClientRect().bottom);
    const line = navBottom + (window.innerHeight - navBottom) * 0.33;
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let sid: string | null = null;
    for (const [id] of SECTIONS) {
      const top = shells[id]!.el.getBoundingClientRect().top;
      if (top <= line || (atEnd && top < window.innerHeight - 48)) sid = id;
    }
    if (sid === currentSec) return;
    currentSec = sid;
    for (const a of navLinks) {
      if (a.dataset.sec === sid) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    // On a phone the nav scrolls sideways: keep the current link in view (horizontal only, no page jump).
    const cur = navLinks.find((a) => a.dataset.sec === sid);
    const list = dnav.querySelector<HTMLElement>('.dnav__list');
    if (cur && list && list.scrollWidth > list.clientWidth + 1) {
      const l = cur.offsetLeft - list.offsetLeft;
      if (l < list.scrollLeft || l + cur.offsetWidth > list.scrollLeft + list.clientWidth)
        list.scrollTo({ left: Math.max(0, l - 16), behavior: prefersReduced() ? 'auto' : 'smooth' });
    }
  };
  let navRaf = 0;
  const onNavScroll = () => {
    if (navRaf) return;
    navRaf = requestAnimationFrame(() => {
      navRaf = 0;
      markCurrent();
    });
  };
  window.addEventListener('scroll', onNavScroll, { passive: true });
  window.addEventListener('resize', onNavScroll);
  requestAnimationFrame(markCurrent);
  disposers.push(() => {
    window.removeEventListener('scroll', onNavScroll);
    window.removeEventListener('resize', onNavScroll);
    if (navRaf) cancelAnimationFrame(navRaf);
  });

  /* ---- Data ------------------------------------------------------------------------------ */
  const geoP = loadAtlasGeometry();
  const chP = loadCourthouses();
  const distP = loadDistricts();
  const profP = loadProfile(d.id);
  const varsP = loadVariables();

  // Locator + place labels
  void Promise.all([geoP, chP]).then(([geo, ch]) => {
    const mine: Courthouse[] = ch.status === 'ok' ? ch.data.filter((c) => c.district_id === d.id) : [];
    const places = mine.filter((c) => c.kind === 'place_of_holding_court');
    if (geo.status !== 'ok') {
      locatorSlot.replaceChildren(emptyState({ title: 'Map not yet built', file: 'public/data/geo/districts-lo.topo.json', icon: 'map', compact: true }));
      return;
    }
    const proj = atlasProjection();
    const pts = places
      .map((c) => {
        const p = proj.project(c.lon, c.lat, c.state);
        return p ? { x: p[0], y: p[1], label: c.city } : null;
      })
      .filter((p): p is { x: number; y: number; label: string } => !!p);
    const svg = renderLocator({ geometry: geo.geometry, districtId: d.id, points: pts });
    if (!svg) {
      locatorSlot.replaceChildren(emptyState({ title: 'No map shape for this district', icon: 'map', compact: true }));
      return;
    }
    const labels = h('div', { class: 'district-locator__labels', 'aria-hidden': 'true' });
    const mapBox = h('div', { class: 'district-locator__map' }, svg, labels);
    locatorSlot.replaceChildren(
      mapBox,
      h('figcaption', { class: 'caption' }, `${d.name}${pts.length ? `, with its ${pts.length === 1 ? 'place' : 'places'} of holding court` : ''}. The inset shows its place in the nation.`),
    );
    const layout = () => placeLocatorLabels(svg, labels, pts);
    requestAnimationFrame(layout);
    void document.fonts?.ready.then(layout);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => layout());
      ro.observe(mapBox);
      disposers.push(() => ro.disconnect());
    }
  });

  const [dist, prof, vars] = await Promise.all([distP, profP, varsP]);
  const district = dist.status === 'ok' ? dist.data[d.id] : undefined;
  const variables: Variable[] = vars.status === 'ok' ? vars.data : [];
  const varById = new Map(variables.map((v) => [v.id, v]));

  // Hero facts + at a glance
  if (district) {
    statuteDd.replaceChildren((district.statute_sections ?? []).join('; ') || 'Not recorded');
    glance.replaceChildren(...glanceTiles(district, varById));
    if (district.prev && district.next) drawPager(district.prev, district.next);
  } else {
    statuteDd.replaceChildren(h('span', { class: 'no-data' }, 'No data'));
    glance.replaceChildren(dist.status === 'error' ? errorState(dist.error, 'public/data/districts.json') : dataNotBuilt('districts.json', 'District facts', true));
  }

  // What stands out + key statistics
  const goToStat = (variable: string) => {
    const row = document.getElementById(`stat-${variable}`);
    if (!row) return;
    const list = row.closest('.stat-list');
    if (row.classList.contains('stat--extra') && list?.classList.contains('stat-list--collapsed')) {
      (list.parentElement?.querySelector('.stat-group__more') as HTMLButtonElement | null)?.click();
    }
    row.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
  };
  if (prof.status === 'ok' && variables.length) {
    shells.standout!.body.replaceChildren();
    renderStandout(shells.standout!.body, prof.data, variables, goToStat, d.id);
    shells.stats!.body.replaceChildren();
    renderKeyStats(shells.stats!.body, prof.data, variables);
  } else {
    const missing = prof.status !== 'ok' ? `profiles/${d.id}.json` : 'variables.json';
    const err = prof.status === 'error' ? prof : vars.status === 'error' ? vars : null;
    for (const k of ['standout', 'stats']) shells[k]!.body.replaceChildren(err ? errorState(err.error, `public/data/${missing}`) : dataNotBuilt(missing, 'This section', true));
  }

  /* ---- Lazy sections ------------------------------------------------------------------------ */
  disposers.push(
    whenNear(shells.bench!.el, () => {
      void Promise.all([import('./district/bench.ts'), loadDistrictJudges(d.id), loadSources()]).then(([m, jf, src]) => {
        const body = shells.bench!.body;
        body.replaceChildren();
        if (jf.status !== 'ok') {
          body.append(jf.status === 'error' ? errorState(jf.error, `public/data/judges/${d.id}.json`) : dataNotBuilt(`judges/${d.id}.json`, 'The bench timeline', true));
          return;
        }
        const srcId = jf.data.source_ids[0];
        const asOfIso = (src.status === 'ok' && srcId ? src.data[srcId]?.retrieved_at : null) ?? new Date().toISOString();
        disposers.push(m.renderBench(body, { file: jf.data, asOfIso, districtName: d.name }));
      });
    }),
  );
  disposers.push(
    whenNear(shells.mix!.el, () => {
      void import('./district/mix.ts').then((m) => {
        const body = shells.mix!.body;
        body.replaceChildren();
        if (prof.status !== 'ok') {
          body.append(dataNotBuilt(`profiles/${d.id}.json`, 'The case mix', true));
          return;
        }
        const cm = prof.data.case_mix;
        disposers.push(m.renderCaseMix(body, { civil: cm.civil_nature_of_suit, criminal: cm.criminal_offense, composition: cm.sentencing_composition, variables, profile: prof.data }));
      });
    }),
  );
  disposers.push(
    whenNear(shells.geography!.el, () => {
      void Promise.all([import('./district/geography.ts'), chP]).then(([m, ch]) => {
        const body = shells.geography!.body;
        body.replaceChildren();
        if (!district) {
          body.append(dataNotBuilt('districts.json', 'The geography', true));
          return;
        }
        m.renderGeography(body, district, ch.status === 'ok' ? ch.data.filter((c) => c.district_id === d.id) : []);
      });
    }),
  );
  disposers.push(
    whenNear(shells.cases!.el, () => {
      void Promise.all([import('./district/cases.ts'), loadCases(d.id)]).then(([m, cf]) => {
        const body = shells.cases!.body;
        body.replaceChildren();
        if (cf.status === 'error') {
          body.append(errorState(cf.error, `public/data/cases/${d.id}.json`));
          return;
        }
        m.renderCases(body, cf.status === 'ok' ? cf.data : null, d.id);
      });
    }),
  );

  // Deep link to a section (?s=bench)
  const wanted = ctx.query.get('s');
  if (wanted && shells[wanted]) requestAnimationFrame(() => goToSection(wanted, false));

  return cleanup;
}

/* ---- At a glance ---------------------------------------------------------------------------- */

const sentenceCase = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t);

function tile(label: string, value: Node | string, meta: Array<Node | string | null>, extra: Array<Node | null> = []): HTMLElement {
  return h(
    'div',
    { class: 'tile' },
    h('p', { class: 'tile__label' }, label),
    h('p', { class: 'tile__value' }, value),
    h('p', { class: 'tile__meta' }, ...meta.filter((m): m is Node | string => m !== null)),
    ...extra.filter((x): x is Node => !!x),
  );
}

function latestTile(label: string, stat: LatestStat | null | undefined, v: Variable | undefined, note: string | undefined): HTMLElement {
  if (!stat) {
    return tile(label, h('span', { class: 'no-data' }, 'No data'), [], [note ? h('p', { class: 'tile__note' }, sentenceCase(note.replace(/^No data:\s*/i, ''))) : null]);
  }
  return tile(label, fmtValue(stat.value, v ? { unit: '', format: v.format } : null, { unit: false }), [periodLabel(stat.year, stat.period_type)], [
    sourceChip({ sourceIds: [stat.source_id], derived: !!stat.derived, formula: stat.derived ? (v?.formula ?? null) : null, compact: true }),
  ]);
}

function glanceTiles(dd: District, vars: Map<string, Variable>): HTMLElement[] {
  const tiles: HTMLElement[] = [];
  // Population
  const pop = typeof dd.population === 'number' ? dd.population : null;
  if (pop !== null) {
    tiles.push(
      tile('Population', fmtValue(pop, { unit: '', format: ',.0f' }), [dd.population_year ? periodLabel(dd.population_year, dd.population_period_type ?? 'JUL1_EST') : null], [
        dd.population_approximate ? h('p', { class: 'tile__note' }, h('span', { class: 'tile__flag' }, 'Approximate'), ' ', dd.population_note ?? '') : null,
        sourceChip({ sourceIds: dd.population_source_id ? [dd.population_source_id] : [], derived: !!dd.population_derived, formula: dd.population_formula ?? null, compact: true }),
      ]),
    );
  } else {
    const c20 = dd.population_census_2020;
    tiles.push(
      tile('Population', h('span', { class: 'no-data' }, 'No data'), ['No annual estimate'], [
        dd.population_note ? h('p', { class: 'tile__note' }, sentenceCase(dd.population_note.replace(/^No data:\s*/i, ''))) : null,
        c20 ? h('p', { class: 'tile__alt' }, h('span', { class: 'tile__alt-label' }, '2020 Census count'), ' ', h('span', { class: 'tile__alt-val' }, fmtValue(c20.value, { unit: '', format: ',.0f' }))) : null,
        c20 ? sourceChip({ sourceIds: [c20.source_id], derived: !!c20.derived, formula: c20.formula ?? null, compact: true }) : null,
      ]),
    );
  }
  // Counties
  const nCounties = dd.counties?.length ?? 0;
  tiles.push(
    tile('Counties', nCounties ? fmtValue(nCounties, { unit: '', format: '.0f' }) : h('span', { class: 'no-data' }, 'No data'), [nCounties === 1 ? 'County or equivalent named in the statute' : 'Counties or equivalents named in the statute'], [
      sourceChip({ sourceIds: (dd.statute_sections ?? []).some((s) => /48 U\.S\.C/.test(s)) ? ['olrc_usc48_xml'] : ['olrc_usc28_xml'], compact: true }),
    ]),
  );
  tiles.push(latestTile('Authorized judgeships', dd.judgeships, vars.get('judgeships'), undefined));
  tiles.push(latestTile('Active judges', dd.judges_active, vars.get('active_judges'), dd.judges_note));
  tiles.push(latestTile('Senior judges', dd.judges_senior, vars.get('senior_judges'), dd.judges_note));
  return tiles;
}

/* ---- Locator labels -------------------------------------------------------------------------- */

function placeLocatorLabels(svg: SVGSVGElement, layer: HTMLElement, pts: Array<{ x: number; y: number; label: string }>): void {
  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !vb.width) return;
  const k = rect.width / vb.width;
  const fontSize = rect.width < 420 ? 11 : 12;
  const font = `600 ${fontSize}px "Public Sans Variable", "Public Sans", sans-serif`;
  const reserved: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  const key = svg.querySelector('.locator-map__key-bg');
  if (key) {
    const x = Number(key.getAttribute('x'));
    const y = Number(key.getAttribute('y'));
    const w = Number(key.getAttribute('width'));
    const hh = Number(key.getAttribute('height'));
    reserved.push({ x0: (x - vb.x) * k - 4, y0: (y - vb.y) * k - 4, x1: (x + w - vb.x) * k + 4, y1: (y + hh - vb.y) * k + 4 });
  }
  // Each dot also reserves its own footprint so labels never cover another place's dot.
  for (const p of pts) {
    const sx = (p.x - vb.x) * k;
    const sy = (p.y - vb.y) * k;
    reserved.push({ x0: sx - 4, y0: sy - 4, x1: sx + 4, y1: sy + 4 });
  }
  const seen = new Set<string>();
  const cands = pts
    .filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)))
    .map((p, i) => ({ id: `${i}`, text: p.label, x: (p.x - vb.x) * k, y: (p.y - vb.y) * k, priority: pts.length - i }));
  const placed = placeLabels(cands, { font, fontSize, width: rect.width, height: rect.height, gap: 7, reserved });
  layer.replaceChildren(
    ...placed.map((l) =>
      h(
        'span',
        {
          class: `district-locator__label is-${l.anchor}`,
          style: `left:${(l.x + l.dx).toFixed(1)}px;top:${(l.y + l.dy).toFixed(1)}px;font-size:${fontSize}px`,
        },
        l.text,
      ),
    ),
  );
}
