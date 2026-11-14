// RefDAW main controller: state, undo, track headers, transport, dialogs, assistant, humming.
import { api, waitJob, Tempo, endBeat, fmtTime, parseTime, NOTE_NAMES, pitchName, download, clamp, el, newId } from "./util.js";
import { Engine, Recorder } from "./audio.js";
import { Arrangement, PianoRoll } from "./views.js";

const $ = (id) => document.getElementById(id);
const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11] };
const PCS = { C: 0, "C#": 1, Db: 1, D: 2, Eb: 3, "D#": 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, Ab: 8, "G#": 8, A: 9, Bb: 10, "A#": 10, B: 11 };

const app = {
  project: null,
  config: {},
  engine: new Engine(),
  view: { ppb: 24, scrollX: 0, laneH: 56, rowH: 12, ghosts: true },
  selectedTrack: null,
  playheadBeat: 0,
  range: null,
  tool: "select",
  snap: 0.25,
  undo: [], redo: [],
  chat: [],
  pendingCommit: null,

  tempo() { return new Tempo(this.project); },
  hasReference() { return !!(this.project && this.project.reference); },
  scalePcs() {
    const k = this.project.key, t = PCS[k.tonic] ?? 0;
    return (MODES[k.mode] || MODES.major).map((i) => (t + i) % 12);
  },
  snapBeat(b, coarse) {
    const s = coarse ? Math.max(this.snap || 0.25, this.view.ppb < 12 ? 4 : this.view.ppb < 30 ? 1 : 0.25) : this.snap;
    return s ? Math.round(b / s) * s : b;
  },

  // ------------------------------------------------ undo / change tracking
  commit() { this.pendingCommit = JSON.stringify(this.project); },
  discardCommit() { this.pendingCommit = null; },
  changed({ analyze = true } = {}) {
    if (this.pendingCommit) { this.undo.push(this.pendingCommit); if (this.undo.length > 200) this.undo.shift(); this.redo = []; this.pendingCommit = null; }
    this.engine.updateMix(this.project);
    this.renderAll();
    this.save();
    if (analyze) this.scheduleAnalyze();
  },
  replaceProject(p, { record = true } = {}) {
    if (record) { this.undo.push(JSON.stringify(this.project)); this.redo = []; }
    this.project = p;
    if (!p.tracks.find((t) => t.id === this.selectedTrack)) this.selectedTrack = p.tracks[0]?.id || null;
    this.engine.loadProject(p);
    this.engine.updateMix(p);
    this.renderAll();
    this.save();
  },
  doUndo() {
    if (!this.undo.length) return;
    this.redo.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.undo.pop());
    this.afterHistory();
  },
  doRedo() {
    if (!this.redo.length) return;
    this.undo.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.redo.pop());
    this.afterHistory();
  },
  afterHistory() {
    if (!this.project.tracks.find((t) => t.id === this.selectedTrack)) this.selectedTrack = this.project.tracks[0]?.id || null;
    this.engine.loadProject(this.project); this.engine.updateMix(this.project);
    this.renderAll(); this.save();
  },
  saveTimer: null,
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => api(`/api/projects/${this.project.id}`, { method: "PUT", json: this.project }).catch((e) => status(e.message, { error: true })), 600);
  },
  analyzeTimer: null,
  scheduleAnalyze() {
    clearTimeout(this.analyzeTimer);
    this.analyzeTimer = setTimeout(async () => {
      try {
        const r = await api("/api/analyze", { json: { project: this.project } });
        this.project.chords = r.project.chords;
        this.redraw();
      } catch { /* analysis is optional */ }
    }, 1500);
  },

  // ------------------------------------------------ selection / transport
  selectTrack(id) {
    if (this.selectedTrack !== id) { this.selectedTrack = id; this.roll.sel.clear(); this.roll.centerOn(this.roll.track()); }
    document.querySelectorAll("#heads .head[data-id]").forEach((h) => h.classList.toggle("sel", h.dataset.id === id));
    this.renderRollBar(); this.updateCtx(); this.redraw();
  },
  setRange(a, b) {
    this.range = a == null ? null : { start: a, end: b };
    if (!this.range || this.range.end - this.range.start < 0.01) { this.range = null; }
    this.engine.loop = this.range && $("btnLoop").classList.contains("on") ? this.range : null;
    this.updateCtx(); this.redraw();
  },
  seek(b) {
    this.playheadBeat = Math.max(0, b);
    if (this.engine.playing) this.engine.play(this.project, this.playheadBeat);
    this.updateLcd(); this.redraw();
  },
  togglePlay() {
    if (this.engine.playing) { this.playheadBeat = this.engine.positionBeat; this.engine.stop(); }
    else this.engine.play(this.project, this.range && this.engine.loop ? this.range.start : this.playheadBeat);
    $("btnPlay").classList.toggle("on", this.engine.playing);
    $("btnPlay").textContent = this.engine.playing ? "❚❚" : "▶";
  },
  stop() {
    this.engine.stop();
    this.playheadBeat = this.range ? this.range.start : 0;
    $("btnPlay").classList.remove("on"); $("btnPlay").textContent = "▶";
    this.updateLcd(); this.redraw();
  },

  // ------------------------------------------------ rendering
  redrawQueued: false,
  redraw() {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    requestAnimationFrame(() => { this.redrawQueued = false; this.arr.draw(); this.roll.draw(); });
  },
  renderAll() { this.renderTop(); this.renderHeads(); this.renderRollBar(); this.renderHumTargets(); this.updateCtx(); this.redraw(); },
  renderTop() {
    const p = this.project;
    $("projName").value = p.name;
    $("bpm").value = (+p.bpm).toFixed(1);
    $("btnSteady").hidden = !p.tempoMap;
    $("keyTonic").value = p.key.tonic; $("keyMode").value = p.key.mode;
    $("curLen").textContent = fmtTime(this.tempo().sec(endBeat(p)));
    if (document.activeElement !== $("target")) $("target").value = p.targetSeconds ? fmtTime(p.targetSeconds) : "";
    $("btnUndo").disabled = !this.undo.length; $("btnRedo").disabled = !this.redo.length;
  },
  renderHeads() {
    const box = $("heads");
    box.innerHTML = "";
    box.style.setProperty("--lane-h", this.view.laneH + "px");
    document.documentElement.style.setProperty("--lane-h", this.view.laneH + "px");
    for (const t of this.project.tracks) {
      const sel = el("select", { title: "Instrument", onchange: (e) => { this.commit(); t.program = +e.target.value; this.engine.instrument(t.program).load(this.engine.ensure()); this.changed({ analyze: false }); } },
        this.config.gm.map((g, i) => el("option", { value: i, selected: i === t.program }, g)));
      sel.addEventListener("mousedown", (e) => e.stopPropagation());
      const name = el("div", { class: "tname", title: "Double-click to rename" }, t.name);
      name.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const v = prompt("Track name", t.name);
        if (v) { this.commit(); t.name = v; this.changed({ analyze: false }); }
      });
      const vol = el("input", { type: "range", min: 0, max: 1, step: 0.01, value: t.volume ?? 0.8, title: "Volume",
        oninput: (e) => { t.volume = +e.target.value; this.engine.updateMix(this.project); this.save(); } });
      vol.addEventListener("mousedown", (e) => e.stopPropagation());
      const btn = (label, cls, on, fn, title) => el("button", { class: cls + (on ? " on" : ""), title, onmousedown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); fn(); } }, label);
      const head = el("div", { class: "head" + (t.id === this.selectedTrack ? " sel" : ""), "data-id": t.id, onmousedown: () => this.selectTrack(t.id) },
        el("div", { class: "sw", style: `background:${t.color}` }),
        el("div", { class: "mid" }, name, sel),
        el("div", { class: "btns" },
          el("div", {},
            btn("M", "m", t.mute, () => { t.mute = !t.mute; this.engine.updateMix(this.project); this.renderHeads(); this.redraw(); this.save(); }, "Mute"),
            btn("S", "s", t.solo, () => { t.solo = !t.solo; this.engine.updateMix(this.project); this.renderHeads(); this.save(); }, "Solo"),
            btn("✕", "", false, () => { if (confirm(`Delete track “${t.name}”?`)) { this.commit(); this.project.tracks = this.project.tracks.filter((x) => x !== t); this.changed(); } }, "Delete track")),
          vol));
      box.append(head);
    }
    if (this.hasReference()) {
      const r = this.project.reference;
      const vol = el("input", { type: "range", min: 0, max: 1, step: 0.01, value: this.engine.refVolume, oninput: (e) => { this.engine.refVolume = +e.target.value; } });
      box.append(el("div", { class: "head" },
        el("div", { class: "sw", style: "background:#4f6f7a" }),
        el("div", { class: "mid" }, el("div", { class: "tname", title: r.name || r.file }, "Reference"),
          el("span", { class: "dim small" }, r.synced === false ? "out of sync" : (r.name || r.file || "").slice(0, 26))),
        el("div", { class: "btns" },
          el("div", {}, el("button", { class: "m" + (this.engine.refMuted ? " on" : ""), title: "Mute reference", onclick: () => { this.engine.refMuted = !this.engine.refMuted; this.renderHeads(); } }, "M")),
          vol)));
    }
    box.style.transform = `translateY(${-(this.view.scrollYArr || 0)}px)`;
  },
  renderRollBar() {
    const t = this.roll.track();
    $("rollTitle").textContent = t ? t.name : "—";
    $("rollTitle").style.color = t ? t.color : "";
    const ns = this.roll.selectedNotes();
    $("selInfo").textContent = ns.length ? `${ns.length} note${ns.length > 1 ? "s" : ""} selected` : t ? `${t.notes.length} notes` : "";
    if (ns.length) $("vel").value = Math.round(ns.reduce((a, n) => a + n.v, 0) / ns.length);
  },
  renderHumTargets() {
    const s = $("humTarget"), cur = s.value;
    s.innerHTML = "";
    s.append(el("option", { value: "__new" }, "New track"));
    for (const t of this.project.tracks) s.append(el("option", { value: t.id }, t.name));
    s.value = [...s.options].some((o) => o.value === cur) ? cur : "__new";
  },
  selectionChanged() { this.renderRollBar(); this.updateCtx(); },
  updateCtx() {
    const sel = this.selection();
    const bpb = this.project.timeSig[0];
    const parts = [];
    if (sel.track_name) parts.push(sel.track_name);
    if (sel.start_beat != null) parts.push(`bars ${Math.floor(sel.start_beat / bpb) + 1}–${Math.ceil(sel.end_beat / bpb)}`);
    if (sel.selected_notes) parts.push(`${sel.selected_notes} notes selected`);
    $("ctxLine").textContent = parts.length ? "Context: " + parts.join(" · ") : "";
  },
  selection() {
    const t = this.roll?.track();
    const out = {};
    if (t) { out.track_id = t.id; out.track_name = t.name; }
    const ns = this.roll ? this.roll.selectedNotes() : [];
    if (ns.length) {
      out.selected_notes = ns.length;
      out.start_beat = Math.min(...ns.map((n) => n.s));
      out.end_beat = Math.max(...ns.map((n) => n.s + n.d));
    } else if (this.range) { out.start_beat = this.range.start; out.end_beat = this.range.end; }
    out.playhead_beat = +this.playheadBeat.toFixed(2);
    return out;
  },
  updateLcd() {
    const b = this.engine.playing ? this.engine.positionBeat : this.playheadBeat;
    const bpb = this.project.timeSig[0];
    $("posBar").textContent = `${Math.floor(b / bpb) + 1}.${Math.floor(b % bpb) + 1}`;
    $("posTime").textContent = fmtTime(this.tempo().sec(b));
  },
  wheel(e, src) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = src.c.getBoundingClientRect();
      const x = e.clientX - r.left - (src === this.roll ? 0 : 0);
      const beatAt = (x + this.view.scrollX) / this.view.ppb;
      this.view.ppb = clamp(this.view.ppb * Math.exp(-e.deltaY * 0.0025), 2, 400);
      this.view.scrollX = Math.max(0, beatAt * this.view.ppb - x);
    } else if (src === this.arr && !e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const max = Math.max(0, (this.project.tracks.length + 1) * this.view.laneH - (src.c.clientHeight - src.head));
      this.view.scrollYArr = clamp((this.view.scrollYArr || 0) + e.deltaY, 0, max);
      this.arr.c.style.setProperty("--sy", this.view.scrollYArr);
      this.renderHeads();
    } else {
      this.view.scrollX = Math.max(0, this.view.scrollX + (e.shiftKey ? e.deltaY : e.deltaX));
    }
    this.redraw();
  },

  // ------------------------------------------------ server-side operations
  async op(name, args, label) {
    try {
      const r = await api("/api/edit", { json: { project: this.project, op: name, args } });
      this.replaceProject(r.project);
      status(label || r.message);
      return r;
    } catch (e) { status(e.message, { error: true }); }
  },
};

