import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// The Courtroom (#/courtroom). Every expected number is computed here from the published files in
// public/data/, so nothing in this spec hard-codes a statistic.

const PUB = 'public/data';
const read = (p: string) => JSON.parse(fs.readFileSync(`${PUB}/${p}`, 'utf8'));
const has = fs.existsSync(`${PUB}/variables.json`);
test.skip(!has, 'web data not built (make web)');

type Var = { id: string; label: string; unit: string; format?: string; derived?: boolean };
type Vals = {
  years: number[];
  values: Record<string, Record<string, number>>;
  ranks: Record<string, Record<string, number>>;
  ranked_of: Record<string, number>;
  national?: Record<string, number>;
};
const variables: Var[] = has ? read('variables.json') : [];
const byId = new Map(variables.map((v) => [v.id, v]));
const vals = (id: string): Vals => read(`values/${id}.json`);
const latest = (f: Vals) => Math.max(...f.years);

/** The number as the panel prints it (the variable's decimals; percents keep their sign). */
function num(v: Var, x: number): string {
  const m = /\.(\d+)/.exec(v.format ?? '');
  let d = m ? parseInt(m[1]!, 10) : v.unit === 'percent' || v.unit === 'months' ? 1 : 0;
  if (d === 0 && !Number.isInteger(x)) d = 1;
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  return v.unit === 'percent' ? `${n}%` : n;
}
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
};
/** Same wording as src/pages/district/common.ts rankPhrase, including ties (ranks are shared at display precision). */
const rankPhrase = (r: number, of: number, ties = 1) => {
  if (ties > 1) {
    const who = ties > 2 ? ` (${ties} districts)` : '';
    if (r === 1) return `Tied for highest of ${of}${who}`;
    if (r + ties - 1 === of) return `Tied for lowest of ${of}${who}`;
    return `Tied for ${ordinal(r)} highest of ${of}${who}`;
  }
  return r === 1 ? `Highest of ${of}` : r === of ? `Lowest of ${of}` : `${ordinal(r)} highest of ${of}`;
};
const tiesOf = (f: { ranks: Record<string, Record<string, number>> }, y: number, r: number) =>
  Object.values(f.ranks).filter((row) => row[String(y)] === r).length;

/**
 * Capture for review. On narrow screens with the bottom sheet open, a full-page capture paints the
 * fixed sheet and sticky header mid-page, so take the viewport with the room at the top instead.
 */
async function capture(page: Page, testInfo: import('@playwright/test').TestInfo, name: string): Promise<void> {
  const sheet = (await page.locator('#cr-panel').getAttribute('data-sheet')) === 'open';
  if (testInfo.project.name === 'mobile' && sheet) {
    await page.evaluate(() => {
      const st = document.querySelector('.cr-stage')!;
      const hd = document.querySelector<HTMLElement>('.site-header');
      window.scrollTo(0, st.getBoundingClientRect().top + window.scrollY - (hd?.offsetHeight ?? 0) - 8);
    });
    await page.waitForTimeout(250);
    await shot(page, testInfo, name, false);
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, testInfo, name);
  }
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.cr-stage')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

/** Count non-transparent pixels in the WebGL canvas (needs preserveDrawingBuffer, set under automation). */
async function paintedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas.cr-canvas');
    if (!c) return 0;
    const t = document.createElement('canvas');
    t.width = 80;
    t.height = 50;
    const ctx = t.getContext('2d')!;
    ctx.drawImage(c, 0, 0, 80, 50);
    const d = ctx.getImageData(0, 0, 80, 50).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
}

