// node video/build-video.mjs → writes video/explainer.html (open it, or render with video/render.cjs)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as BZ from "../content/business.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const cache = JSON.parse(readFileSync(join(HERE, "../dist/turn-cache.json"), "utf8"));
const k = (v) => "$" + String(Math.round(v / 100) / 10).replace(/\.0$/, "") + "k";
const d = (v) => "$" + Math.round(v).toLocaleString("en-US");
const cash = BZ.MOVER_BOM.reduce((s, r) => s + r.qty * r.unit, 0);
const lab = BZ.MOVER_LABOR.reduce((s, r) => [s[0] + (r.flat ? r.rate[0] : r.hours[0] * r.rate[0]), s[1] + (r.flat ? r.rate[1] : r.hours[1] * r.rate[1])], [0, 0]);
const run = (r) => { const oL = r.oneTime.reduce((s, x) => s + x.lo, 0), oH = r.oneTime.reduce((s, x) => s + x.hi, 0); const uL = r.unit.reduce((s, x) => s + x.lo, 0) * (1 + r.freight[0]), uH = r.unit.reduce((s, x) => s + x.hi, 0) * (1 + r.freight[1]); return { uL, uH, cL: oL + r.qty * uL, cH: oH + r.qty * uH }; };
const [r100, r1000] = BZ.MOVER_RUNS.runs.map(run);
// Narration timing (optional): word timestamps from the ElevenLabs transcript of voiceover.mp3.
// Each scene is cut halfway through the pause before its paragraph; subtitles are grouped from the words.
let timing = null, subs = null;
try {
  const words = JSON.parse(readFileSync(join(HERE, "voiceover-words.json"), "utf8")).words.filter((w) => w.type === "word");
  const cues = ["Home", "Picture", "Here's", "Inside,", "But", "What", "Now,", "Building", "So", "Home"];
  const starts = []; let wi = 0;
  for (const c of cues) { while (wi < words.length && words[wi].text !== c) wi++; starts.push(wi); wi++; }
  const audioEnd = words[words.length - 1].end + 2.8;
  const bounds = [0, ...starts.slice(1).map((i) => (words[i - 1].end + words[i].start) / 2), audioEnd];
  timing = bounds.slice(1).map((b, i) => +(b - bounds[i]).toFixed(3));
  subs = [];
  starts.forEach((si, p) => {
    const end = p + 1 < starts.length ? starts[p + 1] : words.length;
    let cur = [];
    const flush = () => { if (cur.length) subs.push([+cur[0].start.toFixed(2), +(cur[cur.length - 1].end + 0.25).toFixed(2), cur.map((w) => w.text).join(" ")]); cur = []; };
    for (let i = si; i < end; i++) {
      const w = words[i], len = cur.map((x) => x.text).join(" ").length;
      if (cur.length && len + w.text.length > 70) flush();
      cur.push(w);
      const n = cur.map((x) => x.text).join(" ").length;
      if ((/[.?!:]$/.test(w.text) && n > 24) || (/,$/.test(w.text) && n > 38)) flush();
    }
    flush();
  });
} catch (e) { console.log("no voiceover timing:", e.message); }
// Cue maps, scene-relative: [seconds into the scene's narration, seconds of the scene's animation].
// Each pairs a spoken cue (from the transcript) with the animation moment it describes.
let warp = null;
if (timing) {
  const words = JSON.parse(readFileSync(join(HERE, "voiceover-words.json"), "utf8")).words.filter((w) => w.type === "word");
  const sceneStart = timing.map((_, i) => timing.slice(0, i).reduce((a, b) => a + b, 0));
  const at = (scene, word, nth = 0) => { const hits = words.filter((w) => w.text === word && w.start >= sceneStart[scene] && w.start < sceneStart[scene] + timing[scene]); return +(hits[nth].start - sceneStart[scene]).toFixed(2); };
  warp = {
    2: [[at(2, "First,"), 0.3], [at(2, "Next,"), 3.8], [at(2, "then"), 5.9], [at(2, "You"), 7.8], [at(2, "destination,"), 12.2], [at(2, "pull"), 14.7]],
    3: [[at(3, "Moving"), 1], [at(3, "because"), 5], [at(3, "crank"), 7.5]],
    4: [[at(4, "only"), 0.6], [at(4, "Wheels"), 3.6], [at(4, "ramp"), 9.2], [at(4, "hard"), 12.6]],
    6: [[at(6, "People"), 0.5], [at(6, "We"), 7.6], [at(6, "competitor"), 10]],
    7: [[at(7, "tested"), 0.4], [at(7, "hundred-unit"), 2.6], [at(7, "units,"), 4.8], [at(7, "certification"), 7.5]],
    8: [[at(8, "Start"), 0.6], [at(8, "Watch"), 2], [at(8, "If", 0), 4], [at(8, "If", 1), 6], [at(8, "cheap"), 8]],
  };
}
const V = {
  timing, subs, warp,
  turn: cache.turn.samples.map((t) => [Math.round(t.x), Math.round(t.y), +t.ph.toFixed(1)]),
  minClear: Math.round(cache.turn.minClear), longest: Math.round(cache.longest),
  protoCash: cash, protoLab: `${k(lab[0])}–${k(lab[1])}`, proto: `${k(cash + lab[0])}–${k(cash + lab[1])}`,
  p100: `${k(r100.cL)}–${k(r100.cH)}`, l100: `${d(r100.uL)}–${d(r100.uH)}`,
  p1000: `${k(r1000.cL)}–${k(r1000.cH)}`, l1000: `${d(r1000.uL)}–${d(r1000.uH)}`,
};
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Home Lift &amp; Mover explainer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>html,body{margin:0;background:#F2F4F8}svg{display:block;width:100vw;max-width:1280px;height:auto}</style></head>
<body><svg id="v" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg"></svg>
<script>window.V=${JSON.stringify(V)};</script><script>${readFileSync(join(HERE, "scenes.js"), "utf8")}</script>
<script>if(!navigator.webdriver){const t0=performance.now();(function f(){renderAt(((performance.now()-t0)/1000)%TOTAL);requestAnimationFrame(f)})()}else renderAt(0)</script></body></html>`;
writeFileSync(join(HERE, "explainer.html"), html);
console.log("wrote video/explainer.html", V.proto, V.p100, V.l100, V.p1000, V.l1000, V.minClear, V.longest);
