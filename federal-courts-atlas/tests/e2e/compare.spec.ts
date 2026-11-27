import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// Compare mode (#/compare?d=...&y=...). Every expectation about a number is computed here
// from the published files in public/data/, so nothing in this spec hard-codes a statistic.

const PUB = 'public/data';
const read = (p: string) => JSON.parse(fs.readFileSync(`${PUB}/${p}`, 'utf8'));
const has = fs.existsSync(`${PUB}/variables.json`);
test.skip(!has, 'web data not built (make web)');

type Var = {
  id: string;
  family: string;
  label: string;
  unit: string;
  format?: string;
  featured?: boolean;
  derived?: boolean;
  formula?: string | null;
  years: number[];
  default_rank_direction?: 'asc' | 'desc';
  period_type: string;
};
type Vals = {
  years: number[];
  values: Record<string, Record<string, number>>;
  ranks: Record<string, Record<string, number>>;
  ranked_of: Record<string, number>;
  national?: Record<string, number>;
  cell_notes?: Record<string, Record<string, string>>;
};

const variables: Var[] = has ? read('variables.json') : [];
const byId = new Map(variables.map((v) => [v.id, v]));
const featured = variables.filter((v) => v.featured);
const vals = (id: string): Vals => read(`values/${id}.json`);
const REG: Record<string, { name: string; short: string }> = has ? read('districts.json') : {};

const val = (f: Vals, id: string, y: number): number | null => {
  const x = f.values[id]?.[String(y)];
  return typeof x === 'number' ? x : null;
};

/** Latest year in which the most chosen districts (ideally all) have a value: the page's default per row. */
function latestCommon(v: Var, f: Vals, ids: string[]): number | null {
  let best: number | null = null;
  let have = 0;
  for (const y of [...v.years].sort((a, b) => a - b)) {
    const n = ids.filter((id) => val(f, id, y) !== null).length;
    if (n >= have && n > 0) {
      best = y;
      have = n;
    }
  }
  return best;
}

const decimals = (v: Var) => {
  const m = /\.(\d+)/.exec(v.format ?? '');
  return m ? parseInt(m[1]!, 10) : 1;
};
const num = (x: number, v: Var) => {
  let d = decimals(v);
  if (d === 0 && !Number.isInteger(x)) d = 1;
  return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const m = n % 100;
  return n + (s[(m - 20) % 10] || s[m] || s[0]!);
};
const rankPhrase = (r: number, of: number) => (r === 1 ? `Highest of ${of}` : r === of ? `Lowest of ${of}` : `${ordinal(r)} highest of ${of}`);

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`./${hash}`);
  await expect(page.locator('h1')).toHaveText(/Compare districts/);
}

/** Wait until every row on the page has its data (no skeleton rows left) and the summary is computed. */
async function ready(page: Page): Promise<void> {
  await expect(page.locator('.cmp-tr--loading')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.cmp-sum__loading')).toHaveCount(0, { timeout: 20_000 });
}

async function noOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
}

async function noEmDash(page: Page): Promise<void> {
  const text = await page.locator('main, body').first().innerText();
  expect(text.includes('\u2014'), 'em-dash in page text').toBe(false);
}