// ------------------------------------------------------------------ status line
let statusTimer;
function status(msg, { error = false, progress = null, sticky = false } = {}) {
  const s = $("status");
  s.className = "show" + (error ? " err" : "");
  s.innerHTML = "";
  s.append(el("div", {}, msg));
  if (progress != null) s.append(el("div", { class: "bar", style: `width:${Math.round(progress * 100)}%` }));
  clearTimeout(statusTimer);
  if (!sticky) statusTimer = setTimeout(() => { s.className = ""; }, error ? 7000 : 3200);
}
const jobStatus = (j) => status(j.message, { progress: j.progress, sticky: true });

// ------------------------------------------------------------------ modal helpers
function modal(...content) {
  const box = $("modalBox");
  box.innerHTML = "";
  box.append(...content);
  $("modal").classList.remove("hidden");
}
const closeModal = () => $("modal").classList.add("hidden");
$("modal").addEventListener("mousedown", (e) => { if (e.target.id === "modal") closeModal(); });

function menu(anchor, items) {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = el("div", { class: "menu", style: `top:${r.bottom + 4}px;left:${Math.min(r.left, innerWidth - 240)}px` },
    items.map((it) => it === "-" ? el("hr") : el("button", { onclick: () => { m.remove(); it[1](); } }, it[0])));
  document.body.append(m);
  setTimeout(() => window.addEventListener("mousedown", function h(e) { if (!m.contains(e.target)) { m.remove(); window.removeEventListener("mousedown", h); } }), 0);
}

