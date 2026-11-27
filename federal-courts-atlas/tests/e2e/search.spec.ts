import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// "Find your federal court" (#/search and the home search box). Expected districts and
// land shares are read from the courthouses lane's search files; nothing is hard-coded
// except the queries themselves.

const PUB = 'public/data';
const read = (p: string) => JSON.parse(fs.readFileSync(`${PUB}/${p}`, 'utf8'));
const has = fs.existsSync(`${PUB}/search/places.json`) && fs.existsSync(`${PUB}/search/zcta.json`);
test.skip(!has, 'search index not built');

type Table = { fields: string[]; rows: unknown[][] };
const places: Table = has ? read('search/places.json') : { fields: [], rows: [] };
const counties: Table = has ? read('search/counties.json') : { fields: [], rows: [] };
const zcta: Record<string, string | Array<[string, number]>> = has ? read('search/zcta.json').zcta : {};
const districts: Record<string, { name: string; short: string }> = read('districts.json');

function place(name: string, state: string): unknown[] {
  const iN = places.fields.indexOf('name');
  const iS = places.fields.indexOf('state');
  const r = places.rows.find((x) => x[iN] === name && x[iS] === state);
  if (!r) throw new Error(`no place ${name}, ${state}`);
  return r;
}

async function openSearch(page: Page, q = '') {
  await page.goto(`./#/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  await expect(page.locator('h1')).toHaveText('Find your federal court');
  await page.waitForSelector('.psearch[data-index="ok"]', { timeout: 15_000 });
}

const box = (page: Page) => page.getByRole('combobox', { name: /Search for a place/ });

test('search: Alexandria lists E.D. Va., and Enter opens the district', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await openSearch(page);
  await box(page).fill('Alexandria');
  const opts = page.getByRole('listbox').getByRole('option');
  const iD = places.fields.indexOf('district_id');
  const want = place('Alexandria', 'VA')[iD] as string;
  expect(want).toBe('vaed');
  const va = opts.filter({ hasText: districts[want]!.short }).filter({ hasText: 'Alexandria' });
  await expect(va.first()).toBeVisible();
  // The preview panel shows the first match with a locator map and a link to its profile.
  await expect(page.locator('.find-card').first()).toBeVisible();
  await expect(page.locator('.find-card__map svg').first()).toBeVisible();
  await settle(page);
  await shot(page, testInfo, 'search-alexandria');
  // Narrow by state and open with the keyboard.
  await box(page).fill('Alexandria, VA');
  await expect(opts.first()).toContainText(districts.vaed!.short);
  await box(page).press('ArrowDown');
  await expect(page.locator('.find__detail-title')).toContainText('Alexandria, Virginia');
  await box(page).press('Enter');
  await expect(page).toHaveURL(/#\/district\/vaed$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('search: ZIP 22314 finds E.D. Va.; a split ZIP lists both districts with land shares', async ({ page }, testInfo) => {
  await openSearch(page, '22314');
  expect(zcta['22314']).toBe('vaed');
  const opts = page.getByRole('listbox').getByRole('option');
  await expect(opts.first()).toContainText(districts.vaed!.short);
  await expect(page.locator('.find-card__name').first()).toHaveText(districts.vaed!.name);
  // Find a ZIP that spans two districts and check order and shares.
  const split = Object.entries(zcta).find(([, v]) => Array.isArray(v) && v.length === 2 && v.every(([, sh]) => sh > 0.01 && sh < 0.99)) as [string, Array<[string, number]>];
  const [zip, parts] = split;
  await box(page).fill(zip);
  await expect(opts).toHaveCount(2);
  await expect(opts.nth(0)).toContainText(districts[parts[0]![0]]!.short);
  await expect(opts.nth(0)).toContainText(`${Math.round(parts[0]![1] * 100)}%`);
  await expect(opts.nth(1)).toContainText(districts[parts[1]![0]]!.short);
  await expect(opts.nth(1)).toContainText(`${Math.round(parts[1]![1] * 100)}%`);
  await expect(page.locator('.find-card')).toHaveCount(2);
  await settle(page);
  await shot(page, testInfo, 'search-split-zip');
});

test('search: a place that reaches into two districts lists the primary first', async ({ page }) => {
  const iD = places.fields.indexOf('district_id');
  const iO = places.fields.indexOf('other_district_ids');
  const dallas = place('Dallas', 'TX');
  const primary = dallas[iD] as string;
  const other = String(dallas[iO]).split(/[;,\s]+/).filter(Boolean)[0]!;
  expect(other).toBeTruthy();
  await openSearch(page, 'Dallas, TX');
  const opts = page.getByRole('listbox').getByRole('option');
  await expect(opts.nth(0)).toContainText(districts[primary]!.short);
  await expect(opts.nth(1)).toContainText(districts[other]!.short);
  await expect(opts.nth(1)).toHaveAttribute('aria-label', /also reaches into/);
});

test('search: a county split by statute shows both districts', async ({ page }) => {
  const iN = counties.fields.indexOf('name');
  const iSt = counties.fields.indexOf('state');
  const iSp = counties.fields.indexOf('split_districts');
  const row = counties.rows.find((r) => String(r[iSp] ?? '').includes(';'))!;
  const ids = String(row[iSp]).split(';');
  await openSearch(page, `${row[iN]}, ${row[iSt]}`);
  const opts = page.getByRole('listbox').getByRole('option');
  const all = (await opts.allTextContents()).join(' | ');
  for (const id of ids) expect(all).toContain(districts[id]!.short);
  await expect(page.locator('.find__note')).toContainText('splits this county');
});

test('search: combobox keyboard pattern', async ({ page }) => {
  await openSearch(page);
  const b = box(page);
  await expect(b).toHaveAttribute('aria-expanded', 'false');
  await b.fill('Cook County');
  await expect(b).toHaveAttribute('aria-expanded', 'true');
  const controls = await b.getAttribute('aria-controls');
  await expect(page.locator(`#${controls}`)).toHaveAttribute('role', 'listbox');
  await b.press('ArrowDown');
  const first = await b.getAttribute('aria-activedescendant');
  await b.press('ArrowDown');
  const second = await b.getAttribute('aria-activedescendant');
  expect(second).not.toBe(first);
  await expect(page.locator(`#${first}`)).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator(`#${second}`)).toHaveAttribute('aria-selected', 'true');
  await b.press('ArrowUp');
  await expect(b).toHaveAttribute('aria-activedescendant', first!);
  await b.press('Escape');
  await expect(b).toHaveValue('');
  await expect(page).not.toHaveURL(/q=/);
});

test('search: URL query, examples and an unknown ZIP', async ({ page }, testInfo) => {
  await openSearch(page);
  await expect(page.locator('.find__examples')).toBeVisible();
  await settle(page);
  await shot(page, testInfo, 'search-empty');
  await page.getByRole('button', { name: 'Brooklyn' }).click();
  await expect(page).toHaveURL(/q=Brooklyn/);
  await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
  // A five-digit code with no ZIP code area says so plainly.
  const unused = ['00000', '99999', '00001'].find((z) => !(z in zcta))!;
  await box(page).fill(unused);
  await expect(page.locator('.psearch__empty')).toContainText('No ZIP code area');
});

test('search: phone layout and dark mode', async ({ page, isMobile }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await openSearch(page, '28376');
  await expect(page.locator('.find-card')).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (isMobile) {
    const opt = await page.getByRole('option').first().boundingBox();
    expect(opt!.height).toBeGreaterThanOrEqual(44);
  }
  await settle(page);
  await shot(page, testInfo, 'search-dark');
});
