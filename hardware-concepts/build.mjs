// Build: node build.mjs  → writes index.html (standalone page) and dist/artifact.html (body-only variant).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, markerDefs, pathOf } from "./figures/geom.mjs";
import { driverIso, driverInUse, hammerStudy } from "./figures/driver.mjs";
import { moverIso, moverSequence, moverPlan, bestTurn, longestThatTurns, wheelStudy } from "./figures/mover.mjs";
import { DRIVER, MOVER, fmt } from "./content/model.mjs";
import { TOOLKIT_PARTS, MOVER_PARTS } from "./content/parts.mjs";
import * as BZ from "./content/business.mjs";
import { toolkitText, moverText } from "./content/text.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (v) => { const r = Math.round(v * 100) / 100; return "$" + fmt(r, r % 1 ? 2 : 0); };
const usdR = (lo, hi) => (Math.round(lo) === Math.round(hi) ? usd(lo) : `${usd(lo)}–${usd(hi)}`);
const kusd = (v) => (v >= 1000 ? "$" + String(Math.round(v / 100) / 10).replace(/\.0$/, "") + "k" : usd(Math.round(v)));
const kR = (lo, hi) => `${kusd(lo)}–${kusd(hi)}`;
const a = (href, text) => (href ? `<a href="${href}" target="_blank" rel="noopener">${text}</a>` : text);

// ---------- cost maths (all totals derived here) ----------
function bomTotals(rows) {
  const byStage = {};
  rows.forEach((r) => { r.sub = Math.round(r.qty * r.unit * 100) / 100; byStage[r.stage] = (byStage[r.stage] || 0) + r.sub; });
  const total = Object.values(byStage).reduce((s, v) => s + v, 0);
  return { byStage, total };
}
function laborTotals(rows) {
  rows.forEach((r) => { r.lo = r.flat ? r.rate[0] : r.hours[0] * r.rate[0]; r.hi = r.flat ? r.rate[1] : r.hours[1] * r.rate[1]; });
  return { lo: rows.reduce((s, r) => s + r.lo, 0), hi: rows.reduce((s, r) => s + r.hi, 0) };
}
function runTotals(R) {
  return R.runs.map((run) => {
    const oneLo = run.oneTime.reduce((s, r) => s + r.lo, 0), oneHi = run.oneTime.reduce((s, r) => s + r.hi, 0);
    const uLo = run.unit.reduce((s, r) => s + r.lo, 0) * (1 + run.freight[0]);
    const uHi = run.unit.reduce((s, r) => s + r.hi, 0) * (1 + run.freight[1]);
    return { ...run, oneLo, oneHi, uLo, uHi, cashLo: oneLo + run.qty * uLo, cashHi: oneHi + run.qty * uHi };
  });
}

const tkBom = bomTotals(BZ.TOOLKIT_BOM), mvBom = bomTotals(BZ.MOVER_BOM);
const tkLab = laborTotals(BZ.TOOLKIT_LABOR), mvLab = laborTotals(BZ.MOVER_LABOR);
const tkRuns = runTotals(BZ.TOOLKIT_RUNS), mvRuns = runTotals(BZ.MOVER_RUNS);

// ---------- figures ----------
console.time("figures");
const dIso = driverIso();
const dUse = driverInUse();
const hStudy = hammerStudy();
const mIso = moverIso();
const mSeq = moverSequence();
// The turn search is slow (~40 s); cache it keyed by the inputs that change it.
const turnKey = JSON.stringify([MOVER.item.L, MOVER.item.D, MOVER.hall, MOVER.door, MOVER.wall]);
let cache = null;
try { cache = JSON.parse(readFileSync(join(HERE, "dist/turn-cache.json"), "utf8")); } catch {}
if (!cache || cache.key !== turnKey) { cache = { key: turnKey, turn: bestTurn(), longest: longestThatTurns() }; mkdirSync(join(HERE, "dist"), { recursive: true }); writeFileSync(join(HERE, "dist/turn-cache.json"), JSON.stringify(cache)); }
const turn = cache.turn, longest = cache.longest;
const mPlan = moverPlan(turn);
console.timeEnd("figures");

const extra = {
  tkUnit1000: usdR(tkRuns[1].uLo, tkRuns[1].uHi),
  mvUnit1000: usdR(mvRuns[1].uLo, mvRuns[1].uHi),
  tkStage0: usd(tkBom.byStage[0]),
  mvStage0: usd(mvBom.byStage[0]),
};
const TK = toolkitText(extra), MV = moverText(extra);

// ---------- HTML pieces ----------
const FN_LABEL = { motion: "Moving part / force path", power: "Electrical power", control: "Control / sensing", structure: "Housing / structure", hazard: "Hazard control", job: "Work piece" };

