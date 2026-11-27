import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// First map paint: time from navigation start to two frames after the district
// paths are in the DOM (performance mark 'atlas:first-map-paint'). Measured cold
// (no HTTP cache) against `vite preview`, unthrottled and with 4x CPU throttling.
test('first map paint under 2 s', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop measurement only');
  const results: Record<string, unknown> = {};
  for (const throttle of [1, 4]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto('./#/');
    await page.waitForFunction(() => performance.getEntriesByName('atlas:first-map-paint').length > 0, null, { timeout: 20_000 });
    const m = await page.evaluate(() => {
      const get = (n: string) => performance.getEntriesByName(n)[0]?.startTime ?? null;
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const topo = res.find((r) => r.name.includes('districts-lo'));
      const js = res.filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'));
      return {
        firstMapPaint: get('atlas:first-map-paint'),
        mapDomReady: get('atlas:map-dom-ready'),
        firstContentfulPaint: get('first-contentful-paint'),
        topologyKB: topo ? Math.round(topo.encodedBodySize / 1024) : null,
        topologyMs: topo ? Math.round(topo.duration) : null,
        jsKB: Math.round(js.reduce((a, r) => a + (r.encodedBodySize || 0), 0) / 1024),
        hiResRequested: res.some((r) => r.name.includes('districts-hi')),
        threeRequested: res.some((r) => /three/i.test(r.name)),
      };
    });
    results[`cpu_x${throttle}`] = m;
    console.log(`first map paint (cpu x${throttle}):`, JSON.stringify(m));
    expect(m.hiResRequested, 'hi-res topology must not load at national view').toBe(false);
    expect(m.threeRequested, 'three.js must not load on the map').toBe(false);
    if (throttle === 1) expect(m.firstMapPaint!).toBeLessThan(2000);
    await ctx.close();
  }
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/perf.json', JSON.stringify(results, null, 2));
});
