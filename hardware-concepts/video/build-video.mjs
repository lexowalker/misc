// node video/build-video.mjs [mover|toolkit]  → writes the explainer page for that product
//   mover:   video/explainer.html          (voiceover.mp3, voiceover-words.json)
//   toolkit: video/toolkit-explainer.html  (toolkit-voiceover.mp3, toolkit-voiceover-words.json)
// Open the page to watch it live, or render it with video/render.cjs.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as BZ from "../content/business.mjs";
import { DRIVER } from "../content/model.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const product = process.argv[2] || "mover";
const k = (v) => "$" + String(Math.round(v / 100) / 10).replace(/\.0$/, "") + "k";
const d = (v) => "$" + Math.round(v).toLocaleString("en-US");
const run = (r) => { const oL = r.oneTime.reduce((s, x) => s + x.lo, 0), oH = r.oneTime.reduce((s, x) => s + x.hi, 0); const uL = r.unit.reduce((s, x) => s + x.lo, 0) * (1 + r.freight[0]), uH = r.unit.reduce((s, x) => s + x.hi, 0) * (1 + r.freight[1]); return { uL, uH, cL: oL + r.qty * uL, cH: oH + r.qty * uH }; };
function costs(bom, labor, runs) {
  const cash = bom.reduce((s, r) => s + r.qty * r.unit, 0);
  const stage0 = bom.filter((r) => r.stage === 0).reduce((s, r) => s + r.qty * r.unit, 0);
  const lab = labor.reduce((s, r) => [s[0] + (r.flat ? r.rate[0] : r.hours[0] * r.rate[0]), s[1] + (r.flat ? r.rate[1] : r.hours[1] * r.rate[1])], [0, 0]);
  const [r100, r1000] = runs.runs.map(run);
  return {
    protoCash: cash, stage0: d(stage0), protoLab: `${k(lab[0])}–${k(lab[1])}`, proto: `${k(cash + lab[0])}–${k(cash + lab[1])}`,
    p100: `${k(r100.cL)}–${k(r100.cH)}`, l100: `${d(r100.uL)}–${d(r100.uH)}`,
    p1000: `${k(r1000.cL)}–${k(r1000.cH)}`, l1000: `${d(r1000.uL)}–${d(r1000.uH)}`,
  };
}

const CFG = {
  mover: {
    title: "Home Lift &amp; Mover explainer", scenes: "mover-scenes.js", out: "explainer.html", words: "voiceover-words.json",
    // first word of each narration paragraph, one per scene
    cues: ["Home", "Picture", "Here's", "Inside", "But", "What", "Now", "Building", "So", "Home"],
    // [scene, spoken word, nth occurrence in that scene, animation second it pins]
    pins: [[2, "First", 0, 0.3], [2, "Next", 0, 3.8], [2, "then", 0, 5.9], [2, "You", 0, 7.8], [2, "destination", 0, 12.2], [2, "pull", 0, 14.7],
      [3, "Moving", 0, 1], [3, "because", 0, 5], [3, "crank", 0, 7.5],
      [4, "only", 0, 0.6], [4, "Wheels", 0, 3.6], [4, "ramp", 0, 9.2], [4, "hard", 0, 12.6],
      [6, "People", 0, 0.5], [6, "We", 0, 7.6], [6, "competitor", 0, 10],
      [7, "tested", 0, 0.4], [7, "hundred-unit", 0, 2.6], [7, "units", 0, 4.8], [7, "certification", 0, 7.5],
      [8, "Start", 0, 0.6], [8, "Watch", 0, 2], [8, "If", 0, 4], [8, "If", 1, 6], [8, "cheap", 0, 8]],
    data: () => {
      const cache = JSON.parse(readFileSync(join(HERE, "../dist/turn-cache.json"), "utf8"));
      return { turn: cache.turn.samples.map((t) => [Math.round(t.x), Math.round(t.y), +t.ph.toFixed(1)]), minClear: Math.round(cache.turn.minClear), longest: Math.round(cache.longest), ...costs(BZ.MOVER_BOM, BZ.MOVER_LABOR, BZ.MOVER_RUNS) };
    },
  },
  toolkit: {
    title: "Modular Power Toolkit explainer", scenes: "toolkit-scenes.js", out: "toolkit-explainer.html", words: "toolkit-voiceover-words.json",
    cues: ["The", "Start", "Here's", "This", "So", "What", "Now", "The", "So", "The"],
    // the transcript's mis-hearings, fixed in the subtitles only
    fixes: [["Tool Kit", "Toolkit"], ["tool kit", "toolkit"], ["Flexiclic", "FlexiClick"], ["headlands", "head lands"], ["$19 to $40,000", "$19,000 to $40,000"], ["Right angle", "Right-angle"], ["right angle", "right-angle"], ["ball end", "ball-end"], ["hundred unit", "hundred-unit"], ["Installation Driver", "installation driver"], ["Newtons", "newtons"], ["once in a while", "once-in-a-while"]],
    pins: [[1, "Plumbers", 0, 6],
      [2, "compact", 0, 5], [2, "ball", 0, 10], [2, "turning", 0, 11],
      [3, "shaft", 0, 1.5], [3, "crown", 0, 3], [3, "bit", 0, 5], [3, "slides", 0, 8], [3, "drops", 0, 12.2], [3, "spins", 0, 13.2], [3, "Your", 0, 18],
      [4, "battery", 0, 0.8], [4, "coupling", 0, 3.8], [4, "hinge", 0, 5], [4, "phase", 0, 10.5],
      [5, "only", 0, 1], [5, "straight-line", 1, 7.5], [5, "palm", 0, 11.5], [5, "paused", 0, 14.5],
      [6, "adapters", 0, 0.5], [6, "Our", 0, 5.4], [6, "strongest", 0, 10],
      [7, "prototype", 0, 0.4], [7, "hundred", 0, 3], [7, "thousand", 0, 6],
      [8, "Develop", 0, 0.6], [8, "next", 0, 2.5], [8, "Measure", 0, 5], [8, "If", 0, 7.5], [8, "If", 1, 12.5]],
    data: () => ({ tk: { ...costs(BZ.TOOLKIT_BOM, BZ.TOOLKIT_LABOR, BZ.TOOLKIT_RUNS), seconds: DRIVER.seconds, reactN: DRIVER.reactN } }),
  },
}[product];

