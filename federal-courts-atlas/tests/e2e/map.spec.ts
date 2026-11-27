import { test, expect, type Page } from '@playwright/test';
import { settle, shot, watchErrors } from './helpers.ts';

async function zoomK(page: Page): Promise<number> {
  const t = (await page.locator('.atlas-map__zoom').getAttribute('transform')) ?? '';
  const m = /scale\(([\d.]+)\)/.exec(t);
  return m ? Number(m[1]) : 1;
}

async function openMap(page: Page) {
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-state="ready"]');
}

test('map renders the 94 districts with accessible names', async ({ page }) => {
  const errors = watchErrors(page);
  await openMap(page);
  await expect(page.locator('path.district')).toHaveCount(94);
  const va = page.locator('path.district[data-id="vaed"]');
  await expect(va).toHaveAttribute('role', 'link');
  await expect(va).toHaveAttribute('aria-label', /^Eastern District of Virginia/);
  // Territories render inside their insets.
  for (const id of ['akd', 'hid', 'prd', 'vid', 'gud', 'nmid']) {
    const box = await page.locator(`path.district[data-id="${id}"]`).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.width, id).toBeGreaterThan(0.5);
  }
  expect(errors).toEqual([]);
});

test('zoom buttons zoom in, swap to hi-res, zoom out and reset', async ({ page }, testInfo) => {
  await openMap(page);
  expect(await zoomK(page)).toBe(1);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoomK(page)).toBeGreaterThan(1.7);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoomK(page)).toBeGreaterThan(3);
  // Past the threshold the hi-res topology (with county lines) replaces the national one.
  await expect(page.locator('.atlas-map')).toHaveAttribute('data-resolution', 'hi', { timeout: 15_000 });
  await expect(page.locator('.mesh--county')).toHaveAttribute('d', /M/);
  await settle(page);
  await shot(page, testInfo, 'map-zoomed', false);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoomK(page)).toBeLessThan(2.5);
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await expect.poll(() => zoomK(page)).toBe(1);
  await expect(page.locator('.atlas-map')).toHaveAttribute('data-resolution', 'lo', { timeout: 5_000 });
});

test('keyboard: districts are focusable in order, keys zoom, Enter opens', async ({ page }, testInfo) => {
  await openMap(page);
  await page.locator('path.district[data-id="alnd"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-id', 'almd');
  const va = page.locator('path.district[data-id="vaed"]');
  await va.focus();
  const tip = page.locator('.map-tip');
  await expect(tip).toHaveAttribute('data-open', 'true');
  await expect(tip).toContainText('Eastern District of Virginia');
  await shot(page, testInfo, 'map-keyboard-focus', false);
  await page.keyboard.press('+');
  await expect.poll(() => zoomK(page)).toBeGreaterThan(1.4);
  await page.keyboard.press('0');
  await expect.poll(() => zoomK(page)).toBe(1);
  await va.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/district\/vaed$/);
  await expect(page.locator('h1')).toHaveText('Eastern District of Virginia');
});

test('hover shows a compact tooltip; click opens the district', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'pointer hover is desktop-only');
  await openMap(page);
  const co = page.locator('path.district[data-id="cod"]');
  await co.hover();
  await expect(page.locator('.map-tip')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.map-tip')).toContainText('District of Colorado');
  await co.click();
  await expect(page).toHaveURL(/#\/district\/cod$/);
});

test('tap shows a pinned tooltip with a link to the profile', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'touch only');
  await openMap(page);
  await page.locator('path.district[data-id="cod"]').tap();
  const tip = page.locator('.map-tip');
  await expect(tip).toHaveAttribute('data-pinned', 'true');
  await shot(page, testInfo, 'map-tap-tooltip', false);
  await tip.getByRole('link', { name: /Open district profile/ }).tap();
  await expect(page).toHaveURL(/#\/district\/cod$/);
});

test('view as table shows the same districts, sortable', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: 'View as table' }).click();
  const table = page.locator('.choropleth__table table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(94);
  const th = table.locator('thead th').first();
  await expect(th).toHaveAttribute('aria-sort', 'ascending');
  await th.getByRole('button').click();
  await expect(th).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Hide table' }).click();
  await expect(table).toBeHidden();
});

test('theme toggle switches and persists', async ({ page }) => {
  await openMap(page);
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--map-q4').trim());
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--map-q4').trim());
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('glossary term opens an accessible definition', async ({ page }) => {
  await page.goto('./#/learn');
  const t = page.locator('button.term[data-term="senior-status"]').first();
  await t.scrollIntoViewIfNeeded();
  await t.focus();
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.gloss-pop')).toContainText('Rule of 80');
  const describedBy = await t.getAttribute('aria-describedby');
  await expect(page.locator(`#${describedBy}`)).toContainText('Rule of 80');
  await page.keyboard.press('Escape');
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'false');
});
