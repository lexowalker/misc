  // ===== Modular Power Toolkit explainer scenes (uses helpers from lib-head.js) =====
  const K = V.tk;

  // side section of job J1: front face at screen x `fx`, bottom-panel top at screen y `py`, s px/mm
  function section(fx, py, s, o2 = {}) {
    const X = (x) => fx + x * s, Z = (z) => py - z * s;
    let o = "";
    o += R(X(-300), Z(0), 330 * s, 18 * s, { fill: "url(#hatch)", stroke: C.ink });
    o += R(X(-300), Z(58), 300 * s, 18 * s, { fill: "url(#hatch)", stroke: C.ink });
    o += L(X(0), Z(-18), X(0), Z(110), { stroke: C.ink3, dash: "3 5" });
    // bolt: head Ø10 × 6, socket, shank
    const bx = X(-180);
    o += R(bx - 3 * s, Z(0), 6 * s, 24 * s, { fill: "#E4E6E9", stroke: C.ink });
    o += R(bx - 5 * s, Z(6), 10 * s, 6 * s, { fill: "#D0D3D8", stroke: C.ink, sw: 2 });
    const a = ((o2.turns || 0) * 2 * Math.PI) % (2 * Math.PI);
    o += L(bx + Math.sin(a) * 4 * s, Z(6), bx + Math.sin(a) * 4 * s, Z(0.5), { stroke: C.teal, sw: 3 });
    if (o2.labels !== false) {
      o += T(X(-292), Z(-9) + 6, "bottom panel", { size: 15, fill: C.ink2 });
      o += T(X(-292), Z(49) + 6, "drawer frame", { size: 15, fill: C.ink2 });
      o += T(X(6), Z(98), "front", { size: 15, fill: C.ink3 });
    }
    return o;
  }
  // D-head + power base, side view. Bit axis at screen x, bit tip at screen y.
  function dhead(x, tip, s, o2 = {}) {
    const top = tip - 25 * s, bot = tip - 9 * s, arm = 230;
    let o = "";
    o += R(x - 3.2 * s, top, 6.4 * s, 25 * s, { fill: C.tealT, stroke: C.teal, sw: 2 });
    o += R(x - 16 * s, top, (arm + 32) * s, 16 * s, { fill: "#EEF0F2", stroke: C.ink, rx: 8 * s, sw: 2 });
    o += R(x - 3.2 * s, top, 6.4 * s, 25 * s, { fill: C.tealT, stroke: C.teal, sw: 2 });
    o += R(x + (arm - 44) * s, top - 2.5 * s, 40 * s, 21 * s, { fill: "#C9CCD1", stroke: C.ink, rx: 4 * s });
    o += R(x + (arm + 16) * s, top - 5 * s, 16 * s, 22 * s, { fill: C.violetT, stroke: C.violet, rx: 3 * s, sw: 2 });
    if (o2.host !== false) o += R(x + (arm + 32) * s, top - 13 * s, 190 * s, 42 * s, { fill: "#E4E6E9", stroke: C.ink, rx: 12 * s, sw: 2 });
    if (o2.gears) {
      o += L(x + 12 * s, top + 8 * s, x + (arm + 30) * s, top + 8 * s, { stroke: C.teal, sw: 3 });
      o += R(x + 12 * s, top + 3 * s, 9 * s, 10 * s, { fill: C.tealT, stroke: C.teal, sw: 2 });
      o += R(x - 13 * s, top + 5 * s, 26 * s, 6 * s, { fill: C.tealT, stroke: C.teal, sw: 2 });
    }
    return o;
  }
  const hand = (x, y, k = 1) => P(`M${x - 40 * k} ${y}C${x - 40 * k} ${y - 26 * k} ${x - 14 * k} ${y - 44 * k} ${x + 16 * k} ${y - 40 * k}C${x + 40 * k} ${y - 36 * k} ${x + 52 * k} ${y - 18 * k} ${x + 50 * k} ${y}C${x + 48 * k} ${y + 10 * k} ${x + 36 * k} ${y + 14 * k} ${x + 30 * k} ${y + 8 * k}L${x + 22 * k} ${y}Z`, { fill: "#F5E9DF", stroke: "#6F6F6F" });

  // 1 · title
  scene(7, "", (t) => {
    const u = es(t, 0, 1.2);
    let o = T(110, 230, "Modular Power Toolkit", { size: 70, w: 600, op: u });
    o += T(112, 282, "A cordless toolkit for awkward spaces. Two candidate heads:", { size: 27, fill: C.ink2, op: es(t, 0.5, 1.6) });
    o += T(112, 318, "a flat right-angle hex driver, and an angled hammer.", { size: 27, fill: C.ink2, op: es(t, 0.5, 1.6) });
    o += T(112, 394, "Which one, if either, should you build first?", { size: 32, w: 600, fill: C.teal, op: es(t, 1.8, 2.8) });
    o += G(dhead(lerp(1400, 640, es(t, 1, 3.6)), 560, 1.25, { gears: false }), {});
    o += T(112, 470, "Explainer · decision file 2026-11-15 · US launch · USD", { size: 18, fill: C.ink3, mono: true, op: u });
    return o;
  }, []);

  // 2 · the job
  scene(11, "The job", (t) => {
    const s = 2.2, fx = 1000, py = 470;
    const X = (x) => fx + x * s, Z = (z) => py - z * s;
    let o = T(70, 110, "One real job: J1", { size: 40, w: 600 });
    o += G(section(fx, py, s), { op: es(t, 0.3, 1.2) });
    o += G(L(X(-260), Z(0), X(-260), Z(40), { stroke: C.rust, sw: 2.5, dash: "6 4", arrow: "aR" }) + L(X(-260), Z(40), X(-260), Z(0), { stroke: C.rust, sw: 2.5, dash: "6 4", arrow: "aR" }) + T(X(-252), Z(20) + 7, "40 mm gap", { size: 21, w: 600, fill: C.rust }), { op: es(t, 2.5, 3.2) });
    o += G(L(X(0), Z(84), X(-180), Z(84), { stroke: C.rust, sw: 2.5, dash: "6 4", arrow: "aR" }) + T(X(-90), Z(84) - 12, "180 mm deep", { size: 21, w: 600, fill: C.rust, a: "middle" }), { op: es(t, 3.2, 3.9) });
    o += G(T(X(-180), Z(-18) + 34, "M6 bolt, 4 mm hex", { size: 20, w: 600, a: "middle" }), { op: es(t, 1.4, 2) });
    ["Plumbers", "Electricians", "Furniture assemblers", "Homeowners"].forEach((n, i) => { o += chip(70 + [0, 150, 315, 560][i], 600, n, C.ink, "#F4F4F4", es(t, 6 + i * 0.6, 6.6 + i * 0.6)); });
    return o;
  }, [[0.4, 5.5, "A dresser bolt with a 4 mm hex socket, 180 mm back in a 40 mm gap."], [5.5, 11, "Plumbers, electricians, assemblers and homeowners all meet spots like this."]]);

  // 3 · what people use today
  scene(16, "Today’s tools", (t) => {
    const s = 1.7, fx = 860, py = 440;
    const X = (x) => fx + x * s, Z = (z) => py - z * s;
    const ph = t < 5 ? 0 : t < 10 ? 1 : 2;
    let o = T(70, 110, "What people use today", { size: 40, w: 600 });
    ["Right-angle adapter", "Compact hand ratchet", "Ball-end hex key"].forEach((n, i) => { o += R(70 + i * 300, 140, 284, 44, { fill: ph === i ? C.ink : C.paper, stroke: C.ink }); o += T(70 + i * 300 + 142, 169, n, { size: 19, w: 600, a: "middle", fill: ph === i ? "#fff" : C.ink }); });
    o += section(fx, py, s, { turns: ph === 2 ? es(t, 11, 15.5) * 6 : 0 });
    if (ph === 0) {
      const bx = lerp(120, 22, es(t, 0.4, 2.6));
      const tip = Z(6.5);
      o += R(X(bx) - 18 * s, tip - 51 * s, 40 * s, 26 * s, { fill: "#F7F7F7", stroke: C.ink, dash: "6 3" });
      o += R(X(bx) - 3 * s, tip - 25 * s, 6 * s, 25 * s, { fill: C.tealT, stroke: C.teal });
      o += R(X(bx) + 10 * s, tip - 45 * s, 160 * s, 24 * s, { fill: "#F7F7F7", stroke: C.ink, dash: "6 3", rx: 6 });
      o += G(R(X(-30), Z(58), 40 * s, 17.5 * s, { fill: "url(#hz)", stroke: C.rust }) + T(X(-40), Z(110), "51 mm head + 6 mm bolt = 57 mm. Gap is 40.", { size: 21, w: 600, fill: C.rust, a: "end" }), { op: es(t, 2.6, 3.2) });
    } else if (ph === 1) {
      const rx = X(-180);
      o += R(rx - 14, Z(30), 120, 16, { fill: "#E4E6E9", stroke: C.ink, rx: 8 });
      o += R(rx - 4, Z(30) + 16, 8, Z(6) - Z(30) - 16, { fill: C.tealT, stroke: C.teal });
      o += G(hand(rx + 210, Z(36), 1.5) + T(X(-40), Z(110), "Thin enough, but your hand can’t reach 180 mm in", { size: 21, w: 600, fill: C.rust, a: "end" }), { op: es(t, 6, 6.6) });
      o += G(R(X(0) - 6, Z(58) - 4, 26, 18 * s + 8, { fill: "url(#hz)", stroke: C.rust }), { op: es(t, 6.6, 7.2) });
    } else {
      const a = es(t, 11, 15.5) * 6 * 2 * Math.PI;
      const bx = X(-180);
      o += L(bx, Z(6), bx, Z(28), { stroke: C.teal, sw: 7 });
      o += L(bx, Z(28), bx + Math.cos(a) * 100 * s, Z(28) - Math.sin(a) * 14 * s, { stroke: C.teal, sw: 7 });
      const cx = 1060, cy = 290, r = 52, f = es(t, 10.5, 15.5);
      o += Ci(cx, cy, r, { fill: C.paper, stroke: C.ink, sw: 3 }) + P(`M${cx} ${cy}L${cx} ${cy - r + 8}`, { stroke: C.ink, sw: 3 }) + P(`M${cx} ${cy}L${r1(cx + Math.sin(f * 2 * Math.PI * 2.5) * (r - 14))} ${r1(cy - Math.cos(f * 2 * Math.PI * 2.5) * (r - 14))}`, { stroke: C.rust, sw: 4 });
      o += T(cx, cy + r + 34, "2–3 minutes", { size: 24, w: 600, a: "middle", fill: C.rust });
      o += T(X(-40), Z(110), "Reaches, but 24 turns a quarter at a time", { size: 21, w: 600, fill: C.rust, a: "end" });
    }
    return o;
  }, [[0, 5, "A right-angle drill adapter needs 57 mm. It can’t get in."], [5, 10, "A hand ratchet is thin enough, but your hand can’t reach that far."], [10, 16, "A hex key reaches, but 24 quarter turns take two to three minutes."]]);

  // 4 · the driver head
  scene(24, "The driver head", (t) => {
    let o = T(70, 100, "The D-head", { size: 40, w: 600 });
    // top: the drivetrain schematic
    const sx = 240, sy = 230, s1 = 2.0;
    o += G(dhead(sx, sy, s1, { gears: true, host: false }), { op: es(t, 0.3, 1.2) });
    o += G(T(sx + 40 * s1, sy - 34 * s1, "shaft down a 230 mm arm", { size: 19, fill: C.teal, w: 600 }), { op: es(t, 1.5, 2.1) });
    o += G(T(sx - 30, sy + 26, "pinion + crown gear: 2.6 × torque", { size: 19, fill: C.teal, w: 600 }), { op: es(t, 3, 3.6) });
    o += G(L(sx - 34 * s1, sy, sx - 34 * s1, sy - 25 * s1, { stroke: C.teal, sw: 2.5, arrow: "aT" }) + L(sx - 34 * s1, sy - 25 * s1, sx - 34 * s1, sy, { stroke: C.teal, sw: 2.5, arrow: "aT" }) + T(sx - 38 * s1 - 6, sy - 12 * s1 + 7, "25 mm", { size: 21, w: 600, mono: true, fill: C.teal, a: "end" }), { op: es(t, 5, 5.6) });
    o += G(T(sx + 380 * s1 * 0.6 + 120, sy - 40, "bit passes right through the gear", { size: 19, fill: C.ink2 }), { op: es(t, 5.6, 6.2) });
    // bottom: the job, animated
    const s = 1.4, fx = 640, py = 540;
    const X = (x) => fx + x * s, Z = (z) => py - z * s;
    const show = es(t, 7, 7.8);
    const bx = lerp(90, -180, es(t, 8, 12));
    const tipZ = 6.5 - 4 * es(t, 12.2, 13);
    const turns = es(t, 13.2, 17) * 24;
    let b = section(fx, py, s, { turns, labels: false });
    b += dhead(X(bx), Z(tipZ), s);
    b += hand(X(bx) + 206 * s, Z(tipZ + 27.5), 0.75);
    o += G(b, { op: show });
    const top = tipZ + 25;
    if (t > 8 && t < 13) o += G(L(X(bx) - 22, Z(top), X(bx) - 22, Z(40), { stroke: C.teal, sw: 2.5, arrow: "aT" }) + T(X(bx) - 30, Z(48), `${(40 - top).toFixed(1)} mm clear`, { size: 19, w: 600, mono: true, fill: C.teal, a: "end" }), { op: es(t, 8.4, 8.8) });
    if (t >= 13) o += G(T(X(60), Z(80), `${turns.toFixed(1)} / 24 turns · ${(turns / 24 * K.seconds).toFixed(1)} s`, { size: 22, w: 600, mono: true, fill: C.teal }), { op: es(t, 13, 13.4) });
    // reaction: plan inset
    const ix = 900, iy = 290;
    o += G(R(ix - 30, iy - 70, 340, 150, { fill: "#FAFBFC", stroke: C.rule }) + T(ix - 18, iy - 46, "From above: where the twist goes", { size: 16, fill: C.ink2 }) + R(ix, iy - 8, 260, 22, { fill: "#EEF0F2", stroke: C.ink, rx: 11 }) + R(ix + 200, iy - 12, 40, 30, { fill: "#C9CCD1", stroke: C.ink }) + P(`M${ix - 8} ${iy + 26}A26 26 0 0 1 ${ix - 8} ${iy - 22}`, { stroke: C.teal, sw: 3 }) + L(ix + 220, iy + 56, ix + 220, iy + 24, { stroke: C.teal, sw: 4, arrow: "aT" }) + T(ix + 232, iy + 60, `${Math.round(K.reactN)} N`, { size: 22, w: 600, fill: C.teal, mono: true }) + T(ix - 18, iy + 60, "8 N·m at the bolt", { size: 16, fill: C.teal }), { op: es(t, 18, 18.8) });
    return o;
  }, [[0.3, 7, "A shaft runs down the arm to a pinion and crown gear: 2.6 times the torque."], [7, 13, "The stack is only 25 mm, so it slides in with 8.5 mm to spare."], [13, 18, "It drops onto the bolt and spins it home in about nine seconds."], [18, 24, "Your other hand holds the sleeve and pushes back about 39 N."]]);

  // 5 · the family
  scene(15, "The family", (t) => {
    let o = T(70, 100, "What the family shares", { size: 40, w: 600 });
    const y = 300, h = 70;
    const blocks = [["bayonet coupling", 470, 70, C.teal, C.tealT], ["gearbox", 540, 110, C.teal, C.tealT], ["motor", 650, 120, C.blue, C.blueT], ["hinge (wires only)", 770, 70, C.violet, C.violetT], ["grip + trigger", 840, 170, C.violet, C.violetT], ["battery", 1010, 140, C.blue, C.blueT]];
    blocks.forEach(([n, x, w, col, bg], i) => {
      const g = es(t, 0.8 + i * 0.5, 1.3 + i * 0.5);
      o += G(R(x, y, w, h, { fill: bg, stroke: col, sw: 2, rx: 6 }) + L(x + w / 2, i % 2 ? y : y + h, x + w / 2, i % 2 ? y - 18 : y + h + 18, { stroke: col, sw: 1.5 }) + T(x + w / 2, i % 2 ? y - 26 : y + h + 40, n, { size: 17, a: "middle", fill: col, w: 600 }), { op: g });
    });
    o += G(T(470, y - 80, "Shared power base: everything expensive lives here", { size: 21, w: 600 }), { op: es(t, 0.5, 1) });
    // heads slide in from the left
    const dx = lerp(-300, 0, es(t, 5, 7));
    o += G(dhead(160 + dx, y + 52, 1.0, { host: false }) + T(150, y + 100, "D-head: develop", { size: 18, w: 600, fill: C.teal }), { op: es(t, 5, 5.4) });
    o += G(R(150, 470, 250, 60, { fill: "#F7F7F7", stroke: C.ink3, dash: "6 4", rx: 8 }) + T(275, 507, "H-head: paused", { size: 18, a: "middle", fill: C.ink3, w: 600 }), { op: es(t, 7, 7.5) });
    o += G(chip(470, 520, "Phase 1: the D-head plugs into a driver you already own", C.teal, C.tealT), { op: es(t, 10.5, 11.2) });
    return o;
  }, [[0.5, 5, "Share the battery, motor, gearbox, controls and one coupling."], [5, 10.5, "Keep the heads simple and mechanical. The hinge carries only wires."], [10.5, 15, "For phase one, the head plugs into a driver people already own."]]);

  // 6 · the hammer
  scene(19, "The hammer", (t) => {
    let o = T(70, 100, "The hammer head", { size: 40, w: 600 });
    const s = 1.7, jx = 200, cy = 330;
    const X = (x) => jx + x * s;
    o += R(X(-38), cy - 160, 38 * s, 300, { fill: "url(#hatch)", stroke: C.ink });
    o += R(X(150), cy - 160, 50 * s, 300, { fill: "#F0F1F3", stroke: C.ink2 });
    o += T(X(-36), cy - 172, "joist", { size: 16, fill: C.ink2 }) + T(X(152), cy - 172, "pipe", { size: 16, fill: C.ink2 });
    o += L(X(0), cy + 165, X(150), cy + 165, { stroke: C.rust, dash: "6 4", sw: 2 }) + T(X(75), cy + 192, "150 mm clear", { size: 18, a: "middle", fill: C.rust, w: 600 });
    const phase = t < 7 ? 0 : 1;
    const stick = phase === 0 ? 76 - 30 * es(t, 1, 6.5) : 76 - 60 * es(t, 7.5, 11);
    o += R(X(stick - 76), cy - 3, 76 * s, 6, { fill: "#9AA0A6", stroke: C.ink, sw: 0.8 }) + R(X(stick) - 2, cy - 7, 4, 14, { fill: "#9AA0A6", stroke: C.ink, sw: 0.8 });
    if (phase === 0) {
      const xp = 76 + 13, R0 = 48, dxp = xp - (stick + 13), th = Math.asin(clamp(dxp / R0, -1, 1));
      const px = X(xp), py = cy - R0 * 0.9 * s;
      o += Ci(px, py, 6, { fill: "#fff", stroke: C.ink, sw: 2 });
      o += G(L(px, py, px, cy, { stroke: C.teal, sw: 5 }) + R(px - 13 * s, cy - 14 * s, 26 * s, 28 * s, { fill: C.tealT, stroke: C.teal, sw: 2, rx: 4 }), { tr: `rotate(${r1(th * 180 / Math.PI)} ${r1(px)} ${r1(py)})` });
      o += T(760, 240, "Pivoting face", { size: 28, w: 600 }) + T(760, 280, `meets the nail ${(th * 180 / Math.PI).toFixed(0)}° off-square`, { size: 22, mono: true, fill: th > 0.15 ? C.rust : C.teal, w: 600 }) + T(760, 314, "blows turn glancing as the nail sinks", { size: 19, fill: C.ink2 });
    } else {
      const hit = Math.abs(Math.sin(t * 9)) * 10;
      o += R(X(stick), cy - 20 * s, 70 * s, 40 * s, { fill: "#EEF0F2", stroke: C.ink, rx: 8, sw: 2 });
      o += R(X(stick) + hit * s, cy - 6 * s, 30 * s, 12 * s, { fill: C.tealT, stroke: C.teal, rx: 3, sw: 2 });
      o += R(X(stick + 14), cy - 20 * s - 120, 42 * s, 120, { fill: "#E4E6E9", stroke: C.ink, rx: 10 });
      o += T(760, 240, "Straight-line striker", { size: 28, w: 600 }) + T(760, 280, "every blow on the nail axis ✓", { size: 22, fill: C.good, w: 600 });
    }
    // clearance bars
    const bars = [["Straight-line striker", 146], ["Bostitch PN50 palm nailer", 183], ["Milwaukee M12 palm nailer", 241]];
    const bx0 = 760, sc = 1.7;
    bars.forEach(([n, v], i) => {
      const g = es(t, 11.5 + i * 0.6, 12.1 + i * 0.6), yy = 400 + i * 52;
      o += G(T(bx0, yy - 6, n, { size: 16, fill: C.ink2 }) + R(bx0, yy, v * sc * g, 18, { fill: v <= 150 ? C.teal : "#A8B0BA" }) + T(bx0 + v * sc * g + 8, yy + 15, `${v} mm`, { size: 16, mono: true, w: 600, fill: v <= 150 ? C.teal : C.ink }), { op: g });
    });
    o += G(L(bx0 + 150 * sc, 384, bx0 + 150 * sc, 530, { stroke: C.rust, sw: 2, dash: "5 3" }) + T(bx0 + 150 * sc, 548, "gap 150", { size: 15, a: "middle", fill: C.rust }), { op: es(t, 12, 12.6) });
    o += G(chip(760, 600, "Palm nailers cover ≥ 183 mm for $55–203 → pause", C.rust, C.rustT), { op: es(t, 14.5, 15.2) });
    return o;
  }, [[0, 7, "A pivoting face only hits squarely at one point in its arc."], [7, 11.5, "A straight-line striker keeps every blow on the nail. It wins."], [11.5, 19, "But palm nailers already cover any space over 183 mm. Hammer paused."]]);

  // 7 · market
  scene(15, "The market", (t) => {
    let o = T(70, 110, "What people can buy today (US, listings 2026-11-15)", { size: 32, w: 600 });
    const rows = [["Ball-end hex keys, 9-pc (Bondhus)", 32, 32], ["Wera Zyklop Mini bit ratchet", 42, 47], ["DeWalt right-angle adapter", 20, 49], ["Milwaukee right-angle adapter", 46, 50], ["Bosch FlexiClick 5-in-1 kit", 140, 238], ["Milwaukee M12 installation driver", 199, 248], ["Milwaukee extended-reach ratchet", 249, 249], ["D-head, target retail", 49, 59]];
    const x0 = 500, sc = 2.6;
    rows.forEach(([n, lo, hi], i) => {
      const y = 150 + i * 52, us = i === rows.length - 1, g = es(t, 0.5 + i * 0.7, 1.3 + i * 0.7);
      o += G(T(x0 - 20, y + 24, n, { a: "end", size: 20, w: us ? 600 : 400, fill: us ? C.teal : C.ink }), { op: g });
      o += R(x0, y + 6, lo * sc * g, 26, { fill: us ? C.tealT : "#A8B0BA", stroke: us ? C.teal : "none" });
      if (hi > lo) o += R(x0 + lo * sc, y + 6, (hi - lo) * sc * g, 26, { fill: us ? "url(#sw)" : "#D0D5DB", stroke: us ? C.teal : "none" });
      o += G(T(x0 + hi * sc * g + 10, y + 26, lo === hi ? `$${lo}` : `$${lo}–${hi}`, { size: 19, mono: true, w: 600, fill: us ? C.teal : C.ink }), { op: g });
    });
    o += G(chip(70, 600, "Why people won’t switch: a rare job, and a hex key is free", C.rust, C.rustT), { op: es(t, 10, 10.7) });
    return o;
  }, [[0, 6, "Adapters cost $20–50, a bit ratchet about $45, modular drivers $140–250."], [6, 10, "The D-head would need to sell for around $50–60."], [10, 15, "Strongest reason not to switch: it’s a rare job, and a hex key is free."]]);

  // 8 · costs
  scene(12, "What it costs", (t) => {
    let o = T(70, 120, "What it would cost you", { size: 40, w: 600 });
    const card = (i, a, title, n, l1, l2, col) => G(R(70 + i * 385, 170, 360, 380, { fill: C.paper, stroke: C.rule }) + T(94 + i * 385, 214, title, { size: 21, w: 600, fill: C.ink2 }) + T(94 + i * 385, 296, n, { size: 36, w: 600, mono: true, fill: col }) + T(94 + i * 385, 350, l1, { size: 20, fill: C.ink2 }) + T(94 + i * 385, 380, l2, { size: 20, fill: C.ink2 }), { op: es(t, a, a + 0.7) });
    o += card(0, 0.4, "Tested prototype", K.proto, `$${fmt(K.protoCash)} parts (you buy)`, `+ ${K.protoLab} engineer`, C.teal);
    o += card(1, 3, "Pilot · 100 units", K.p100, `landed ${K.l100} per unit`, "machined housings", C.blue);
    o += card(2, 6, "First run · 1,000 units", K.p1000, `landed ${K.l1000} per unit`, "vs ≈ $50 retail: thin margin", C.violet);
    return o;
  }, [[0, 3, `A tested prototype: about ${K.proto}, including an engineer.`], [3, 6, `A 100-unit pilot needs about ${K.p100}.`], [6, 12, `At 1,000 units each lands at ${K.l1000}: room at $50, but not a lot.`]]);

  // 9 · verdict
  scene(18, "The verdict", (t) => {
    let o = T(70, 120, "Verdict:", { size: 40, w: 600 }) + T(250, 120, "narrow it", { size: 40, w: 600, fill: "#8E6A00" });
    o += G(T(70, 160, "Develop the driver head as an attachment. Pause the hammer.", { size: 22, fill: C.ink2 }), { op: es(t, 0.6, 1.2) });
    o += G(R(70, 186, 1140, 80, { fill: C.paper, stroke: C.ink, sw: 2 }) + T(94, 220, `Next step · ${K.stage0} · 2 weekends`, { size: 22, w: 600 }) + T(94, 250, "Measure 20 real awkward fasteners. Time today’s tools on them.", { size: 20, fill: C.ink2 }), { op: es(t, 2.5, 3.2) });
    const box = (x, y, w, h, title, sub, col, bg, a) => G(R(x, y, w, h, { fill: bg, stroke: col, sw: 2 }) + T(x + 18, y + 36, title, { size: 22, w: 600, fill: col }) + T(x + 18, y + 68, sub, { size: 19, fill: C.ink2 }), { op: es(t, a, a + 0.6) });
    o += box(440, 296, 400, 84, "Where do the fasteners sit?", "gap height · depth · time per tool", C.ink, C.paper, 5);
    const branch = (x, label, title, sub, col, bg, a) => G(L(640, 380, x + 170, 424, { stroke: col, sw: 2.5, arrow: col === C.rust ? "aR" : col === C.teal ? "aT" : "aK" }) + T(x + 170, 448, label, { size: 17, fill: col, a: "middle", w: 600 }), { op: es(t, a, a + 0.5) }) + box(x, 460, 340, 110, title, sub, col, bg, a + 0.3);
    o += branch(60, "≥ 30% in 36–57 mm gaps", "Build the prototype", "the cheap tools fail there", C.teal, C.tealT, 7.5);
    o += branch(470, "many nail bays 146–183 mm", "Revisit the hammer", "only then", C.blue, C.blueT, 10);
    o += branch(880, "adapter or key ≈ always < 1 min", "Pause", "today’s tools are enough", C.rust, C.rustT, 12.5);
    return o;
  }, [[0, 5, "Verdict: narrow it. Develop the driver head as an attachment; pause the hammer."], [5, 12, "Next: a $174 survey of real fasteners. 30% in 36–57 mm gaps means build it."], [12, 18, "If a cheap adapter or hex key handles almost all of them quickly, pause."]]);

  // 10 · end
  scene(6, "", (t) => {
    let o = T(640, 300, "Modular Power Toolkit", { size: 54, w: 600, a: "middle", op: es(t, 0, 0.8) });
    o += T(640, 356, "A real mechanical edge, in a narrow niche.", { size: 28, a: "middle", fill: C.teal, op: es(t, 0.5, 1.2) });
    o += T(640, 420, "Full drawings, sources and calculations are in the decision file.", { size: 22, a: "middle", fill: C.ink2, op: es(t, 1, 1.6) });
    return o;
  }, []);