// ------------------------------------------------------------------ import dialog
function importDialog(preset = {}) {
  let audio = preset.audio || null, scoreF = preset.score || null;
  const audioDrop = el("div", { class: "drop" + (audio ? " has" : "") }, audio ? audio.name : "Drop or click to choose audio (mp3, wav, m4a, flac)");
  const scoreDrop = el("div", { class: "drop" + (scoreF ? " has" : "") }, scoreF ? scoreF.name : "Optional: MusicXML / MXL / MIDI score");
  const pick = (drop, accept, set) => {
    const inp = el("input", { type: "file", accept, style: "display:none", onchange: (e) => { const f = e.target.files[0]; if (f) { set(f); drop.textContent = f.name; drop.classList.add("has"); } } });
    drop.append(inp);
    drop.addEventListener("click", () => inp.click());
    drop.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
    drop.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) { set(f); drop.textContent = f.name; drop.classList.add("has"); } });
  };
  pick(audioDrop, "audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aiff", (f) => (audio = f));
  pick(scoreDrop, ".xml,.musicxml,.mxl,.mid,.midi", (f) => (scoreF = f));
  const ens = el("select", {}, el("option", { value: "auto" }, "Auto (guess from file name)"),
    ...app.config.ensembles.map((e) => el("option", { value: e }, e.replace(/_/g, " "))));
  const sens = el("input", { type: "range", min: 0, max: 1, step: 0.05, value: 0.5 });
  const sects = el("input", { type: "number", min: 1, max: 12, value: 4 });
  const sep = el("input", { type: "checkbox", disabled: !app.config.demucs });
  const transcribe = el("input", { type: "checkbox", checked: true });
  const align = el("input", { type: "checkbox", checked: true });
  const smode = el("select", {}, el("option", { value: "replace" }, "use the score's notes (recommended)"), el("option", { value: "add" }, "add score tracks next to the transcription"));
  const go = el("button", { class: "primary", onclick: async () => {
    if (!audio && !scoreF) return;
    closeModal();
    try {
      if (audio) {
        const fd = new FormData();
        fd.append("file", audio); fd.append("ensemble", ens.value); fd.append("sensitivity", sens.value);
        fd.append("sections", sects.value); fd.append("separate", sep.checked); fd.append("transcribe", transcribe.checked && !(scoreF && smode.value === "replace"));
        status("Uploading audio…", { sticky: true });
        const r = await api(`/api/projects/${app.project.id}/import-audio`, { method: "POST", body: fd });
        const p = r.job ? await waitJob(r.job, jobStatus) : r.project;
        app.replaceProject(p);
        await app.engine.loadReference(`/api/projects/${p.id}/files/${p.reference.file}?v=${Date.now()}`);
      }
      if (scoreF) {
        const fd = new FormData();
        fd.append("file", scoreF); fd.append("align", align.checked); fd.append("mode", smode.value);
        status("Reading score…", { sticky: true });
        const r = await api(`/api/projects/${app.project.id}/import-score`, { method: "POST", body: fd });
        app.replaceProject(await waitJob(r.job, jobStatus));
      }
      app.selectedTrack = app.project.tracks[0]?.id;
      app.view.scrollX = 0; app.fitView();
      app.roll.centerOn(app.roll.track());
      app.renderAll();
      const p = app.project;
      if (p.reference?.alignNote) app.chat.push({ role: "system", text: "Note: " + p.reference.alignNote }), renderChat();
      status(`Imported: ${p.tracks.length} tracks, ${p.tracks.reduce((a, t) => a + t.notes.length, 0)} notes · ${p.key.tonic} ${p.key.mode} · ${p.bpm.toFixed(1)} BPM`);
    } catch (e) { status(e.message, { error: true }); }
  } }, "Import");
  modal(
    el("h2", {}, "Import a reference"),
    audioDrop,
    el("div", { class: "grid", style: "margin-top:10px" },
      el("label", {}, "Ensemble"), ens,
      el("label", {}, "Note sensitivity"), sens,
      el("label", {}, "Sections"), sects,
      el("label", {}, "Transcribe notes"), transcribe,
      el("label", {}, "Separate stems first"), el("span", {}, sep, el("span", { class: "dim small" }, app.config.demucs ? " Demucs (good for band/pop mixes, slower)" : " install with ./setup.sh --stems"))),
    el("h3", {}, "Score (optional, more accurate)"),
    scoreDrop,
    el("div", { class: "grid", style: "margin-top:10px" },
      el("label", {}, "Notes from"), smode,
      el("label", {}, "Align to recording"), el("span", {}, align, el("span", { class: "dim small" }, " follow the recording's tempo so both play in sync"))),
    el("p", { class: "note" }, "Audio only: notes are transcribed with Basic Pitch and split into voices by range. With a score, the score's notes are used and the audio supplies the timing."),
    el("div", { class: "foot" }, el("button", { onclick: closeModal }, "Cancel"), go));
}

