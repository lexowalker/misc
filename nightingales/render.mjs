// Captures the canvas film with Playwright.
//   node render.mjs stills 12.5 80 200      → build/still_<t>.png for each time
//   node render.mjs video 30 4              → build/video.mp4 (silent), rendered in 4 parallel chunks
// Also writes build/cues.json (sound cues) for audio.py.
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const [mode = 'stills', ...args] = process.argv.slice(2);

// a tiny static server so the page can load fonts and images
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/index.html`;

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto(URL0);
  await p.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  return p;
}
const grab = (p, t) => p.evaluate(t => { window.render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, t)
  .then(u => Buffer.from(u.split(',')[1], 'base64'));

const browser = await pw.chromium.launch({ args: ['--disable-gpu-vsync'] });
const first = await page(browser);
const { duration, cues } = await first.evaluate(() => ({ duration: TL.duration, cues: window.CUES }));
fs.writeFileSync(path.join(ROOT, 'build/cues.json'), JSON.stringify(cues, null, 1));

if (mode === 'stills') {
  for (const a of args) {
    const t = +a, buf = await grab(first, t);
    fs.writeFileSync(path.join(ROOT, `build/still_${a}.jpg`), buf);
    console.log('still', a);
  }
} else if (mode === 'video') {
  const fps = +(args[0] || 30), workers = +(args[1] || 4), N = Math.ceil(duration * fps);
  const per = Math.ceil(N / workers), t0 = Date.now();
  let done = 0;
  await Promise.all([...Array(workers)].map(async (_, w) => {
    const p = w === 0 ? first : await page(browser);
    const out = path.join(ROOT, `build/chunk_${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = w * per; i < Math.min(N, (w + 1) * per); i++) {
      const buf = await grab(p, i / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 300 === 0) console.log(`${done}/${N} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }));
  fs.writeFileSync(path.join(ROOT, 'build/chunks.txt'), [...Array(workers)].map((_, w) => `file 'chunk_${w}.mp4'`).join('\n'));
  await new Promise(r => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(ROOT, 'build/chunks.txt'), '-c', 'copy', path.join(ROOT, 'build/video.mp4')], { stdio: 'inherit' }).on('close', r));
  console.log('video done', N, 'frames');
}
await browser.close();
server.close();
