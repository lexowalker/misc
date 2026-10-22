// node render.mjs stills t1 t2 ...            -> build/still_<t>.jpg
// node render.mjs sheet t0 t1 step            -> build/sheet_<t0>.jpg (contact sheet of small frames)
// node render.mjs frames [workers] [from] [to] -> build/frames/%05d.jpg (24 fps, seconds range)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, 'index.html');
const [mode = 'stills', ...rest] = process.argv.slice(2);
fs.mkdirSync(path.join(here, 'build'), { recursive: true });
const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--disable-lcd-text'];

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && console.error('console', m.text()));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => window.init());
  return { page, info };
}

if (mode === 'stills') {
  const browser = await chromium.launch({ args: ARGS });
  const { page } = await openPage(browser);
  for (const t of rest) {
    const t0 = Date.now();
    await page.evaluate(t => window.render(t), +t);
    await page.screenshot({ path: path.join(here, 'build', `still_${t}.jpg`), type: 'jpeg', quality: 92 });
    console.log(t, Date.now() - t0, 'ms');
  }
  await browser.close();
} else if (mode === 'sheet') {
  const [a, b, step] = rest.map(Number);
  const browser = await chromium.launch({ args: ARGS });
  const { page } = await openPage(browser);
  const dir = path.join(here, 'build', 'sheet');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let i = 0;
  for (let t = a; t <= b + 1e-6; t += step) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: path.join(dir, String(i++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 85 });
  }
  await browser.close();
  console.log('sheet frames', i);
} else {
  const workers = +(rest[0] || 2);
  const dir = path.join(here, 'build', 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const browsers = await Promise.all(Array.from({ length: workers }, () => chromium.launch({ args: ARGS })));
  const pages = await Promise.all(browsers.map(b => openPage(b)));
  const total = pages[0].info.total, fps = 24;
  const n = Math.ceil(total * fps);
  const from = rest[1] ? Math.floor(+rest[1] * fps) : 0, to = rest[2] ? Math.min(n, Math.ceil(+rest[2] * fps)) : n;
  console.log(`frames ${from}..${to} of ${n}`);
  let next = from, done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async ({ page }) => {
    while (next < to) {
      const i = next++;
      const f = path.join(dir, String(i).padStart(5, '0') + '.jpg');
      if (fs.existsSync(f) && fs.statSync(f).size > 0) { done++; continue; }
      await page.evaluate(t => window.render(t), i / fps);
      await page.screenshot({ path: f + '.tmp', type: 'jpeg', quality: 94 });
      fs.renameSync(f + '.tmp', f);
      if (++done % 120 === 0) console.log(done, '/', to - from, ((Date.now() - t0) / done).toFixed(0) + 'ms/frame', new Date().toISOString());
    }
  }));
  await Promise.all(browsers.map(b => b.close()));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