function partsKey(parts, tab) {
  let html = "";
  let open = false;
  for (const p of parts) {
    if (p.group) { if (open) html += "</ul>"; html += `<h4 class="key-group">${esc(p.group)}</h4><ul class="key-list">`; open = true; continue; }
    html += `<li><button type="button" class="key-item" data-pid="${p.id}" data-fn="${p.fn}"><span class="key-id">${p.id}</span><span class="key-name">${esc(p.name)}</span><span class="fn-chip" data-fn="${p.fn}" title="${FN_LABEL[p.fn]}"></span></button></li>`;
  }
  return html + "</ul>";
}

function legend(extraItems = "") {
  return `<div class="legend" aria-label="Legend">
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H24" class="lg-force"/><path d="M20 2L26 6L20 10Z" class="lg-force-head"/></svg>Moving part, force path</span>
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H26" class="lg-power"/></svg>Electrical power</span>
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H26" class="lg-control"/></svg>Control, sensing</span>
  <span class="lg"><svg viewBox="0 0 28 12"><rect x="2" y="1" width="24" height="10" class="lg-haz"/></svg>Hazard</span>
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H26" class="lg-src"/></svg>Sourced dimension</span>
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H26" class="lg-tgt"/></svg>Design target</span>
  <span class="lg"><svg viewBox="0 0 28 12"><path d="M2 6H26" class="lg-meas"/></svg>Must be measured</span>
  ${extraItems}</div>`;
}

function judgments(list) {
  return `<div class="judgments">${list.map((j) => `<div class="judg"><div class="judg-k">${j.k}</div><div class="judg-v" data-tone="${j.tone}">${j.v}</div><p>${j.why}</p></div>`).join("")}</div>`;
}

function stagesHtml(stages, bom, labor) {
  return `<ol class="stages">${stages.map((s) => {
    const cash = bom.byStage[s.n] || 0;
    const lab = labor.filter((l) => l.stage === s.n);
    const labLo = lab.reduce((t, l) => t + l.lo, 0), labHi = lab.reduce((t, l) => t + l.hi, 0);
    return `<li class="stage" data-n="${s.n}"><div class="stage-head"><span class="stage-n">${s.n}</span><h4>${s.title}</h4></div>
    <dl class="stage-grid">
      <dt>Buy or make</dt><dd>${s.buy}</dd>
      <dt>Tools and skills</dt><dd>${s.skills}</dd>
      <dt>Who</dt><dd>${s.who}</dd>
      <dt>Time</dt><dd>${s.time}</dd>
      <dt>Founder cash</dt><dd class="num">${usd(cash)}${labLo ? ` <span class="muted">+ paid labour ${kR(labLo, labHi)}</span>` : ""}</dd>
      <dt>Measure</dt><dd>${s.measure}</dd>
      <dt>Pass / fail</dt><dd>${s.pass}</dd>
    </dl></li>`;
  }).join("")}</ol>`;
}

