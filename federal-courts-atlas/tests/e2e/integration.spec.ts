import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle, shot, watchErrors } from './helpers.ts';

// Integration pass: every route, in light and dark, at desktop and 375 px.
// Each visit checks the heading, the theme, console errors and horizontal overflow (the page's scroll width and
// any visible element that pokes out of the viewport without a scrolling or clipping ancestor).
// Five page types are also captured as the final review set: final-<page>-<theme>.jpg.
// Nothing here hard-codes a statistic; the table route and story slugs are read from public/data.

const PUB = path.join('public', 'data');
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(PUB, p), 'utf8'));
const has = fs.existsSync(path.join(PUB, 'variables.json')) && fs.existsSync(path.join(PUB, 'stories', 'index.json'));
test.skip(!has, 'web or stories data not built (make stories web)');

const variablesRaw = has ? read('variables.json') : [];
const variables: Array<{ id: string }> = Array.isArray(variablesRaw) ? variablesRaw : variablesRaw.variables ?? [];
const slugs: string[] = has ? (read('stories/index.json').order as string[]) : [];
const tableVar = variables[0]?.id ?? 'civil_disposition_months';

type Route = { name: string; hash: string; h1: RegExp; ready?: string; final?: 'full' | 'viewport' };

const ROUTES: Route[] = [
  { name: 'home', hash: '#/', h1: /How federal justice varies/, ready: '.atlas-map[data-state="ready"]', final: 'full' },
  { name: 'district-vaed', hash: '#/district/vaed', h1: /Eastern District of Virginia/, ready: '.locator-map', final: 'full' },
  { name: 'district-nmid', hash: '#/district/nmid', h1: /Northern Mariana Islands/, ready: '.locator-map, .district-locator .empty-state' },
  { name: 'compare', hash: '#/compare?d=vaed,txed', h1: /Compare districts/, ready: '.locator-map', final: 'full' },
  { name: 'stories', hash: '#/stories', h1: /Stories from the data/ },
  ...slugs.map<Route>((s, i) => ({
    name: `story-${s}`,
    hash: `#/stories/${s}`,
    h1: /./,
    ready: '.story-step',
    final: i === 0 ? 'viewport' : undefined,
  })),
  { name: 'courtroom', hash: '#/courtroom', h1: /The Courtroom/, ready: '.cr-stage[data-ready="true"], .cr-stage[data-renderer="fallback"]', final: 'viewport' },
  { name: 'learn', hash: '#/learn', h1: /How federal courts work/, ready: '.diagram--lifecycle' },
  { name: 'search', hash: '#/search', h1: /Find your federal court/ },
  { name: 'sources', hash: '#/sources', h1: /Sources and methodology/ },
  { name: 'table', hash: `#/table/${tableVar}`, h1: /./, ready: 'table' },
];

/** Scroll through the page so lazy sections (thumbnails, story charts, compare rows) render, then return to the top. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
}

/** Visible elements whose box crosses the viewport edge with no ancestor that scrolls or clips horizontally. */
async function pokingOut(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const clips = (el: Element) => {
      const s = getComputedStyle(el);
      return ['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX);
    };
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
      if (s.position === 'fixed' || s.position === 'absolute') {
        // Off-canvas or visually hidden helpers (1px clip) are not visible overflow.
        if (r.width <= 1 || r.height <= 1) continue;
      }
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        if (clips(p)) {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1 && pr.left >= -1) clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (clipped) continue;
      // Report the outermost offender only.
      const parent = el.parentElement;
      if (parent && parent !== document.body) {
        const pr = parent.getBoundingClientRect();
        if (pr.right > vw + 1 || pr.left < -1) continue;
      }
      const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') ?? '';
      out.push(`${el.tagName.toLowerCase()}.${cls.trim().split(/\s+/).join('.')} [${Math.round(r.left)}, ${Math.round(r.right)}] vw=${vw}`);
    }
    return out.slice(0, 10);
  });
}