// ------------------------------------------------------------------ export
async function renderMix(stems = false) {
  status("Rendering…", { sticky: true });
  try {
    if (!stems) {
      const wav = await app.engine.render(app.project);
      download(wav, `${app.project.name}.wav`);
      const fd = new FormData(); fd.append("file", wav, "mix.wav"); fd.append("name", "mix.wav");
      await api(`/api/projects/${app.project.id}/upload-render`, { method: "POST", body: fd });
      status("Rendered mix.wav (also saved in the project for generation)");
      return wav;
    }
    for (const t of app.project.tracks) {
      status(`Rendering ${t.name}…`, { sticky: true });
      download(await app.engine.render(app.project, { trackIds: [t.id] }), `${app.project.name} - ${t.name}.wav`);
    }
    status("Stems rendered");
  } catch (e) { status("Render failed: " + e.message, { error: true }); }
}
async function exportFile(kind) {
  try {
    const r = await api(`/api/export/${kind}`, { json: { project: app.project } });
    download(await r.blob(), `${app.project.name}.${kind === "midi" ? "mid" : "musicxml"}`);
  } catch (e) { status(e.message, { error: true }); }
}

// ------------------------------------------------------------------ generate dialog
async function generateDialog() {
  const p = app.project;
  const dur = p.targetSeconds || app.tempo().sec(endBeat(p));
  const insts = [...new Set(p.tracks.filter((t) => !t.mute).map((t) => app.config.gm[t.program]))].join(", ");
  const prov = el("select", {},
    el("option", { value: "fal_stable" }, "Stable Audio 2.5 via fal.ai (re-performs your mix; keeps your notes closest)" + (app.config.fal ? "" : " — key missing")),
    el("option", { value: "fal_ace" }, "ACE-Step via fal.ai (restyles your mix more freely)" + (app.config.fal ? "" : " — key missing")),
    el("option", { value: "elevenlabs" }, "ElevenLabs Music (new music from style + sections + exact length)" + (app.config.elevenlabs ? "" : " — key missing")),
    el("option", { value: "suno" }, "Suno (manual upload; no public API)"));
  const style = el("textarea", { rows: 3, placeholder: "e.g. minimalist cinematic, pulsing arpeggios, warm string orchestra and saxophones, building intensity, melancholic and hopeful" });
  style.value = localStorage.getItem("refdaw.style") || "";
  const inst = el("input", { type: "text", value: insts });
  const secs = el("input", { type: "text", value: fmtTime(dur), size: 6 });
  const useSect = el("input", { type: "checkbox", checked: true });
  const strength = el("input", { type: "range", min: 0.15, max: 0.85, step: 0.05, value: 0.45, id: "genStrength" });
  const strengthOut = el("span", { class: "dim small" }, " 0.45");
  strength.oninput = () => (strengthOut.textContent = " " + (+strength.value).toFixed(2) + (strength.value < 0.35 ? " (very close to your notes)" : strength.value > 0.6 ? " (freer reinterpretation)" : ""));
  const acoustic = el("input", { type: "checkbox", checked: true, id: "genAcoustic" });
  const model = el("input", { type: "text", placeholder: "default (music_v1)" });
  const endpoint = el("input", { type: "text", placeholder: "fal-ai/ace-step/audio-to-audio" });
  const extra = el("textarea", { rows: 2, placeholder: '{"edit_mode": "remix"}' });
  const out = el("div");
  const files = el("div", { class: "files" });
  const refreshFiles = async () => {
    const fl = await api(`/api/projects/${p.id}/files`);
    files.innerHTML = "";
    for (const f of fl.filter((f) => /^(gen_|mix)/.test(f.name) && /\.(mp3|wav|flac|ogg|m4a)$/.test(f.name))) {
      const url = `/api/projects/${p.id}/files/${f.name}`;
      files.append(el("div", { class: "file" }, el("span", { class: "small" }, f.name), el("audio", { controls: true, src: url, preload: "none" }), el("a", { href: url, download: f.name }, "⬇")));
    }
    if (!files.children.length) files.append(el("span", { class: "dim small" }, "No renders or generations yet."));
  };
  const go = el("button", { class: "primary", onclick: async () => {
    localStorage.setItem("refdaw.style", style.value);
    const seconds = parseTime(secs.value) || dur;
    out.innerHTML = "";
    try {
      if (prov.value === "fal_ace" || prov.value === "fal_stable") {
        go.disabled = true;
        out.append(el("p", { class: "note" }, "Rendering the mix to use as reference…"));
        await renderMix(false);
      }
      const body = { project: app.project, provider: prov.value, style: style.value, instruments: inst.value, seconds,
        useSections: useSect.checked, strength: +strength.value, acoustic: acoustic.checked, model: model.value, endpoint: endpoint.value, extra: extra.value };
      const r = await api(`/api/projects/${p.id}/generate`, { json: body });
      if (r.brief) { out.append(el("pre", {}, r.brief), el("button", { onclick: () => renderMix(false) }, "Render mix.wav for Suno")); return; }
      out.append(el("p", { class: "note" }, "Prompt: " + r.prompt));
      go.disabled = true;
      const res = await waitJob(r.job, (j) => { jobStatus(j); go.textContent = j.message; });
      status("Generated " + res.file);
      await refreshFiles();
    } catch (e) { out.append(el("pre", { style: "color:#ffb3b8" }, e.message)); status(e.message, { error: true }); }
    finally { go.disabled = false; go.textContent = "Generate"; }
  } }, "Generate");
  modal(
    el("h2", {}, "Generate audio from this arrangement"),
    el("div", { class: "grid" },
      el("label", {}, "Model"), prov,
      el("label", {}, "Style"), style,
      el("label", {}, "Instruments"), inst,
      el("label", {}, "Length"), el("span", {}, secs, el("span", { class: "dim small" }, "  m:ss — your target is " + (p.targetSeconds ? fmtTime(p.targetSeconds) : "not set"))),
      el("label", {}, "How much to change"), el("span", {}, strength, strengthOut, el("div", { class: "dim small" }, "Stable Audio only. Lower keeps your notes and timing; higher sounds more natural but drifts.")),
      el("label", {}, "Acoustic only"), el("span", {}, acoustic, el("span", { class: "dim small" }, " tell the model: no drums, synths or vocals")),
      el("label", {}, "Follow my sections"), el("span", {}, useSect, el("span", { class: "dim small" }, " section lengths match the arrangement (ElevenLabs)"))),
    el("details", {}, el("summary", { class: "dim" }, "Advanced"),
      el("div", { class: "grid", style: "margin-top:8px" },
        el("label", {}, "ElevenLabs model"), model,
        el("label", {}, "fal endpoint"), endpoint,
        el("label", {}, "Extra fal args (JSON)"), extra)),
    out,
    el("h3", {}, "Renders & generations"), files,
    el("div", { class: "foot" }, el("button", { onclick: closeModal }, "Close"), el("button", { onclick: () => renderMix(false).then(refreshFiles) }, "Render mix.wav"), go));
  refreshFiles();
}

