// Canvas views: the arrangement (all tracks + ruler, sections, chords) and the piano roll.
import { clamp, pitchName, newId, endBeat } from "./util.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [g, r.width, r.height];
}

function drawGrid(g, app, w, h, top) {
  const { ppb, scrollX } = app.view;
  const bpb = app.project.timeSig[0];
  const b0 = Math.floor(scrollX / ppb), b1 = Math.ceil((scrollX + w) / ppb);
  const sub = ppb > 80 ? 4 : ppb > 40 ? 2 : 1;
  for (let b = b0; b <= b1; b++) {
    for (let s = 0; s < sub; s++) {
      const x = Math.round((b + s / sub) * ppb - scrollX) + 0.5;
      g.strokeStyle = s ? css("--grid-sub") : b % bpb === 0 ? css("--grid-bar") : css("--grid-beat");
      if (!s && b % bpb !== 0 && ppb < 10) continue;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, h); g.stroke();
    }
  }
}

function drawPlayhead(g, app, h) {
  const x = app.playheadBeat * app.view.ppb - app.view.scrollX;
  g.fillStyle = css("--playhead");
  g.fillRect(Math.round(x), 0, 1.5, h);
}

function drawRange(g, app, h, top = 0) {
  const r = app.range;
  if (!r) return;
  const x0 = r.start * app.view.ppb - app.view.scrollX, x1 = r.end * app.view.ppb - app.view.scrollX;
  g.fillStyle = app.engine.loop ? css("--loop") : css("--range");
  g.fillRect(x0, top, x1 - x0, h - top);
}

