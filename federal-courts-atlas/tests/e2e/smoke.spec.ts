import { test, expect } from '@playwright/test';
import { settle, shot, watchErrors } from './helpers.ts';

// One smoke test per route: it loads, has a heading, throws no errors, and is captured.
const ROUTES: Array<[string, string, RegExp]> = [
  ['home', '#/', /How federal justice varies/],
  ['district', '#/district/vaed', /Eastern District of Virginia/],
  ['district-territory', '#/district/gud', /District of Guam/],
  ['compare', '#/compare?d=vaed,txed,nysd', /Compare districts/],
  ['stories', '#/stories', /Stories from the data/],
  ['story', '#/stories/rocket-docket', /The Rocket Docket/],
  ['courtroom', '#/courtroom', /The Courtroom/],
  ['learn', '#/learn', /How federal courts work/],
  ['search', '#/search?q=texas', /Find your federal court/],
  ['sources', '#/sources', /Sources and methodology/],
  ['table', '#/table/median_time_civil', /median_time_civil|Median/i],
  ['not-found', '#/no-such-page', /There is no page at this address/],
];

for (const [name, hash, heading] of ROUTES) {
  test(`route ${name} renders`, async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto(`./${hash}`);
    await expect(page.locator('h1').first()).toHaveText(heading);
    if (name === 'home' || name.startsWith('district') || name === 'compare') {
      // Maps (or their designed empty states) must have rendered.
      await page.waitForSelector('.atlas-map[data-state="ready"], .atlas-map[data-state="missing"], .locator-map, .empty-state', { timeout: 15_000 });
    }
    await settle(page);
    await shot(page, testInfo, name);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('learn page in dark mode', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await page.goto('./#/learn');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForSelector('.diagram--lifecycle');
  await settle(page);
  // Viewport captures of the diagrams keep the dark set small; light mode has the full page.
  await page.locator('#structure .learn-figure').first().scrollIntoViewIfNeeded();
  await shot(page, testInfo, 'learn-dark-structure', false);
  await page.locator('#criminal .learn-figure').scrollIntoViewIfNeeded();
  await shot(page, testInfo, 'learn-dark-lifecycle', false);
});

test('home in dark mode', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-state="ready"], .atlas-map[data-state="missing"]');
  await settle(page);
  await shot(page, testInfo, 'home-dark');
});

test('mobile nav collapses to a menu', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('./#/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await expect(toggle).toBeVisible();
  await expect(page.locator('.site-nav__list')).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('link', { name: 'Learn' })).toBeVisible();
  const box = await page.getByRole('link', { name: 'Learn' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await shot(page, testInfo, 'menu-open', false);
  await page.getByRole('link', { name: 'Learn' }).click();
  await expect(page).toHaveURL(/#\/learn/);
  await expect(page.locator('.site-nav__list')).toBeHidden();
});

test('no horizontal overflow at this width', async ({ page }) => {
  for (const hash of ['#/', '#/learn', '#/search?q=new', '#/district/vaed', '#/compare?d=vaed,txed']) {
    await page.goto(`./${hash}`);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${hash}`).toBeLessThanOrEqual(0);
  }
});