// ------------------------------------------------------------------ projects
async function openProject(id) {
  app.engine.stop();
  const p = await api(`/api/projects/${id}`);
  app.project = p; app.undo = []; app.redo = []; app.range = null; app.playheadBeat = 0; app.view.scrollX = 0;
  app.selectedTrack = p.tracks[0]?.id || null;
  app.chat = JSON.parse(localStorage.getItem("refdaw.chat." + p.id) || "[]");
  renderChat();
  localStorage.setItem("refdaw.last", id);
  app.fitView();
  app.roll.centerOn(app.roll.track());
  app.renderAll();
  app.engine.loadProject(p).then(() => app.redraw());
  if (p.reference) app.engine.loadReference(`/api/projects/${p.id}/files/${p.reference.file}`).then(() => app.redraw()).catch(() => {});
  else app.engine.loadReference(null);
}
async function newProject() {
  const p = await api("/api/projects", { json: { name: "Untitled" } });
  await openProject(p.id);
  return p;
}
async function projectsMenu() {
  const list = await api("/api/projects");
  menu($("projBtn"), [
    ["＋ New project", async () => { await newProject(); importDialog(); }],
    "-",
    ...list.map((x) => [`${x.id === app.project.id ? "● " : ""}${x.name} (${x.tracks} tracks)`, () => openProject(x.id)]),
    "-",
    ["Delete this project…", async () => {
      if (!confirm(`Delete “${app.project.name}” and its files?`)) return;
      await api(`/api/projects/${app.project.id}`, { method: "DELETE" });
      const rest = list.filter((x) => x.id !== app.project.id);
      if (rest.length) openProject(rest[0].id); else newProject();
    }],
  ]);
}
app.fitView = function () {
  const w = this.arr?.c.clientWidth || 900;
  const e = Math.max(32, endBeat(this.project));
  this.view.ppb = clamp((w - 30) / e, 2, 60);
  this.view.scrollX = 0;
};

// ------------------------------------------------------------------ assistant
function renderChat() {
  const box = $("chat");
  box.innerHTML = "";
  if (!app.chat.length) box.append(el("div", { class: "msg system" }, "Ask for edits in plain words, by typing or speaking. Select a track, a range on the ruler, or some notes first to point at them. Every change can be undone."));
  for (const m of app.chat) {
    const d = el("div", { class: "msg " + m.role }, m.text);
    if (m.log && m.log.length) d.append(el("div", { class: "log" }, m.log.map((l) => "• " + l).join("\n")));
    box.append(d);
  }
  box.scrollTop = box.scrollHeight;
  if (app.project) localStorage.setItem("refdaw.chat." + app.project.id, JSON.stringify(app.chat.slice(-40)));
}
async function ask(text) {
  text = text.trim();
  if (!text) return;
  app.chat.push({ role: "user", text });
  renderChat();
  $("agentState").textContent = "working…";
  try {
    const r = await api("/api/agent", { json: { project: app.project, message: text, selection: app.selection(), history: app.chat.slice(-9, -1) } });
    const res = await waitJob(r.job, () => {});
    if (res.log.length) app.replaceProject(res.project);
    app.chat.push({ role: "assistant", text: res.reply, log: res.log });
  } catch (e) {
    app.chat.push({ role: "system", text: "⚠ " + e.message });
  }
  $("agentState").textContent = "";
  renderChat();
}
$("askForm").addEventListener("submit", (e) => { e.preventDefault(); const t = $("ask").value; $("ask").value = ""; ask(t); });
$("ask").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("askForm").requestSubmit(); } });

