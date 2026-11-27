import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle, shot, watchErrors } from './helpers.ts';

// Home lane: variable switcher (thumbnails + select), time machine, tooltip, No data,
// courthouse dots, place search, phone layout and dark mode. Every expected number is
// read here from the same public/data files the page reads; nothing is hard-coded.

const PUB = 'public/data';
const read = (p: string) => JSON.parse(fs.readFileSync(`${PUB}/${p}`, 'utf8'));
const has = fs.existsSync(`${PUB}/variables.json`);
test.skip(!has, 'web data not built (make web)');

type Var = { id: string; family: string; label: string; short_label?: string; unit: string; derived: boolean; formula: string | null; years: number[] };
type Vals = {
  years: number[];
  period_type: string;
  values: Record<string, Record<string, number>>;
  ranks: Record<string, Record<string, number>>;
  ranked_of: Record<string, number>;
  cell_notes?: Record<string, Record<string, string>>;
};

const ORDER = ['speed', 'workload', 'sentencing', 'casemix'];
const variables: Var[] = has ? read('variables.json') : [];
const byFamily = [...variables].sort((a, b) => ORDER.indexOf(a.family) - ORDER.indexOf(b.family));
const vals = (id: string): Vals => read(`values/${id}.json`);
const CLASSED = 'path.district.q0, path.district.q1, path.district.q2, path.district.q3, path.district.q4';

function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

/** The rank phrase the tooltip should show, computed from the values file. */
function expectedRank(f: Vals, id: string, year: number): string {
  const y = String(year);
  const v = f.values[id]![y]!;
  const r = f.ranks[id]![y]!;
  const n = f.ranked_of[y]!;
  const all = Object.values(f.values).map((row) => row[y]).filter((w): w is number => typeof w === 'number');
  const lower = all.filter((w) => w < v).length;
  const tied = all.filter((w) => w === v).length > 1;
  const pre = tied ? 'Tied for ' : '';
  const fromBottom = lower + 1;
  if (r === 1) return `${pre}${tied ? 'highest' : 'Highest'} of ${n}`;
  if (fromBottom === 1) return `${pre}${tied ? 'lowest' : 'Lowest'} of ${n}`;
  if (r <= fromBottom) return `${pre}${ord(r)} highest of ${n}`;
  return `${pre}${ord(fromBottom)} lowest of ${n}`;
}

async function openHome(page: Page, query = '') {
  await page.goto(`./#/${query}`);
  await page.waitForSelector('.atlas-map[data-has-data="true"]');
}

async function classes(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('path.district')].map((p) => [p.getAttribute('data-id'), (p.getAttribute('class') ?? '').match(/q\d|nodata|base/)?.[0] ?? ''])),
  );
}

/** Open a district's tooltip. Small districts are reached by keyboard focus (same tooltip). */
async function showTip(page: Page, id: string, isMobile: boolean, pointer = false) {
  const p = page.locator(`path.district[data-id="${id}"]`);
  if (!pointer) await p.focus();
  else if (isMobile) await p.tap();
  else await p.hover();
  await expect(page.locator('.map-tip')).toHaveAttribute('data-open', 'true');
}