const BASIS = { seen: "listing 2026-11-15", est: "estimate", quote: "quote required" };
function bomTable(rows, totals, labor, laborT) {
  const stageName = ["Stage 0 · disproof", "Stage 1 · bench proof", "Stage 2 · integrated prototype"];
  let body = "";
  [0, 1, 2].forEach((st) => {
    const rs = rows.filter((r) => r.stage === st);
    if (!rs.length) return;
    body += `<tr class="grp"><th colspan="6">${stageName[st]}</th></tr>`;
    body += rs.map((r) => `<tr><td class="mono">${r.pid}</td><td>${a(r.src, esc(r.item))}${r.note ? `<div class="muted small">${esc(r.note)}</div>` : ""}</td><td class="num">${r.qty}</td><td class="num">${usd(r.unit)}</td><td class="num">${usd(r.sub)}</td><td><span class="basis" data-b="${r.basis}">${BASIS[r.basis]}</span></td></tr>`).join("");
    body += `<tr class="sub"><td></td><td>Stage ${st} subtotal</td><td></td><td></td><td class="num">${usd(totals.byStage[st])}</td><td></td></tr>`;
  });
  body += `<tr class="tot"><td></td><td>Founder cash outlay, all stages</td><td></td><td></td><td class="num">${usd(totals.total)}</td><td></td></tr>`;
  const lab = labor.map((l) => `<tr><td class="mono">S${l.stage}</td><td>${a(l.src, esc(l.who))}</td><td class="num">${l.flat ? "flat" : `${l.hours[0]}–${l.hours[1]} h`}</td><td class="num">${l.flat ? "" : `${usd(l.rate[0])}–${usd(l.rate[1])}/h`}</td><td class="num">${kR(l.lo, l.hi)}</td><td><span class="basis" data-b="est">estimate</span></td></tr>`).join("");
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Part</th><th>Item (supplier or comparable)</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Subtotal</th><th>Basis</th></tr></thead><tbody>${body}</tbody></table></div>
  <h4 class="sub-h">Paid engineering and test labour (separate from founder cash)</h4>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stage</th><th>Who</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Cost</th><th>Basis</th></tr></thead><tbody>${lab}<tr class="tot"><td></td><td>Paid labour, all stages</td><td></td><td></td><td class="num">${kR(laborT.lo, laborT.hi)}</td><td></td></tr></tbody></table></div>
  <p class="cash-sum">Total to reach a tested integrated prototype: <strong class="num">${kR(totals.total + laborT.lo, totals.total + laborT.hi)}</strong> (founder cash ${usd(totals.total)} + paid labour ${kR(laborT.lo, laborT.hi)}).</p>`;
}

function runsTable(R, runs) {
  const cols = runs.map((r) => `<th class="num">${fmt(r.qty)} units</th>`).join("");
  const row = (label, f, cls = "") => `<tr class="${cls}"><td>${label}</td>${runs.map((r) => `<td class="num">${f(r)}</td>`).join("")}</tr>`;
  const oneRows = runs[0].oneTime.map((_, i) => row(esc(runs[0].oneTime[i].item.split(" (")[0]), (r) => kR(r.oneTime[i].lo, r.oneTime[i].hi))).join("");
  return `<div class="tbl-wrap"><table class="tbl runs"><thead><tr><th>Each scenario standalone</th>${cols}</tr></thead><tbody>
  <tr class="grp"><th colspan="${runs.length + 1}">One-time</th></tr>${oneRows}
  ${row("One-time total", (r) => kR(r.oneLo, r.oneHi), "sub")}
  <tr class="grp"><th colspan="${runs.length + 1}">Recurring landed cost per unit (incl. freight and duty)</th></tr>
  ${row("Landed per unit", (r) => usdR(r.uLo, r.uHi), "sub")}
  ${row("× quantity", (r) => kR(r.qty * r.uLo, r.qty * r.uHi))}
  ${row("Total cash required", (r) => kR(r.cashLo, r.cashHi), "tot")}
  </tbody></table></div>
  <details class="more"><summary>Per-unit build-up and one-time detail</summary>
  ${runs.map((r) => `<h5>${fmt(r.qty)} units</h5><ul class="tight">${r.oneTime.map((o) => `<li>${esc(o.item)}: ${kR(o.lo, o.hi)} <span class="basis" data-b="est">estimate</span>${o.why ? ` <span class="muted">(${a(o.src, esc(o.why))})</span>` : ""}</li>`).join("")}${r.unit.map((u) => `<li>${esc(u.item)}: ${usdR(u.lo, u.hi)} per unit</li>`).join("")}<li>Freight and duty: ${Math.round(r.freight[0] * 100)}–${Math.round(r.freight[1] * 100)} %</li></ul>`).join("")}
  </details>
  <p class="muted">${R.note} ${R.drivers}</p>`;
}

function compTable(rows) {
  return `<div class="tbl-wrap"><table class="tbl comp"><thead><tr><th>Exact model</th><th>US price (dated)</th><th>Relevant specs</th><th>On the chosen task</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${a(r.link, esc(r.model))}${r.alt ? ` · ${a(r.alt, "alt. listing")}` : ""}${r.link ? `<div class="small">${a(r.link, "product page with image")}</div>` : ""}</td><td class="num">${esc(r.price)}<div class="muted small">${esc(r.basis)}</div></td><td>${esc(r.spec)}</td><td>${esc(r.task)}</td></tr>`).join("")}</tbody></table></div>`;
}

function stdTable(rows) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Standard or rule</th><th>Applicability</th><th>Note</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${a(r.src, esc(r.std))}</td><td><span class="status" data-s="${r.status.startsWith("confirmed") ? "ok" : r.status.startsWith("lab") ? "q" : "ref"}">${esc(r.status)}</span></td><td>${esc(r.note)}</td></tr>`).join("")}</tbody></table></div>`;
}

function choices(list) {
  return `<ul class="choices">${list.map((c) => `<li><span class="mat" data-m="${c.mat ? "y" : "n"}">${c.mat ? "Changes design" : "Minor"}</span><div><strong>${c.c}</strong><div class="muted">${c.why}</div></div></li>`).join("")}</ul>`;
}

function recBox(r) {
  return `<div class="rec"><div class="rec-v"><span class="rec-label">Recommendation</span><span class="rec-word">${r.verdict}</span></div>
  <dl><dt>Next experiment</dt><dd>${r.next}</dd><dt>Budget</dt><dd class="num">${r.budget}</dd><dt>What would change it</dt><dd>${r.change}</dd></dl></div>`;
}