// voice commands: browser speech recognition, else server STT (ElevenLabs)
let recog = null, sttRec = null;
$("btnMic").addEventListener("click", async () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $("btnMic");
  if (recog) { recog.stop(); return; }
  if (sttRec) {
    const wav = sttRec.stop(); sttRec = null; btn.classList.remove("on"); btn.textContent = "🎙 Speak";
    const fd = new FormData(); fd.append("file", wav, "speech.wav");
    try { const r = await api("/api/stt", { method: "POST", body: fd }); if (r.text) ask(r.text); } catch (e) { status(e.message, { error: true }); }
    return;
  }
  if (SR) {
    recog = new SR();
    recog.lang = navigator.language || "en-US";
    recog.interimResults = true;
    recog.continuous = false;
    let finalText = "";
    recog.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript; else interim += ev.results[i][0].transcript;
      }
      $("ask").value = finalText + interim;
    };
    recog.onerror = (ev) => status("Speech recognition: " + ev.error, { error: true });
    recog.onend = () => { btn.classList.remove("on"); btn.textContent = "🎙 Speak"; recog = null; if (finalText.trim()) { $("ask").value = ""; ask(finalText); } };
    btn.classList.add("on"); btn.textContent = "■ Listening…";
    recog.start();
  } else if (app.config.elevenlabs) {
    sttRec = new Recorder();
    await sttRec.start(app.engine.ensure());
    btn.classList.add("on"); btn.textContent = "■ Stop";
  } else status("This browser has no speech recognition. Use Chrome or Safari, or add ELEVENLABS_API_KEY.", { error: true });
});

// ------------------------------------------------------------------ humming
let hum = null;
$("btnHum").addEventListener("click", async () => {
  const btn = $("btnHum");
  if (hum) { finishHum(); return; }
  const ctx = app.engine.ensure();
  const rec = new Recorder();
  try { await rec.start(ctx); } catch (e) { status("Microphone unavailable: " + e.message, { error: true }); return; }
  const tempo = app.tempo();
  const startBeat = app.playheadBeat;
  const bpb = app.project.timeSig[0];
  const countIn = bpb;
  const beatLen = 60 / app.project.bpm;
  const tNow = ctx.currentTime + 0.05;
  for (let i = 0; i < countIn; i++) app.engine.click(tNow + i * beatLen, i === 0);
  const playAt = tNow + countIn * beatLen;
  const target = $("humTarget").value;
  hum = { rec, startBeat, playAt, tempo, target, meter: setInterval(() => { $("meterBar").style.width = Math.min(100, rec.level * 160) + "%"; }, 50) };
  btn.classList.add("on"); btn.textContent = "■ Stop";
  hum.playTimer = setTimeout(() => {
    if (!hum) return;
    const only = $("humPlayback").checked ? app.project.tracks.filter((t) => t.id !== target || $("humMode").value === "layer").map((t) => t.id) : [];
    app.engine.metronome = $("btnMetro").classList.contains("on") || !$("humPlayback").checked;
    app.engine.play(app.project, startBeat, { onlyTracks: only, reference: $("humPlayback").checked });
    $("btnPlay").classList.add("on");
  }, (playAt - ctx.currentTime) * 1000);
});
async function finishHum() {
  const h = hum; hum = null;
  clearTimeout(h.playTimer); clearInterval(h.meter); $("meterBar").style.width = "0";
  app.engine.stop(); app.engine.metronome = $("btnMetro").classList.contains("on");
  $("btnPlay").classList.remove("on"); $("btnPlay").textContent = "▶";
  $("btnHum").classList.remove("on"); $("btnHum").textContent = "● Record hum";
  const wav = h.rec.stop();
  const lead = h.playAt - h.rec.startTime; // seconds recorded before beat `startBeat`
  const capBeat = h.tempo.beat(h.tempo.sec(h.startBeat) - lead);
  const fd = new FormData();
  fd.append("file", wav, "hum.wav");
  fd.append("project", JSON.stringify({ ...app.project, tracks: [] }));
  fd.append("start_beat", capBeat);
  fd.append("latency_ms", Math.round(((app.engine.ctx.baseLatency || 0.01) + (app.engine.ctx.outputLatency || 0.02)) * 1000));
  fd.append("snap_key", $("humSnap").checked);
  fd.append("grid", app.snap || 0.25);
  fd.append("octave_shift", $("humOct").value);
  status("Transcribing your melody…", { sticky: true });
  try {
    const r = await api("/api/hum", { method: "POST", body: fd });
    const notes = r.notes.filter((n) => n.s >= h.startBeat - 0.01);
    if (!notes.length) { status("No clear pitches heard. Try humming louder, closer to the mic.", { error: true }); return; }
    app.commit();
    let t;
    if (h.target === "__new") {
      const colors = ["#e8a33d", "#5fb3b3", "#c678dd", "#7fb069", "#e06c75", "#61afef", "#d19a66", "#98c379"];
      t = { id: newId("t"), name: "Hum " + (app.project.tracks.filter((x) => x.name.startsWith("Hum")).length + 1), program: 73,
        color: colors[app.project.tracks.length % colors.length], volume: 0.8, pan: 0, mute: false, solo: false, notes: [] };
      app.project.tracks.push(t);
    } else t = app.project.tracks.find((x) => x.id === h.target);
    const a = notes[0].s, b = Math.max(...notes.map((n) => n.s + n.d));
    if ($("humMode").value === "replace" && h.target !== "__new") t.notes = t.notes.filter((n) => n.s < a || n.s >= b);
    t.notes.push(...notes);
    t.notes.sort((x, y) => x.s - y.s);
    app.selectedTrack = t.id;
    app.roll.sel = new Set(notes.map((n) => n.id));
    app.roll.centerOn({ notes });
    app.changed();
    status(`Added ${notes.length} hummed notes to ${t.name}: ${notes.slice(0, 8).map((n) => pitchName(n.p)).join(" ")}${notes.length > 8 ? " …" : ""}`);
  } catch (e) { status(e.message, { error: true }); }
}

