import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// The home map and table views with the web lane's real published files (public/data/).
// Expectations are read from those same files here; nothing is hard-coded.

const PUB = 'public/data';
const read = (p: string) => JSON.parse(fs.readFileSync(`${PUB}/${p}`, 'utf8'));
const has = fs.existsSync(`${PUB}/variables.json`);
test.skip(!has, 'web data not built (make web)');

type Var = { id: string; family: string; label: string; short_label?: string; derived: boolean; formula: string | null };
type Vals = { years: number[]; values: Record<string, Record<string, number>>; ranks: Record<string, Record<string, number>>; ranked_of: Record<string, number> };

const ORDER = ['speed', 'workload', 'sentencing', 'casemix'];
const variables: Var[] = has ? read('variables.json') : [];
const byFamily = [...variables].sort((a, b) => ORDER.indexOf(a.family) - ORDER.indexOf(b.family));

function latestCount(v: Vals): number {
  const y = String(v.years[v.years.length - 1]);
  return Object.values(v.values).filter((row) => y in row).length;
}

test('home map colors with real data and shows ranks', async ({ page, isMobile }, testInfo) => {
  const errors = watchErrors(page);
  const def = byFamily[0]!;
  const vals: Vals = read(`values/${def.id}.json`);
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  await expect(page.locator('#variable-select')).toHaveValue(def.id);
  const classed = await page.locator('path.district.q0, path.district.q1, path.district.q2, path.district.q3, path.district.q4').count();
  expect(classed).toBe(latestCount(vals));
  // Several quantile classes are in use (real spread, not a single color).
  const used = await page.evaluate(() => new Set([...document.querySelectorAll('path.district')].map((p) => (p.getAttribute('class') ?? '').match(/q\d/)?.[0]).filter(Boolean)).size);
  expect(used).toBeGreaterThanOrEqual(4);
  const y = String(vals.years[vals.years.length - 1]);
  const rank = vals.ranks['cod']![y]!;
  await expect(page.locator('path.district[data-id="cod"]')).toHaveAttribute('aria-label', new RegExp(`${rank}(st|nd|rd|th) of ${vals.ranked_of[y]}( \\(tied\\))?, FY ${y}$`));
  const co = page.locator('path.district[data-id="cod"]');
  if (isMobile) await co.tap();
  else await co.hover();
  await expect(page.locator('.map-tip')).toContainText('District of Colorado');
  await expect(page.locator('.map-tip')).toContainText(`of ${vals.ranked_of[y]}`);
  await shot(page, testInfo, 'web-home-tooltip', false);
  await page.mouse.click(5, 5);
  await settle(page);
  await shot(page, testInfo, 'web-home-real-data');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('derived per-capita rate: formula shown, territories have no data', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const v = variables.find((x) => x.id === 'civil_filings_per_100k')!;
  expect(v.derived).toBe(true);
  await page.goto(`./#/?v=${v.id}`);
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  await expect(page.locator('.home-about__formula')).toContainText('100,000');
  for (const t of ['gud', 'vid', 'nmid']) await expect(page.locator(`path.district[data-id="${t}"]`)).toHaveClass(/nodata/);
  await settle(page);
  await shot(page, testInfo, 'web-home-per-capita');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('time machine reaches the first year of a long sentencing series', async ({ page }, testInfo) => {
  const v = variables.find((x) => x.id === 'within_range_pct')!;
  const vals: Vals = read(`values/${v.id}.json`);
  await page.goto(`./#/?v=${v.id}`);
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  const slider = page.locator('.year-slider__input');
  await slider.focus();
  await page.keyboard.press('Home');
  const first = String(vals.years[0]);
  await expect(page.locator('.year-slider__value')).toContainText(first);
  const n = Object.values(vals.values).filter((row) => first in row).length;
  await expect(page.locator('path.district.q0, path.district.q1, path.district.q2, path.district.q3, path.district.q4')).toHaveCount(n);
  await page.locator('.home-time').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'web-home-sentencing-first-year', false);
});

test('table view of a real variable', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const v = byFamily[0]!;
  await page.goto(`./#/table/${v.id}`);
  await expect(page.locator('h1').first()).toContainText(v.label);
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await settle(page);
  await shot(page, testInfo, 'web-table');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('table view shows cell notes, derived tags and the year formula (data audit 2026-11-27)', async ({ page }) => {
  const errors = watchErrors(page);
  type VF = Vals & { cell_notes?: Record<string, Record<string, string>>; derived_years?: number[] };
  const f: VF = read('values/within_range_pct.json');
  // A derived year with a small-base cell note, both read from the published file.
  const y = (f.derived_years ?? []).find((yy) => Object.values(f.cell_notes ?? {}).some((row) => String(yy) in row));
  test.skip(y === undefined, 'no derived year with a cell note');
  const id = Object.keys(f.cell_notes!).find((d) => String(y) in f.cell_notes![d]!)!;
  const name = read('districts.json')[id].name as string;
  await page.goto(`./#/table/within_range_pct?y=${y}`);
  const row = page.locator('table tbody tr', { hasText: name });
  await expect(row).toContainText(f.cell_notes![id]![String(y)]!);
  await expect(row.locator('.source-chip--derived')).toHaveText('Derived');
  await expect(page.locator('.data-table__foot')).toContainText('Derived values:');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('home with real data in dark mode', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await page.goto('./#/?v=weighted_filings_per_judgeship');
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  await settle(page);
  await shot(page, testInfo, 'web-home-dark');
});