const bare = (s) => s.replace(/^[^\w']+|[^\w'-]+$/g, "");
// Narration timing (optional): word timestamps from the ElevenLabs transcript of the voiceover.
// Each scene is cut halfway through the pause before its paragraph; subtitles are grouped from the words;
// pins map spoken words to the animation moments they describe.
let timing = null, subs = null, warp = null;
if (existsSync(join(HERE, CFG.words))) {
  const words = JSON.parse(readFileSync(join(HERE, CFG.words), "utf8")).words.filter((w) => w.type === "word");
  const starts = []; let wi = 0;
  for (const [ci, c] of CFG.cues.entries()) {
    // a paragraph starts on its cue word after a pause (the first one starts at the top)
    while (wi < words.length && !(bare(words[wi].text) === c && (ci === 0 || words[wi].start - words[wi - 1].end > 0.45))) wi++;
    if (wi >= words.length) throw new Error(`cue "${c}" (scene ${ci + 1}) not found`);
    starts.push(wi); wi++;
  }
  const bounds = [0, ...starts.slice(1).map((i) => (words[i - 1].end + words[i].start) / 2), words[words.length - 1].end + 2.8];
  timing = bounds.slice(1).map((b, i) => +(b - bounds[i]).toFixed(3));
  subs = [];
  starts.forEach((si, p) => {
    const end = p + 1 < starts.length ? starts[p + 1] : words.length;
    let cur = [];
    const text = () => cur.map((x) => x.text).join(" ");
    const fix = (t) => (CFG.fixes || []).reduce((x, [a, b]) => x.split(a).join(b), t);
    const flush = () => { if (cur.length) subs.push([+cur[0].start.toFixed(2), +(cur[cur.length - 1].end + 0.25).toFixed(2), fix(text())]); cur = []; };
    for (let i = si; i < end; i++) {
      const w = words[i];
      if (cur.length && text().length + w.text.length > 70) flush();
      cur.push(w);
      if ((/[.?!:]$/.test(w.text) && text().length > 24) || (/,$/.test(w.text) && text().length > 38)) flush();
    }
    flush();
  });
  warp = {};
  for (const [sc, word, nth, animT] of CFG.pins) {
    const hits = words.filter((w) => bare(w.text) === word && w.start >= bounds[sc] && w.start < bounds[sc + 1]);
    if (!hits[nth]) throw new Error(`pin "${word}" #${nth} not found in scene ${sc + 1}`);
    (warp[sc] ||= []).push([+(hits[nth].start - bounds[sc]).toFixed(2), animT]);
  }
}
const V = { timing, subs, warp, ...CFG.data() };
const js = ["lib-head.js", CFG.scenes, "lib-tail.js"].map((f) => readFileSync(join(HERE, f), "utf8")).join("\n");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${CFG.title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>html,body{margin:0;background:#F2F4F8}svg{display:block;width:100vw;max-width:1280px;height:auto}</style></head>
<body><svg id="v" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg"></svg>
<script>window.V=${JSON.stringify(V)};</script><script>${js}</script>
<script>if(!navigator.webdriver){const t0=performance.now();(function f(){renderAt(((performance.now()-t0)/1000)%TOTAL);requestAnimationFrame(f)})()}else renderAt(0)</script></body></html>`;
writeFileSync(join(HERE, CFG.out), html);
console.log(`wrote video/${CFG.out}`, timing ? `narrated, ${timing.reduce((a, b) => a + b, 0).toFixed(1)} s` : "silent");