// ------------------------------------------------------------------ toolbar & header wiring
function wire() {
  $("btnPlay").onclick = () => app.togglePlay();
  $("btnStop").onclick = () => app.stop();
  $("btnHome").onclick = () => app.seek(0);
  $("btnLoop").onclick = () => { $("btnLoop").classList.toggle("on"); app.engine.loop = $("btnLoop").classList.contains("on") && app.range ? app.range : null; app.redraw(); };
  $("btnMetro").onclick = () => { $("btnMetro").classList.toggle("on"); app.engine.metronome = $("btnMetro").classList.contains("on"); };
  $("btnUndo").onclick = () => app.doUndo();
  $("btnRedo").onclick = () => app.doRedo();
  $("btnImport").onclick = () => importDialog();
  $("btnGenerate").onclick = () => generateDialog();
  $("projBtn").onclick = () => projectsMenu();
  $("btnExport").onclick = () => menu($("btnExport"), [
    ["Render mix (WAV)", () => renderMix(false)],
    ["Render stems (one WAV per track)", () => renderMix(true)],
    "-",
    ["MIDI file", () => exportFile("midi")],
    ["MusicXML score", () => exportFile("musicxml")],
    ["Project JSON", () => download(new Blob([JSON.stringify(app.project, null, 1)], { type: "application/json" }), app.project.name + ".refdaw.json")],
  ]);
  $("projName").onchange = (e) => { app.commit(); app.project.name = e.target.value || "Untitled"; app.changed({ analyze: false }); };
  $("btnSteady").onclick = () => app.op("steady_tempo", {});
  $("bpm").onchange = (e) => { const v = parseFloat(e.target.value); if (v > 10) app.op("set_tempo", { bpm: v }); };
  for (const n of NOTE_NAMES) $("keyTonic").append(el("option", { value: n }, n));
  for (const m of Object.keys(MODES)) $("keyMode").append(el("option", { value: m }, m));
  const keyChange = () => {
    const tonic = $("keyTonic").value, mode = $("keyMode").value;
    const k = app.project.key;
    if (tonic === k.tonic && mode === k.mode) return;
    const move = confirm(`Move the music from ${k.tonic} ${k.mode} to ${tonic} ${mode}?\n\nOK = transpose the notes. Cancel = only relabel the key.`);
    if (move) app.op("change_key", { tonic, mode });
    else { app.commit(); app.project.key = { tonic, mode }; app.changed({ analyze: false }); }
  };
  $("keyTonic").onchange = keyChange; $("keyMode").onchange = keyChange;
  $("btnFit").onclick = () => {
    const s = parseTime($("target").value);
    if (!s) { status("Enter a target length like 2:47", { error: true }); return; }
    app.op("fit_duration", { seconds: s });
  };
  $("target").onchange = () => { const s = parseTime($("target").value); if (s) { app.project.targetSeconds = s; app.save(); } };
  $("btnAddTrack").onclick = () => {
    app.commit();
    const colors = ["#e8a33d", "#5fb3b3", "#c678dd", "#7fb069", "#e06c75", "#61afef", "#d19a66", "#98c379"];
    const t = { id: newId("t"), name: "Track " + (app.project.tracks.length + 1), program: 0, color: colors[app.project.tracks.length % 8], volume: 0.8, pan: 0, mute: false, solo: false, notes: [] };
    app.project.tracks.push(t); app.selectedTrack = t.id; app.changed();
  };
  document.querySelectorAll("#toolSeg button").forEach((b) => b.onclick = () => setTool(b.dataset.tool));
  $("snap").onchange = (e) => (app.snap = parseFloat(e.target.value));
  $("ghosts").onchange = (e) => { app.view.ghosts = e.target.checked; app.redraw(); };
  $("vel").oninput = (e) => {
    const ns = app.roll.selectedNotes(); if (!ns.length) { app.lastVel = +e.target.value; return; }
    if (!app.pendingCommit) app.commit();
    ns.forEach((n) => (n.v = +e.target.value)); app.redraw();
  };
  $("vel").onchange = () => { if (app.pendingCommit) app.changed({ analyze: false }); };
  $("btnQuant").onclick = () => quantizeSel();
  $("btnRange").onclick = () => {
    const t = app.roll.track(); if (!t) return;
    const v = prompt(`Limit “${t.name}” to how many semitones? (12 = one octave)`, "12");
    if (!v) return;
    const s = app.selection();
    app.op("limit_range", { track_id: t.id, max_semitones: parseInt(v), method: "compress", start_beat: s.start_beat, end_beat: s.end_beat });
  };
  $("btnVary").onclick = () => {
    const t = app.roll.track(); if (!t) return;
    const s = app.selection();
    app.op("vary", { track_id: t.id, amount: 0.15, start_beat: s.start_beat, end_beat: s.end_beat, seed: Math.floor(Math.random() * 1e6) });
  };
  // splitter
  $("splitter").addEventListener("mousedown", (e) => {
    const main = $("main"), r = main.getBoundingClientRect();
    const mv = (ev) => { const h = clamp(r.bottom - ev.clientY, 120, r.height - 120); main.style.setProperty("--editor-h", h + "px"); app.redraw(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    e.preventDefault();
  });
  window.addEventListener("resize", () => app.redraw());
  // drag & drop anywhere
  // Drop overlay. Hidden on any drop (capture phase, so drops on inner drop zones count too),
  // when the drag leaves the window, and on any mouse movement without a drag in progress.
  let hintTimer = null;
  const hideHint = () => { clearTimeout(hintTimer); $("dropHint").classList.add("hidden"); };
  window.addEventListener("dragenter", (e) => { if (e.dataTransfer?.types?.includes("Files") && $("modal").classList.contains("hidden")) $("dropHint").classList.remove("hidden"); });
  window.addEventListener("dragover", () => { clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 400); });
  window.addEventListener("dragleave", (e) => { if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) hideHint(); });
  window.addEventListener("drop", hideHint, true);
  window.addEventListener("dragend", hideHint, true);
  window.addEventListener("mousemove", hideHint);
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault(); hideHint();
    if (!$("modal").classList.contains("hidden")) return;
    const preset = {};
    for (const f of e.dataTransfer.files) {
      if (/\.(xml|musicxml|mxl|mid|midi)$/i.test(f.name)) preset.score = f; else preset.audio = f;
    }
    if (preset.audio || preset.score) importDialog(preset);
  });
  window.addEventListener("keydown", keys);
  app.engine.onEnd = () => { $("btnPlay").classList.remove("on"); $("btnPlay").textContent = "▶"; };
}
function setTool(t) {
  app.tool = t;
  document.querySelectorAll("#toolSeg button").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
}
function quantizeSel() {
  const t = app.roll.track(); if (!t) return;
  const ns = app.roll.selectedNotes();
  const g = app.snap || 0.25;
  if (ns.length) {
    app.commit();
    for (const n of ns) { n.s = Math.round(n.s / g) * g; n.d = Math.max(g, Math.round(n.d / g) * g); }
    app.changed(); status(`Quantized ${ns.length} notes`);
  } else {
    const s = app.selection();
    app.op("quantize", { grid: g, track_ids: [t.id], start_beat: s.start_beat, end_beat: s.end_beat });
  }
}
let clipboard = null;
function keys(e) {
  const tag = (e.target.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return;
  const mod = e.metaKey || e.ctrlKey;
  const roll = app.roll, t = roll.track();
  const sel = roll.selectedNotes();
  if (e.code === "Space") { e.preventDefault(); app.togglePlay(); return; }
  if (e.key === "Enter") { app.stop(); return; }
  if (e.key === "Home") { app.seek(0); return; }
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? app.doRedo() : app.doUndo(); return; }
  if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); app.doRedo(); return; }
  if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); roll.selectAll(); app.selectionChanged(); app.redraw(); return; }
  if (mod && e.key.toLowerCase() === "c" && sel.length) { clipboard = sel.map((n) => ({ ...n })); status(`Copied ${sel.length} notes`); return; }
  if (mod && e.key.toLowerCase() === "v" && clipboard && t) {
    e.preventDefault(); app.commit();
    const a = Math.min(...clipboard.map((n) => n.s));
    const pasted = clipboard.map((n) => ({ ...n, id: newId(), s: n.s - a + app.playheadBeat }));
    t.notes.push(...pasted); t.notes.sort((x, y) => x.s - y.s); roll.sel = new Set(pasted.map((n) => n.id));
    app.changed(); return;
  }
  if (mod && e.key.toLowerCase() === "d" && sel.length) {
    e.preventDefault(); app.commit();
    const a = Math.min(...sel.map((n) => n.s)), b = Math.max(...sel.map((n) => n.s + n.d));
    const L = Math.ceil((b - a) / (app.snap || 0.25)) * (app.snap || 0.25);
    const dup = sel.map((n) => ({ ...n, id: newId(), s: n.s + L }));
    t.notes.push(...dup); t.notes.sort((x, y) => x.s - y.s); roll.sel = new Set(dup.map((n) => n.id));
    app.changed(); return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && sel.length) {
    e.preventDefault(); app.commit();
    t.notes = t.notes.filter((n) => !roll.sel.has(n.id)); roll.sel.clear(); app.changed(); return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && sel.length) {
    e.preventDefault(); app.commit();
    const g = app.snap || 0.25;
    for (const n of sel) {
      if (e.key === "ArrowUp") n.p = clamp(n.p + (e.shiftKey ? 12 : 1), 0, 127);
      if (e.key === "ArrowDown") n.p = clamp(n.p - (e.shiftKey ? 12 : 1), 0, 127);
      if (e.key === "ArrowLeft") n.s = Math.max(0, n.s - g);
      if (e.key === "ArrowRight") n.s += g;
    }
    if (sel.length === 1 && (e.key === "ArrowUp" || e.key === "ArrowDown")) app.engine.preview(t.program, sel[0].p, sel[0].v);
    app.changed(); return;
  }
  if (e.key === "Escape") { roll.sel.clear(); app.setRange(null); app.selectionChanged(); app.redraw(); return; }
  if (mod) return;
  const k = e.key.toLowerCase();
  if (k === "v") setTool("select");
  else if (k === "d") setTool("draw");
  else if (k === "q") quantizeSel();
  else if (k === "l") $("btnLoop").click();
  else if (k === "k") $("btnMetro").click();
  else if (k === "f") { app.fitView(); app.redraw(); }
  else if (k === "=" || k === "+") { app.view.ppb = clamp(app.view.ppb * 1.25, 2, 400); app.redraw(); }
  else if (k === "-") { app.view.ppb = clamp(app.view.ppb / 1.25, 2, 400); app.redraw(); }
}

