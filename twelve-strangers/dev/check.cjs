// Smoke test: node dev/check.cjs <html file> [--width 390] [--height 844] [--theme dark|light] [--shot out.png] [--full] [--wait ms] [--script file.cjs]
// Prints console errors, page errors, failed requests and horizontal overflow. Routes the three.js CDN URL to a local copy
// (set THREE_LOCAL, default: the scratchpad vendor copy) because the sandbox cannot reach the CDN.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const file = path.resolve(args[0]);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
const width = +opt('width', 390), height = +opt('height', 844);
const theme = opt('theme', 'light');
const shot = opt('shot', null);
const wait = +opt('wait', 1200);
const extra = opt('script', null);
const THREE_LOCAL = process.env.THREE_LOCAL || '/tmp/claude-0/-home-user/771062b5-3af2-5bc0-9bce-e36f67d32479/scratchpad/vendor/package/build/three.min.js';

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme === 'dark' ? 'dark' : 'light', hasTouch: flag('touch'), isMobile: flag('touch') });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|GPU stall/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) problems.push(`requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`); });
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/.*three\.min\.js/, (route) => route.fulfill({ path: THREE_LOCAL, contentType: 'application/javascript' }));
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  if (extra) { const fn = require(path.resolve(extra)); await fn(page, { problems, width, height, theme }); }
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (overflow.sw > overflow.iw + 1) {
    const culprits = await page.evaluate(() => {
      const iw = window.innerWidth; const out = [];
      document.querySelectorAll('body *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.right > iw + 1 && r.width > 0) out.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '') + ' right=' + Math.round(r.right)); });
      return out.slice(0, 12);
    });
    problems.push(`overflow: scrollWidth ${overflow.sw} > innerWidth ${overflow.iw}\n   ` + culprits.join('\n   '));
  }
  if (shot) await page.screenshot({ path: shot, fullPage: flag('full') });
  console.log(problems.length ? problems.join('\n') : 'clean: no console errors, page errors, failed requests or overflow');
  await browser.close();
})().catch((e) => { console.error('check failed:', e); process.exit(1); });
