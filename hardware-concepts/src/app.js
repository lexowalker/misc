// Page behaviour: tabs, views, part selection (pointer, touch, keyboard), and the mechanisms.
// Every animated reading is computed from the same numbers that move the parts.
(() => {
  // SVG elements have no "hidden" property; map it to the attribute so CSS [hidden] applies.
  if (!("hidden" in SVGElement.prototype)) Object.defineProperty(SVGElement.prototype, "hidden", { set(v) { this.toggleAttribute("hidden", !!v); }, get() { return this.hasAttribute("hidden"); } });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f0 = (v) => Math.round(v).toLocaleString("en-US");
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

  // iso camera (same formula as the Anatomy kit)
  const axis = (P, [dx, dy, dz]) => {
    const a = ((P.azimuth ?? 45) * Math.PI) / 180, e = ((P.elevation ?? 30) * Math.PI) / 180, k = P.scale * Math.sqrt(1.6);
    return [(dx * Math.sin(a) - dy * Math.cos(a)) * k, ((dx * Math.cos(a) + dy * Math.sin(a)) * Math.sin(e) - dz * Math.cos(e)) * k];
  };
  const tr = (P, v) => { const [x, y] = axis(P, v); return `translate(${x.toFixed(2)} ${y.toFixed(2)})`; };

  // ---------- tabs ----------
  const tabs = $$(".tabs [role=tab]");
  function showTab(id, focus) {
    tabs.forEach((t) => { const on = t.dataset.tab === id; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    $$(".panel").forEach((p) => (p.hidden = p.dataset.tab !== id));
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    fitLabels();
  }
  tabs.forEach((t) => {
    t.addEventListener("click", () => showTab(t.dataset.tab));
    t.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const i = tabs.indexOf(t); showTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].dataset.tab, true); } });
  });

  // ---------- figure controller per tab ----------
  const figs = {};
  $$(".panel").forEach((panel) => {
    const id = panel.dataset.tab;
    const card = $(".fig-card", panel);
    const F = (figs[id] = { id, panel, card, view: "asm", t: 0, target: 0, sel: null, readout: $("[data-readout]", card), desc: $("[data-desc]", panel), hooks: {} });
    const viewBtns = $$(".views [role=tab]", card);
    F.setView = (v, focus) => {
      F.view = v;
      viewBtns.forEach((b) => { const on = b.dataset.view === v; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      $$(".view", card).forEach((el) => (el.hidden = !el.dataset.v.split(" ").includes(v)));
      $$(".ctl", card).forEach((el) => (el.hidden = !el.dataset.for.split(" ").includes(v)));
      $$("[data-only]", card).forEach((el) => (el.hidden = el.dataset.only !== v));
      if (v === "asm" || v === "exp") explodeTo(F, v === "exp" ? 1 : 0);
      F.hooks[v]?.();
      applySel(F);
      fitLabels();
    };
    viewBtns.forEach((b) => {
      b.addEventListener("click", () => F.setView(b.dataset.view));
      b.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const i = viewBtns.indexOf(b); F.setView(viewBtns[(i + (e.key === "ArrowRight" ? 1 : viewBtns.length - 1)) % viewBtns.length].dataset.view, true); } });
    });
    const exBtn = $("[data-act=explode]", card);
    exBtn?.addEventListener("click", () => F.setView(F.view === "exp" ? "asm" : "exp"));
    // selection from the drawing (callouts and tagged 2D parts) and the key
    card.addEventListener("click", (e) => { const el = e.target.closest("[data-pid]"); if (el && card.contains(el) && el.closest(".view")) select(F, el.dataset.pid, false); });
    card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("callout")) { e.preventDefault(); select(F, e.target.dataset.pid, false); } });
    const keys = $$(".key-item", panel);
    keys.forEach((b, i) => {
      b.addEventListener("click", () => select(F, b.dataset.pid, true));
      b.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); keys[clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, keys.length - 1)].focus(); } });
    });
  });

  // ---------- explode (assembled <-> exploded) ----------
  function explodeTo(F, target) {
    F.target = target;
    const svg = $(".view[data-v~=asm] svg", F.card);
    const P = F.id === "toolkit" ? DATA.driver.P : DATA.mover.P;
    const btn = $("[data-act=explode]", F.card);
    if (btn) { btn.textContent = target ? "Put together" : "Take apart"; btn.setAttribute("aria-pressed", target ? "true" : "false"); }
    const parts = $$(".part, .part-co", svg).map((g) => ({ g, ex: g.dataset.ex.split(",").map(Number), internal: g.hasAttribute("data-internal") }));
    parts.forEach((p, i) => (p.delay = (i / parts.length) * 0.25));
    cancelAnimationFrame(F.raf);
    const start = performance.now(), from = F.t, dur = still.matches ? 0 : 900;
    const step = (now) => {
      const u = dur ? clamp((now - start) / dur, 0, 1) : 1;
      F.t = from + (target - from) * u;
      parts.forEach((p) => {
        const local = clamp((F.t - p.delay * (target ? 1 : 0.4)) / (1 - p.delay), 0, 1);
        const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
        p.g.setAttribute("transform", tr(P, p.ex.map((v) => v * e)));
        if (p.internal) p.g.style.opacity = smooth(0.1, 0.55, e);
      });
      if (F.id === "mover") setLift(F, target ? 0 : F.lift || 0, true);
      readIso(F);
      if (u < 1) F.raf = requestAnimationFrame(step);
    };
    F.raf = requestAnimationFrame(step);
  }
  function readIso(F) {
    if (F.view !== "asm" && F.view !== "exp") return;
    if (F.id === "toolkit") {
      const d = DATA.driver.d;
      F.readout.textContent = F.view === "exp"
        ? "Exploded along assembly axes: head parts lift out of the 16 mm tray (z) and the power base slides off the input (x). Heavier-outlined labels are internal."
        : `Assembled · stack ${d.stack} mm (bit 25 mm through a 16 mm body) · arm ${d.armLength} mm · ${d.torque} N·m target at the bit, ${f0(d.outRpm)} rpm`;
    } else {
      const fr = DATA.mover.frames[F.lift || 0], m = DATA.mover.m;
      F.readout.textContent = F.view === "exp"
        ? "Exploded: deck, pad and load cells lift off the toggle links, electronics slide out the back, ball transfers drop. Heavier-outlined labels are internal."
        : `Link angle ${f1(fr.th)}° · deck lift ${f1(fr.lift)} mm · top of pad ${f1(m.stowed + fr.lift)} mm above floor · ${fr.lift >= m.gap ? `chest raised ${f1(fr.lift - m.gap)} mm` : `${f1(m.gap - fr.lift)} mm below a ${m.clear} mm underside`}`;
    }
  }

  // ---------- selection ----------
  function select(F, pid, fromKey) {
    F.sel = F.sel === pid && !fromKey ? null : pid;
    if (F.sel) {
      const vis = visibleIn(F, F.sel);
      if (!vis) {
        const order = ["exp", "asm", "use", "ham", "seq", "plan"];
        const v = order.find((vv) => visibleInView(F, F.sel, vv));
        if (v) F.setView(v);
      }
    }
    applySel(F);
  }
  function viewEl(F, v) { return $$(".view", F.card).find((el) => el.dataset.v.split(" ").includes(v)); }
  function visibleInView(F, pid, v) {
    const el = viewEl(F, v);
    if (!el) return false;
    const hits = $$(`[data-pid="${pid}"]`, el).filter((n) => !n.closest("[hidden]") || n.closest(".view") === el && !n.closest("g[hidden]"));
    if (!hits.length) return false;
    if (v === "asm") return hits.some((n) => !(n.closest(".part, .part-co")?.hasAttribute("data-internal")));
    return true;
  }
  function visibleIn(F, pid) { return visibleInView(F, pid, F.view); }
  function applySel(F) {
    const pid = F.sel;
    $$(".view svg", F.card).forEach((svg) => {
      svg.classList.toggle("has-sel", !!pid);
      $$("[data-pid]", svg).forEach((n) => n.classList.toggle("sel", n.dataset.pid === pid));
    });
    $$(".key-item", F.panel).forEach((b) => b.setAttribute("aria-pressed", b.dataset.pid === pid ? "true" : "false"));
    if (!pid) { F.desc.innerHTML = `<p class="muted">Select a part label in the drawing or in the parts key. Labels and key entries share IDs with the bill of materials.</p>`; return; }
    const p = DATA.parts[pid];
    const bom = DATA.bom[pid] || [];
    const shown = visibleIn(F, pid) ? "" : `<p class="muted small">Not drawn in this view.</p>`;
    F.desc.innerHTML = `<div><span class="desc-id">${pid}</span><span class="desc-name">${p.name}</span></div>
      <div class="desc-fn"><span class="fn-chip" data-fn="${p.fn}"></span>${DATA.fnLabel[p.fn]}</div>
      <p>${p.desc}</p>${shown}${bom.length ? `<ul class="desc-bom">${bom.slice(0, 3).map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}`;
  }

  // ---------- keep labels legible when the drawing is scaled down ----------
  function fitLabels() {
    $$(".view:not([hidden]) svg").forEach((svg) => {
      const vb = svg.viewBox.baseVal; if (!vb || !vb.width) return;
      const scale = svg.getBoundingClientRect().width / vb.width; if (!scale) return;
      const f = clamp(10 / (11 * scale), 1, 2.1);
      $$(".callout", svg).forEach((c) => {
        const r = $(".co-pill", c), t = $(".co-text", c);
        const cx = +t.getAttribute("x"), cy = +r.getAttribute("y") + 9;
        const xf = f === 1 ? "" : `translate(${cx} ${cy}) scale(${f.toFixed(3)}) translate(${-cx} ${-cy})`;
        r.setAttribute("transform", xf); t.setAttribute("transform", xf);
      });
    });
  }
  addEventListener("resize", () => { clearTimeout(fitLabels.t); fitLabels.t = setTimeout(fitLabels, 120); });

  // ---------- play helper ----------
  function player(btn, input, dur, onEnd) {
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; btn.textContent = "Play"; };
    btn.addEventListener("click", () => {
      if (raf) return stop();
      const min = +input.min, max = +input.max;
      let v = +input.value >= max ? min : +input.value;
      if (still.matches) { input.value = max; input.dispatchEvent(new Event("input")); return; }
      btn.textContent = "Pause";
      let last = performance.now();
      const step = (now) => {
        v = Math.min(max, v + ((now - last) / dur) * (max - min)); last = now;
        input.value = v; input.dispatchEvent(new Event("input"));
        if (v < max) raf = requestAnimationFrame(step); else { stop(); onEnd?.(); }
      };
      raf = requestAnimationFrame(step);
    });
    input.addEventListener("pointerdown", stop);
  }
  function segment(card, name, onChange) {
    const btns = $$(`button[data-${name}]`, card);
    btns.forEach((b) => b.addEventListener("click", () => { btns.forEach((x) => x.setAttribute("aria-checked", x === b)); onChange(b.dataset[name]); }));
    btns.forEach((b, i) => b.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = btns[(i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length]; n.focus(); n.click(); } }));
  }

  // ================= TOOLKIT: in-use J1 =================
  (() => {
    const F = figs.toolkit, card = F.card, D = DATA.driver.d, map = DATA.driver.use;
    const view = viewEl(F, "use"), svg = $("svg", view);
    const X = (x) => map.ox + x * map.s, Z = (z) => map.oz - z * map.s;
    const input = $("[data-i=approach]", card);
    let tool = "dhead";
    const tools = { dhead: { stack: D.stack, reach: Infinity }, ra: { stack: D.raHead, reach: Infinity }, lkey: { stack: 22 + 3.5, reach: D.lkeyLong } };
    function draw() {
      const t = +input.value;
      $$(".tool", svg).forEach((g) => (g.hidden = g.dataset.tool !== tool));
      $$("[data-tool-only]", svg).forEach((g) => (g.hidden = g.dataset.toolOnly !== tool));
      const T = tools[tool];
      const slideTip = D.boltHead + 0.5;
      const fits = D.boltHead + 0.5 + T.stack <= D.void;
      // approach: bit axis from 60 mm outside the front face to the bolt axis
      let bx = 60 + (-D.bolt - 60) * smooth(0, 0.6, t);
      let tip = slideTip;
      let note = "";
      if (!fits) { bx = Math.max(bx, 22); note = `blocked at the front rail: needs ${f1(D.boltHead + 0.5 + T.stack)} mm, void is ${D.void} mm`; }
      const engage = fits ? smooth(0.6, 0.7, t) : 0;
      tip = slideTip - engage * (0.5 + D.socket);
      const g = $(`.tool[data-tool=${tool}] .mover`, svg);
      g.setAttribute("transform", `translate(${X(bx).toFixed(1)} ${Z(tip).toFixed(1)})`);
      const turning = fits ? smooth(0.7, 1, t) : 0;
      const turns = turning * D.turns;
      const mark = $("#bolt-mark", svg);
      const ang = (turns * 360) % 360;
      mark.setAttribute("d", `M${X(-D.bolt) + Math.sin((ang * Math.PI) / 180) * 9} ${Z(6)}v-${(6 * map.s).toFixed(1)}`);
      // live stack + clearance dims for the D-head
      const live = $("[data-live=stack]", svg);
      if (tool === "dhead") {
        const top = tip + D.stack;
        const x = X(bx) - 26;
        live.innerHTML = `<path class="dim-line" d="M${x} ${Z(tip)}V${Z(top)}" marker-start="url(#ar-tgt)" marker-end="url(#ar-tgt)"/><text class="dim-text" x="${x - 5}" y="${(Z(tip) + Z(top)) / 2 + 4}" text-anchor="end">${D.stack}</text>` +
          (bx < 0 ? `<path class="dim-line" d="M${x + 92} ${Z(top)}V${Z(D.void)}" marker-start="url(#ar-tgt)" marker-end="url(#ar-tgt)"/><text class="dim-text" x="${x + 98}" y="${(Z(top) + Z(D.void)) / 2 + 4}">${f1(D.void - top)} clear</text>` : "");
      }
      $$("[data-r=react]", svg).forEach((n) => (n.textContent = turning > 0 ? `${f0(D.reactN)} N` : ""));
      $$("[data-r=react2]", svg).forEach((n) => (n.textContent = `${f0(D.reactN)} N at sleeve`));
      const secs = (turns / D.outRpm) * 60;
      const names = { dhead: "D-head", ra: "Right-angle adapter (49-22-8510)", lkey: "4 mm ball-end L-key" };
      let msg;
      if (!fits) msg = `${names[tool]}: bit axis ${f0(bx)} mm outside the front face${bx <= 22 ? ` · ${note}. Cannot reach J1.` : " · approaching"}`;
      else if (tool === "dhead") msg = t < 0.6 ? `D-head sliding in: bit tip ${f1(tip - D.boltHead)} mm above the bolt head, ${f1(D.void - tip - D.stack)} mm under the frame · depth ${f0(Math.max(0, -bx))} of ${D.bolt} mm` : t < 0.7 ? `Dropping onto the socket: engagement ${f1(Math.max(0, D.boltHead - tip))} of ${D.socket} mm` : `Driving: ${f1(turns)} of ${D.turns} turns · ${f1(secs)} s at ${f0(D.outRpm)} rpm · support hand reacts ${f0(D.reactN)} N`;
      else {
        const finger = Math.max(0, -(bx + D.lkeyLong));
        msg = `L-key fits (25.5 mm tall) and reaches with fingers ${f0(finger)} mm inside the slot (measure your key's long arm). ${turning > 0 ? `${f1(turns)} of ${D.turns} turns · about ${f0(turns * 4 * 1.6)} s at ~1.6 s per quarter-turn regrip (estimate)` : ""}`;
      }
      F.readout.textContent = msg;
    }
    input.addEventListener("input", draw);
    segment(card, "tool", (v) => { tool = v; draw(); applySel(F); });
    player($("[data-act=play-use]", card), input, 6000);
    F.hooks.use = draw;
  })();

  // ================= TOOLKIT: hammer study =================
  (() => {
    const F = figs.toolkit, card = F.card, D = DATA.driver.d, map = DATA.driver.ham;
    const svg = $("svg", viewEl(F, "ham"));
    const X = (x) => map.ox + x * map.s, Y = (y) => map.oy + y * map.s;
    const input = $("[data-i=drive]", card);
    let tool = "linear";
    const len = { linear: D.linearHead, pivot: D.pivotHead, palm: D.palmLen };
    function draw() {
      const p = +input.value;
      $$(".htool", svg).forEach((g) => (g.hidden = g.dataset.htool !== tool));
      const stick = D.nail * (1 - p);
      const nail = $(".nail", svg);
      nail.setAttribute("transform", `translate(${X(stick - D.nail).toFixed(1)} 0)`);
      const need = stick + len[tool];
      const over = need - D.gap;
      const flag = $(".haz-flag", svg);
      flag.hidden = over <= 0;
      if (over > 0) { const r = $("rect", flag); r.setAttribute("x", X(D.gap)); r.setAttribute("width", (over * map.s).toFixed(1)); }
      const g = $(`.htool[data-htool=${tool}] .hmove`, svg);
      let msg = "";
      if (tool === "pivot") {
        // housing held where the face is square at the start; as the nail sinks the face meets it off-square
        const xp = D.nail + 13, R = D.pivotR;
        g.setAttribute("transform", `translate(${X(D.nail).toFixed(1)} 0)`);
        const dx = xp - (stick + 13);
        const th = dx <= R ? Math.asin(dx / R) : Math.PI / 2;
        const sw = $(".swing", g);
        const pinX = R * map.s, pinY = Y(-R * 0.9);
        sw.setAttribute("transform", `rotate(${((th * 180) / Math.PI).toFixed(1)} ${pinX} ${pinY})`);
        msg = dx > R ? `Pivoting face: the nail has sunk past the arc (${f0(stick)} mm stick-out); the head must be re-registered.` : `Pivoting face: meets the nail head ${f1((th * 180) / Math.PI)}° off-square at ${f0(stick)} mm stick-out; the blow turns glancing as the nail sinks. Needs ${f0(D.nail + D.pivotHead)} mm at the start.`;
      } else {
        g.setAttribute("transform", `translate(${X(stick).toFixed(1)} 0)`);
        const name = tool === "linear" ? "Linear striker (H-head)" : "Bostitch PN50 palm nailer";
        msg = `${name}: stick-out ${f0(stick)} mm + head ${len[tool]} mm = ${f0(need)} mm of a ${D.gap} mm gap · ${over > 0 ? `collides by ${f0(over)} mm: the nail must be started by hand` : `${f0(-over)} mm spare`} · blows stay on the nail axis`;
        const s = $(".t-striker", g);
        if (s) s.setAttribute("transform", `translate(${(Math.abs(Math.sin(p * Math.PI * 14)) * 10 * map.s).toFixed(1)} 0)`);
      }
      F.readout.textContent = msg;
    }
    input.addEventListener("input", draw);
    segment(card, "htool", (v) => { tool = v; draw(); applySel(F); });
    player($("[data-act=play-ham]", card), input, 5000);
    F.hooks.ham = draw;
  })();

  // ================= MOVER: lift frames in the iso =================
  function setLift(F, i, quiet) {
    const svg = $(".view[data-v~=asm] svg", F.card), P = DATA.mover.P;
    $$("[data-frame]", svg).forEach((g) => (g.hidden = +g.dataset.frame !== i));
    const lift = DATA.mover.frames[i].lift;
    $$(".lifts", svg).forEach((g) => g.setAttribute("transform", tr(P, [0, 0, lift])));
    const sk = $(".lifts-skirt .part", svg);
    if (sk) sk.style.opacity = i ? 1 : 1;
    if (!quiet) readIso(F);
  }
  (() => {
    const F = figs.mover, card = F.card;
    const input = $("[data-i=lift]", card);
    F.lift = 0;
    input.addEventListener("input", () => { F.lift = +input.value; if (F.view !== "asm") F.setView("asm"); setLift(F, F.lift); });
  })();

  // ================= MOVER: sequence =================
  (() => {
    const F = figs.mover, card = F.card, M = DATA.mover.m, map = DATA.mover.seq;
    const svg = $("svg", viewEl(F, "seq"));
    const X = (y) => map.ox + y * map.s, Z = (z) => map.oz - z * map.s;
    const input = $("[data-i=step]", card);
    const out = 280;
    const keys = [
      { y: out, lift: 0 }, { y: 0, lift: 0 }, { y: 0, lift: M.gap }, { y: 0, lift: M.gap + 10 },
      { y: 0, lift: M.gap + 10 }, { y: 0, lift: M.gap + 10 }, { y: 0, lift: 0 }, { y: out, lift: 0 },
    ];
    function draw() {
      const v = +input.value, i = Math.min(6, Math.floor(v)), u = smooth(0, 1, v - i);
      const a = keys[i], b = keys[i + 1] || keys[i];
      const y = a.y + (b.y - a.y) * u, lift = a.lift + (b.lift - a.lift) * u;
      const raise = Math.max(0, lift - M.gap);
      $(".seq-plat", svg).setAttribute("transform", `translate(${(y * map.s).toFixed(1)} 0)`);
      $(".seq-deck", svg).setAttribute("transform", `translate(0 ${(-lift * map.s).toFixed(1)})`);
      $(".seq-item", svg).setAttribute("transform", `translate(0 ${(-raise * map.s).toFixed(1)})`);
      const pinch = $("[data-r=pinch]", svg);
      pinch.setAttribute("height", ((17 + lift) * map.s).toFixed(1));
      pinch.setAttribute("y", Z(39 + lift).toFixed(1));
      $(".seq-dims", svg).style.opacity = v < 2.5 ? 1 : 0.15;
      const s = Math.round(v);
      const arrow = $("[data-r=arrow]", svg);
      if (s === 4) arrow.innerHTML = `<path d="M${X(-60)} ${Z(300)}h${-120}" marker-end="url(#ar-force)"/><text x="${X(-60) + 8}" y="${Z(300) + 4}">drive ${M.speed} m/s</text>`;
      else if (s === 5) arrow.innerHTML = `<path d="M${X(0)} ${Z(M.cgZ + raise)}h${(M.tipAcross * 260).toFixed(0)}" marker-end="url(#ar-force)" style="stroke:#8A3800"/><text x="${X(20)}" y="${Z(M.cgZ + raise) + 26}" style="fill:#8A3800">braking ${M.decel} g · tips at ${M.tipAcross.toFixed(2)} g</text>`;
      else arrow.innerHTML = "";
      const perCell = (M.mass * 9.81) / 4;
      const msgs = [
        `Platform outside · stowed ${M.stowed} mm under a ${M.clear} mm underside (assumed) · ${M.gap} mm of air to spare`,
        `Inserted · deck ${M.stowed} mm, underside ${M.clear} mm · user pushes with the handle, no kneeling`,
        `Deck lift ${f1(lift)} mm · ${lift >= M.gap - 0.1 ? `contact: load cells read ≈ ${f0(perCell)} N each when centred` : "rising unloaded"}`,
        `Feet ${f1(raise)} mm off the floor · load ${M.mass} kg on a ${M.PW} mm-wide support · tips across at ${M.tipAcross.toFixed(2)} g`,
        `Driving at ${M.speed} m/s · rolling force ≈ ${f0(M.total * 0.03)} N on hardwood is supplied by the drive wheels (traction ≈ ${f0(M.traction)} N)`,
        `Stopping at ${M.decel} g · 4× margin to tipping · the screw self-locks, so height holds with power off`,
        `Deck lift ${f1(lift)} mm · ${raise > 0 ? "lowering" : "feet carry the chest again"} · after power loss, crank M14 by hand`,
        `Retrieved · platform out with the handle`,
      ];
      F.readout.innerHTML = `<strong>${DATA.mover.captions[s]}</strong><br>${msgs[s]}`;
    }
    input.addEventListener("input", draw);
    player($("[data-act=play-seq]", card), input, 12000);
    F.hooks.seq = draw;
  })();

  // ================= MOVER: plan view =================
  (() => {
    const F = figs.mover, card = F.card, M = DATA.mover.m, map = DATA.mover.plan, T = DATA.mover.turn;
    const svg = $("svg", viewEl(F, "plan"));
    const X = (x) => map.ox + x * map.s, Y = (y) => map.oy - y * map.s;
    const input = $("[data-i=route]", card);
    // path = lead-in along the hall, the searched turn, lead-out into the room
    const first = T[0], lastP = T[T.length - 1];
    const pts = [[first[0] - 700, first[1], first[2], first[3]], ...T, [lastP[0], lastP[1] + 500, lastP[2], lastP[3]]];
    const rect = (cx, cy, L, D, ph) => { const c = Math.cos(ph), s = Math.sin(ph); return [[-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, D / 2], [-L / 2, D / 2]].map(([x, y]) => [X(cx + x * c - y * s), Y(cy + x * s + y * c)]); };
    const d = (poly) => "M" + poly.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
    function at(u) {
      const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), w = f - i;
      const a = pts[i], b = pts[i + 1];
      return [0, 1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * w);
    }
    function draw() {
      const u = +input.value, [x, y, ph, c] = at(u), r = (ph * Math.PI) / 180;
      $("[data-r=item]", svg).setAttribute("d", d(rect(x, y, M.L, M.D, r)));
      $("[data-r=plat]", svg).setAttribute("d", d(rect(x, y, M.PL, M.PW, r)));
      // user trails 700 mm behind the chest's rear end along its heading
      const back = M.L / 2 + 500;
      const ux = x - Math.cos(r) * back; let uy = y - Math.sin(r) * back;
      if (uy < 1054) uy = clamp(uy, 220, 700);
      const user = $("[data-r=user]", svg);
      user.setAttribute("cx", X(ux).toFixed(1)); user.setAttribute("cy", Y(uy).toFixed(1));
      $("[data-r=cord]", svg).setAttribute("d", `M${X(ux).toFixed(1)} ${Y(uy).toFixed(1)}L${X(x - Math.cos(r) * (M.PL / 2)).toFixed(1)} ${Y(y - Math.sin(r) * (M.PL / 2)).toFixed(1)}`);
      F.readout.textContent = `Heading ${f0(ph)}° · clearance to nearest wall or jamb here ${f0(Math.min(c, 999))} mm · tightest on this path ${DATA.mover.minClear} mm · longest ${M.D} mm-deep item that turns here ≈ ${f0(DATA.mover.longest)} mm`;
    }
    input.addEventListener("input", draw);
    player($("[data-act=play-plan]", card), input, 9000);
    F.hooks.plan = draw;
  })();

  // ================= wheel study =================
  (() => {
    const box = $("[data-wheel]"); if (!box) return;
    const M = DATA.mover.m;
    const wd = $("[data-i=wd]", box), sh = $("[data-i=sh]", box);
    const svg = $("svg", box);
    function draw() {
      const D = +wd.value, h = +sh.value, r = D / 2;
      const s = 1.15; // px per mm
      const floorY = 190, sillX = 200;
      const cx = sillX - Math.sqrt(Math.max(0, r * r - (r - Math.min(h, r)) ** 2)) * s, cy = floorY - r * s;
      $("[data-r=wheel]", svg).setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
      $("[data-r=wheel] .wheel", svg).setAttribute("r", (r * s).toFixed(1));
      const sill = $("[data-r=sill]", svg); sill.setAttribute("y", floorY - h * s); sill.setAttribute("height", h * s);
      const ratio = h >= r ? Infinity : Math.sqrt(2 * r * h - h * h) / (r - h);
      const load = ((1 - M.driveShare) * M.total) / 2; // two leading supports
      const F = ratio * load;
      $("[data-r=push]", svg).setAttribute("d", `M${(cx - r * s - 70).toFixed(1)} ${cy.toFixed(1)}H${(cx - r * s - 6).toFixed(1)}`);
      $("[data-r=lever]", svg).setAttribute("d", h > 0 ? `M${cx.toFixed(1)} ${cy.toFixed(1)}L${sillX} ${(floorY - h * s).toFixed(1)}` : "");
      $("[data-o=wd]", box).textContent = `${D} mm`;
      $("[data-o=sh]", box).textContent = `${h} mm`;
      const ok = F <= M.traction;
      $("[data-o=read]", box).innerHTML = `Push / wheel load = ${isFinite(ratio) ? ratio.toFixed(2) : "∞"}<br>Push to climb (2 leading wheels, ${f0(load)} N each) ≈ ${isFinite(F) ? f0(F) + " N" : "cannot climb"}<br>Drive traction ≈ ${f0(M.traction)} N → <strong style="color:${ok ? "#0E6027" : "#8A3800"}">${ok ? "climbs" : "stalls; needs a ramp"}</strong><br>Stowed height needed ≈ ${f0(D + 7)} mm (wheel + 7 mm deck and tray)`;
    }
    wd.addEventListener("input", draw); sh.addEventListener("input", draw); draw();
  })();

  // ---------- start ----------
  Object.values(figs).forEach((F) => { F.setView("asm"); readIso(F); applySel(F); });
  const start = (location.hash || "").replace("#", "");
  showTab(start === "mover" ? "mover" : "toolkit");
})();
