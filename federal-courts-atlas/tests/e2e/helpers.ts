import type { Page, TestInfo } from '@playwright/test';
import path from 'node:path';

export const SHOTS = path.join('tests', 'e2e', '__screenshots__');

/**
 * Save a screenshot under tests/e2e/__screenshots__/<project>/<name>.jpg.
 * JPEG (q80) keeps the full set small enough to commit; these are review captures
 * for the UI audit, not pixel-diff baselines (the data changes as lanes publish).
 */
export async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = true): Promise<void> {
  const file = path.join(SHOTS, testInfo.project.name, `${name}.jpg`);
  if (fullPage) {
    // Chromium cannot encode captures taller than about 16,384 device pixels (long tables on mobile);
    // such pages are captured from the top down to that limit.
    const { h, w, dpr } = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      w: document.documentElement.clientWidth,
      dpr: window.devicePixelRatio || 1,
    }));
    const maxCss = Math.floor(16000 / dpr);
    if (h > maxCss) {
      await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: true, animations: 'disabled', clip: { x: 0, y: 0, width: w, height: maxCss } });
      return;
    }
  }
  await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage, animations: 'disabled' });
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
