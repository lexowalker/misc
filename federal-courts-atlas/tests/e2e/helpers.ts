import type { Page, TestInfo } from '@playwright/test';
import path from 'node:path';

export const SHOTS = path.join('tests', 'e2e', '__screenshots__');

/**
 * Save a screenshot under tests/e2e/__screenshots__/<project>/<name>.jpg.
 * JPEG (q80) keeps the full set small enough to commit; these are review captures
 * for the UI audit, not pixel-diff baselines (the data changes as lanes publish).
 */
export async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = true): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, testInfo.project.name, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage, animations: 'disabled' });
}

/** Collect console errors, ignoring expected 404s for data files not yet built. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/Failed to load resource: .*404/.test(t)) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Wait for fonts and the map (if any) to settle before a screenshot. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}
