import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle, shot, watchErrors } from './helpers.ts';

// District profile pages (#/district/:id). Every expectation about a number is read from
// the published files in public/data/ inside the test, so nothing here hard-codes a statistic.

const DATA = path.join('public', 'data');
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'));
const DISTRICTS = readJson('districts.json') as Record<string, Record<string, unknown>>;

/** Scroll through the page so every lazy section renders, then return to the top. */
async function renderAll(page: Page): Promise<void> {
  for (const sec of ['bench', 'mix', 'geography', 'cases']) {
    await page.locator(`#sec-${sec}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#sec-${sec} .dsec__body > .loading-state`)).toHaveCount(0, { timeout: 15_000 });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function open(page: Page, id: string): Promise<void> {
  await page.goto(`./#/district/${id}`);
  await expect(page.locator('h1')).toHaveText(String(DISTRICTS[id]!.name));
  await page.waitForSelector('.locator-map, .district-locator .empty-state', { timeout: 15_000 });
  await expect(page.locator('#sec-stats .stat-list').first()).toBeVisible({ timeout: 15_000 });
}

const SAMPLE = ['vaed', 'txed', 'cand', 'nmid', 'dcd', 'akd', 'wyd', 'prd', 'gud', 'flnd', 'txwd'];

for (const id of SAMPLE) {
  test(`profile ${id} renders every section without errors`, async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await open(page, id);
    await renderAll(page);
    // Every section has a heading and no leftover loading state.
    for (const sec of ['standout', 'stats', 'bench', 'mix', 'geography', 'cases']) {
      await expect(page.locator(`#sec-${sec} .dsec__title`)).toBeVisible();
    }
    // No horizontal page scroll at this width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
    // No em-dash in any rendered text.
    const text = await page.locator('body').innerText();
    expect(text.includes('\u2014'), 'em-dash in page text').toBe(false);
    if (['vaed', 'nmid', 'wyd', 'txed', 'flnd', 'txwd'].includes(id) || testInfo.project.name === 'desktop') {
      await settle(page);
      await shot(page, testInfo, `district-${id}`);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('at a glance reads districts.json (population, judgeships, approximate note, territories)', async ({ page }) => {
  await open(page, 'wyd');
  const wyd = DISTRICTS.wyd as { population: number; judgeships: { value: number } };
  const glance = page.locator('.glance');
  await expect(glance.locator('.tile').first()).toContainText(wyd.population.toLocaleString('en-US'));
  await expect(glance).toContainText('Approximate');
  await expect(glance.locator('.tile', { hasText: 'Authorized judgeships' })).toContainText(String(wyd.judgeships.value));

  await open(page, 'nmid');
  const nmid = DISTRICTS.nmid as { population_census_2020: { value: number } };
  await expect(page.locator('.facts')).toContainText('Article IV territorial court');
  const pop = page.locator('.glance .tile').first();
  await expect(pop).toContainText('No data');
  await expect(pop).toContainText(nmid.population_census_2020.value.toLocaleString('en-US'));
  await expect(page.locator('.glance .tile', { hasText: 'Active judges' })).toContainText('No data');
});

test('a shared judgeship is shown as published, not rounded', async ({ page }) => {
  const oknd = DISTRICTS.oknd as { judgeships: { value: number } };
  test.skip(Number.isInteger(oknd.judgeships.value), 'oknd judgeships are whole in this build');
  await open(page, 'oknd');
  await expect(page.locator('.glance .tile', { hasText: 'Authorized judgeships' }).locator('.tile__value')).toHaveText(String(oknd.judgeships.value));
  // The context sentence must print the half judgeship as published (the pipeline once rounded it), never rounded.
  await expect(page.locator('#sec-standout')).not.toContainText(`had ${Math.round(oknd.judgeships.value)} authorized`);
  const prof = readJson('profiles/oknd.json') as { distinctive: { paragraph: string } };
  if (prof.distinctive.paragraph.includes('authorized judgeship')) {
    await expect(page.locator('#sec-standout')).toContainText(`had ${oknd.judgeships.value} authorized`);
  }
});

test('key statistics: value, explicit rank, national figure, sparkline, source, derived formula', async ({ page }) => {
  const prof = readJson('profiles/vaed.json') as { key_stats: Array<{ variable: string; family: string; value: number | null; rank: number | null; ranked_of: number | null; derived: boolean; national: number | null; featured: boolean }> };
  await open(page, 'vaed');
  const row = page.locator('#stat-civil_disposition_months');
  const r = prof.key_stats.find((x) => x.variable === 'civil_disposition_months')!;
  await expect(row.locator('.stat__num')).toHaveText(r.value!.toFixed(1));
  await expect(row.locator('.stat__rank-text')).toContainText(new RegExp(`(\\d+(st|nd|rd|th) highest|Highest|Lowest|highest|lowest) of ${r.ranked_of}`));
  await expect(row.locator('.stat__nat')).toContainText(r.national!.toFixed(1));
  await expect(row.locator('.sparkline svg')).toHaveCount(1);
  await expect(row.locator('.source-chip')).toContainText(/Administrative Office/);

  // A derived per-capita rate: "Derived" label and a formula on focus.
  const rate = page.locator('#stat-civil_filings_per_100k');
  await expect(rate.locator('.source-chip__label')).toHaveText('Derived');
  await rate.locator('.source-chip .source-chip__formula').focus();
  await expect(rate.locator('.source-chip .source-chip__pop')).toBeVisible();
  await expect(rate.locator('.source-chip .source-chip__pop')).toContainText('100,000');

  // Featured rows show first; the rest open on demand.
  const extra = prof.key_stats.filter((x) => x.family === 'workload' && !x.featured).length;
  const more = page.getByRole('button', { name: new RegExp(`Show ${extra} more workload measures`) });
  await expect(page.locator('#stat-judgeships')).toBeHidden();
  await more.click();
  await expect(page.locator('#stat-judgeships')).toBeVisible();
});

test('missing values read "No data" (civil trial median below the AO threshold)', async ({ page }) => {
  const prof = readJson('profiles/wyd.json') as { key_stats: Array<{ variable: string; value: number | null }> };
  test.skip(prof.key_stats.find((x) => x.variable === 'civil_trial_months')!.value !== null, 'wyd has a value in this build');
  await open(page, 'wyd');
  await expect(page.locator('#stat-civil_trial_months .stat__value')).toContainText('No data');
  await expect(page.locator('#stat-civil_trial_months .stat__rank')).toContainText('Not ranked');
});

test('what stands out: each sentence has a source chip and every number matches its claim', async ({ page }) => {
  const prof = readJson('profiles/txed.json') as { distinctive: { sentences: Array<{ text: string }> } };
  await open(page, 'txed');
  const items = page.locator('.standout__item');
  await expect(items).toHaveCount(prof.distinctive.sentences.length);
  for (let i = 0; i < prof.distinctive.sentences.length; i++) {
    await expect(items.nth(i).locator('.standout__text')).toHaveText(prof.distinctive.sentences[i]!.text);
    await expect(items.nth(i).locator('.source-chip')).toHaveCount(1);
  }
  await items.first().getByRole('link', { name: 'See the measure' }).click();
  await expect(page.locator('.stat.is-flash')).toHaveCount(1);
});

test('bench timeline: since 1980 by default, current bench filter, table equivalent, tooltip on focus', async ({ page, isMobile }, testInfo) => {
  const jf = readJson('judges/vaed.json') as { judges: Array<{ name: string; service_end_date?: string; service_start_date?: string; commission_date?: string }> };
  await open(page, 'vaed');
  await page.locator('#sec-bench').scrollIntoViewIfNeeded();
  const rows = page.locator('.bench__row');
  const start = (j: { service_start_date?: string; commission_date?: string }) => j.service_start_date ?? j.commission_date ?? '';
  const recent = jf.judges.filter((j) => !j.service_end_date || j.service_end_date >= '1980').sort((a, b) => start(a).localeCompare(start(b)) || a.name.localeCompare(b.name));
  await expect(rows).toHaveCount(recent.length);
  // Party letters and initials, never images.
  await expect(page.locator('#sec-bench img')).toHaveCount(0);
  await expect(page.locator('.bench-legend')).toContainText('Senior status');

  await page.getByRole('button', { name: 'Current bench' }).click();
  await expect(rows).toHaveCount(jf.judges.filter((j) => !j.service_end_date).length);
  await page.getByRole('button', { name: 'All years' }).click();
  await expect(rows).toHaveCount(jf.judges.filter((j) => j.service_start_date || j.commission_date).length);
  await page.getByRole('button', { name: 'Since 1980' }).click();

  // One tab stop (the newest judge); arrow keys move through the list.
  await expect(page.locator('.bench__who[tabindex="0"]')).toHaveCount(1);
  const last = rows.last().locator('.bench__who');
  await last.focus();
  await expect(page.locator('.bench-tip')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.bench-tip')).toContainText(recent[recent.length - 1]!.name);
  await page.keyboard.press('ArrowUp');
  await expect(rows.nth(recent.length - 2).locator('.bench__who')).toBeFocused();
  await expect(page.locator('.bench-tip')).toContainText(/Appointed by|Reassigned/);
  await settle(page);
  // Review capture of the section only: unstick the header and section nav so they do not overlay it.
  await page.addStyleTag({ content: '.site-header, .dnav { position: static !important; }' });
  await last.focus();
  await page.locator('#sec-bench').screenshot({ path: path.join('tests', 'e2e', '__screenshots__', testInfo.project.name, 'district-bench-tooltip.jpg'), type: 'jpeg', quality: 80 });

  await page.locator('#sec-bench').getByRole('button', { name: 'View as table' }).click();
  const table = page.locator('#sec-bench table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(recent.length);
  await table.getByRole('button', { name: 'Judge' }).click();
  await expect(table.locator('th[aria-sort="ascending"]')).toHaveCount(1);
  void isMobile;
});

test('territory: no Article III bench, designed empty states, no cases yet', async ({ page }, testInfo) => {
  await open(page, 'gud');
  await renderAll(page);
  await expect(page.locator('#sec-bench .empty-state')).toContainText('Article IV');
  const cases = readJson('cases/gud.json') as { items: unknown[] };
  if (!cases.items.length) await expect(page.locator('#sec-cases .empty-state')).toContainText('No recent cases yet');
  await settle(page);
  await shot(page, testInfo, 'district-gud-full');
});

test('case mix bars and sentencing composition (chart and table)', async ({ page }) => {
  const prof = readJson('profiles/vaed.json') as { case_mix: { civil_nature_of_suit: { groups: Array<{ label: string; share: number }> } } };
  await open(page, 'vaed');
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  const top = prof.case_mix.civil_nature_of_suit.groups[0]!;
  const firstRow = page.locator('#mix-civil .mix__row').first();
  await expect(firstRow.locator('.mix__label')).toHaveText(top.label);
  await expect(firstRow.locator('.mix__val')).toContainText(`${top.share.toFixed(1)}%`);
  await expect(page.locator('.comp__chart')).toHaveCount(2);
  await expect(page.locator('.comp__break-label')).toContainText('FY 2018');
  // Keyboard: focus a chart and step through years.
  const chart = page.locator('.comp__chart').last();
  await chart.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.comp-tooltip')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.comp-tooltip')).toContainText('FY 2025');
  await page.locator('.comp').getByRole('button', { name: 'View as table' }).click();
  await expect(page.locator('.comp table')).toBeVisible();
});

test('recent cases list links to CourtListener; prev/next and compare links work', async ({ page }) => {
  const cases = readJson('cases/vaed.json') as { items: Array<{ case_name: string; url: string }> };
  await open(page, 'vaed');
  await page.locator('#sec-cases').scrollIntoViewIfNeeded();
  await expect(page.locator('.case')).toHaveCount(Math.min(5, cases.items.length));
  await expect(page.locator('.case__name a').first()).toHaveAttribute('href', cases.items[0]!.url);
  await expect(page.getByRole('link', { name: 'Compare with…' })).toHaveAttribute('href', '#/compare?d=vaed');
  const next = String(DISTRICTS.vaed!.next);
  await page.locator('.dpager__link--next').click();
  await expect(page).toHaveURL(new RegExp(`#/district/${next}$`));
  await expect(page.locator('h1')).toHaveText(String(DISTRICTS[next]!.name));
});

test('section navigation scrolls to a section and keeps the URL shareable', async ({ page }) => {
  await open(page, 'cand');
  await page.locator('.dnav').getByRole('link', { name: 'The bench' }).click();
  await expect(page).toHaveURL(/#\/district\/cand\?s=bench$/);
  await expect(page.locator('#sec-bench .bench__row').first()).toBeVisible();
  // Deep link straight to a section.
  await page.goto('./#/district/akd?s=geography');
  await expect(page.locator('#sec-geography .geo')).toBeVisible({ timeout: 15_000 });
});

test('dark mode profile', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await open(page, 'txed');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await renderAll(page);
  await settle(page);
  await shot(page, testInfo, 'district-txed-dark');
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'district-txed-dark-mix', false);
});

type Grp = { id: string; label: string; share: number; count: number; derived?: boolean };
type Blk = { year: number; total: number; groups: Grp[]; national_note?: { text: string }; other_years?: Array<{ year: number; total: number; groups: Grp[]; national_note?: { text: string } }> };
type Var = { id: string; lane?: string; preliminary_years?: number[] };

test('IDB FY 2026 values carry "(preliminary)" on the profile; FCMS and USSC years do not', async ({ page }) => {
  const vars = readJson('variables.json') as Var[];
  const prof = readJson('profiles/vaed.json') as { key_stats: Array<{ variable: string; year: number; featured: boolean }>; case_mix: Record<string, Blk> };
  await open(page, 'vaed');
  for (const b of await page.locator('.stat-group__more').all()) await b.click();
  let prelim = 0;
  for (const row of prof.key_stats) {
    const v = vars.find((x) => x.id === row.variable)!;
    const period = page.locator(`#stat-${row.variable} .stat__period`);
    if (v.preliminary_years?.includes(row.year)) {
      await expect(period).toHaveText(`FY ${row.year} (preliminary)`);
      prelim++;
    } else {
      await expect(period).not.toContainText('preliminary');
    }
  }
  expect(prelim).toBeGreaterThanOrEqual(10);
  // The case-mix blocks label the same year.
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  for (const id of ['civil', 'criminal', 'civil-ends', 'criminal-ends']) {
    await expect(page.locator(`#mix-${id} .mix__sub`)).toContainText('FY 2026 (preliminary)');
  }
  await expect(page.locator('#mix-sentenced .mix__sub')).not.toContainText('preliminary');
});

test('how cases end: IDB disposition groups with a year switch, and offenses of people sentenced', async ({ page }, testInfo) => {
  const prof = readJson('profiles/vaed.json') as { case_mix: Record<string, Blk> };
  const civ = prof.case_mix.civil_disposition!;
  const cri = prof.case_mix.criminal_disposition!;
  const off = prof.case_mix.sentenced_offense!;
  await open(page, 'vaed');
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  await page.locator('#mix-ends').scrollIntoViewIfNeeded();
  await expect(page.locator('#mix-ends h3')).toHaveText('How cases end');
  // Civil: one row per group, in the published order, with share and count.
  const rows = page.locator('#mix-civil-ends .mix__row');
  await expect(rows).toHaveCount(civ.groups.length);
  for (const [i, g] of civ.groups.entries()) {
    await expect(rows.nth(i).locator('.mix__label')).toHaveText(g.label);
    await expect(rows.nth(i).locator('.mix__val')).toContainText(`${g.share.toFixed(1)}%`);
    await expect(rows.nth(i).locator('.mix__count')).toContainText(g.count.toLocaleString('en-US'));
  }
  await expect(page.locator('#mix-civil-ends .mix__sub')).toContainText(`${civ.total.toLocaleString('en-US')} civil cases closed`);
  // Switch to the latest year with a published cross-check.
  const prev = civ.other_years![0]!;
  await page.locator('#mix-civil-ends').getByRole('button', { name: `FY ${prev.year}`, exact: true }).click();
  await expect(page.locator('#mix-civil-ends .mix__sub')).toHaveText(`FY ${prev.year} · ${prev.total.toLocaleString('en-US')} civil cases closed`);
  await expect(rows.first().locator('.mix__val')).toContainText(`${prev.groups[0]!.share.toFixed(1)}%`);
  await expect(page.locator('#mix-civil-ends')).not.toContainText('have not yet been checked');
  // An all-district note appears in a year when one MDL docket is above a quarter of all civil cases closed.
  await expect(page.locator('#mix-civil-ends .mix__natnote')).toHaveCount(prev.national_note ? 1 : 0);
  if (prev.national_note) await expect(page.locator('#mix-civil-ends .mix__natnote')).toHaveText(prev.national_note.text);
  await page.locator('#mix-civil-ends summary', { hasText: 'What the groups mean' }).click();
  await expect(page.locator('#mix-civil-ends .mix__defs p')).toContainText('Settled means');
  // Criminal: guilty pleas first, the AO's D-4 groups.
  const plea = cri.groups.find((g) => g.id === 'plea')!;
  await expect(page.locator('#mix-criminal-ends .mix__row').first().locator('.mix__label')).toHaveText(plea.label);
  await expect(page.locator('#mix-criminal-ends .mix__row').first().locator('.mix__val')).toContainText(`${plea.share.toFixed(1)}%`);
  await expect(page.locator('#mix-criminal-ends .source-chip').first()).toContainText('Derived');
  await settle(page);
  await shot(page, testInfo, 'district-vaed-ends', false);
  // Offenses of people sentenced: USSC shares as published; only "all other" is derived.
  await page.locator('#mix-sentenced').scrollIntoViewIfNeeded();
  const srows = page.locator('#mix-sentenced .mix__row');
  await expect(srows).toHaveCount(off.groups.length);
  for (const [i, g] of off.groups.entries()) {
    await expect(srows.nth(i).locator('.mix__label')).toHaveText(g.label);
    await expect(srows.nth(i).locator('.mix__val')).toContainText(`${g.share.toFixed(1)}%`);
    await expect(srows.nth(i).locator('.source-chip__formula')).toHaveCount(g.derived ? 1 : 0);
  }
  await expect(page.locator('#mix-sentenced .mix__sub')).toContainText(`FY ${off.year}`);
  await expect(page.locator('#mix-sentenced-sec .mix-aside__links a', { hasText: 'Child pornography' })).toHaveAttribute('href', '#/?v=sentenced_child_pornography_pct');
  await settle(page);
  await shot(page, testInfo, 'district-vaed-sentenced', false);
});

test('bench notes that duty stations are not in the FJC export', async ({ page }) => {
  await open(page, 'vaed');
  await page.locator('#sec-bench').scrollIntoViewIfNeeded();
  await expect(page.locator('#sec-bench .bench__note--duty')).toHaveText('Duty stations are not in the FJC directory export, so judges are listed by district.');
});

type MdlDocketJson = { docket: string; label?: string; name?: string; court_short?: string; current?: boolean; years_text?: string; sentences: Array<{ text: string; year: number }>; history: Array<{ text: string }> };
type MdlJson = { intro: string; rule: string; years: number[]; dockets: MdlDocketJson[] };

/** The compact note's sentence about the dockets that get no sentences of their own, built from the profile file:
 * one docket reads "MDL 2433 also made up more than a quarter of this court’s civil cases filed or closed in FY 2015
 * and FY 2019."; several list their years in parentheses and end "each also made up ... in the years given." */
function earlierText(rest: MdlDocketJson[]): string {
  const share = 'more than a quarter of this court’s civil cases filed or closed';
  if (rest.length === 1) return `${rest[0]!.label} also made up ${share} in ${rest[0]!.years_text}.`;
  const parts = rest.map((d) => `${d.label} (${d.years_text})`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} each also made up ${share} in the years given.`;
}

test('multidistrict litigation note on N.D. Fla., near the statistics it bears on', async ({ page }, testInfo) => {
  const prof = readJson('profiles/flnd.json') as { mdl_context?: MdlJson };
  const mdl = prof.mdl_context!;
  expect(mdl.dockets.map((d) => d.docket)).toContain('2885');
  await open(page, 'flnd');
  // In brief: next to the sentences. Dockets above a quarter in the headline years get their sentences; older ones
  // share one line.
  const brief = page.locator('#sec-standout .mdl-note--compact');
  await expect(brief).toBeVisible();
  for (const d of mdl.dockets.filter((x) => x.current)) for (const s of d.sentences) await expect(brief).toContainText(s.text);
  const older = mdl.dockets.filter((x) => !x.current);
  if (older.length) await expect(brief.locator('.mdl-note__earlier')).toHaveText(earlierText(older));
  for (const d of older) for (const s of d.sentences) await expect(brief).not.toContainText(s.text);
  // The kicker's "multidistrict litigation" opens the glossary definition (28 U.S.C. § 1407(a)).
  await brief.locator('.mdl-note__kicker .term').click();
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.gloss-pop__cite')).toHaveText('28 U.S.C. § 1407(a)');
  await page.keyboard.press('Escape');
  // Key statistics: the full note with names, history and the rule, above the measures.
  const full = page.locator('#mdl-note');
  // The intro marks "multidistrict litigation (MDL)" as a glossary term (its definition sits in hidden text).
  await expect(full.locator('.mdl-note__intro .term')).toHaveText('multidistrict litigation (MDL)');
  for (const part of mdl.intro.split('multidistrict litigation (MDL)')) await expect(full.locator('.mdl-note__intro')).toContainText(part);
  await expect(full.locator('.mdl-note__rule')).toHaveText(mdl.rule);
  for (const d of mdl.dockets) {
    await expect(full).toContainText(d.label!);
    if (d.name) await expect(full).toContainText(d.name);
    for (const s of d.sentences) await expect(full).toContainText(s.text);
    for (const h of d.history) await expect(full).toContainText(h.text);
  }
  await expect(full.locator('.source-chip')).toContainText('Derived');
  await brief.getByRole('link', { name: /Every year and docket/ }).click();
  await expect(full).toBeFocused();
  await expect(full).toBeInViewport();
  await settle(page);
  await shot(page, testInfo, 'district-flnd-mdl', false);
  // Case mix: the note for the IDB years shown there (FY 2025 and 2026 sentences only, no older docket).
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  await expect(page.locator('#sec-mix .mdl-note')).toContainText('MDL 2885');
  for (const d of mdl.dockets.filter((x) => !x.current)) await expect(page.locator('#sec-mix .mdl-note')).not.toContainText(d.label!);
  // A district without a dominant docket in any year from FY 2010 has no note.
  await open(page, 'vaed');
  await renderAll(page);
  await expect(page.locator('.mdl-note')).toHaveCount(0);
});

test('MDL notes for earlier years: S.D. Ohio, S.D. W. Va., E.D. La.', async ({ page }, testInfo) => {
  for (const id of ['ohsd', 'wvsd', 'laed']) {
    const mdl = (readJson(`profiles/${id}.json`) as { mdl_context?: MdlJson }).mdl_context!;
    expect(mdl.dockets.length, id).toBeGreaterThan(0);
    await open(page, id);
    const brief = page.locator('#sec-standout .mdl-note--compact');
    await expect(brief).toBeVisible();
    const current = mdl.dockets.filter((d) => d.current);
    const lead = current.length ? current : mdl.dockets.slice(0, 1);
    for (const d of lead) for (const s of d.sentences) await expect(brief).toContainText(s.text);
    const rest = mdl.dockets.filter((d) => !lead.includes(d));
    // One plain sentence for the other dockets, with the years each was above a quarter (S.D. Ohio: one docket and
    // no current one; S.D. W. Va.: two and no current one; E.D. La.: three beside a current one).
    await expect(brief.locator('.mdl-note__earlier')).toHaveCount(rest.length ? 1 : 0);
    if (rest.length) await expect(brief.locator('.mdl-note__earlier')).toHaveText(earlierText(rest));
    await expect(brief).not.toContainText('Also above a quarter');
    const full = page.locator('#mdl-note');
    for (const d of mdl.dockets) {
      await expect(full.locator('.mdl-note__docket', { hasText: d.label! }).first()).toBeVisible();
      if (d.name) await expect(full).toContainText(d.name);
      for (const s of d.sentences) await expect(full).toContainText(s.text);
      for (const h of d.history) await expect(full).toContainText(h.text);
    }
    // Unnamed dockets (no GovInfo record found) are shown by number only.
    for (const d of mdl.dockets.filter((x) => !x.name)) {
      await expect(full.locator('.mdl-note__docket', { hasText: d.label! }).first().locator('i')).toHaveCount(0);
    }
    await expect(full.locator('.mdl-note__rule')).toContainText('from FY 2010');
    // The case-mix note shows only the headline years, so a district whose dockets all ended earlier has none there.
    await page.locator('#sec-mix').scrollIntoViewIfNeeded();
    await expect(page.locator('#mix-ends')).toBeVisible();
    await expect(page.locator('#sec-mix .mdl-note')).toHaveCount(current.length ? 1 : 0);
    await page.locator('#sec-standout').scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, testInfo, `district-${id}-mdl-brief`, false);
    await full.scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, testInfo, `district-${id}-mdl`, false);
  }
});

test('dark mode: MDL note and how cases end', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await open(page, 'flnd');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#mdl-note').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'district-flnd-dark-mdl', false);
  await page.locator('#sec-mix').scrollIntoViewIfNeeded();
  await page.locator('#mix-ends').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'district-flnd-dark-ends', false);
  // Earlier-year notes in dark mode (S.D. Ohio: no current docket; E.D. La.: one current, three earlier).
  for (const id of ['ohsd', 'laed']) {
    await open(page, id);
    await page.locator('#sec-standout').scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, testInfo, `district-${id}-dark-mdl-brief`, false);
    await page.locator('#mdl-note').scrollIntoViewIfNeeded();
    await settle(page);
    await shot(page, testInfo, `district-${id}-dark-mdl`, false);
  }
});

test('axe: the MDL note, year switches and new case-mix blocks have no serious or critical violations (flnd)', async ({ page }) => {
  test.setTimeout(90_000);
  const problems: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, 'flnd');
    await renderAll(page);
    await page.locator('#mix-civil-ends').getByRole('button', { name: 'FY 2025', exact: true }).click();
    await page.locator('#mix-civil-ends summary', { hasText: 'What the groups mean' }).click();
    await page.addScriptTag({ path: path.join('node_modules', 'axe-core', 'axe.min.js') });
    const v = await page.evaluate(async () => {
      const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
      // @ts-expect-error injected by addScriptTag
      const all = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'target-size': { enabled: false } }, resultTypes: ['violations'] });
      // Same exclusion as a11y.spec.ts: glossary terms inside sentences are exempt from WCAG 2.5.8.
      // @ts-expect-error injected by addScriptTag
      const ts = await window.axe.run({ include: [document], exclude: [['.term']] }, { runOnly: { type: 'rule', values: ['target-size'] }, resultTypes: ['violations'] });
      return [...all.violations, ...ts.violations] as Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }>;
    });
    for (const x of v.filter((y) => y.impact === 'serious' || y.impact === 'critical')) {
      problems.push(`${theme}: ${x.id} (${x.impact}) ${x.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('all 94 profiles render every section without console errors', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one sweep is enough; desktop only');
  test.setTimeout(420_000);
  const errors = watchErrors(page);
  const ids = Object.keys(DISTRICTS);
  expect(ids.length).toBe(94);
  const problems: string[] = [];
  for (const id of ids) {
    await page.goto(`./#/district/${id}`);
    await expect(page.locator('h1')).toHaveText(String(DISTRICTS[id]!.name));
    await expect(page.locator('#sec-stats .stat-list').first()).toBeVisible({ timeout: 15_000 });
    await renderAll(page);
    const empty = await page.locator('#sec-standout .standout__item, #sec-standout .standout__none').count();
    if (!empty) problems.push(`${id}: no standout content`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`${id}: horizontal overflow ${overflow}px`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});
