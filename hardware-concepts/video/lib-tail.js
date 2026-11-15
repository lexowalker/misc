  // Optional narration timing: V.timing[i] = real seconds for scene i. Each scene's animation is
  // time-stretched to fit, so the drawing and its readouts stay in step with the voice.
  const real = S.map((sc, i) => (V.timing && V.timing[i]) || sc.dur);
  const total = real.reduce((s, x) => s + x, 0);
  window.TOTAL = total;
  window.renderAt = (tg) => {
    let acc = 0, idx = 0;
    while (idx < S.length - 1 && tg >= acc + real[idx]) { acc += real[idx]; idx++; }
    const sc = S[idx], tr = tg - acc, D = real[idx];
    // optional piecewise cue map [[realSeconds, sceneSeconds], ...] keeps key moments on the spoken words
    const wp = V.warp && V.warp[idx];
    let t = tr * (sc.dur / D);
    if (wp) { const pts = [[0, 0], ...wp, [D, sc.dur]]; for (let i = 1; i < pts.length; i++) if (tr <= pts[i][0]) { const [a0, b0] = pts[i - 1], [a1, b1] = pts[i]; t = b0 + ((b1 - b0) * (tr - a0)) / Math.max(1e-6, a1 - a0); break; } }
    const fade = Math.min(es(tr, 0, 0.45), 1 - es(tr, D - 0.4, D));
    let o = `${DEFS}<rect width="${W}" height="${H}" fill="${C.page}"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="${C.paper}" stroke="${C.rule}"/>`;
    o += `<g opacity="${r1(fade * 100) / 100}">${sc.draw(t)}</g>`;
    if (sc.label) o += T(W - 50, 58, `${String(idx).padStart(2, "0")} · ${sc.label.toUpperCase()}`, { size: 15, a: "end", fill: C.ink3, mono: true });
    // subtitles: the spoken words when a voiceover is present, otherwise the scene's own captions
    let cap = null, op = 0;
    if (V.subs) { cap = V.subs.find(([a, b]) => tg >= a && tg < b); if (cap) op = Math.min(es(tg, cap[0] - 0.05, cap[0] + 0.15), 1 - es(tg, cap[1] - 0.1, cap[1])); }
    else { cap = sc.caps.find(([a, b]) => t >= a && t < b); if (cap) { const k = D / sc.dur; op = Math.min(es(tr, cap[0] * k, cap[0] * k + 0.3), 1 - es(tr, cap[1] * k - 0.25, cap[1] * k)); } }
    if (cap) {
      o += G(`<rect x="24" y="${H - 96}" width="${W - 48}" height="72" fill="${C.ink}"/>` + T(W / 2, H - 50, cap[2], { size: 24, a: "middle", fill: "#fff", w: 500 }), { op });
    }
    // progress bar
    o += `<rect x="24" y="${H - 27}" width="${r1((W - 48) * (tg / total))}" height="3" fill="${C.teal}"/>`;
    document.getElementById("v").innerHTML = o;
  };
})();
