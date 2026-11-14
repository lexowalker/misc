// Shared helpers: API calls, tempo mapping, note names, WAV encoding.

export const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const pitchName = (p) => NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1);

export async function api(path, opts = {}) {
  const o = { ...opts };
  if (o.json !== undefined) {
    o.method = o.method || "POST";
    o.headers = { "Content-Type": "application/json", ...(o.headers || {}) };
    o.body = JSON.stringify(o.json);
    delete o.json;
  }
  const r = await fetch(path, o);
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = j.error || j.detail || JSON.stringify(j); } catch { /* not json */ }
    throw new Error(msg);
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r;
}

export async function waitJob(jid, onProgress) {
  for (;;) {
    const j = await api(`/api/jobs/${jid}`);
    onProgress && onProgress(j);
    if (j.status === "done") return j.result;
    if (j.status === "error") throw new Error(j.error);
    await new Promise((r) => setTimeout(r, 400));
  }
}

let idc = 0;
export const newId = (p = "n") => p + Math.random().toString(36).slice(2, 9) + (idc++);

// Same semantics as server/core.py Tempo.
export class Tempo {
  constructor(project) {
    this.bpm = project.bpm || 120;
    const tm = project.tempoMap;
    if (tm && tm.length >= 2) {
      this.b = tm.map((a) => a[0]);
      this.s = tm.map((a) => a[1]);
    } else this.b = this.s = null;
  }
  static _interp(x, xs, ys) {
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return ys[0] + (x - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0]);
    if (x >= xs[hi]) return ys[hi] + (x - xs[hi]) * (ys[hi] - ys[hi - 1]) / (xs[hi] - xs[hi - 1]);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return ys[lo] + (x - xs[lo]) * (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]);
  }
  sec(beat) { return this.b ? Tempo._interp(beat, this.b, this.s) : beat * 60 / this.bpm; }
  beat(sec) { return this.b ? Tempo._interp(sec, this.s, this.b) : sec * this.bpm / 60; }
}

export function endBeat(project) {
  let e = 0;
  for (const t of project.tracks) for (const n of t.notes) e = Math.max(e, n.s + n.d);
  return e;
}

export const fmtTime = (sec) => {
  if (!isFinite(sec)) return "0:00";
  const neg = sec < 0; sec = Math.abs(sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return (neg ? "-" : "") + m + ":" + String(s).padStart(2, "0");
};
export const parseTime = (str) => {
  const m = String(str).trim().match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1] * 60 + +m[2];
  const v = parseFloat(str);
  return isFinite(v) ? v : null;
};

// gleitz/midi-js-soundfonts file name for a GM program name.
export const sfName = (gmName) => gmName.toLowerCase().replace(/-/g, "").replace(/[()+]/g, "").trim().replace(/ /g, "_");

export function encodeWav(channels, sampleRate) {
  const n = channels[0].length, nc = channels.length;
  const buf = new ArrayBuffer(44 + n * nc * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * nc * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nc * 2, true);
  v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
    const x = Math.max(-1, Math.min(1, channels[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

export function downsample(data, from, to) {
  if (from === to) return data;
  const ratio = from / to, n = Math.floor(data.length / ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.min(data.length, Math.floor((i + 1) * ratio));
    let s = 0; for (let j = a; j < b; j++) s += data[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
