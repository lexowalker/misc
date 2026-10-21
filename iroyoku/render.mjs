// Usage: node render.mjs stills t1 t2 ...      -> build/still_<t>.png
//        node render.mjs frames [fps] [workers] -> build/frames/%05d.jpg + build/cues.json
//        node render.mjs frames fps workers from to  (render a sub-range of seconds)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, 'index.html');
const [mode = 'stills', ...rest] = process.argv.slice(2);
fs.mkdirSync(path.join(here, 'build'), { recursive: true });

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  page.on('console', m => m.type() === 'error' && console.error('console', m.text()));
  await page.goto(url);
  const info = await page.evaluate(() => window.init());
  return { page, info };
}

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
if (mode === 'stills') {
  const { page } = await openPage(browser);
  for (const t of rest) {
    await page.evaluate(t => window.render(t), +t);
    await page.screenshot({ path: path.join(here, 'build', `still_${t}.png`) });
  }
} else {
  const fps = +(rest[0] || 24), workers = +(rest[1] || 4);
  const dir = path.join(here, 'build', 'frames');
  const { page: p0, info } = await openPage(browser);
  fs.writeFileSync(path.join(here, 'build', 'cues.json'), JSON.stringify(await p0.evaluate(() => ({ sfx: window.SFX, scenes: window.SCENES, total: window.TOTAL }))));
  const n = Math.ceil(info.total * fps);
  const from = rest[2] ? Math.floor(+rest[2] * fps) : 0, to = rest[3] ? Math.min(n, Math.ceil(+rest[3] * fps)) : n;
  if (!rest[2]) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`frames ${from}..${to} of ${n}`);
  const pages = [p0, ...(await Promise.all(Array.from({ length: workers - 1 }, () => openPage(browser)))).map(x => x.page)];
  let next = from, done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async page => {
    while (next < to) {
      const i = next++;
      await page.evaluate(t => window.render(t), i / fps);
      await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
      if (++done % 240 === 0) console.log(done, '/', to - from, ((Date.now() - t0) / done).toFixed(0) + 'ms/frame');
    }
  }));
}
await browser.close();