test('two districts: aligned rows with value, rank, leader and national figure from the values files', async ({ page, isMobile }, testInfo) => {
  const errors = watchErrors(page);
  const ids = ['vaed', 'mdd'];
  await open(page, `#/compare?d=${ids.join(',')}`);
  await expect(page.locator('.cmp-card')).toHaveCount(2);
  await ready(page);

  // One section per family, featured rows shown, one cell per district.
  await expect(page.locator('.cmp-family')).toHaveCount(4);
  await expect(page.locator('.cmp-tr:not(.cmp-tr--head)')).toHaveCount(featured.length);
  for (const v of featured) await expect(page.locator(`#cmp-row-${v.id} .cmp-td`)).toHaveCount(2);

  // Every featured row: the year, each value and rank, and the national figure come from the file.
  for (const v of featured) {
    const f = vals(v.id);
    const y = latestCommon(v, f, ids);
    const row = page.locator(`#cmp-row-${v.id}`);
    if (y === null) continue;
    await expect(row).toHaveAttribute('data-year', String(y));
    for (const id of ids) {
      const cell = row.locator(`.cmp-td[data-district="${id}"]`);
      const x = val(f, id, y);
      if (x === null) {
        await expect(cell).toContainText('No data');
        continue;
      }
      await expect(cell.locator('.cmp-td__num')).toContainText(num(x, v));
      const r = f.ranks[id]?.[String(y)];
      if (r) await expect(cell.locator('.cmp-td__rank')).toHaveText(rankPhrase(r, f.ranked_of[String(y)]!));
    }
    const nat = f.national?.[String(y)];
    if (typeof nat === 'number') await expect(row.locator('.cmp-measure__nat-val')).toContainText(num(nat, v));
    else await expect(row.locator('.cmp-measure__nat')).toContainText(/None published|No data/);

    // Leader: highest value, or lowest for measures read lowest first; marked with a symbol and a word.
    const xs = ids.map((id) => val(f, id, y));
    if (xs.every((x) => x !== null) && xs[0] !== xs[1]) {
      const asc = v.default_rank_direction === 'asc';
      const lead = ids[(asc ? xs[0]! < xs[1]! : xs[0]! > xs[1]!) ? 0 : 1]!;
      await expect(row.locator('.cmp-td--lead')).toHaveCount(1);
      await expect(row.locator(`.cmp-td[data-district="${lead}"] .cmp-lead`)).toHaveText(asc ? /▼\s*Lowest/ : /▲\s*Highest/);
    }

    // One shared y-domain per row: every chosen district's series plus the national series.
    const pool: number[] = [];
    for (const id of ids) for (const yy of v.years) {
      const x = val(f, id, yy);
      if (x !== null) pool.push(x);
    }
    for (const yy of v.years) if (typeof f.national?.[String(yy)] === 'number') pool.push(f.national[String(yy)]!);
    if (pool.length) await expect(row).toHaveAttribute('data-domain', `${Math.min(...pool)},${Math.max(...pool)}`);
  }

  // Layout: columns on desktop, stacked on a phone; never a horizontal page scroll.
  await expect(page.locator('.cmp')).toHaveClass(isMobile ? /cmp--stacked/ : /^(?!.*cmp--stacked).*$/);
  await noOverflow(page);
  await noEmDash(page);
  await settle(page);
  await shot(page, testInfo, 'compare-vaed-mdd');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('summary strip: widest gaps in national standing, computed from the values files and labeled derived', async ({ page }, testInfo) => {
  const ids = ['txed', 'txwd', 'ded'];
  await open(page, `#/compare?d=${ids.join(',')}`);
  await ready(page);
  const gaps: Array<{ label: string; gap: number }> = [];
  for (const v of featured) {
    const f = vals(v.id);
    const y = latestCommon(v, f, ids);
    if (y === null) continue;
    const of = f.ranked_of[String(y)];
    if (!of || of < 2) continue;
    const cells = ids
      .map((id) => [id, val(f, id, y), f.ranks[id]?.[String(y)] ?? null] as const)
      .filter((c) => c[1] !== null && c[2] !== null && !f.cell_notes?.[c[0]]?.[String(y)]);
    if (cells.length < 2) continue;
    const ranks = cells.map((c) => c[2]!);
    const hiV = cells.find((c) => c[2] === Math.min(...ranks))![1];
    const loV = cells.find((c) => c[2] === Math.max(...ranks))![1];
    if (hiV === loV) continue;
    gaps.push({ label: v.label, gap: (Math.max(...ranks) - Math.min(...ranks)) / (of - 1) });
  }
  gaps.sort((a, b) => b.gap - a.gap || a.label.localeCompare(b.label));
  const expected = gaps.filter((g) => g.gap > 0).slice(0, 3);
  const items = page.locator('.cmp-gap');
  await expect(items).toHaveCount(expected.length);
  for (let i = 0; i < expected.length; i++) await expect(items.nth(i).locator('.cmp-gap__measure')).toHaveText(expected[i]!.label);
  await expect(page.locator('.cmp-sum .source-chip__label')).toHaveText('Derived');
  // The formula is reachable from the keyboard.
  await page.locator('.cmp-sum .source-chip__formula').focus();
  await expect(page.locator('.cmp-sum .source-chip__pop')).toBeVisible();
  await expect(page.locator('.cmp-sum .source-chip__pop')).toContainText('Gap in standing');
  // "Go to the row" moves focus to that row.
  await items.first().locator('.cmp-gap__go').click();
  const target = featured.find((v) => v.label === expected[0]!.label)!;
  await expect(page.locator(`#cmp-row-${target.id}`)).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await shot(page, testInfo, 'compare-txed-txwd-ded');
});

test('search picker: by abbreviation, id and name; URL stays in sync; removing works', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await open(page, '#/compare?d=vaed');
  const input = page.getByRole('combobox', { name: 'Add a district' });
  // Short-form abbreviation.
  await input.fill('E.D. Tex.');
  await expect(page.getByRole('option').first()).toContainText(REG.txed!.name);
  if (testInfo.project.name === 'mobile') await shot(page, testInfo, 'compare-search-open', false);
  await input.press('Enter');
  await expect(page).toHaveURL(/d=vaed,txed/);
  await expect(page.locator('.cmp-card')).toHaveCount(2);
  // Registry id.
  await input.fill('nysd');
  await expect(page.getByRole('option').first()).toContainText(REG.nysd!.name);
  await input.press('ArrowDown');
  await input.press('Enter');
  // Plain words.
  await input.fill('northern california');
  await expect(page.getByRole('option').first()).toContainText(REG.cand!.name);
  await page.getByRole('option').first().click();
  await expect(page.locator('.cmp-card')).toHaveCount(4);
  await expect(page).toHaveURL(/#\/compare\?d=vaed,txed,nysd,cand$/);
  // Full: the input is disabled until one is removed.
  await expect(input).toBeDisabled();
  await page.getByRole('button', { name: `Remove ${REG.txed!.name} from the comparison` }).click();
  await expect(page.locator('.cmp-card')).toHaveCount(3);
  await expect(page).toHaveURL(/d=vaed,nysd,cand$/);
  await expect(input).toBeEnabled();
  // An already chosen district is marked and cannot be added twice.
  await input.fill('vaed');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-disabled', 'true');
  await input.press('Enter');
  await expect(page.locator('.cmp-card')).toHaveCount(3);
  await input.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('year selector: one year for every row, URL sync, and series that do not reach it say so', async ({ page }, testInfo) => {
  const ids = ['casd', 'azd', 'txwd', 'txsd'];
  // A year inside some series and outside at least one featured series.
  const years = [...new Set(variables.flatMap((v) => v.years))].sort((a, b) => b - a);
  const year = years.find((y) => featured.some((v) => !v.years.includes(y)) && featured.filter((v) => v.years.includes(y)).length >= 5)!;
  await open(page, `#/compare?d=${ids.join(',')}`);
  await ready(page);
  await page.locator('#cmp-year').focus();
  await page.locator('#cmp-year').selectOption(String(year));
  await expect(page).toHaveURL(new RegExp(`y=${year}`));
  // Only the rows redraw: the same select element keeps focus.
  await expect(page.locator('#cmp-year')).toBeFocused();
  await ready(page);
  for (const v of featured) {
    const row = page.locator(`#cmp-row-${v.id}`);
    if (v.years.includes(year)) {
      await expect(row).toHaveAttribute('data-year', String(year));
      const f = vals(v.id);
      for (const id of ids) {
        const x = val(f, id, year);
        const cell = row.locator(`.cmp-td[data-district="${id}"]`);
        if (x === null) await expect(cell).toContainText('No data');
        else await expect(cell.locator('.cmp-td__num')).toContainText(num(x, v));
      }
    } else {
      await expect(row.locator('.cmp-measure__period')).toContainText(`Not published for FY ${year}`);
      await expect(row.locator('.cmp-td .no-data')).toHaveCount(ids.length);
    }
  }
  // Reload keeps the year.
  await page.reload();
  await expect(page.locator('#cmp-year')).toHaveValue(String(year));
  await ready(page);
  await settle(page);
  await shot(page, testInfo, 'compare-four-border-year');
  // Back to the default.
  await page.locator('#cmp-year').selectOption('');
  await expect(page).not.toHaveURL(/y=/);
});

test('derived rows carry the formula; territories show No data for per-capita rates; cell notes are shown', async ({ page, isMobile }, testInfo) => {
  const errors = watchErrors(page);
  const ids = ['vaed', 'gud'];
  await open(page, `#/compare?d=${ids.join(',')}`);
  await ready(page);
  const derived = featured.find((v) => v.derived && v.formula && v.unit === 'per_100k')!;
  const row = page.locator(`#cmp-row-${derived.id}`);
  await expect(row.locator('.cmp-td[data-district="gud"]')).toContainText('No data');
  await expect(row.locator('.source-chip__label')).toHaveText('Derived');
  // Keyboard focus shows the formula; on a touch screen a tap toggles it.
  const fx = row.locator('.source-chip__formula');
  if (isMobile) {
    await fx.tap();
    await expect(fx).toHaveAttribute('aria-expanded', 'true');
  } else await fx.focus();
  await expect(row.locator('.source-chip__pop')).toBeVisible();
  await expect(row.locator('.source-chip__pop code')).toHaveText(derived.formula!);
  await row.scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'compare-derived-formula', false);
  if (isMobile) {
    await page.locator('h1').tap();
    await expect(row.locator('.source-chip__pop')).toBeHidden();
  }
  // A cell with a caveat note (e.g. a small base) shows it behind a "Note" toggle.
  let noted: { v: Var; y: number } | null = null;
  for (const v of featured) {
    const f = vals(v.id);
    const y = latestCommon(v, f, ids);
    if (y !== null && f.cell_notes?.gud?.[String(y)] && val(f, 'gud', y) !== null) {
      noted = { v, y };
      break;
    }
  }
  if (noted) {
    const note = page.locator(`#cmp-row-${noted.v.id} .cmp-td[data-district="gud"] .cmp-note`);
    await note.locator('summary').click();
    await expect(note.locator('p')).toHaveText(vals(noted.v.id).cell_notes!.gud![String(noted.y)]!);
  }
  await noOverflow(page);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('no district chosen: suggested pairs start a comparison', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await open(page, '#/compare');
  const first = page.locator('.cmp-suggest__btn').first();
  await expect(page.locator('.cmp-suggest__btn')).toHaveCount(4);
  await settle(page);
  await shot(page, testInfo, 'compare-empty');
  await first.click();
  await expect(page).toHaveURL(/#\/compare\?d=vaed,mdd$/);
  await expect(page.locator('.cmp-card')).toHaveCount(2);
  await noOverflow(page);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('one district: card, nearby quick-add buttons, and rows without leader marks', async ({ page }, testInfo) => {
  await open(page, '#/compare?d=vaed');
  await ready(page);
  await expect(page.locator('.cmp-card')).toHaveCount(1);
  await expect(page.locator('.cmp-td--lead')).toHaveCount(0);
  await expect(page.locator('.cmp-sum')).toContainText('Add a second district');
  const quick = page.locator('.cmp-quick__btn');
  expect(await quick.count()).toBeGreaterThan(0);
  await settle(page);
  await shot(page, testInfo, 'compare-one', false);
  await quick.first().click();
  await expect(page.locator('.cmp-card')).toHaveCount(2);
});

test('keyboard: search, choose with arrows and Enter, expand a family', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'keyboard path checked on desktop');
  await open(page, '#/compare?d=vaed,mdd');
  await ready(page);
  await page.getByRole('combobox', { name: 'Add a district' }).focus();
  await page.keyboard.type('Delaware');
  await shot(page, testInfo, 'compare-search-open', false);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('combobox', { name: 'Add a district' })).toHaveAttribute('aria-activedescendant', /ded$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.cmp-card')).toHaveCount(3);
  // Expand the workload family: the non-featured measures load and render.
  const more = page.locator('#cmp-workload .cmp-family__more');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const all = variables.filter((v) => v.family === 'workload');
  await expect(page.locator('#cmp-workload .cmp-tr:not(.cmp-tr--head):not(.cmp-tr--loading)')).toHaveCount(all.length, { timeout: 20_000 });
  await page.locator('#cmp-workload .cmp-tr--extra').first().scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'compare-workload-expanded', false);
});

test('dark mode', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await open(page, '#/compare?d=vaed,mdd,ded');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await ready(page);
  await settle(page);
  await shot(page, testInfo, 'compare-dark', false);
  await page.locator('#cmp-speed').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'compare-dark-rows', false);
  await noOverflow(page);
});

test('variables.json labels are used verbatim in the rows', async ({ page }) => {
  await open(page, '#/compare?d=ilnd,nysd');
  await ready(page);
  for (const v of featured) await expect(page.locator(`#cmp-row-${v.id} .cmp-measure__label`)).toHaveText(byId.get(v.id)!.label);
});
