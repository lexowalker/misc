// Checks the map's 5-step quantile palettes (light + dark) defined in src/styles/tokens.css:
//  * perceptual spacing: CIEDE2000 between adjacent steps, for normal vision and simulated
//    protanopia, deuteranopia and tritanopia (Machado, Oliveira & Fernandes 2009, severity 1.0,
//    applied in linear sRGB);
//  * monotonic lightness (CIELAB L*), so order survives any color-vision deficiency and grayscale;
//  * WCAG contrast of each step against the page background and the district border color,
//    and of the No-data hatch against the background.
// Usage: node scripts/check-palette.mjs   (exits 1 if a hard requirement fails)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function block(selectorRe) {
  const m = css.match(selectorRe);
  if (!m) throw new Error('block not found: ' + selectorRe);
  return m[1];
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2];
  return out;
}
const light = vars(block(/\/\*\s*@palette light\s*\*\/([\s\S]*?)\/\*\s*@end\s*\*\//));
const dark = vars(block(/\/\*\s*@palette dark\s*\*\/([\s\S]*?)\/\*\s*@end\s*\*\//));

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lum = (rgb) => {
  const [r, g, b] = rgb.map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [lum(hexToRgb(a)), lum(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(toLin);
  let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  let z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function dE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1p = h(a1p, b1), h2p = h(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0; else if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) hpm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
const CVD = {
  normal: null,
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
function simulate(hex, m) {
  const rgb = hexToRgb(hex);
  if (!m) return rgb;
  const l = rgb.map(toLin);
  const o = [0, 1, 2].map((i) => m[i * 3] * l[0] + m[i * 3 + 1] * l[1] + m[i * 3 + 2] * l[2]);
  return o.map((c) => fromLin(Math.min(1, Math.max(0, c))));
}
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

let failed = false;
function report(name, p) {
  const steps = [0, 1, 2, 3, 4].map((i) => p[`map-q${i}`]);
  console.log(`\n== ${name} ==  bg ${p['map-bg']}  border ${p['map-border']}  no-data ${p['map-nodata']} / ${p['map-nodata-line']}`);
  console.log('steps:', steps.join(' '));
  console.log('L*   :', steps.map((h) => rgbToLab(hexToRgb(h))[0].toFixed(1)).join('  '));
  for (const [cvd, m] of Object.entries(CVD)) {
    const labs = steps.map((h) => rgbToLab(simulate(h, m)));
    const d = labs.slice(1).map((lab, i) => dE2000(labs[i], lab));
    const min = Math.min(...d);
    const sim = steps.map((h) => toHex(simulate(h, m))).join(' ');
    console.log(`${cvd.padEnd(13)} adjacent ΔE00 ${d.map((v) => v.toFixed(1)).join(' / ')}  (min ${min.toFixed(1)})  ${m ? 'sim ' + sim : ''}`);
    if (min < 10) { failed = true; console.log('   FAIL: adjacent steps closer than ΔE00 10'); }
    const L = labs.map((l) => l[0]);
    const mono = L.every((v, i) => i === 0 || v < L[i - 1]) || L.every((v, i) => i === 0 || v > L[i - 1]);
    if (!mono) { failed = true; console.log('   FAIL: lightness not monotonic'); }
  }
  console.log('contrast vs bg     :', steps.map((h) => contrast(h, p['map-bg']).toFixed(2)).join('  '));
  console.log('contrast vs border :', steps.map((h) => contrast(h, p['map-border']).toFixed(2)).join('  '));
  const nd = contrast(p['map-nodata'], p['map-nodata-line']);
  console.log(`no-data hatch line vs fill: ${nd.toFixed(2)}; no-data fill vs bg: ${contrast(p['map-nodata'], p['map-bg']).toFixed(2)}`);
  const ndLab = rgbToLab(hexToRgb(p['map-nodata']));
  const nearest = Math.min(...steps.map((h) => dE2000(ndLab, rgbToLab(hexToRgb(h)))));
  console.log(`no-data fill ΔE00 to nearest step: ${nearest.toFixed(1)} (chroma ${Math.hypot(ndLab[1], ndLab[2]).toFixed(1)}; the hatch, not hue, carries the meaning)`);
  const extreme = name === 'light' ? steps[0] : steps[0];
  console.log(`lowest step vs background: ${contrast(extreme, p['map-bg']).toFixed(2)} (must read as a filled shape against the page)`);
}
report('light', light);
report('dark', dark);
console.log(failed ? '\nPALETTE CHECK FAILED' : '\nPALETTE CHECK OK');
process.exit(failed ? 1 : 0);
