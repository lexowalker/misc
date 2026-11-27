import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Automated accessibility scan (axe-core, WCAG 2.0/2.1 A and AA rules) of every route, in light and dark, at
// both widths (the desktop and mobile projects). Serious and critical violations fail the test; moderate and
// minor ones are reported in the test output only. A few interactive states are scanned too: an open formula
// popover, the open place-search list, the mobile menu, and the rank chart while it highlights exceptions.
//
// axe.min.js is injected with addScriptTag from the axe-core devDependency (no second Playwright, no browser).
// One narrow exclusion, explained in axe() below: inline glossary terms are left out of the target-size rule
// (WCAG 2.5.8 exempts targets inside a sentence). Nothing else is disabled; the three.js canvas passes as is. If a
// rule ever has to be switched off, do it narrowly in axe() with a comment saying why.

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');

const PUB = path.join('public', 'data');
const has = fs.existsSync(path.join(PUB, 'variables.json')) && fs.existsSync(path.join(PUB, 'stories', 'index.json'));
test.skip(!has, 'web or stories data not built (make stories web)');
const slugs: string[] = has ? (JSON.parse(fs.readFileSync(path.join(PUB, 'stories', 'index.json'), 'utf8')).order as string[]) : [];
const variablesRaw = has ? JSON.parse(fs.readFileSync(path.join(PUB, 'variables.json'), 'utf8')) : [];
const variables: Array<{ id: string; derived?: boolean; formula?: string | null }> = Array.isArray(variablesRaw) ? variablesRaw : variablesRaw.variables ?? [];
const tableVar = variables[0]?.id ?? 'civil_disposition_months';

type Route = { name: string; hash: string; ready: string };

const ROUTES: Route[] = [
  { name: 'home', hash: '#/', ready: '.atlas-map[data-state="ready"]' },
  { name: 'home-old-year', hash: '#/?v=within_range_pct&y=2006', ready: '.atlas-map[data-state="ready"]' },
  { name: 'district-vaed', hash: '#/district/vaed', ready: '.district-page h1' },
  { name: 'district-nmid', hash: '#/district/nmid', ready: '.district-page h1' },
  { name: 'compare-2', hash: '#/compare?d=vaed,txed', ready: '.cmp-page h1' },
  { name: 'compare-4', hash: '#/compare?d=vaed,txed,nysd,gud', ready: '.cmp-page h1' },
  { name: 'stories', hash: '#/stories', ready: 'h1' },
  ...slugs.map((s) => ({ name: `story-${s}`, hash: `#/stories/${s}`, ready: '.story-step' })),
  { name: 'courtroom', hash: '#/courtroom', ready: '.cr-stage[data-ready="true"], .cr-stage[data-renderer="fallback"]' },
  { name: 'learn', hash: '#/learn', ready: '.diagram--lifecycle' },
  { name: 'search-query', hash: '#/search?q=Richmond', ready: 'h1' },
  { name: 'search-none', hash: '#/search?q=zzqxw', ready: 'h1' },
  { name: 'sources', hash: '#/sources', ready: 'h1' },
  { name: 'table', hash: `#/table/${tableVar}`, ready: 'table' },
  { name: 'not-found', hash: '#/no-such-page', ready: 'h1' },
];

type Violation = { id: string; impact: string | null; help: string; nodes: Array<{ target: string[]; failureSummary?: string }> };

async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);
}

async function axe(page: Page): Promise<Violation[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
    // @ts-expect-error injected by addScriptTag
    const all = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'target-size': { enabled: false } }, resultTypes: ['violations'] });
    // Target size (WCAG 2.5.8) runs separately, without the glossary terms (.term): they are words inside running
    // sentences, which 2.5.8 exempts ("the target is in a sentence"), but axe cannot tell a sentence from a label
    // and flags two of them on a phone. Every other control is checked.
    // @ts-expect-error injected by addScriptTag
    const ts = await window.axe.run({ include: [document], exclude: [['.term']] }, { runOnly: { type: 'rule', values: ['target-size'] }, resultTypes: ['violations'] });
    return [...all.violations, ...ts.violations] as Violation[];
  });
}

function report(label: string, v: Violation[]): string[] {
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  const other = v.filter((x) => !bad.includes(x));
  if (other.length) console.log(`[a11y] ${label} (not failing): ${other.map((x) => `${x.id}/${x.impact}:${x.nodes.length}`).join(', ')}`);
  return bad.map((x) => `${label}: ${x.id} (${x.impact}) ${x.help} -> ${x.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function open(page: Page, r: Route, theme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(`./${r.hash}`);
  await page.waitForSelector(r.ready, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await scrollThrough(page);
}

for (const r of ROUTES) {
  test(`a11y: ${r.name} has no serious or critical axe violations in either theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const problems: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      await open(page, r, theme);
      // The page really is in the theme under test (the theme follows prefers-color-scheme until chosen).
      const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light');
      expect(dark).toBe(theme === 'dark');
      problems.push(...report(`${testInfo.project.name}/${theme}/${r.name}`, await axe(page)));
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('a11y: interactive states (formula popover, place search list, menu, rank chart exceptions)', async ({ page, isMobile }, testInfo) => {
  test.setTimeout(120_000);
  const problems: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const tag = `${testInfo.project.name}/${theme}`;
    // A formula popover opened by a click (the derived per-capita rate's table).
    const derived = variables.find((v) => v.derived && v.formula);
    if (derived) {
      await open(page, { name: 'table', hash: `#/table/${derived.id}`, ready: 'table' }, theme);
      await page.locator('.source-chip__formula').first().click();
      await expect(page.locator('.source-chip__pop').first()).toBeVisible();
      problems.push(...report(`${tag}/formula-open`, await axe(page)));
    }
    // The home page's place search with its list open.
    await open(page, ROUTES[0]!, theme);
    await page.locator('.psearch__input').first().fill('Richmond');
    await expect(page.getByRole('option').first()).toBeVisible();
    problems.push(...report(`${tag}/search-open`, await axe(page)));
    // The mobile menu, open.
    if (isMobile) {
      await page.keyboard.press('Escape');
      const toggle = page.locator('.site-nav__toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      problems.push(...report(`${tag}/menu-open`, await axe(page)));
    }
    // The Rocket Docket rank chart while it dims the first-place years.
    if (slugs.includes('rocket-docket')) {
      await open(page, { name: 'story', hash: '#/stories/rocket-docket', ready: '.story-step' }, theme);
      const n = await page.locator('.story-step').count();
      for (let i = 0; i < n; i++) {
        await page.locator('.story-step').nth(i).scrollIntoViewIfNeeded();
        await page.evaluate((k) => document.querySelectorAll('.story-step')[k]!.scrollIntoView({ block: 'center' }), i);
        await page.waitForTimeout(150);
        if (await page.locator('.story-view.is-active .rank-strip.is-exceptions').count()) break;
      }
      problems.push(...report(`${tag}/rank-exceptions`, await axe(page)));
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
