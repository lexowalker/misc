import { test, expect, type Page } from '@playwright/test';

// Visual regression: pixel comparisons of a few views that should not change unless the design does. Baselines
// live in tests/e2e/visual.spec.ts-snapshots/ (committed; one PNG per view and project, "-linux" suffix) and are
// specific to headless Chromium 1.63 on Linux: fonts and anti-aliasing differ on other systems. Update them
// only after reviewing the change: CI=1 E2E_PORT=<port> npx playwright test tests/e2e/visual.spec.ts
// --update-snapshots (see docs/lanes/frontend.md, Testing).
//
// Kept stable on purpose: animations off, reduced motion, fonts loaded, caret hidden, CSS-pixel scale, and clip
// regions rather than whole pages. Views avoid anything that moves with the data build (the footer's build
// date, live counts) or between runs (courthouse dots, hover states, the thumbnail strip).

test.use({ reducedMotion: 'reduce' });

const SHOT = { animations: 'disabled' as const, caret: 'hide' as const, scale: 'css' as const, maxDiffPixelRatio: 0.002 };

async function ready(page: Page, url: string, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(url);
  await page.waitForSelector('h1');
  await page.evaluate(() => document.fonts.ready);
  // Glossary and formula popovers are closed; nothing is hovered or focused.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test('visual: Learn page diagrams', async ({ page }) => {
  await ready(page, './#/learn');
  const figs = page.locator('.learn-figure:not(.learn-figure--map)');
  await expect(figs).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    const fig = figs.nth(i);
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator('svg').first()).toBeVisible();
    await expect(fig).toHaveScreenshot(`learn-diagram-${i + 1}.png`, SHOT);
  }
});

test('visual: not-found page', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await ready(page, './#/no-such-page', theme);
    await expect(page.locator('.page--narrow')).toHaveScreenshot(`not-found-${theme}.png`, SHOT);
  }
});

test('visual: search page before a query', async ({ page }) => {
  await ready(page, './#/search');
  await expect(page.locator('.find__examples')).not.toBeEmpty();
  // The page puts the cursor in the search box once it has rendered, which may land before or after ready()
  // blurs it. Focus it here so the focus ring is always in the picture rather than in some runs only.
  const box = page.getByRole('combobox');
  await box.focus();
  await expect(box).toBeFocused();
  await page.waitForTimeout(150);
  // The help line counts the places in the search index, which changes with the data build: masked.
  await expect(page.locator('.find-page')).toHaveScreenshot('search-empty.png', { ...SHOT, mask: [page.locator('.find__help')] });
});

test('visual: home map, authorized judgeships FY 2015, courthouses hidden', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await ready(page, './#/?v=judgeships&y=2015', theme);
    await page.waitForSelector('.atlas-map[data-state="ready"]');
    await expect(page.locator('path.district.q0, path.district.q1, path.district.q2, path.district.q3, path.district.q4').first()).toBeVisible();
    // Courthouse dots and city labels are left out: their layer is data that grows as places are geocoded.
    await page.addStyleTag({ content: '.atlas-map .dots, .atlas-map .city-labels { display: none !important; }' });
    const svg = page.locator('.home-map .atlas-map');
    await svg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(svg).toHaveScreenshot(`home-map-judgeships-2015-${theme}.png`, SHOT);
  }
});

test('visual: district header', async ({ page }) => {
  await ready(page, './#/district/vaed');
  const head = page.locator('.district-head');
  await expect(head.locator('h1')).toHaveText('Eastern District of Virginia');
  await expect(head).toHaveScreenshot('district-head-vaed.png', SHOT);
});
