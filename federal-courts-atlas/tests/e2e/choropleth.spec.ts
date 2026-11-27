import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// Exercises the choropleth path (quantile classes, legend, tooltip with rank, table,
// year slider, No-data hatch) before the web lane publishes real statistics.
// Nothing is invented: the test-only variable is the number of counties in each
// district, counted here from the boundaries lane's real topology, and it exists only
// inside this test via request interception (never in src/ or public/).
// Only the latest period has values; earlier periods are deliberately empty, which
// exercises the "No data" state.

const HI = 'public/data/geo/districts-hi.topo.json';
const ID = '__test_county_count';
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

function fixture() {
  const topo = JSON.parse(fs.readFileSync(HI, 'utf8'));
  const counts: Record<string, number> = {};
  for (const g of topo.objects.counties.geometries) {
    const d = g.properties?.district_id;
    if (d) counts[d] = (counts[d] ?? 0) + 1;
  }
  const latest = YEARS[YEARS.length - 1]!;
  const values: Record<string, Record<string, number>> = {};
  for (const [d, n] of Object.entries(counts)) values[d] = { [latest]: n };
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const ranks: Record<string, Record<string, number>> = {};
  sorted.forEach(([d, n]) => (ranks[d] = { [latest]: 1 + sorted.filter(([, m]) => m > n).length }));
  const variable = {
    id: ID,
    family: 'casemix',
    label: 'TEST FIXTURE: Counties per district',
    short_label: 'Counties (test fixture)',
    unit: 'count',
    format: ',.0f',
    explainer: 'Test-only measure counted from the boundaries topology inside the Playwright test. Not a court statistic.',
    caveats: ['Exists only inside the end-to-end test; never shipped.'],
    source_ids: ['census_cb2025_county_500k'],
    derived: true,
    formula: 'count(counties assigned to the district)',
    higher_means: 'more counties',
    years: YEARS,
  };
  return { variable, file: { variable: ID, period_type: 'CY', years: YEARS, values, ranks } };
}

async function mock(page: Page) {
  const { variable, file } = fixture();
  await page.route('**/data/variables.json', (r) => r.fulfill({ json: [variable] }));
  await page.route(`**/data/values/${ID}.json`, (r) => r.fulfill({ json: file }));
  return file;
}

test.skip(!fs.existsSync(HI), 'boundaries topology not built');

test('choropleth: classes, legend, tooltip, table and year slider', async ({ page, isMobile }, testInfo) => {
  const errors = watchErrors(page);
  const file = await mock(page);
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  // Every district with a value gets one of the five classes; the rest show No data.
  const classed = await page.locator('path.district.q0, path.district.q1, path.district.q2, path.district.q3, path.district.q4').count();
  expect(classed).toBe(Object.keys(file.values).length);
  await expect(page.locator('.legend__end--lo')).toHaveText('Lowest');
  await expect(page.locator('.legend__end--hi')).toHaveText('Highest');
  await expect(page.locator('.legend__nd')).toContainText('No data');
  await expect(page.locator('path.district[data-id="txnd"]')).toHaveAttribute('aria-label', /Counties per district: \d+, \d+(st|nd|rd|th) of 94( \(tied\))?, 2025$/);
  await settle(page);
  await shot(page, testInfo, 'choropleth-fixture');

  // Tooltip with value and rank.
  const co = page.locator('path.district[data-id="cod"]');
  if (isMobile) await co.tap();
  else await co.hover();
  const tip = page.locator('.map-tip');
  await expect(tip).toContainText('District of Colorado');
  await expect(tip).toContainText(/\d+(st|nd|rd|th) of \d+/);
  await shot(page, testInfo, 'choropleth-tooltip', false);

  // Legend hover highlights one class.
  if (!isMobile) {
    await page.locator('.legend__swatch.q4').hover();
    await expect(page.locator('.atlas-map')).toHaveClass(/is-filtering/);
  }

  // Table view lists the same values.
  await page.getByRole('button', { name: 'View as table' }).click();
  await expect(page.locator('.choropleth__table tbody tr')).toHaveCount(94);
  await expect(page.locator('.choropleth__table thead')).toContainText('Rank');

  // Year slider: an earlier period has no values, so every district shows No data.
  const slider = page.locator('.year-slider__input');
  await expect(slider).toBeVisible();
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.year-slider__value')).toHaveText('2019');
  await expect(page.locator('path.district.nodata')).toHaveCount(94);
  await expect(page).toHaveURL(/y=2019/);
  await page.locator('.home-time').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'choropleth-nodata-year', false);
  expect(errors).toEqual([]);
});

test('choropleth in dark mode', async ({ page }, testInfo) => {
  await mock(page);
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
  await settle(page);
  await shot(page, testInfo, 'choropleth-fixture-dark');
});