test('home: thumbnail switcher recolors the map and updates the URL', async ({ page }) => {
  const errors = watchErrors(page);
  await openHome(page);
  const def = byFamily[0]!;
  await expect(page.locator('#variable-select')).toHaveValue(def.id);
  await expect(page.locator(`.vthumb[data-variable="${def.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  const before = await classes(page);

  // Four family tabs with every variable; the Sentencing tab shows its thumbnails.
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await page.getByRole('tab', { name: /Sentencing/ }).click();
  const sent = byFamily.filter((v) => v.family === 'sentencing');
  await expect(page.locator('.vswitch__strip .vthumb')).toHaveCount(sent.length);
  const target = sent.find((v) => v.id === 'within_range_pct') ?? sent[0]!;
  const thumb = page.locator(`.vthumb[data-variable="${target.id}"]`);
  await thumb.click();
  await expect(thumb).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`.vthumb[data-variable="${def.id}"]`)).toHaveCount(0); // other family's strip is not shown
  await expect(page.locator('#variable-select')).toHaveValue(target.id);
  await expect(page).toHaveURL(new RegExp(`[?&]v=${target.id}(&|$)`));
  await expect(page.locator('.home-measure__title')).toContainText(target.label);
  const f = vals(target.id);
  const latest = f.years[f.years.length - 1]!;
  await expect(page.locator(CLASSED)).toHaveCount(Object.values(f.values).filter((r) => String(latest) in r).length);
  const after = await classes(page);
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

  // The select fallback switches too, and the matching tab opens.
  const casemix = byFamily.find((v) => v.family === 'casemix')!;
  await page.locator('#variable-select').selectOption(casemix.id);
  await expect(page.locator('.home-measure__title')).toContainText(casemix.label);
  await expect(page.getByRole('tab', { name: /Case mix/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`.vthumb[data-variable="${casemix.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(new RegExp(`[?&]v=${casemix.id}(&|$)`));
  expect(errors, errors.join('\n')).toEqual([]);
});

test('home: thumbnails are drawn after the first map paint', async ({ page }) => {
  await openHome(page);
  const speed = byFamily.filter((v) => v.family === 'speed');
  await expect(page.locator('.vthumb__map[data-state="ready"] svg')).toHaveCount(speed.length, { timeout: 15_000 });
  const t = await page.evaluate(() => {
    const paint = performance.getEntriesByName('atlas:first-map-paint')[0]?.startTime ?? null;
    const res = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter((r) => /\/values\//.test(r.name));
    return { paint, values: res.map((r) => ({ name: r.name.split('/').pop(), start: r.startTime })) };
  });
  expect(t.paint).not.toBeNull();
  // Only the default variable's values may load before the map paints; thumbnail files come after.
  const def = byFamily[0]!.id;
  for (const r of t.values) if (!r.name!.startsWith(def)) expect(r.start, r.name).toBeGreaterThan(t.paint!);
});

test('home: time machine changes the year, the colors and the URL', async ({ page }, testInfo) => {
  const v = variables.find((x) => x.id === 'within_range_pct') ?? byFamily[0]!;
  const f = vals(v.id);
  await openHome(page, `?v=${v.id}`);
  const slider = page.locator('.year-slider__input');
  await slider.focus();
  await page.keyboard.press('Home');
  const first = f.years[0]!;
  await expect(page.locator('.year-slider__value')).toContainText(String(first));
  await expect(page).toHaveURL(new RegExp(`[?&]y=${first}(&|$)`));
  await expect(page.locator(CLASSED)).toHaveCount(Object.values(f.values).filter((r) => String(first) in r).length);
  await expect(page.locator('.choropleth__legend-year')).toContainText(String(first));
  // Landmark events: Booker is a button that jumps to its fiscal year.
  const booker = page.getByRole('button', { name: /Booker/ });
  if (f.years.includes(2005)) {
    await booker.click();
    await expect(page).toHaveURL(/[?&]y=2005(&|$)/);
    await expect(slider).toHaveAttribute('aria-valuetext', 'FY 2005');
  }
  // The legend says colors are pooled across years.
  await expect(page.locator('.legend__note')).toContainText('pooled');
  // Event labels never overlap (desktop shows them; phones show markers only).
  const boxes = await page.locator('.year-slider__event-label').evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })),
  );
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      expect(overlap, `event labels ${i} and ${j} overlap`).toBe(false);
    }
  await page.locator('.home-time').scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, testInfo, 'home-time-machine', false);
});