// ------------------------------------------------------------------ animation loop
function frame() {
  if (app.engine.playing) {
    const b = app.engine.positionBeat;
    app.playheadBeat = b;
    const w = app.arr.c.clientWidth, x = b * app.view.ppb - app.view.scrollX;
    if (x > w - 40 || x < 0) app.view.scrollX = Math.max(0, b * app.view.ppb - 60);
    app.updateLcd();
    app.redraw();
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
(async function boot() {
  app.config = await api("/api/config");
  app.engine.gm = app.config.gm;
  app.arr = new Arrangement($("arrCanvas"), app);
  app.roll = new PianoRoll($("rollCanvas"), $("keys"), app);
  wire();
  const list = await api("/api/projects");
  const last = localStorage.getItem("refdaw.last");
  const pick = list.find((x) => x.id === last) || list[0];
  if (pick) await openProject(pick.id);
  else { await newProject(); }
  if (!app.project.tracks.length) importDialog();
  if (!app.config.anthropic) app.chat.length || $("chat").append(el("div", { class: "msg system" }, "Add ANTHROPIC_API_KEY to refdaw/.env to enable the assistant."));
  window.refdaw = app; // handy for debugging in the console
  // unlock audio on first gesture
  window.addEventListener("pointerdown", () => app.engine.ensure(), { once: true });
  requestAnimationFrame(frame);
})().catch((e) => status("Startup failed: " + e.message, { error: true, sticky: true }));