test.describe('The Courtroom', () => {
  test('renders the 3D room, the seat list and the intro panel', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto('./#/courtroom');
    await expect(page.locator('h1')).toHaveText('The Courtroom');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-renderer', 'webgl');
    await expect(page.locator('canvas.cr-canvas')).toHaveCount(1);
    await expect(page.locator('.cr-seats__list .cr-seat')).toHaveCount(10);
    await expect(page.locator('.cr-seat--room')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cr-panel-title')).toHaveText('Choose a seat');
    await expect(page.locator('.cr-pin')).toHaveCount(9);
    expect(await paintedPixels(page)).toBeGreaterThan(1000);
    // three.js is loaded on this route (and only here: perf.spec.ts checks the map never loads it).
    const three = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /three/i.test(r.name)));
    expect(three).toBe(true);
    // The canvas is capped at 2 device pixels per CSS pixel.
    const ratio = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.cr-canvas')!;
      return c.width / c.clientWidth;
    });
    expect(ratio).toBeLessThanOrEqual(2.01);
    await settle(page);
    await shot(page, testInfo, 'courtroom-room');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('choosing a seat from the list flies there and shows national figures', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto('./#/courtroom');
    await ready(page);
    const jury = page.locator('.cr-seat[data-seat="jury"]');
    await jury.click();
    await expect(jury).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cr-seat--room')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/seat=jury/);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'jury', { timeout: 10_000 });
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-mode', 'pov');
    await expect(page.locator('#cr-panel-title')).toHaveText('The jury box');
    // The two FCMS juror measures are in the catalog (data fix lane, 2026-11-27); the panel reads variables.json first.
    const jurorIds = ['jurors_avg_present', 'jurors_pct_not_selected'];
    for (const id of jurorIds) expect(byId.has(id), `${id} should be in variables.json`).toBe(true);
    for (const id of ['civil_trial_rate_pct', 'criminal_trial_rate_pct', ...jurorIds]) {
      const f = vals(id);
      const y = latest(f);
      const nat = f.national?.[String(y)];
      const row = page.locator(`.cr-stat[data-variable="${id}"]`);
      await expect(row.locator('.cr-stat__label')).toHaveText(byId.get(id)!.label);
      if (typeof nat === 'number') {
        await expect(row.locator('.cr-stat__num')).toHaveText(num(byId.get(id)!, nat));
        await expect(row.locator('.cr-stat__meta')).toContainText(`FY ${y}`);
        await expect(row.locator('.cr-stat__meta')).toContainText('National figure');
        await expect(row.locator('.source-chip')).toBeVisible();
      } else {
        await expect(row.locator('.cr-stat__value')).toContainText('No national figure');
      }
    }
    // Juror counts are published, so the "not part of the atlas yet" note is gone.
    await expect(page.locator('.cr-group__missing')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await paintedPixels(page)).toBeGreaterThan(1000);
    await settle(page);
    await capture(page, testInfo, 'courtroom-seat-jury');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('district figures, ranks and sources come from public/data', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    const d = 'vaed';
    await page.goto(`./#/courtroom?seat=judge&d=${d}`);
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'judge');
    await expect(page.locator('#cr-district')).toHaveValue(d);
    await expect(page.locator('#cr-panel-title')).toHaveText('The judge’s bench');
    for (const id of ['judgeships', 'active_judges', 'senior_judges', 'weighted_filings_per_judgeship', 'vacant_judgeship_months']) {
      const f = vals(id);
      const y = latest(f);
      const x = f.values[d]?.[String(y)];
      const row = page.locator(`.cr-stat[data-variable="${id}"]`);
      if (typeof x !== 'number') {
        await expect(row.locator('.cr-stat__value')).toContainText('No data');
        continue;
      }
      await expect(row.locator('.cr-stat__num')).toHaveText(num(byId.get(id)!, x));
      const r = f.ranks[d]?.[String(y)];
      const of = f.ranked_of[String(y)];
      if (r && of) await expect(row.locator('.cr-stat__rank')).toContainText(rankPhrase(r, of, tiesOf(f, y, r)));
      if (byId.get(id)!.derived) await expect(row.locator('.source-chip--derived')).toBeVisible();
    }
    // No statistics about individual judges, said plainly.
    await expect(page.locator('.cr-panel__note')).toContainText('no statistics about individual judges');

    // Switching district re-renders the figures; the URL keeps the choice.
    await page.locator('#cr-district').selectOption('txwd');
    await expect(page).toHaveURL(/d=txwd/);
    const f = vals('judgeships');
    const y = latest(f);
    await expect(page.locator('.cr-stat[data-variable="judgeships"] .cr-stat__num')).toHaveText(num(byId.get('judgeships')!, f.values.txwd![String(y)]!));

    // The gallery: population served, from districts.json.
    await page.locator('.cr-seat[data-seat="gallery"]').click();
    await expect(page.locator('#cr-panel-title')).toHaveText('The gallery');
    const dist = read('districts.json').txwd;
    await expect(page.locator('.cr-stat[data-variable="population"] .cr-stat__num')).toHaveText(new Intl.NumberFormat('en-US').format(dist.population));
    for (const place of dist.places_of_holding_court ?? []) await expect(page.locator('.cr-places')).toContainText(place);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'gallery', { timeout: 10_000 });
    await settle(page);
    await capture(page, testInfo, 'courtroom-district-gallery');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('keyboard: arrows move through seats, Enter sits and focuses the panel, Escape returns', async ({ page }) => {
    await page.goto('./#/courtroom');
    await ready(page);
    await page.locator('.cr-seat[data-seat="judge"]').focus();
    await page.keyboard.press('ArrowDown');
    const clerk = page.locator('.cr-seat[data-seat="clerk"]');
    await expect(clerk).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('.cr-seat[data-seat="gallery"]')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('.cr-seat--room')).toBeFocused();
    await clerk.focus();
    await page.keyboard.press('Enter');
    await expect(clerk).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cr-panel-title')).toHaveText('The courtroom deputy');
    await expect(page.locator('#cr-panel-title')).toBeFocused();
    await expect(page.locator('[role="status"][aria-live="polite"]').last()).toContainText('The courtroom deputy');
    await page.keyboard.press('Escape');
    await expect(clerk).toHaveAttribute('aria-pressed', 'false');
    await expect(clerk).toBeFocused();
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-mode', 'overview');
    await expect(page.locator('#cr-panel-title')).toHaveText('Choose a seat');
  });

  test('picking in the room: a floating label and a click on the furniture', async ({ page }) => {
    await page.goto('./#/courtroom');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'overview');
    // A label.
    await page.locator('.cr-pin[data-seat="witness"] .cr-pin__dot').click();
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'witness', { timeout: 10_000 });
    await expect(page.locator('#cr-panel-title')).toHaveText('The witness stand');
    // Back to the room, then click the jury box itself (just below its label's dot).
    await page.locator('.cr-back').click();
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'overview', { timeout: 10_000 });
    const dot = await page.locator('.cr-pin[data-seat="jury"] .cr-pin__dot').boundingBox();
    expect(dot).not.toBeNull();
    const canvasBox = (await page.locator('canvas.cr-canvas').boundingBox())!;
    const x = dot!.x + dot!.width / 2;
    const y = Math.min(dot!.y + dot!.height / 2 + 26, canvasBox.y + canvasBox.height - 4);
    await page.mouse.click(x, y);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'jury', { timeout: 10_000 });
    await expect(page.locator('.cr-seat[data-seat="jury"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('reduced motion cuts to the seat instead of flying', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#/courtroom');
    await ready(page);
    const t0 = Date.now();
    await page.locator('.cr-seat[data-seat="lectern"]').click();
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'lectern', { timeout: 2_000 });
    // A flight takes at least one second; a cut lands at once.
    expect(Date.now() - t0).toBeLessThan(900);
  });

  test('without WebGL, a floor plan replaces the room and everything else works', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test override
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (this: HTMLCanvasElement, ...a: unknown[]) => unknown).call(this, type, ...rest);
      };
    });
    await page.goto('./#/courtroom');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-renderer', 'fallback');
    await expect(page.locator('canvas.cr-canvas')).toHaveCount(0);
    await expect(page.locator('svg.cr-plan')).toBeVisible();
    await expect(page.locator('.cr-fallback-note')).toContainText('floor plan');
    // three.js is never requested when WebGL is unavailable.
    expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /three/i.test(r.name)))).toBe(false);
    await page.locator('.cr-plan__seat[data-seat="prosecution"]').click();
    await expect(page.locator('#cr-panel-title')).toHaveText('The prosecution table');
    await expect(page.locator('.cr-plan__seat[data-seat="prosecution"]')).toHaveClass(/is-selected/);
    await page.locator('#cr-district').selectOption('azd');
    const f = vals('guilty_plea_pct');
    const y = latest(f);
    const x = f.values.azd?.[String(y)];
    const cell = page.locator('.cr-stat[data-variable="guilty_plea_pct"] .cr-stat__value');
    if (typeof x === 'number') await expect(cell).toHaveText(num(byId.get('guilty_plea_pct')!, x));
    else await expect(cell).toContainText('No data');
    // The list works too.
    await page.locator('.cr-seat[data-seat="defense"]').click();
    await expect(page.locator('#cr-panel-title')).toHaveText('The defense table');
    await expect(page.locator('.cr-panel__nodata')).toContainText('no data on defense lawyers');
    await settle(page);
    await capture(page, testInfo, 'courtroom-fallback');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('if the WebGL context is lost, the floor plan takes over', async ({ page }) => {
    await page.goto('./#/courtroom?seat=witness');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-renderer', 'webgl');
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.cr-canvas')!;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext;
      gl.getExtension('WEBGL_lose_context')!.loseContext();
    });
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-renderer', 'fallback');
    await expect(page.locator('canvas.cr-canvas')).toHaveCount(0);
    await expect(page.locator('.cr-plan__seat[data-seat="witness"]')).toHaveClass(/is-selected/);
    await expect(page.locator('#cr-panel-title')).toHaveText('The witness stand');
  });

  test('?webgl=0 shows the floor plan without loading three.js', async ({ page }) => {
    await page.goto('./#/courtroom?webgl=0&seat=reporter');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-renderer', 'fallback');
    await expect(page.locator('#cr-panel-title')).toHaveText('The court reporter');
    await expect(page.locator('.cr-record__item').first()).toBeVisible();
    expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /three/i.test(r.name)))).toBe(false);
  });

  test('leaving the page disposes the scene; coming back builds it again', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('./#/courtroom?seat=defense');
    await ready(page);
    await page.locator('.site-header a[href="#/learn"]').first().evaluate((a: HTMLAnchorElement) => a.click());
    await expect(page.locator('h1')).toHaveText(/How federal courts work/);
    await expect(page.locator('canvas.cr-canvas')).toHaveCount(0);
    await expect(page.locator('.cr-pin')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('h1')).toHaveText('The Courtroom');
    await ready(page);
    await expect(page.locator('canvas.cr-canvas')).toHaveCount(1);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'defense');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('dark mode: the evening room', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
    await page.goto('./#/courtroom?seat=lectern&d=nysd');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ready(page);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'lectern');
    await settle(page);
    await capture(page, testInfo, 'courtroom-dark-lectern');
    // Switching theme at runtime recolors the scene without errors.
    await page.locator('.site-header button[aria-label*="theme" i], .site-header .theme-toggle').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.waitForTimeout(200);
    expect(await paintedPixels(page)).toBeGreaterThan(1000);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('narrow screens: the panel becomes a bottom sheet; no horizontal scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'bottom sheet is for narrow screens');
    const errors = watchErrors(page);
    await page.goto('./#/courtroom');
    await ready(page);
    const panel = page.locator('#cr-panel');
    await expect(panel).toHaveAttribute('data-sheet', 'closed');
    await shot(page, testInfo, 'courtroom-room-full');
    await page.locator('.cr-seat[data-seat="witness"]').click();
    await expect(panel).toHaveAttribute('data-sheet', 'open');
    // The sheet slides up 24 px as it opens (cr-sheet-in, 420 ms); measure where it settles, not part-way. One full
    // run read it 167 ms in, 8.76 px short of the bottom (third recheck, Nov 27).
    await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = (await panel.boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(Math.abs(box.y + box.height - vh)).toBeLessThan(2);
    expect(box.height).toBeLessThan(vh * 0.6);
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-arrived', 'witness', { timeout: 10_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'courtroom-sheet', false);
    // Expand, then close: back to the room view, focus returns to the seat button.
    await page.locator('.cr-sheet__handle').click();
    await expect(panel).toHaveAttribute('data-expanded', 'true');
    await page.locator('.cr-sheet__close').click();
    await expect(panel).toHaveAttribute('data-sheet', 'closed');
    await expect(page.locator('.cr-seat[data-seat="witness"]')).toBeFocused();
    await expect(page.locator('.cr-stage')).toHaveAttribute('data-mode', 'overview');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
