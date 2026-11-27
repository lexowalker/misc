import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle, shot, watchErrors } from './helpers.ts';

// Guided stories (#/stories and #/stories/:slug). Every number the tests look for is read from
// public/data/stories/*.json inside the test; nothing here hard-codes a statistic.

const DATA = path.join('public', 'data', 'stories');
const INDEX = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')) as { order: string[] };
const SLUGS = INDEX.order;
const story = (slug: string) =>
  JSON.parse(fs.readFileSync(path.join(DATA, `${slug}.json`), 'utf8')) as {
    numbers: Record<string, { text: string; derived: boolean; formula?: string }>;
  };

async function open(page: Page, slug: string): Promise<void> {
  await page.goto(`./#/stories/${slug}`);
  await expect(page.locator('.story-head__title')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.story-step').first()).toBeVisible();
}

/** Scroll so that step i becomes the active step. */
async function toStep(page: Page, i: number): Promise<void> {
  await page.evaluate((k) => {
    const el = document.querySelectorAll<HTMLElement>('.story-step')[k]!;
    const narrow = window.matchMedia('(max-width: 59.99rem)').matches;
    // Mirror the page's trigger line (src/pages/story.ts pick()); the sticky graphic's bottom once stuck.
    const g = document.querySelector('.scrolly__graphic') as HTMLElement;
    const top = parseFloat(getComputedStyle(g).top) || 0;
    const gb = narrow ? top + g.offsetHeight : 0;
    const line = narrow ? gb + (window.innerHeight - gb) * 0.45 : window.innerHeight * 0.55;
    const y = el.getBoundingClientRect().top + window.scrollY - line + 24;
    window.scrollTo(0, Math.max(0, y));
  }, i);
  await expect(page.locator('.story-step').nth(i)).toHaveClass(/is-active/, { timeout: 5_000 });
  await page.waitForTimeout(150);
}

test('stories index lists every story with a thumbnail and a filled dek', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('./#/stories');
  await expect(page.locator('h1')).toHaveText('Stories from the data');
  await expect(page.locator('.story-tile')).toHaveCount(SLUGS.length);
  await expect(page.locator('.story-tile__map')).toHaveCount(SLUGS.length, { timeout: 15_000 });
  const deks = await page.locator('.story-tile__dek').allInnerTexts();
  for (const d of deks) {
    expect(d.length, 'dek rendered').toBeGreaterThan(40);
    expect(d).not.toMatch(/[{}]/);
  }
  for (const slug of SLUGS) await expect(page.locator(`a[href="#/stories/${slug}"]`)).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await settle(page);
  await shot(page, testInfo, 'stories-index');
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const slug of SLUGS) {
  test(`story ${slug}: every step renders from data, graphic follows the text`, async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    const data = story(slug);
    await open(page, slug);
    const steps = page.locator('.story-step');
    const n = await steps.count();
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(9);

    // Every digit in the dek and the steps sits inside a number, an event date or a glossary term.
    const stray = await page.evaluate(() => {
      const bad: string[] = [];
      for (const root of document.querySelectorAll('.story-step__text, .story-dek')) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          // Proper names that contain digits are allowed.
          if (!/\d/.test((node.textContent ?? '').replace(/COVID-19/g, ''))) continue;
          const el = node.parentElement;
          if (el?.closest('.story-num, .story-date, .term, .term-wrap')) continue;
          bad.push((node.textContent ?? '').trim());
        }
      }
      return bad;
    });
    expect(stray, `digits outside data-driven spans: ${stray.join(' | ')}`).toEqual([]);

    // Each number span shows exactly the text from the data file.
    const shown = await page.$$eval('.story-step .story-num[data-key]', (els) =>
      els.map((e) => [(e as HTMLElement).dataset.key!, (e as HTMLElement).dataset.mod ?? '', e.textContent ?? '']),
    );
    expect(shown.length).toBeGreaterThan(10);
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    for (const [key, mod, text] of shown) {
      const num = data.numbers[key!] as unknown as { text: string; bare: string; value: number; year?: number } | undefined;
      expect(num, `number ${key} in data file`).toBeTruthy();
      const expected =
        mod === 'year' ? `FY ${num!.year}` : mod === 'bare' ? num!.bare : mod === 'word' ? words[num!.value] : mod === 'Word' ? words[num!.value]!.replace(/^./, (c) => c.toUpperCase()) : num!.text;
      expect(text, `text of ${key}${mod ? `:${mod}` : ''}`).toBe(expected);
    }

    // No placeholders left, no em-dash anywhere.
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/\{[a-z0-9_]+(:[a-zA-Z]+)?\}/);
    expect(body.includes(String.fromCharCode(0x2014)), 'em-dash in page').toBe(false);

    // Walk every step: it becomes active and the graphic has a description.
    for (let i = 0; i < n; i++) {
      await toStep(page, i);
      const label = await page.locator('.story-figure__frame').getAttribute('aria-label');
      expect(label && label.length > 20, `graphic description at step ${i}`).toBeTruthy();
      await expect(page.locator('.story-view.is-active')).toHaveCount(1);
      const shotSteps = testInfo.project.name === 'desktop' ? [0, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 5, 6];
      if (shotSteps.includes(i)) {
        await page.waitForTimeout(800);
        await shot(page, testInfo, `story-${slug}-step${i + 1}`, false);
      }
    }

    // No horizontal page scroll.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);

    // How we did this: notes, data tables and sources.
    await page.locator('#how-we-did-this').scrollIntoViewIfNeeded();
    await expect(page.locator('.story-method__notes li').first()).toBeVisible();
    expect(await page.locator('.story-data').count()).toBeGreaterThan(0);
    expect(await page.locator('.story-sources li').count()).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    await shot(page, testInfo, `story-${slug}-method`, false);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('derived numbers show their formula on focus; published numbers name their source on hover', async ({ page, isMobile }) => {
  const slug = 'rocket-docket';
  const data = story(slug);
  await open(page, slug);
  const derived = page.locator('.story-step button.story-num--derived').first();
  const key = await derived.getAttribute('data-key');
  await derived.focus();
  const pop = page.locator('.num-pop[data-open="true"]');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('Derived');
  await expect(pop).toContainText(data.numbers[key!]!.formula!);
  await page.keyboard.press('Escape');
  await expect(page.locator('.num-pop[data-open="true"]')).toHaveCount(0);
  if (!isMobile) {
    const published = page.locator('.story-step span.story-num:not(.story-num--name)').first();
    await published.hover();
    await expect(page.locator('.num-pop[data-open="true"]')).toContainText('As published');
    await expect(page.locator('.num-pop[data-open="true"]')).toContainText('Source');
  }
});

test('reduced motion: graphic changes are instant', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await open(page, 'patent-capital');
  const dur = await page.locator('.story-view').first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
  await toStep(page, 1);
  // The map is drawn at once (no zoom animation pending).
  await expect(page.locator('.story-view--map.is-active')).toBeVisible();
  await ctx.close();
});

test('dark mode story', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, 'border-districts');
  await toStep(page, 0);
  await page.waitForTimeout(700);
  await shot(page, testInfo, 'story-border-districts-dark-map', false);
  await toStep(page, 5);
  await page.waitForTimeout(700);
  await shot(page, testInfo, 'story-border-districts-dark-dots', false);
  await page.goto('./#/stories');
  await expect(page.locator('.story-tile__map')).toHaveCount(SLUGS.length, { timeout: 15_000 });
  await settle(page);
  await shot(page, testInfo, 'stories-index-dark', false);
});

test('unknown story shows a designed not-found state', async ({ page }) => {
  await page.goto('./#/stories/not-a-story');
  await expect(page.locator('h1')).toHaveText('Story not found');
});