// ------------------------------------------------------------------ arrangement
export class Arrangement {
  constructor(canvas, app) {
    this.c = canvas; this.app = app;
    this.RULER = 22; this.SECT = 18; this.CHORD = 18;
    canvas.addEventListener("mousedown", (e) => this.down(e));
    canvas.addEventListener("wheel", (e) => this.app.wheel(e, this), { passive: false });
    canvas.addEventListener("dblclick", (e) => this.dbl(e));
  }
  get head() { return this.RULER + this.SECT + this.CHORD; }
  laneH() { return this.app.view.laneH; }
  draw() {
    const app = this.app, p = app.project;
    const [g, w, h] = setupCanvas(this.c);
    this.w = w;
    g.fillStyle = css("--bg-2"); g.fillRect(0, 0, w, h);
    const { ppb, scrollX } = app.view;
    const X = (b) => b * ppb - scrollX;
    // lanes
    const lh = this.laneH(), top = this.head, sy = app.view.scrollYArr || 0;
    p.tracks.forEach((t, i) => {
      const y = top + i * lh - sy;
      g.fillStyle = t.id === app.selectedTrack ? css("--lane-sel") : i % 2 ? css("--lane-a") : css("--lane-b");
      g.fillRect(0, y, w, lh);
    });
    if (app.hasReference()) {
      const y = top + p.tracks.length * lh - sy;
      g.fillStyle = css("--lane-ref"); g.fillRect(0, y, w, lh);
      this.drawWave(g, y, lh, w);
    }
    drawGrid(g, app, w, h, top);
    drawRange(g, app, h, 0);
    // notes
    p.tracks.forEach((t, i) => {
      const y = top + i * lh - sy;
      if (!t.notes.length || y > h || y + lh < top) return;
      let lo = 127, hi = 0;
      for (const n of t.notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
      const span = Math.max(12, hi - lo + 1), nh = Math.max(1.5, (lh - 8) / span);
      g.fillStyle = t.mute ? css("--muted") : t.color;
      g.globalAlpha = 0.9;
      const bL = scrollX / ppb, bR = (scrollX + w) / ppb;
      for (const n of t.notes) {
        if (n.s + n.d < bL || n.s > bR) continue;
        const ny = y + 4 + (hi - n.p) * ((lh - 8 - nh) / Math.max(1, span - 1));
        g.fillRect(X(n.s), ny, Math.max(1, n.d * ppb - 0.5), nh);
      }
      g.globalAlpha = 1;
    });
    // header strips
    g.fillStyle = css("--bg-3"); g.fillRect(0, 0, w, top);
    g.font = "11px var(--font-ui), system-ui"; g.textBaseline = "middle";
    const bpb = p.timeSig[0];
    const step = ppb * bpb < 30 ? 4 : ppb * bpb < 60 ? 2 : 1;
    const b0 = Math.floor(scrollX / ppb / bpb), b1 = Math.ceil((scrollX + w) / ppb / bpb);
    for (let bar = b0; bar <= b1; bar++) {
      if (bar % step) continue;
      const x = X(bar * bpb);
      g.fillStyle = css("--text-dim"); g.fillText(String(bar + 1), x + 3, this.RULER / 2 + 1);
      g.fillStyle = css("--grid-bar"); g.fillRect(Math.round(x), this.RULER - 6, 1, 6);
    }
    // sections
    (p.sections || []).forEach((s, i) => {
      const x0 = X(s.start), x1 = X(s.end), y = this.RULER;
      g.fillStyle = i % 2 ? css("--sect-a") : css("--sect-b");
      g.fillRect(x0, y + 1, x1 - x0 - 1, this.SECT - 2);
      g.fillStyle = css("--text"); g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, this.SECT); g.clip();
      g.fillText(s.name, x0 + 4, y + this.SECT / 2); g.restore();
    });
    // chords
    const cy = this.RULER + this.SECT;
    let lastX = -1e9;
    for (const c of p.chords || []) {
      const x = X(c.start);
      if (x > w || X(c.start + c.dur) < 0) continue;
      g.fillStyle = css("--grid-beat"); g.fillRect(Math.round(x), cy + 3, 1, this.CHORD - 6);
      if (x - lastX > 34) { g.fillStyle = css("--text-dim"); g.fillText(c.name, x + 3, cy + this.CHORD / 2); lastX = x; }
    }
    g.fillStyle = css("--border"); g.fillRect(0, top - 1, w, 1);
    drawPlayhead(g, app, h);
  }
  drawWave(g, y, lh, w) {
    const app = this.app, buf = app.engine.refBuffer;
    if (!buf) return;
    if (!this.peaks || this.peaksFor !== buf) {
      const d = buf.getChannelData(0), bins = Math.ceil(buf.duration * 50), per = Math.floor(d.length / bins);
      this.peaks = new Float32Array(bins);
      for (let i = 0; i < bins; i++) { let m = 0; for (let j = i * per; j < (i + 1) * per; j += 8) m = Math.max(m, Math.abs(d[j] || 0)); this.peaks[i] = m; }
      this.peaksFor = buf;
    }
    const synced = app.project.reference?.synced !== false;
    g.fillStyle = synced ? css("--wave") : css("--muted");
    const tempo = app.tempo();
    const mid = y + lh / 2;
    for (let x = 0; x < w; x += 2) {
      const sec = tempo.sec((x + app.view.scrollX) / app.view.ppb);
      const i = Math.floor(sec * 50);
      if (i < 0 || i >= this.peaks.length) continue;
      const a = this.peaks[i] * (lh / 2 - 3);
      g.fillRect(x, mid - a, 1.5, a * 2);
    }
    if (!synced) { g.fillStyle = css("--text-dim"); g.fillText("reference out of sync (timing edited)", 8, y + 10); }
  }
  hit(e) {
    const r = this.c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const beat = (x + this.app.view.scrollX) / this.app.view.ppb;
    const lane = Math.floor((y - this.head + (this.app.view.scrollYArr || 0)) / this.laneH());
    return { x, y, beat, lane };
  }
  dbl(e) {
    const h = this.hit(e);
    if (h.y < this.RULER + this.SECT && h.y > this.RULER) {
      const s = (this.app.project.sections || []).find((s) => h.beat >= s.start && h.beat < s.end);
      if (s) { this.app.setRange(s.start, s.end); }
    }
  }
  down(e) {
    const app = this.app, h = this.hit(e);
    const snap = (b) => app.snapBeat(b, true);
    if (h.y < this.head) {
      // ruler / sections: click sets playhead, drag selects range
      if (h.y > this.RULER && h.y < this.RULER + this.SECT && e.detail === 1) {
        const s = (app.project.sections || []).find((s) => h.beat >= s.start && h.beat < s.end);
        if (s && e.altKey) { app.setRange(s.start, s.end); return; }
      }
      const b0 = snap(h.beat);
      app.seek(Math.max(0, h.beat));
      let moved = false;
      const mv = (ev) => {
        const hh = this.hit(ev); moved = true;
        const b1 = snap(hh.beat);
        app.setRange(Math.min(b0, b1), Math.max(b0, b1));
      };
      const up = () => {
        window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
        if (!moved) app.setRange(null);
      };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      return;
    }
    if (h.lane >= 0 && h.lane < app.project.tracks.length) app.selectTrack(app.project.tracks[h.lane].id);
    // drag in lanes selects a time range too
    const b0 = snap(h.beat);
    let moved = false;
    const mv = (ev) => { moved = true; const b1 = snap(this.hit(ev).beat); app.setRange(Math.min(b0, b1), Math.max(b0, b1)); };
    const up = () => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
      if (!moved) app.seek(Math.max(0, h.beat));
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
}

// ------------------------------------------------------------------ piano roll
export class PianoRoll {
  constructor(canvas, keys, app) {
    this.c = canvas; this.k = keys; this.app = app;
    this.sel = new Set();
    this.scrollY = 0; // in pitch rows from top (127 at top)
    canvas.addEventListener("mousedown", (e) => this.down(e));
    canvas.addEventListener("mousemove", (e) => this.hover(e));
    canvas.addEventListener("dblclick", (e) => this.dbl(e));
    canvas.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return this.app.wheel(e, this);
      e.preventDefault();
      this.scrollY = clamp(this.scrollY + e.deltaY / this.rowH(), 0, 128 - this.h / this.rowH());
      this.app.redraw();
    }, { passive: false });
    keys.addEventListener("mousedown", (e) => {
      const r = keys.getBoundingClientRect();
      const p = this.pitchAt(e.clientY - r.top);
      const t = this.track(); if (t) this.app.engine.preview(t.program, p);
    });
  }
  rowH() { return this.app.view.rowH; }
  track() { return this.app.project.tracks.find((t) => t.id === this.app.selectedTrack); }
  pitchAt(y) { return clamp(127 - Math.floor(y / this.rowH() + this.scrollY), 0, 127); }
  yOf(p) { return (127 - p - this.scrollY) * this.rowH(); }
  centerOn(t) {
    if (!t || !t.notes.length) { this.scrollY = clamp(127 - 72 - (this.h || 300) / this.rowH() / 2, 0, 127); return; }
    const ps = t.notes.map((n) => n.p).sort((a, b) => a - b);
    const mid = ps[Math.floor(ps.length / 2)];
    this.scrollY = clamp(127 - mid - (this.h || 300) / this.rowH() / 2, 0, 127);
  }
  draw() {
    const app = this.app, t = this.track();
    const [g, w, h] = setupCanvas(this.c);
    this.w = w; this.h = h;
    const rh = this.rowH();
    const { ppb, scrollX } = app.view;
    const scale = new Set(app.scalePcs());
    const p0 = this.pitchAt(h), p1 = this.pitchAt(0);
    for (let p = p0; p <= p1; p++) {
      const y = this.yOf(p);
      g.fillStyle = scale.has(p % 12) ? css("--row-in") : css("--row-out");
      g.fillRect(0, y, w, rh);
      if (p % 12 === 0) { g.fillStyle = css("--grid-bar"); g.fillRect(0, y + rh - 1, w, 1); }
    }
    drawGrid(g, app, w, h, 0);
    drawRange(g, app, h);
    // ghost notes from other tracks
    if (app.view.ghosts) {
      g.fillStyle = css("--ghost");
      for (const o of app.project.tracks) {
        if (o === t || o.mute) continue;
        for (const n of o.notes) {
          const x = n.s * ppb - scrollX;
          if (x > w || x + n.d * ppb < 0 || n.p < p0 || n.p > p1) continue;
          g.fillRect(x, this.yOf(n.p) + 1, Math.max(1, n.d * ppb - 1), rh - 2);
        }
      }
    }
    if (t) {
      for (const n of t.notes) {
        const x = n.s * ppb - scrollX;
        if (x > w || x + n.d * ppb < 0 || n.p < p0 - 1 || n.p > p1 + 1) continue;
        const y = this.yOf(n.p), nw = Math.max(2, n.d * ppb - 1);
        const selected = this.sel.has(n.id);
        g.globalAlpha = 0.45 + 0.55 * (n.v / 127);
        g.fillStyle = selected ? css("--note-sel") : t.color;
        g.fillRect(x, y + 1, nw, rh - 2);
        g.globalAlpha = 1;
        if (selected) { g.strokeStyle = css("--text"); g.lineWidth = 1; g.strokeRect(x + 0.5, y + 1.5, nw - 1, rh - 3); }
        if (rh >= 11 && nw > 26) { g.fillStyle = "rgba(0,0,0,.65)"; g.font = "9px system-ui"; g.textBaseline = "middle"; g.fillText(pitchName(n.p), x + 3, y + rh / 2); }
      }
    }
    if (this.marquee) {
      const m = this.marquee;
      g.strokeStyle = css("--accent"); g.setLineDash([4, 3]);
      g.strokeRect(Math.min(m.x0, m.x1) + 0.5, Math.min(m.y0, m.y1) + 0.5, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      g.setLineDash([]);
    }
    drawPlayhead(g, app, h);
    if (!t) { g.fillStyle = css("--text-dim"); g.font = "13px system-ui"; g.fillText("Select a track to edit its notes", 16, 24); }
    this.drawKeys();
  }
  drawKeys() {
    const [g, w, h] = setupCanvas(this.k);
    const rh = this.rowH();
    const p0 = this.pitchAt(h), p1 = this.pitchAt(0);
    for (let p = p0; p <= p1; p++) {
      const y = this.yOf(p), black = [1, 3, 6, 8, 10].includes(p % 12);
      g.fillStyle = black ? "#1d1f24" : "#d9dbe0";
      g.fillRect(0, y, w, rh);
      g.fillStyle = "#00000033"; g.fillRect(0, y + rh - 1, w, 1);
      if (p % 12 === 0 && rh >= 7) { g.fillStyle = "#333"; g.font = "9px system-ui"; g.textBaseline = "middle"; g.fillText(pitchName(p), 4, y + rh / 2); }
    }
  }
  pos(e) {
    const r = this.c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return { x, y, beat: (x + this.app.view.scrollX) / this.app.view.ppb, p: this.pitchAt(y) };
  }
  noteAt(pos) {
    const t = this.track(); if (!t) return null;
    const ppb = this.app.view.ppb;
    for (let i = t.notes.length - 1; i >= 0; i--) {
      const n = t.notes[i];
      if (n.p === pos.p && pos.beat >= n.s && pos.beat <= n.s + n.d) {
        const edge = (n.s + n.d - pos.beat) * ppb < Math.min(8, n.d * ppb / 3);
        return { n, edge };
      }
    }
    return null;
  }
  hover(e) {
    if (this.dragging) return;
    const h = this.noteAt(this.pos(e));
    this.c.style.cursor = h ? (h.edge ? "ew-resize" : "grab") : this.app.tool === "draw" ? "crosshair" : "default";
  }
  dbl(e) {
    const pos = this.pos(e), t = this.track();
    if (!t) return;
    const hit = this.noteAt(pos);
    this.app.commit();
    if (hit) { t.notes = t.notes.filter((n) => n !== hit.n); this.sel.delete(hit.n.id); }
    else this.addNote(t, pos);
    this.app.changed();
  }
  addNote(t, pos) {
    const len = this.app.lastLen || this.app.snap || 0.5;
    const n = { id: newId(), p: pos.p, s: this.app.snapBeat(pos.beat, false), d: len, v: this.app.lastVel || 90 };
    t.notes.push(n); t.notes.sort((a, b) => a.s - b.s);
    this.sel = new Set([n.id]);
    this.app.engine.preview(t.program, n.p, n.v);
    return n;
  }
  down(e) {
    const app = this.app, t = this.track();
    if (!t || e.button !== 0) return;
    const pos = this.pos(e);
    const hit = this.noteAt(pos);
    if (!hit && (app.tool === "draw" || e.altKey)) {
      app.commit();
      const n = this.addNote(t, pos);
      this.dragNotes(e, pos, [n], "resize", true);
      return;
    }
    if (!hit) {
      if (!e.shiftKey) this.sel.clear();
      this.marquee = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      const before = new Set(this.sel);
      const mv = (ev) => {
        const q = this.pos(ev); this.marquee.x1 = q.x; this.marquee.y1 = q.y;
        const bA = Math.min(pos.beat, q.beat), bB = Math.max(pos.beat, q.beat);
        const pA = Math.min(pos.p, q.p), pB = Math.max(pos.p, q.p);
        this.sel = new Set(before);
        for (const n of t.notes) if (n.s + n.d > bA && n.s < bB && n.p >= pA && n.p <= pB) this.sel.add(n.id);
        app.redraw();
      };
      const up = (ev) => {
        window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
        const m = this.marquee; this.marquee = null;
        if (Math.abs(m.x1 - m.x0) < 3 && Math.abs(m.y1 - m.y0) < 3) app.seek(Math.max(0, pos.beat));
        app.selectionChanged(); app.redraw();
        void ev;
      };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      return;
    }
    if (e.shiftKey) {
      if (this.sel.has(hit.n.id)) this.sel.delete(hit.n.id); else this.sel.add(hit.n.id);
      app.selectionChanged(); app.redraw();
      return;
    }
    if (!this.sel.has(hit.n.id)) this.sel = new Set([hit.n.id]);
    app.engine.preview(t.program, hit.n.p, hit.n.v);
    app.selectionChanged();
    const notes = t.notes.filter((n) => this.sel.has(n.id));
    app.commit();
    this.dragNotes(e, pos, notes, hit.edge ? "resize" : "move", false, hit.n);
  }
  dragNotes(e, pos, notes, mode, isNew, anchor) {
    const app = this.app, t = this.track();
    const orig = notes.map((n) => ({ n, s: n.s, p: n.p, d: n.d }));
    let lastP = anchor ? anchor.p : null;
    let changed = isNew;
    this.dragging = true;
    const mv = (ev) => {
      const q = this.pos(ev);
      let db = q.beat - pos.beat;
      if (mode === "move") {
        const dp = q.p - pos.p;
        const a0 = anchor ? orig.find((o) => o.n === anchor).s : orig[0].s;
        const snapped = ev.altKey ? a0 + db : app.snapBeat(a0 + db, false);
        db = snapped - a0;
        for (const o of orig) { o.n.s = Math.max(0, o.s + db); o.n.p = clamp(o.p + dp, 0, 127); }
        if (anchor && anchor.p !== lastP) { lastP = anchor.p; app.engine.preview(t.program, anchor.p, anchor.v, 0.2); }
      } else {
        for (const o of orig) {
          const end = ev.altKey ? o.s + o.d + db : app.snapBeat(o.s + o.d + db, false);
          o.n.d = Math.max(app.snap ? Math.min(app.snap, 0.0625) : 0.03, end - o.s);
        }
      }
      changed = true;
      app.redraw();
    };
    const up = () => {
      this.dragging = false;
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
      if (changed) {
        if (mode === "resize" && notes.length === 1) app.lastLen = notes[0].d;
        t.notes.sort((a, b) => a.s - b.s || a.p - b.p);
        app.changed();
      } else app.discardCommit();
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  selectedNotes() {
    const t = this.track(); if (!t) return [];
    return t.notes.filter((n) => this.sel.has(n.id));
  }
  selectAll() { const t = this.track(); if (t) this.sel = new Set(t.notes.map((n) => n.id)); }
  _end() { return endBeat(this.app.project); }
}
