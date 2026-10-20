// Usage: node render.mjs stills t1 t2 ...   -> build/still_<t>.png
//        node render.mjs frames [fps] [workers] -> build/frames/%05d.jpg + build/sfx.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, 'index.html');
const [mode = 'stills', ...rest] = process.argv.slice(2);

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
  const fps = +(rest[0] || 30), workers = +(rest[1] || 4);
  const dir = path.join(here, 'build', 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { page: p0, info } = await openPage(browser);
  fs.writeFileSync(path.join(here, 'build', 'sfx.json'), JSON.stringify(await p0.evaluate(() => window.SFX)));
  const n = Math.ceil(info.total * fps);
  console.log(`${n} frames`);
  const pages = [p0, ...(await Promise.all(Array.from({ length: workers - 1 }, () => openPage(browser)))).map(x => x.page)];
  let next = 0, done = 0;
  await Promise.all(pages.map(async page => {
    // each page renders frames in order so per-frame caches stay valid
    while (next < n) {
      const i = next++;
      await page.evaluate(t => window.render(t), i / fps);
      await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 98 });
      if (++done % 300 === 0) console.log(done, '/', n);
    }
  }));
}
await browser.close();
