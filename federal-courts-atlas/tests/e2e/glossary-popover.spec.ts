import { test, expect, type Page } from '@playwright/test';

// The glossary popover (src/components/glossary.ts), on the Learn page's criminal case steps, where terms sit in
// running text. Mouse: hovering opens it after a short delay; a click pins it open, including a click on a term
// that hovering had already opened (it used to close it); a second click, Escape or a click elsewhere closes it.
// Keyboard: focus opens it, Enter and Space toggle it, Escape closes it and leaves focus on the term. Touch: a tap
// opens it, a second tap or a tap elsewhere closes it.

const HIDE_DELAY = 400; // longer than the popover's 160 ms hide delay

async function openLearn(page: Page) {
  await page.goto('./#/learn');
  const item = page.locator('.learn-steps li', { hasText: 'Arraignment.' });
  const term = item.locator('button.term[data-term="arraignment"]');
  await term.scrollIntoViewIfNeeded();
  await expect(term).toBeVisible();
  return { item, term, pop: page.locator('.gloss-pop') };
}

test('glossary popover: a click after hovering keeps it open; a second click, Escape or a click elsewhere closes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mouse hover; touch is tested below');
  const { item, term, pop } = await openLearn(page);
  // Hover opens it.
  await term.hover();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await expect(pop).toContainText('enters a plea');
  await expect(term).toHaveAttribute('aria-expanded', 'true');
  // The click that follows pins it instead of closing it...
  await term.click();
  await page.waitForTimeout(HIDE_DELAY);
  await expect(pop).toHaveAttribute('data-open', 'true');
  await expect(term).toHaveAttribute('aria-expanded', 'true');
  // ...so it stays open when the pointer leaves the term.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(HIDE_DELAY);
  await expect(pop).toHaveAttribute('data-open', 'true');
  // A second click on the term closes it, and it stays closed: the click comes right after the pointer enters the
  // term, so the hover-open delay (120 ms) is still pending and must not reopen it (third recheck, Nov 27).
  await term.click();
  await expect(pop).toHaveAttribute('data-open', 'false');
  await expect(term).toHaveAttribute('aria-expanded', 'false');
  await page.waitForTimeout(HIDE_DELAY);
  await expect(pop).toHaveAttribute('data-open', 'false');

  // Hover, click, then Escape: closed, focus on the term.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(HIDE_DELAY);
  await term.hover();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await term.click();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.keyboard.press('Escape');
  await expect(pop).toHaveAttribute('data-open', 'false');
  await expect(term).toBeFocused();

  // Pinned by a click, then a click elsewhere on the page closes it.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(HIDE_DELAY);
  await term.click();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(HIDE_DELAY);
  await expect(pop).toHaveAttribute('data-open', 'true');
  await item.click({ position: { x: 4, y: 4 } });
  await expect(pop).toHaveAttribute('data-open', 'false');

  // Hover alone still closes when the pointer leaves.
  await term.hover();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.mouse.move(2, 2);
  await expect(pop).toHaveAttribute('data-open', 'false');
});

test('glossary popover: keyboard focus opens it, Enter and Space toggle it, Escape closes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard');
  const { term, pop } = await openLearn(page);
  await term.focus();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.keyboard.press('Enter');
  await expect(pop).toHaveAttribute('data-open', 'false');
  await page.keyboard.press('Enter');
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.keyboard.press(' ');
  await expect(pop).toHaveAttribute('data-open', 'false');
  await page.keyboard.press(' ');
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.keyboard.press('Escape');
  await expect(pop).toHaveAttribute('data-open', 'false');
  await expect(term).toBeFocused();
  await expect(term).toHaveAttribute('aria-expanded', 'false');
});

test('glossary popover: a tap opens it, a second tap or a tap elsewhere closes it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'touch');
  const { item, term, pop } = await openLearn(page);
  await term.tap();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await page.waitForTimeout(HIDE_DELAY);
  await expect(pop).toHaveAttribute('data-open', 'true');
  await term.tap();
  await expect(pop).toHaveAttribute('data-open', 'false');
  await term.tap();
  await expect(pop).toHaveAttribute('data-open', 'true');
  await item.tap({ position: { x: 4, y: 4 } });
  await expect(pop).toHaveAttribute('data-open', 'false');
});
