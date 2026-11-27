import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { GLOSSARY, glossaryEntry } from '../../src/content/glossary.ts';
import { PHRASE_TERMS, VARIABLE_TERMS } from '../../src/content/variable-terms.ts';

// Glossary terms on measure labels (brief: "every legal term gets a glossary tooltip"). The first two tests are
// unit checks of src/content/variable-terms.ts against the glossary and the published catalog (the typecheck
// already rejects an unknown term id; this also catches a label that no longer contains the marked words).
// The rest check the labels on the home measure header and switcher, compare rows, the table heading and the
// district profile: a term button that opens its definition by keyboard and by tap, a heading whose accessible
// name is the plain label (the definition is a description, not part of the name), a target at least 24px
// tall, and a label that does not move when terms are added.

const PUB = 'public/data';
const has = fs.existsSync(`${PUB}/variables.json`);
test.skip(!has, 'web data not built (make web)');
type Var = { id: string; label: string; family: string };
const variables: Var[] = has ? JSON.parse(fs.readFileSync(`${PUB}/variables.json`, 'utf8')) : [];
const byId = new Map(variables.map((v) => [v.id, v]));

test('variable-terms: every term exists and every marked phrase is in its label', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data check; runs once');
  const problems: string[] = [];
  for (const [id, refs] of Object.entries(VARIABLE_TERMS)) {
    const v = byId.get(id);
    if (!v) {
      problems.push(`${id}: not in variables.json`);
      continue;
    }
    for (const r of refs) {
      if (!glossaryEntry(r.term)) problems.push(`${id}: unknown term ${r.term}`);
      if (!v.label.toLowerCase().includes(r.text.toLowerCase())) problems.push(`${id}: label "${v.label}" has no "${r.text}"`);
    }
  }
  for (const r of PHRASE_TERMS) if (!glossaryEntry(r.term)) problems.push(`phrase: unknown term ${r.term}`);
  expect(problems).toEqual([]);
  const unmapped = variables.filter((v) => !VARIABLE_TERMS[v.id]).map((v) => v.id);
  testInfo.annotations.push({ type: 'measures without a legal term in their label', description: unmapped.join(', ') || 'none' });
});

test('glossary: ids are unique, cross-references resolve, no em-dashes', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data check; runs once');
  const ids = GLOSSARY.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const g of GLOSSARY) {
    for (const s of g.see ?? []) expect(glossaryEntry(s), `${g.id} -> ${s}`).toBeTruthy();
    expect(`${g.term} ${g.definition} ${g.cite ?? ''}`, g.id).not.toContain(String.fromCharCode(0x2014));
  }
});

test('home: measure header and switcher carry glossary terms', async ({ page }, testInfo) => {
  const v = byId.get('weighted_filings_per_judgeship');
  test.skip(!v, 'measure not published');
  await page.goto('./#/?v=weighted_filings_per_judgeship');
  const title = page.locator('.home-measure__title');
  await expect(title.locator('button.term')).toHaveCount(2);
  await expect(title.locator('button.term').first()).toHaveAttribute('data-term', 'weighted-filings');
  // The heading's name is the label itself; the definitions are descriptions.
  await expect(page.getByRole('heading', { level: 2, name: v!.label, exact: true })).toBeVisible();
  const t = title.locator('button.term').first();
  const box = (await t.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(24);
  if (testInfo.project.name === 'mobile') await t.tap();
  else await t.focus();
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.gloss-pop')).toContainText('case weights');
  const desc = await t.getAttribute('aria-describedby');
  await expect(page.locator(`#${desc}`)).toContainText('case weights');
  await page.keyboard.press('Escape');
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'false');
  // The switcher lists the family's terms under the thumbnails.
  const row = page.locator('.vswitch__terms');
  await expect(row).toBeVisible();
  await expect(row.locator('button.term[data-term="judgeship"]')).toHaveCount(1);
  await expect(row.locator('button.term[data-term="vacant-judgeship-months"]')).toHaveCount(1);
});

test('home: punctuation stays with a term and the label does not move', async ({ page }) => {
  const v = byId.get('substantial_assistance_pct');
  test.skip(!v, 'measure not published');
  await page.goto('./#/?v=substantial_assistance_pct');
  const title = page.locator('.home-measure__title');
  await expect(title.locator('button.term[data-term="5k1-1"]')).toHaveCount(1);
  // "(" and ")" sit on the same line as "§5K1.1".
  await expect(title.locator('.term-nowrap')).toHaveText('(§5K1.1)');
  // Same height as the same heading with each term turned back into plain text, rendered in the same place.
  const heights = await title.evaluate((el) => {
    const withTerms = el.getBoundingClientRect().height;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('.term-wrap').forEach((w) => w.replaceWith(document.createTextNode(w.textContent ?? '')));
    clone.querySelectorAll('.term-nowrap').forEach((w) => w.replaceWith(document.createTextNode(w.textContent ?? '')));
    el.parentElement!.insertBefore(clone, el);
    const plain = clone.getBoundingClientRect().height;
    clone.remove();
    return { withTerms, plain };
  });
  expect(Math.abs(heights.withTerms - heights.plain)).toBeLessThanOrEqual(1);
});

test('compare, table and profile labels carry glossary terms', async ({ page }) => {
  test.skip(!byId.get('weighted_filings_per_judgeship'), 'measure not published');
  await page.goto('./#/compare?d=vaed,txed');
  const row = page.locator('#cmp-row-weighted_filings_per_judgeship .cmp-measure__label');
  await row.scrollIntoViewIfNeeded().catch(() => undefined);
  if (await row.count()) {
    await expect(row.locator('button.term[data-term="weighted-filings"]')).toHaveCount(1);
    await expect(row).toHaveText(byId.get('weighted_filings_per_judgeship')!.label);
  }
  const anyCmp = page.locator('.cmp-measure__label button.term').first();
  await expect(anyCmp).toBeVisible();

  await page.goto('./#/table/weighted_filings_per_judgeship');
  const h1 = page.locator('h1');
  await expect(h1.locator('button.term')).toHaveCount(2);
  await expect(page.getByRole('heading', { level: 1, name: byId.get('weighted_filings_per_judgeship')!.label, exact: true })).toBeVisible();

  await page.goto('./#/district/vaed');
  const stat = page.locator('.stat__label button.term').first();
  await stat.scrollIntoViewIfNeeded();
  await expect(stat).toBeVisible();
  // The case-mix section renders when it nears the viewport.
  const civil = page.locator('#mix-civil .mix__title button.term[data-term="nature-of-suit"]');
  for (let i = 0; i < 60 && !(await civil.count()); i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(60);
  }
  await civil.scrollIntoViewIfNeeded();
  await expect(civil).toHaveText('nature of suit');
  await civil.focus();
  await expect(page.locator('.gloss-pop')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.gloss-pop')).toContainText('JS 44');
});
