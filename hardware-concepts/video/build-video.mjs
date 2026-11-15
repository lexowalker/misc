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
const V = {
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