function seg(name, opts, aria) {
  return `<div class="seg" role="radiogroup" aria-label="${aria}">${opts.map(([v, l], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-${name}="${v}">${l}</button>`).join("")}</div>`;
}

// ---------- calculations (expandable) ----------
const d = DRIVER, m = MOVER;
const tkCalc = `
<details class="more"><summary>Driver head: stack, clearance, speed, reaction and gear stress</summary>
<table class="tbl calc"><tbody>
<tr><td>Stack (bit length, through-bore)</td><td class="num">${d.bit} mm</td><td>ISO 1173 C6.3 insert bit is 25 mm ${a(BZ.SRC.iso4762, "")}<span class="basis" data-b="src">sourced</span></td></tr>
<tr><td>Bit protrusion below body</td><td class="num">${d.bit} − ${d.body} = ${d.protrude} mm</td><td><span class="basis" data-b="tgt">target body</span></td></tr>
<tr><td>Void needed</td><td class="num">${d.boltHead} + ${d.stack} + ${d.socketDepth} + 1 = ${fmt(d.voidNeeded, 1)} mm</td><td>M6 head 6 mm (ISO 4762) + stack + hex engagement + sliding margin <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Clearance while sliding in</td><td class="num">${d.void} − (${d.boltHead} + 0.5 + ${d.stack}) = ${fmt(d.slideClear, 1)} mm</td><td><span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Right-angle adapter needs</td><td class="num">${d.raHead} + ${d.boltHead} = ${d.raHead + d.boltHead} mm</td><td>${a(BZ.SRC.ra8510, "Milwaukee 49-22-8510 published 2 in head")}<span class="basis" data-b="src">sourced</span></td></tr>
<tr><td>Output speed</td><td class="num">${d.hostRpm} / ${d.ratio} = ${fmt(d.outRpm)} rpm</td><td>host low gear ${a(BZ.SRC.m2505, "0–400 rpm")} <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Time for ${d.turns} turns (24 mm at 1.0 mm pitch)</td><td class="num">${fmt(d.seconds, 1)} s</td><td><span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Input torque needed at ${d.torque} N·m out</td><td class="num">${d.torque} / ${d.ratio} / 0.9 = ${fmt(d.hostTorque, 2)} N·m</td><td>within a 12 V driver's 34 N·m and the adapter class's 26.5 N·m <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Reaction at the sleeve</td><td class="num">${d.torque} N·m / ${d.sleeveArm / 1000} m = ${fmt(d.reactN, 1)} N</td><td>The support hand pushes this sideways. A comfortable one-hand side push is an estimated 50–100 N. <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Crown gear tooth force</td><td class="num">${d.torque} / 0.013 = ${fmt(d.gear.Ft)} N</td><td>pitch radius 13 mm <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Lewis bending stress</td><td class="num">${fmt(d.gear.Ft)} / (${d.gear.b} × ${d.gear.m} × ${d.gear.Y}) = ${fmt(d.gear.sigma)} MPa</td><td>No dynamic or service factors. Case-hardened 8620 is commonly allowed about 380–450 MPa: marginal, so an engineer must confirm it. <span class="basis" data-b="calc">calc</span></td></tr>
</tbody></table></details>
<details class="more"><summary>Hammer head: clearance and energy</summary>
<table class="tbl calc"><tbody>
<tr><td>Linear striker at start</td><td class="num">${d.nail} + ${d.linearHead} = ${d.needLinear} mm</td><td>nail + head length <span class="basis" data-b="tgt">target</span></td></tr>
<tr><td>Bostitch PN50 at start</td><td class="num">${d.nail} + ${d.palmLen} = ${d.needPalm} mm</td><td>${a(BZ.SRC.pn50, "PN50-E sheet")} <span class="basis" data-b="src">sourced</span></td></tr>
<tr><td>Milwaukee 2458-20 at start</td><td class="num">${d.nail} + ${d.palmM12} = ${d.needPalmM12} mm</td><td>${a(BZ.SRC.m2458b, "6.5 in height")} <span class="basis" data-b="src">sourced</span></td></tr>
<tr><td>Palm nailer blow power</td><td class="num">${d.blowJ} J × ${d.bpm} / 60 = ${fmt(d.blowW)} W</td><td>2.2 ft·lb, 2,700 bpm <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>12 V push-pull solenoid</td><td class="num">≈ 0.03–0.1 J</td><td>${a(BZ.SRC.adafruitSol, "Adafruit #413")}. 1–2 orders of magnitude short, so the striker must be motor-driven <span class="basis" data-b="est">estimate</span></td></tr>
</tbody></table></details>`;

const mvCalc = `
<details class="more"><summary>Lift: toggle links, screw torque and the lowest clearance</summary>
<table class="tbl calc"><tbody>
<tr><td>Deck height</td><td class="num">z = 28.5 + 120 sin θ, θ ${m.link.th0}°→${m.link.th1}°</td><td>${fmt(m.deckZ(m.link.th0), 1)} → ${fmt(m.deckZ(m.link.th1), 1)} mm, lift ${fmt(m.plat.lift, 1)} mm <span class="basis" data-b="tgt">target</span></td></tr>
<tr><td>Nut travel</td><td class="num">120 (cos ${m.link.th0}° − cos ${m.link.th1}°) = ${fmt(m.nutTravel, 1)} mm</td><td>${fmt(m.turnsScrew, 1)} screw turns at 2 mm lead <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Free rise before contact</td><td class="num">${m.item.clear} − ${m.plat.stowed} = ${m.gap} mm</td><td>θ at contact ${fmt(m.thContact, 1)}° <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Horizontal link force per end at contact</td><td class="num">(${fmt(m.W)} / 2) / tan ${fmt(m.thContact, 1)}° = ${fmt(m.Fcontact)} N</td><td><span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Screw torque, both ends</td><td class="num">2 × F × 0.002 / (2π × ${m.screw.eff}) = ${fmt(m.TcontactBoth, 2)} N·m</td><td>Efficiency 0.35 keeps the screw self-locking. ${a(BZ.SRC.pololu131, "Pololu 37D 131:1")} recommended maximum ${m.motorLimit} N·m <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Lowest underside clearance</td><td class="num">${m.minClear} mm</td><td>Where screw torque reaches the motor limit (θ = ${fmt(m.thMin, 1)}°) <span class="basis" data-b="calc">calc</span></td></tr>
</tbody></table></details>
<details class="more"><summary>Stability, rolling and thresholds</summary>
<table class="tbl calc"><tbody>
<tr><td>Tip across (braking or side push)</td><td class="num">(${m.plat.W} / 2) / ${m.item.cgZ} = ${fmt(m.tipAcross, 2)} g</td><td>Programmed stops at ${m.decel} g give a 4× margin; a 0.4 g jolt at a sill does not. <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Tip along</td><td class="num">(${m.plat.L} / 2) / ${m.item.cgZ} = ${fmt(m.tipAlong, 2)} g</td><td>Paired skates at a ${m.skates.span} mm span: ${fmt(m.tipAlongSk, 2)} g <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Rolling force, hardwood</td><td class="num">${fmt(m.total)} N × ${m.crr.hard} = ${fmt(m.rollHard)} N</td><td>${a(BZ.SRC.crr, "PU 95A 0.025–0.035")} <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Rolling force, carpet</td><td class="num">${fmt(m.total)} N × ${m.crr.carpet} = ${fmt(m.rollCarpet)} N</td><td>carpet × 2.5–3.5 <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Traction available</td><td class="num">${m.mu} × ${m.driveShare} × ${fmt(m.total)} = ${fmt(m.traction)} N</td><td>μ on dry hardwood assumed <span class="basis" data-b="meas">measure</span></td></tr>
<tr><td>Step climb, wheel radius r, step h</td><td class="num">F/N = √(2rh − h²) / (r − h)</td><td>Moments about the step edge <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Highest sill without ramp</td><td class="num">${m.maxSillNoRamp} mm</td><td>Two 1 in ball transfers lead and each carries ${fmt(m.cornerLoad)} N <span class="basis" data-b="calc">calc</span></td></tr>
<tr><td>Longest ${m.item.D} mm-deep item that turns</td><td class="num">≈ ${fmt(longest)} mm (grid search) · ${fmt(m.LmaxTurn)} mm (corridor formula)</td><td>Hall ${m.hall} into door ${m.door}. The chest at ${m.item.L} mm clears the jamb by ${fmt(turn.minClear)} mm on the best path found <span class="basis" data-b="calc">calc</span></td></tr>
</tbody></table></details>`;

// paired skates static comparison (long-side elevation)
function skatesFigure() {
  const s = 0.36, w = 940, h = 230;
  const X = (x) => 40 + x * s, Z = (z) => 190 - z * s;
  const it = m.item;
  const panel = (dx, label, supports, span) => `
    <g transform="translate(${dx} 0)">
      <path class="floor" d="M${X(-20)} ${Z(0)}H${X(it.L + 20)}"/>
      <rect class="item-body" x="${X(0)}" y="${Z(it.H)}" width="${it.L * s}" height="${(it.H - it.clear) * s}"/>
      <rect class="item-foot" x="${X(0)}" y="${Z(it.clear)}" width="${it.foot * s}" height="${(it.clear - 10) * s}"/>
      <rect class="item-foot" x="${X(it.L - it.foot)}" y="${Z(it.clear)}" width="${it.foot * s}" height="${(it.clear - 10) * s}"/>
      ${supports.map(([x0, x1]) => `<rect class="plat-tray" x="${X(x0)}" y="${Z(it.clear)}" width="${(x1 - x0) * s}" height="${it.clear * s}"/>`).join("")}
      <g class="cg"><circle cx="${X(it.L / 2)}" cy="${Z(it.cgZ)}" r="6"/></g>
      <text class="lab small" x="${X(0)}" y="${Z(it.H) - 8}">${label}</text>
      <path class="dim-line" data-k="tgt" d="M${X(it.L / 2 - span / 2)} ${Z(-60)}H${X(it.L / 2 + span / 2)}" marker-start="url(#ar-tgt)" marker-end="url(#ar-tgt)"/>
      <text class="dim-text" x="${X(it.L / 2)}" y="${Z(-60) + 16}" text-anchor="middle">support ${span} mm · tips along at ${fmt(span / 2 / it.cgZ, 2)} g</text>
    </g>`;
  return `<svg class="fig-svg small-fig" viewBox="0 0 ${w} ${h + 30}" role="img" aria-label="Long-side elevation comparing the single platform's 700 mm support with paired skates at a 1000 mm span.">
    ${panel(0, "Single platform P-1", [[it.L / 2 - m.plat.L / 2, it.L / 2 + m.plat.L / 2]], m.plat.L)}
    ${panel(470, "Paired lifting skates S-2", [[it.L / 2 - m.skates.span / 2 - 50, it.L / 2 - m.skates.span / 2 + 150], [it.L / 2 + m.skates.span / 2 - 150, it.L / 2 + m.skates.span / 2 + 50]], m.skates.span)}
  </svg>`;
}

const tkAltIntro = `<p>The closest direct products are modular 12 V drivers with right-angle heads and powered ratchets. The workarounds people actually use are cheap adapters, L-keys and tipping the furniture over. <strong>The strongest reason to keep the existing solution:</strong> J1 is a once-in-a-while job, and an L-key or tipping the dresser is free.</p>`;
const mvAltIntro = `<p>The closest direct products are manual lift-and-roll kits and pro movers. No consumer powered under-furniture mover turned up. <strong>The strongest reason to keep the existing solution:</strong> a $29 lever kit plus sliders moves the same chest, works on carpet, and needs no charging.</p>
<h4 class="sub-h">Single platform or paired lifting skates</h4>
${skatesFigure()}
<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>P-1 single platform</th><th>S-2 paired lifting skates</th></tr></thead><tbody>
<tr><td>Pieces to place</td><td>1, pushed under with a handle</td><td>2, each placed under one end; must line up</td></tr>
<tr><td>Weight per piece</td><td class="num">≈ ${m.plat.mass} kg <span class="basis" data-b="est">estimate</span></td><td class="num">≈ 6–7 kg each <span class="basis" data-b="est">estimate</span></td></tr>
<tr><td>Tip margin along / across</td><td class="num">${fmt(m.tipAlong, 2)} g / ${fmt(m.tipAcross, 2)} g</td><td class="num">${fmt(m.tipAlongSk, 2)} g / ${fmt((m.skates.W / 2) / m.item.cgZ, 2)} g</td></tr>
<tr><td>Fits items with a centre stretcher or plinth gap</td><td>No</td><td>Yes, supports sit at the ends</td></tr>
<tr><td>Steering</td><td>One rigid base, turns on the spot</td><td>Rear skate drives, front skate swivels; the item itself is the chassis, so a weak base racks</td></tr>
<tr><td>Wheel size and sills</td><td colspan="2">Same limit: anything that slides under a ${m.item.clear} mm gap has wheels of about 40 mm or less, so ramps are needed either way</td></tr>
<tr><td>Cost</td><td colspan="2">Similar parts count (two lift drives either way); S-2 adds a second battery or a cable between units</td></tr>
</tbody></table></div>
<h4 class="sub-h">Entry height, wheel diameter, lift and threshold</h4>
<p>Anything that slides under a 76 mm gap and still lifts 30 mm or more has wheels of roughly 40 mm or less. The push needed to climb a step grows as √(2rh − h²)/(r − h), so small wheels stall on sills a larger wheel rolls over. Try the numbers:</p>
<div class="wheel-tool" data-wheel>
  ${wheelStudy()}
  <div class="wt-controls">
    <label>Wheel diameter <output data-o="wd">38 mm</output><input type="range" min="20" max="150" step="1" value="38" data-i="wd" aria-label="Wheel diameter, millimetres"></label>
    <label>Sill height <output data-o="sh">6 mm</output><input type="range" min="0" max="13" step="0.5" value="6" data-i="sh" aria-label="Sill height, millimetres"></label>
    <p class="wt-read" data-o="read" aria-live="polite"></p>
  </div>