test('home: play advances the years and pause stops', async ({ page }) => {
  const v = byFamily[0]!;
  const f = vals(v.id);
  await openHome(page, `?v=${v.id}&y=${f.years[0]}`);
  const play = page.getByRole('button', { name: 'Play animation through the years' });
  await play.click();
  await expect(page.getByRole('button', { name: 'Pause animation' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(new RegExp(`[?&]y=${f.years[0]}(&|$)`), { timeout: 5_000 });
  await page.getByRole('button', { name: 'Pause animation' }).click();
  const y1 = await page.locator('.year-slider__value').textContent();
  await page.waitForTimeout(1500);
  await expect(page.locator('.year-slider__value')).toHaveText(y1!);
});

test('home: URL state restores the variable and year', async ({ page }) => {
  const v = variables.find((x) => x.id === 'prison_pct') ?? byFamily[1]!;
  const f = vals(v.id);
  const y = f.years[Math.floor(f.years.length / 2)]!;
  await openHome(page, `?v=${v.id}&y=${y}`);
  await expect(page.locator('#variable-select')).toHaveValue(v.id);
  await expect(page.locator('.year-slider__input')).toHaveAttribute('aria-valuetext', `FY ${y}`);
  await expect(page.locator(CLASSED)).toHaveCount(Object.values(f.values).filter((r) => String(y) in r).length);
});

test('home: tooltip shows value, unit, explicit rank direction and period', async ({ page, isMobile }, testInfo) => {
  const v = byFamily[0]!;
  const f = vals(v.id);
  const latest = f.years[f.years.length - 1]!;
  await openHome(page);
  // A district in the bottom half and one in the top half, so both directions are exercised.
  const ids = Object.keys(f.values).filter((id) => typeof f.values[id]![String(latest)] === 'number' && !f.cell_notes?.[id]?.[String(latest)]);
  ids.sort((a, b) => f.ranks[a]![String(latest)]! - f.ranks[b]![String(latest)]!);
  for (const id of [ids[2]!, ids[ids.length - 3]!]) {
    await showTip(page, id, isMobile);
    const tip = page.locator('.map-tip');
    const dname = JSON.parse(fs.readFileSync(`${PUB}/districts.json`, 'utf8'))[id].name as string;
    await expect(tip).toContainText(dname);
    const value = f.values[id]![String(latest)]!;
    await expect(tip.locator('.map-tip__value')).toContainText(value.toFixed(1));
    if (v.unit === 'months') await expect(tip.locator('.map-tip__value')).toContainText('months');
    await expect(tip.locator('.map-tip__rank')).toContainText(expectedRank(f, id, latest));
    await expect(tip.locator('.map-tip__meta')).toContainText(`FY ${latest}`);
  }
  // Pointer: hover (desktop) or tap (phone) on a large district shows the same tooltip.
  await page.locator('h1').click();
  const big = ids.find((id) => id === 'cod' || id === 'txwd') ?? ids[Math.floor(ids.length / 2)]!;
  await showTip(page, big, isMobile, true);
  await expect(page.locator('.map-tip .map-tip__rank')).toContainText(expectedRank(f, big, latest));
  await shot(page, testInfo, 'home-tooltip', false);
  // The accessible name keeps the "Nth of N, FY YYYY" pattern and names the direction.
  const id0 = ids[0]!;
  await expect(page.locator(`path.district[data-id="${id0}"]`)).toHaveAttribute('aria-label', new RegExp(`: [^,]+, 1st of ${f.ranked_of[String(latest)]}, FY ${latest}$`));
  const help = await page.locator('.atlas-map__svg').getAttribute('aria-describedby');
  await expect(page.locator(`#${help}`)).toContainText('count from the highest');
  // The tooltip also gives the conventional derived rank with its rule.
  await expect(page.locator('.map-tip__meta')).toContainText('(1 = highest)');
});

test('home: No data districts are hatched and say so', async ({ page, isMobile }, testInfo) => {
  const v = variables.find((x) => x.id === 'civil_trial_months');
  test.skip(!v, 'variable not published');
  const f = vals(v!.id);
  const latest = String(f.years[f.years.length - 1]);
  const missing = Object.keys(JSON.parse(fs.readFileSync(`${PUB}/districts.json`, 'utf8'))).filter((id) => typeof f.values[id]?.[latest] !== 'number');
  expect(missing.length).toBeGreaterThan(0);
  await openHome(page, `?v=${v!.id}`);
  const big = missing.find((id) => !['gud', 'vid', 'nmid', 'dcd'].includes(id)) ?? missing[0]!;
  const p = page.locator(`path.district[data-id="${big}"]`);
  await expect(p).toHaveClass(/nodata/);
  const fill = await p.evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toMatch(/url\(/);
  await showTip(page, big, isMobile);
  await expect(page.locator('.map-tip__value')).toContainText('No data');
  await expect(page.locator('.map-tip__value svg.legend__nodata')).toHaveCount(1);
  await expect(page.locator('.legend__nd')).toContainText('No data');
  await shot(page, testInfo, 'home-nodata', false);
});

test('home: a cell caveat appears in the tooltip', async ({ page, isMobile }) => {
  const v = byFamily.find((x) => {
    const f = vals(x.id);
    return Object.values(f.cell_notes ?? {}).some((byYear) => Object.keys(byYear).length);
  });
  test.skip(!v, 'no cell notes published');
  const f = vals(v!.id);
  const [id, byYear] = Object.entries(f.cell_notes!).find(([, by]) => Object.keys(by).length)!;
  const [year, note] = Object.entries(byYear)[0]!;
  await openHome(page, `?v=${v!.id}&y=${year}`);
  await showTip(page, id, isMobile);
  await expect(page.locator('.map-tip__note')).toContainText(note.slice(0, 40));
});

test('home: derived measures show a Derived label with the formula on focus', async ({ page }, testInfo) => {
  const v = variables.find((x) => x.derived && x.formula && x.id.endsWith('per_100k'));
  test.skip(!v, 'no derived rate published');
  await openHome(page, `?v=${v!.id}`);
  const btn = page.locator('.home-measure .dtag__btn');
  await expect(btn).toHaveText('Derived');
  await btn.focus();
  const pop = page.locator('.home-measure .dtag__pop');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(v!.formula!.replace(/^Derived:\s*/i, '').slice(0, 30));
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  for (const t of ['gud', 'vid', 'nmid']) await expect(page.locator(`path.district[data-id="${t}"]`)).toHaveClass(/nodata/);
  await btn.focus();
  await shot(page, testInfo, 'home-derived', false);
});

test('home: courthouse dots distinguish places of holding court from other courthouses', async ({ page }) => {
  const ch: Array<{ city: string; state: string; kind: string }> = read('geo/courthouses.json');
  const kinds = new Map<string, Set<string>>();
  for (const c of ch) {
    const k = `${c.city}|${c.state}`.toLowerCase();
    (kinds.get(k) ?? kinds.set(k, new Set()).get(k)!).add(c.kind);
  }
  const open = [...kinds.values()].filter((s) => !s.has('place_of_holding_court')).length;
  await openHome(page);
  const map = page.locator('.atlas-map');
  await expect(map).toHaveAttribute('data-courthouses', String(kinds.size));
  await expect(map).toHaveAttribute('data-courthouses-open', String(open));
  await expect(page.locator('.home-key')).toContainText('court is held');
});

test('home: search finds E.D. Va. for Alexandria and for ZIP 22314', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await openHome(page);
  const box = page.getByRole('combobox', { name: 'Find your federal court' });
  await box.fill('Alexandria');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const va = list.getByRole('option', { name: /Alexandria, VA.*Eastern District of Virginia/ });
  await expect(va.first()).toBeVisible();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  await settle(page);
  await shot(page, testInfo, 'home-search', false);
  await box.fill('22314');
  await expect(list.getByRole('option').first()).toContainText('E.D. Va.');
  await box.press('ArrowDown');
  const active = await box.getAttribute('aria-activedescendant');
  expect(active).toBeTruthy();
  await expect(page.locator(`#${active}`)).toHaveAttribute('aria-selected', 'true');
  await box.press('Enter');
  await expect(page).toHaveURL(/#\/district\/vaed$/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('home: full page, light', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await openHome(page);
  await expect(page.locator('h1')).toHaveText(/How federal justice varies/);
  await expect(page.getByRole('link', { name: /how they work/ })).toHaveAttribute('href', '#/learn');
  await expect(page.locator('.vthumb__map[data-state="ready"] svg').first()).toBeVisible({ timeout: 15_000 });
  await settle(page);
  await shot(page, testInfo, 'home-full');
  await shot(page, testInfo, 'home-fold', false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('home: dark mode', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fca-theme', 'dark'));
  await openHome(page, '?v=crim_immigration_pct');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.vthumb__map[data-state="ready"] svg').first()).toBeVisible({ timeout: 15_000 });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');
  await settle(page);
  await shot(page, testInfo, 'home-dark-full');
  await shot(page, testInfo, 'home-dark-fold', false);
});

test('home: phone layout has no horizontal page scroll; the strip scrolls instead', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'phone layout');
  await openHome(page, '?v=pending_per_judgeship');
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const strip = page.locator('.vswitch__scroller');
  const sw = await strip.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(sw).toBeGreaterThan(0);
  // Touch targets: tabs and thumbnails are at least 44px tall.
  for (const sel of ['.vswitch__tab', '.vthumb']) {
    const b = await page.locator(sel).first().boundingBox();
    expect(b!.height, sel).toBeGreaterThanOrEqual(44);
  }
  await settle(page);
  await shot(page, testInfo, 'home-phone-fold', false);
});
