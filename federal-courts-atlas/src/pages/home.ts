// Home: the national choropleth. Variable picker (from variables.json), year slider
// (time machine) when a variable has several years, explainer and caveats.
// With no statistics published yet, the map shows the district boundaries only.

import '../styles/home.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { loadValues, loadVariables, caveatList } from '../data/loaders.ts';
import type { ValuesFile, Variable } from '../data/types.ts';
import { ChoroplethView } from '../map/view.ts';
import { YearSlider } from '../components/year-slider.ts';
import { emptyState, errorState } from '../components/states.ts';
import { rich } from '../components/glossary.ts';

export const title = 'Map of the federal district courts';

const FAMILY_LABEL: Record<string, string> = { speed: 'Speed', workload: 'Workload', sentencing: 'Sentencing', casemix: 'Case mix' };
const FAMILY_ORDER = ['speed', 'workload', 'sentencing', 'casemix'];

export async function render(ctx: PageContext): Promise<() => void> {
  const root = ctx.root;
  const page = h('div', { class: 'page home' });
  const head = h(
    'header',
    { class: 'home-head' },
    h('p', { class: 'kicker' }, 'The 94 U.S. district courts'),
    h('h1', { class: 'home-head__title' }, 'How federal justice varies from place to place'),
    h(
      'p',
      { class: 'dek home-head__dek' },
      'Speed, workload, sentencing and case mix in every federal judicial district, drawn from public court records. Hover or tap a district for its numbers; select it to open its profile.',
    ),
  );
  const controls = h('div', { class: 'home-controls' });
  const mapSlot = h('div', { class: 'home-map' });
  const about = h('section', { class: 'home-about', 'aria-label': 'About this measure' });
  page.append(head, controls, mapSlot, about);
  root.append(page);

  const view = new ChoroplethView(mapSlot, { ariaLabel: 'Choropleth map of the 94 federal judicial districts' });
  const timeSlot = h('div', { class: 'home-time' });
  view.afterMap.append(timeSlot);
  let slider: YearSlider | null = null;
  let seq = 0;

  const showVariable = async (v: Variable, year?: number) => {
    const my = ++seq;
    const r = await loadValues(v.id);
    if (my !== seq) return;
    slider?.destroy();
    slider = null;
    if (r.status !== 'ok') {
      view.setData({ variable: null, values: null });
      timeSlot.replaceChildren(
        r.status === 'missing'
          ? emptyState({ title: 'No values for this measure yet', body: `${v.label} is listed, but its values file has not been published.`, file: `public/data/values/${v.id}.json`, compact: true })
          : errorState(r.error, r.url),
      );
      renderAbout(v, null);
      return;
    }
    const values = r.data;
    const y = year && values.years.includes(year) ? year : values.years[values.years.length - 1] ?? null;
    view.setData({ variable: v, values, year: y });
    timeSlot.replaceChildren();
    if (values.years.length > 1 && y !== null) {
      slider = new YearSlider({
        years: values.years,
        value: y,
        periodType: values.period_type,
        label: `Year for ${v.label}`,
        onChange: (yr) => {
          view.setYear(yr);
          replaceQuery({ y: String(yr) });
        },
      });
      timeSlot.append(slider.el);
    }
    replaceQuery({ v: v.id, y: y !== null ? String(y) : null });
    renderAbout(v, values);
  };

  const renderAbout = (v: Variable, values: ValuesFile | null) => {
    const caveats = caveatList(v);
    about.replaceChildren(
      h(
        'div',
        { class: 'home-about__main' },
        h('h2', { class: 'home-about__title' }, v.label),
        v.explainer ? h('p', { class: 'home-about__text' }, v.explainer) : null,
        v.higher_means ? h('p', { class: 'home-about__higher' }, h('span', { class: 'caps' }, 'Higher means'), ' ', v.higher_means) : null,
        v.derived && v.formula ? h('p', { class: 'home-about__formula' }, h('span', { class: 'caps' }, 'Derived'), ' ', h('code', null, v.formula)) : null,
      ),
      h(
        'div',
        { class: 'home-about__side' },
        caveats.length ? h('div', null, h('h3', { class: 'caps' }, 'Caveats'), h('ul', { class: 'home-about__caveats' }, ...caveats.map((c) => h('li', null, c)))) : null,
        values ? h('p', null, h('a', { href: `#/table/${encodeURIComponent(v.id)}` }, 'Full table for every year →')) : null,
      ),
    );
  };

  const renderPrimer = () => {
    about.replaceChildren(
      h(
        'div',
        { class: 'home-about__main' },
        h('h2', { class: 'home-about__title' }, 'Reading the map'),
        h(
          'p',
          { class: 'home-about__text' },
          rich(
            'Each shape is one of the 94 federal judicial [[district|districts]], the trial courts where federal cases begin. Thin lines separate districts; heavier lines are state borders. Alaska, Hawaii and the territories appear in the boxes at lower left. Every district belongs to a [[circuit]], whose [[court-of-appeals|court of appeals]] hears its appeals.',
          ),
        ),
      ),
      h(
        'div',
        { class: 'home-about__side' },
        h('h3', { class: 'caps' }, 'Start here'),
        h(
          'ul',
          { class: 'home-about__links' },
          h('li', null, h('a', { href: '#/learn' }, 'How federal courts work')),
          h('li', null, h('a', { href: '#/search' }, 'Find your federal court')),
          h('li', null, h('a', { href: '#/sources' }, 'Where the data comes from')),
        ),
      ),
    );
  };

  const vr = await loadVariables();
  if (vr.status !== 'ok' || !vr.data.length) {
    controls.append(
      h(
        'div',
        { class: 'home-notice', role: 'status' },
        h('span', { class: 'home-notice__dot', 'aria-hidden': 'true' }),
        h(
          'p',
          null,
          h('strong', null, 'Statistics not yet built. '),
          vr.status === 'error'
            ? `The list of measures could not be loaded (${vr.error}).`
            : 'The map shows the 94 district boundaries. Measures of speed, workload, sentencing and case mix appear here as the data pipeline publishes them; nothing is estimated in the meantime.',
        ),
      ),
    );
    view.setData({ variable: null, values: null });
    renderPrimer();
  } else {
    const vars = [...vr.data].sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family));
    const select = h('select', { id: 'variable-select', class: 'home-select' });
    for (const fam of FAMILY_ORDER) {
      const inFam = vars.filter((v) => v.family === fam);
      if (!inFam.length) continue;
      const og = h('optgroup', { label: FAMILY_LABEL[fam] ?? fam });
      for (const v of inFam) og.append(h('option', { value: v.id }, v.label));
      select.append(og);
    }
    const others = vars.filter((v) => !FAMILY_ORDER.includes(v.family));
    for (const v of others) select.append(h('option', { value: v.id }, v.label));
    controls.append(h('label', { class: 'home-select-label caps', for: 'variable-select' }, 'Showing'), h('div', { class: 'home-select-wrap' }, select));
    const wanted = ctx.query.get('v');
    const initial = vars.find((v) => v.id === wanted) ?? vars[0]!;
    select.value = initial.id;
    select.addEventListener('change', () => {
      const v = vars.find((x) => x.id === select.value);
      if (v) void showVariable(v);
    });
    const y = ctx.query.get('y');
    await showVariable(initial, y ? Number(y) : undefined);
  }

  return () => {
    slider?.destroy();
    view.destroy();
  };
}