</div>`;

function tab(id, title, cfg) {
  return `<section class="panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}" data-tab="${id}"${id === "mover" ? " hidden" : ""}>
  <div class="opening">
    <div class="fig-card" data-fig="${id}">
      <div class="fig-top">
        <div class="views" role="tablist" aria-label="${title} views">${cfg.views.map(([v, l], i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-view="${v}">${l}</button>`).join("")}</div>
        <span class="fig-no mono">${cfg.figNo}</span>
      </div>
      <div class="stage">${cfg.stage}</div>
      <div class="fig-controls">${cfg.controls}</div>
      <p class="readout mono" aria-live="polite" data-readout></p>
      ${legend()}
    </div>
    <div class="sel-desc" aria-live="polite" data-desc><p class="muted">Select a part label in the drawing or in the parts key.</p></div>
    <aside class="parts-key" aria-label="Parts key"><h3 class="key-title">Parts key</h3>${cfg.key}</aside>
  </div>
  <div class="body">
    <section class="sec verdict"><h2>Engineering verdict</h2>${cfg.text.verdict}${judgments(cfg.text.judgments)}<p class="unknown">${cfg.text.unknown}</p>${cfg.afterVerdict || ""}</section>
    <section class="sec"><h2>Prototype path</h2><p class="muted">Ratings and performance targets stay unverified until the stage that tests them passes.</p>${stagesHtml(cfg.text.stages, cfg.bom, cfg.labor)}</section>
    <section class="sec"><h2>Costs</h2><h3>Prototype bill of materials</h3>${bomTable(cfg.bomRows, cfg.bom, cfg.labor, cfg.labT)}<h3>Pilot (100) and first run (1,000)</h3>${runsTable(cfg.R, cfg.runs)}</section>
    <section class="sec"><h2>Alternatives</h2>${cfg.altIntro}${compTable(cfg.comp)}</section>
    <section class="sec"><h2>Partners and standards</h2>${cfg.text.partners}<h3>US standards and testing questions</h3>${stdTable(cfg.std)}</section>
    <section class="sec"><h2>Recommendation</h2>${recBox(cfg.text.rec)}</section>
    <section class="sec details"><h2>Evidence and calculations</h2>
      <details class="more"><summary>Provisional choices and which ones change the design</summary>${choices(cfg.text.choices)}</details>
      ${cfg.calc}
    </section>
  </div>
</section>`;
}

const tkStage = `
  <div class="view" data-v="asm exp">${dIso.svg}</div>
  <div class="view wide" data-v="use" hidden>${dUse.svg}</div>
  <div class="view wide" data-v="ham" hidden>${hStudy.svg}</div>`;
const tkControls = `
  <div class="ctl" data-for="asm exp"><button type="button" class="btn" data-act="explode">Take apart</button><span class="muted small">Parts move out along their assembly axes. Heavier-outlined labels are internal parts.</span></div>
  <div class="ctl" data-for="use" hidden>${seg("tool", [["dhead", "D-head"], ["ra", "Right-angle adapter"], ["lkey", "Ball-end L-key"]], "Tool")}<label class="rng">Approach and drive<input type="range" min="0" max="1" step="0.005" value="0.62" data-i="approach" aria-label="Approach and drive the bolt"></label><button type="button" class="btn" data-act="play-use">Play</button></div>
  <div class="ctl" data-for="ham" hidden>${seg("htool", [["linear", "Linear striker"], ["pivot", "Pivoting face"], ["palm", "Palm nailer (PN50)"]], "Hammer mechanism")}<label class="rng">Nail driven<input type="range" min="0" max="1" step="0.005" value="0" data-i="drive" aria-label="How far the nail is driven"></label><button type="button" class="btn" data-act="play-ham">Play</button></div>`;
const mvStage = `
  <div class="view" data-v="asm exp">${mIso.svg}</div>
  <div class="view wide" data-v="seq" hidden>${mSeq.svg}</div>
  <div class="view wide" data-v="plan" hidden>${mPlan.svg}</div>`;
const mvControls = `
  <div class="ctl" data-for="asm exp"><button type="button" class="btn" data-act="explode">Take apart</button><label class="rng" data-only="asm">Lift<input type="range" min="0" max="10" step="1" value="0" data-i="lift" aria-label="Deck lift"></label></div>
  <div class="ctl" data-for="seq" hidden><label class="rng wide">Step<input type="range" min="0" max="7" step="0.01" value="1" data-i="step" aria-label="Move step, 1 to 8"></label><button type="button" class="btn" data-act="play-seq">Play</button></div>
  <div class="ctl" data-for="plan" hidden><label class="rng wide">Along the route<input type="range" min="0" max="1" step="0.002" value="0.5" data-i="route" aria-label="Position along the route"></label><button type="button" class="btn" data-act="play-plan">Play</button></div>`;

const allParts = [...TOOLKIT_PARTS, ...MOVER_PARTS].filter((p) => p.id);
const bomRefs = (rows) => {
  const map = {};
  rows.forEach((r) => String(r.pid).split(/,\s*/).forEach((p) => {
    const mm = p.match(/^([A-Z])(\d+)–[A-Z]?(\d+)$/);
    const ids = mm ? Array.from({ length: +mm[3] - +mm[2] + 1 }, (_, i) => mm[1] + (+mm[2] + i)) : [p];
    ids.forEach((id) => (map[id] = map[id] || []).push(`S${r.stage}: ${r.item}`));
  }));
  return map;
};
const DATA = {
  parts: Object.fromEntries(allParts.map((p) => [p.id, { name: p.name, fn: p.fn, desc: p.desc }])),
  bom: { ...bomRefs(BZ.TOOLKIT_BOM), ...bomRefs(BZ.MOVER_BOM) },
  fnLabel: FN_LABEL,
  driver: { P: dIso.P, use: dUse.map, ham: hStudy.map, d: { void: d.void, bolt: d.boltDepth, stack: d.stack, boltHead: d.boltHead, socket: d.socketDepth, turns: d.turns, outRpm: d.outRpm, reactN: d.reactN, raHead: d.raHead, lkeyLong: d.lkeyLong, armLength: d.armLength, torque: d.torque, gap: d.hammerGap, nail: d.nail, linearHead: d.linearHead, pivotHead: d.pivotHead, pivotR: d.pivotR, palmLen: d.palmLen } },
  mover: { P: mIso.P, frames: mIso.frames, seq: mSeq.map, plan: mPlan.map, turn: turn.samples.map((t) => [Math.round(t.x), Math.round(t.y), +t.ph.toFixed(1), Math.round(t.c)]), minClear: Math.round(turn.minClear), longest: Math.round(longest), m: { L: m.item.L, D: m.item.D, PL: m.plat.L, PW: m.plat.W, gap: m.gap, clear: m.item.clear, stowed: m.plat.stowed, mass: m.item.mass, cgZ: m.item.cgZ, H: m.item.H, tipAcross: m.tipAcross, decel: m.decel, speed: m.speed, total: m.total, traction: m.traction, driveShare: m.driveShare }, captions: MV.sequence },
};

const body = `
<header class="masthead">
  <div class="mh-inner">
    <div class="mh-title"><span class="mono mh-file">FILE 2026-11-15 · US launch · USD</span><h1>Prototype decision file</h1></div>
    <nav class="tabs" role="tablist" aria-label="Product">
      <button type="button" role="tab" id="tab-toolkit" aria-selected="true" aria-controls="panel-toolkit" data-tab="toolkit">Modular Power Toolkit</button>
      <button type="button" role="tab" id="tab-mover" aria-selected="false" aria-controls="panel-mover" data-tab="mover">Home Lift &amp; Mover</button>
    </nav>
  </div>
</header>
<svg class="defs-host" aria-hidden="true" width="0" height="0">${markerDefs()}</svg>
<main class="wrap">
${tab("toolkit", "Modular Power Toolkit", { figNo: "FIG 1 · D-HEAD ON POWER BASE", views: [["asm", "Assembled"], ["exp", "Exploded"], ["use", "In use · job J1"], ["ham", "Hammer · angle study"]], stage: tkStage, controls: tkControls, key: partsKey(TOOLKIT_PARTS, "toolkit"), text: TK, afterVerdict: TK.family + TK.hammer, bom: tkBom, labor: BZ.TOOLKIT_LABOR, labT: tkLab, bomRows: BZ.TOOLKIT_BOM, R: BZ.TOOLKIT_RUNS, runs: tkRuns, altIntro: tkAltIntro, comp: BZ.TOOLKIT_COMP, std: BZ.TOOLKIT_STD, calc: tkCalc })}
${tab("mover", "Home Lift & Mover", { figNo: "FIG 2 · P-1 LIFT PLATFORM", views: [["asm", "Assembled"], ["exp", "Exploded"], ["seq", "Move sequence"], ["plan", "Tightest turn"]], stage: mvStage, controls: mvControls, key: partsKey(MOVER_PARTS, "mover"), text: MV, bom: mvBom, labor: BZ.MOVER_LABOR, labT: mvLab, bomRows: BZ.MOVER_BOM, R: BZ.MOVER_RUNS, runs: mvRuns, altIntro: mvAltIntro, comp: BZ.MOVER_COMP, std: BZ.MOVER_STD, calc: mvCalc })}
<footer class="foot"><p>Figures drawn with the vendored <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noopener">Anatomy</a> isometric kit (MIT) plus project SVG. Labels: <span class="basis" data-b="src">sourced</span> published spec or code; <span class="basis" data-b="seen">listing</span> US retail listing seen 2026-11-15 via search results (pages not opened, so check before quoting); <span class="basis" data-b="tgt">target</span> proposed and unverified; <span class="basis" data-b="meas">measure</span> placeholder to measure; <span class="basis" data-b="calc">calc</span> derived on this page; <span class="basis" data-b="est">estimate</span>.</p></footer>
</main>`;

const css = read("src/styles.css") + k.ISO_CSS;
const js = `const DATA = ${JSON.stringify(DATA)};\n` + read("src/app.js");
const TITLE = "Prototype Decision File";
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">`;
const full = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${TITLE}</title>${fonts}<style>${css}</style></head><body class="iso" data-theme="light">${body}<script>${js}</script></body></html>`;
writeFileSync(join(HERE, "index.html"), full);
mkdirSync(join(HERE, "dist"), { recursive: true });
const art = `<title>${TITLE}</title><meta name="claude:viewport-fit-sides" content="cover">${fonts}<style>${css}</style><div class="iso" data-theme="light">${body}</div><script>${js}</script>`;
writeFileSync(join(HERE, "dist/artifact.html"), art);
console.log("wrote index.html", (full.length / 1024).toFixed(0), "KB");
console.log("toolkit founder cash", tkBom.total.toFixed(2), "stages", tkBom.byStage, "labor", tkLab);
console.log("mover founder cash", mvBom.total.toFixed(2), "stages", mvBom.byStage, "labor", mvLab);
console.log("runs tk", tkRuns.map((r) => [r.qty, r.oneLo, r.oneHi, r.uLo.toFixed(1), r.uHi.toFixed(1), r.cashLo.toFixed(0), r.cashHi.toFixed(0)]));
console.log("runs mv", mvRuns.map((r) => [r.qty, r.oneLo, r.oneHi, r.uLo.toFixed(1), r.uHi.toFixed(1), r.cashLo.toFixed(0), r.cashHi.toFixed(0)]));