for (const theme of ['light', 'dark'] as const) {
  for (const r of ROUTES) {
    test(`integration ${theme}: ${r.name}`, async ({ page }, testInfo) => {
      const errors = watchErrors(page);
      if (theme === 'dark') await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
      await page.goto(`./${r.hash}`);
      // Light follows the system preference (Playwright's colorScheme is light) and sets no attribute until chosen.
      if (theme === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('h1').first()).toHaveText(r.h1, { timeout: 15_000 });
      if (r.ready) await page.waitForSelector(r.ready, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await scrollThrough(page);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal page overflow on ${r.hash} (${theme})`).toBeLessThanOrEqual(0);
      const poking = await pokingOut(page);
      expect(poking, `elements crossing the viewport edge on ${r.hash} (${theme})`).toEqual([]);

      // The body must paint its own background in both themes (no transparent canvas showing through).
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');

      if (r.final) {
        await settle(page);
        const base = r.name.startsWith('story-') ? 'story' : r.name.replace(/-vaed$/, '');
        await shot(page, testInfo, `final-${base}-${theme}`, r.final === 'full');
        if (r.name.startsWith('story-')) {
          // A mid-story step, where the sticky graphic and a step card overlap.
          await page.locator('.story-step').nth(3).scrollIntoViewIfNeeded();
          await page.waitForTimeout(900);
          await shot(page, testInfo, `final-story-step-${theme}`, false);
        }
      }
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

test('home ships no three.js and stays within its JavaScript budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one measurement is enough');
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-state="ready"]');
  await page.waitForLoadState('networkidle');
  // Let the idle-time thumbnails load too: "total JS on home" includes everything the page pulls in at rest.
  await scrollThrough(page);
  await page.waitForLoadState('networkidle');
  const m = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = res.filter((r) => r.name.endsWith('.js'));
    const mark = performance.getEntriesByName('atlas:first-map-paint')[0]?.startTime ?? Infinity;
    const before = js.filter((r) => r.startTime <= mark);
    const kb = (xs: PerformanceResourceTiming[], k: 'encodedBodySize' | 'decodedBodySize') =>
      Math.round(xs.reduce((a, r) => a + (r[k] || 0), 0) / 1024);
    return {
      scripts: js.length,
      totalTransferKB: kb(js, 'encodedBodySize'),
      totalDecodedKB: kb(js, 'decodedBodySize'),
      beforeFirstPaintTransferKB: kb(before, 'encodedBodySize'),
      threeRequested: res.some((r) => /three|OrbitControls|RoomEnvironment|BufferGeometryUtils/.test(r.name)),
      courtroomRequested: res.some((r) => /courtroom|scene-/.test(r.name)),
    };
  });
  console.log('home JS:', JSON.stringify(m));
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/home-js.json', JSON.stringify(m, null, 2));
  expect(m.threeRequested, 'three.js must never load on the home map').toBe(false);
  expect(m.courtroomRequested).toBe(false);
  // The budget is on decoded bytes, which do not depend on how the host compresses (vite preview gzips).
  expect(m.totalDecodedKB).toBeLessThan(400);
});

// ---- Cross-lane fixes made in the integration pass -------------------------------------------

test('the #/story/<slug> shorthand redirects to the canonical story address', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`./#/story/${slugs[0]}`);
  await expect(page).toHaveURL(new RegExp(`#/stories/${slugs[0]}$`));
  await expect(page.locator('.story-step').first()).toBeVisible({ timeout: 15_000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('an unknown measure on #/table says so instead of "not yet built"', async ({ page }) => {
  await page.goto('./#/table/no_such_measure');
  await expect(page.locator('h1')).toHaveText('No measure by that name');
  await expect(page.locator('.empty-state')).toContainText('no_such_measure');
  await expect(page.getByText('Data not yet built')).toHaveCount(0);
});

test('a shared judgeship prints as published on the shared table (never rounded)', async ({ page }) => {
  const file = read('values/judgeships.json') as { years: number[]; values: Record<string, Record<string, number>> };
  const districts = read('districts.json') as Record<string, { name: string }>;
  const y = file.years[file.years.length - 1]!;
  const frac = Object.entries(file.values).find(([, ys]) => ys[String(y)] !== undefined && !Number.isInteger(ys[String(y)]));
  test.skip(!frac, 'no fractional judgeships in the latest year of this build');
  const [id, ys] = frac!;
  await page.goto(`./#/table/judgeships?y=${y}`);
  const row = page.locator('.data-table tbody tr', { hasText: districts[id]!.name }).first();
  await expect(row).toContainText(String(ys[String(y)]));
});

test('a derived formula opens on tap or hover from the shared source chip', async ({ page, isMobile }) => {
  const derived = (variables as Array<{ id: string; derived?: boolean; formula?: string | null }>).find((v) => v.derived && v.formula);
  test.skip(!derived, 'no derived variable with a formula');
  await page.goto(`./#/table/${derived!.id}`);
  const btn = page.locator('.source-chip__formula').first();
  const pop = page.locator('.source-chip__pop').first();
  await expect(btn).toBeVisible();
  await expect(pop).toBeHidden();
  if (isMobile) await btn.tap();
  else await btn.hover();
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('Formula');
  // A closed popover takes no layout space (it cannot widen a phone page).
  await page.mouse.click(5, 5);
  await page.locator('h1').click();
  await expect(pop).toBeHidden();
});

test('inset labels never sit on their own land', async ({ page }) => {
  await page.goto('./#/');
  await page.waitForSelector('.atlas-map[data-state="ready"]');
  await settle(page);
  const hits = await page.evaluate(() => {
    const out: string[] = [];
    for (const t of Array.from(document.querySelectorAll<SVGTextElement>('.inset-label'))) {
      const r = t.getBoundingClientRect();
      for (let i = 0; i <= 4; i++) {
        for (let j = 1; j <= 3; j++) {
          const x = r.left + (r.width * i) / 4;
          const y = r.top + (r.height * j) / 4;
          // Fill hits only: the tiny territories' paths carry a wide invisible stroke as a tap target.
          const land = document.elementsFromPoint(x, y).find((e) => e.matches('path.district') && (e as SVGPathElement).isPointInFill(
            new DOMPoint(...(() => { const m = (e as SVGGraphicsElement).getScreenCTM()!.inverse(); const p = new DOMPoint(x, y).matrixTransform(m); return [p.x, p.y] as [number, number]; })()),
          ));
          if (land) out.push(`${t.textContent} over ${land.getAttribute('data-id')}`);
        }
      }
    }
    return [...new Set(out)];
  });
  expect(hits).toEqual([]);
  await expect(page.locator('.inset-label', { hasText: /ALASKA|AK/ })).toHaveCount(1);
});

test('sources page: every source file appears once, grouped by kind of data', async ({ page }, testInfo) => {
  const sources = read('sources.json') as Record<string, unknown>;
  const total = Object.keys(sources).length;
  await page.goto('./#/sources');
  await expect(page.locator('.src-group').first()).toBeVisible();
  await expect(page.locator('.src-groups__lead')).toContainText(total.toLocaleString('en-US'));
  // Open every group, then count rows across all group tables.
  for (const d of await page.locator('details.src-group').all()) await d.evaluate((el) => ((el as HTMLDetailsElement).open = true));
  await expect(page.locator('.src-group .data-table tbody tr')).toHaveCount(total);
  // No pipeline vocabulary ("lane") in reader-facing labels.
  expect(await page.locator('.src-group__summary').allInnerTexts()).not.toContainEqual(expect.stringMatching(/lane/i));
  await page.evaluate(() => document.querySelectorAll('details.src-group').forEach((d, i) => ((d as HTMLDetailsElement).open = i < 2)));
  await settle(page);
  await shot(page, testInfo, 'final-sources', false);
});
