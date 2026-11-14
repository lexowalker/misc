// Audio engine: sampled General MIDI instruments (with a synth fallback), transport,
// reference-audio playback, offline rendering and microphone capture.
import { Tempo, sfName, encodeWav, downsample, endBeat } from "./util.js";

const SUSTAINED = (prog) =>
  (prog >= 16 && prog <= 23) || (prog >= 40 && prog <= 44) || (prog >= 48 && prog <= 55) ||
  (prog >= 56 && prog <= 79) || (prog >= 80 && prog <= 95) || prog === 109 || prog === 110;

const NAME_RE = /"([A-G]b?)(-?\d)":\s*"data:audio\/(?:mp3|mpeg);base64,([^"]+)"/g;
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

function b64ToBuf(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

class Instrument {
  constructor(program, gmName) {
    this.program = program;
    this.name = gmName;
    this.samples = null; // Map midi -> AudioBuffer
    this.sustain = SUSTAINED(program);
    this.ready = null;
  }
  load(ctx) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const txt = await (await fetch(`/sf/FluidR3_GM/${sfName(this.name)}.js`)).text();
        const jobs = [];
        const map = new Map();
        for (const m of txt.matchAll(NAME_RE)) {
          const midi = PC[m[1]] + 12 * (parseInt(m[2]) + 1);
          jobs.push(ctx.decodeAudioData(b64ToBuf(m[3])).then((b) => map.set(midi, b)).catch(() => {}));
        }
        await Promise.all(jobs);
        if (map.size > 0) this.samples = map;
      } catch (e) {
        console.warn("soundfont unavailable, using synth for", this.name, e);
      }
      return this;
    })();
    return this.ready;
  }
  nearest(p) {
    if (this.samples.has(p)) return [p, this.samples.get(p)];
    for (let d = 1; d < 24; d++) {
      if (this.samples.has(p - d)) return [p - d, this.samples.get(p - d)];
      if (this.samples.has(p + d)) return [p + d, this.samples.get(p + d)];
    }
    const first = this.samples.keys().next().value;
    return [first, this.samples.get(first)];
  }
  // Schedule a note on `ctx` into `dest`. Returns a stop function.
  play(ctx, dest, p, vel, when, dur) {
    const g = ctx.createGain();
    const amp = Math.pow(vel / 127, 1.6) * 0.9;
    const rel = this.sustain ? 0.18 : 0.35;
    g.connect(dest);
    let src;
    if (this.samples) {
      const [sp, buf] = this.nearest(p);
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (p - sp) / 12);
      const real = buf.duration / src.playbackRate.value;
      if (this.sustain && dur > real * 0.7 && buf.duration > 0.6) {
        src.loop = true; src.loopStart = buf.duration * 0.45; src.loopEnd = buf.duration - 0.08;
      }
      src.connect(g);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(amp, when + 0.006);
    } else {
      // fallback synth (used when soundfont samples can't be loaded): one oscillator, cheap enough for offline renders
      src = ctx.createOscillator();
      const hz = 440 * Math.pow(2, (p - 69) / 12);
      const wave = this.program < 16 || (this.program >= 24 && this.program < 40) ? "triangle" : this.sustain ? "sawtooth" : "square";
      src.type = wave;
      src.frequency.value = hz;
      src.connect(g);
      const peak = amp * (wave === "triangle" ? 0.35 : 0.1);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + (this.sustain ? 0.04 : 0.005));
      if (!this.sustain) g.gain.exponentialRampToValueAtTime(peak * 0.25, when + Math.max(0.02, Math.min(dur, 1.2)));
    }
    const end = when + Math.max(0.03, dur);
    g.gain.setTargetAtTime(0, end, rel / 3);
    src.start(when);
    src.stop(end + rel + 0.1);
    return () => { try { g.gain.cancelScheduledValues(0); g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); src.stop(ctx.currentTime + 0.1); } catch { /* already stopped */ } };
  }
}

export class Engine {
  constructor() {
    this.ctx = null;
    this.instruments = new Map();
    this.playing = false;
    this.voices = new Set();
    this.loop = null; // {start, end} in beats
    this.metronome = false;
    this.refBuffer = null;
    this.refUrl = null;
    this.refVolume = 0.8;
    this.refMuted = false;
    this.onTick = null;
    this.gm = [];
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      this.master = this.ctx.createDynamicsCompressor();
      this.master.threshold.value = -10; this.master.ratio.value = 3;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  instrument(program) {
    if (!this.instruments.has(program)) this.instruments.set(program, new Instrument(program, this.gm[program] || "Acoustic Grand Piano"));
    return this.instruments.get(program);
  }
  async loadProject(project) {
    this.ensure();
    await Promise.all(project.tracks.map((t) => this.instrument(t.program).load(this.ctx)));
  }
  async loadReference(url) {
    if (!url) { this.refBuffer = null; this.refUrl = null; return; }
    if (url === this.refUrl && this.refBuffer) return;
    this.ensure();
    const data = await (await fetch(url)).arrayBuffer();
    this.refBuffer = await this.ctx.decodeAudioData(data);
    this.refUrl = url;
  }
  preview(program, p, vel = 90, dur = 0.35) {
    this.ensure();
    const inst = this.instrument(program);
    inst.load(this.ctx).then(() => inst.play(this.ctx, this.master, p, vel, this.ctx.currentTime + 0.01, dur));
  }

  // ------------------------------------------------------------- transport
  play(project, fromBeat, { onlyTracks = null, reference = true } = {}) {
    this.stop();
    const ctx = this.ensure();
    this.project = project;
    this.tempo = new Tempo(project);
    this.startBeat = fromBeat;
    this.startSec = this.tempo.sec(fromBeat);
    this.t0 = ctx.currentTime + 0.08;
    this.playing = true;
    this.scheduledUntil = this.startSec;
    this.onlyTracks = onlyTracks;
    this.buildBus(project);
    const ref = project.reference;
    if (reference && this.refBuffer && !this.refMuted && ref && ref.synced !== false && this.startSec < this.refBuffer.duration) {
      const s = ctx.createBufferSource();
      s.buffer = this.refBuffer;
      const g = ctx.createGain(); g.gain.value = this.refVolume;
      s.connect(g); g.connect(this.master);
      const off = Math.max(0, this.startSec);
      s.start(this.t0 + Math.max(0, -this.startSec), off);
      this.refSource = s;
    }
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }
  buildBus(project) {
    const ctx = this.ctx;
    if (this.bus) Object.values(this.bus).forEach((b) => b.out.disconnect());
    this.bus = {};
    const anySolo = project.tracks.some((t) => t.solo);
    for (const t of project.tracks) {
      const g = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const audible = anySolo ? t.solo : !t.mute;
      g.gain.value = audible ? (t.volume ?? 0.8) : 0;
      if (pan) { pan.pan.value = t.pan || 0; g.connect(pan); pan.connect(this.master); } else g.connect(this.master);
      this.bus[t.id] = { gain: g, out: pan || g };
    }
  }
  updateMix(project) {
    if (!this.playing || !this.bus) return;
    const anySolo = project.tracks.some((t) => t.solo);
    for (const t of project.tracks) {
      const b = this.bus[t.id];
      if (!b) { this.buildBus(project); return; }
      const audible = anySolo ? t.solo : !t.mute;
      b.gain.gain.setTargetAtTime(audible ? (t.volume ?? 0.8) : 0, this.ctx.currentTime, 0.02);
    }
    this.project = project;
  }
  get positionSec() {
    if (!this.playing) return null;
    return this.startSec + (this.ctx.currentTime - this.t0);
  }
  get positionBeat() {
    const s = this.positionSec;
    return s == null ? null : this.tempo.beat(s);
  }
  tick() {
    if (!this.playing) return;
    const ctx = this.ctx, project = this.project;
    const nowSec = this.positionSec;
    const horizon = nowSec + 0.25;
    const tempo = this.tempo;
    if (this.loop && tempo.beat(nowSec) >= this.loop.end) {
      const lp = this.loop;
      this.play(project, lp.start, { onlyTracks: this.onlyTracks });
      return;
    }
    const from = this.scheduledUntil, to = this.loop ? Math.min(horizon, tempo.sec(this.loop.end)) : horizon;
    if (to > from) {
      const bFrom = tempo.beat(from), bTo = tempo.beat(to);
      for (const t of project.tracks) {
        if (this.onlyTracks && !this.onlyTracks.includes(t.id)) continue;
        const bus = this.bus[t.id];
        if (!bus) continue;
        const inst = this.instrument(t.program);
        if (!inst.ready) inst.load(ctx);
        for (const n of t.notes) {
          if (n.s < bFrom || n.s >= bTo) continue;
          const when = this.t0 + (tempo.sec(n.s) - this.startSec);
          const dur = tempo.sec(n.s + n.d) - tempo.sec(n.s);
          if (when < ctx.currentTime - 0.01) continue;
          const stop = inst.play(ctx, bus.gain, n.p, n.v, when, dur);
          this.voices.add(stop);
          setTimeout(() => this.voices.delete(stop), (when - ctx.currentTime + dur + 1) * 1000);
        }
      }
      if (this.metronome) {
        for (let b = Math.ceil(bFrom); b < bTo; b++) this.click(this.t0 + (tempo.sec(b) - this.startSec), b % (project.timeSig[0]) === 0);
      }
      this.scheduledUntil = to;
    }
    const endB = endBeat(project);
    if (!this.loop && tempo.beat(nowSec) > endB + 2 && !(this.refSource && nowSec < this.refBuffer.duration)) {
      this.stop();
      this.onEnd && this.onEnd();
    }
  }
  click(when, accent) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + 0.06);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    for (const s of this.voices) s();
    this.voices.clear();
    if (this.refSource) { try { this.refSource.stop(); } catch { /* not started */ } this.refSource = null; }
  }

  // ------------------------------------------------------------- offline render
  async render(project, { trackIds = null, sampleRate = 44100, tail = 2.5 } = {}) {
    await this.loadProject(project);
    const tempo = new Tempo(project);
    const start = Math.min(0, tempo.sec(0));
    const len = tempo.sec(endBeat(project)) - start + tail;
    const off = new OfflineAudioContext(2, Math.ceil(len * sampleRate), sampleRate);
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 3;
    comp.connect(off.destination);
    const anySolo = project.tracks.some((t) => t.solo);
    for (const t of project.tracks) {
      if (trackIds && !trackIds.includes(t.id)) continue;
      if (!trackIds && (anySolo ? !t.solo : t.mute)) continue;
      const g = off.createGain(); g.gain.value = t.volume ?? 0.8;
      const pan = off.createStereoPanner(); pan.pan.value = t.pan || 0;
      g.connect(pan); pan.connect(comp);
      const inst = this.instrument(t.program);
      for (const n of t.notes) {
        const when = tempo.sec(n.s) - start;
        inst.play(off, g, n.p, n.v, when, tempo.sec(n.s + n.d) - tempo.sec(n.s));
      }
    }
    const buf = await off.startRendering();
    // normalise to -1 dBFS
    let peak = 0;
    const chans = [buf.getChannelData(0), buf.getChannelData(1)];
    for (const c of chans) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
    if (peak > 0) { const k = 0.89 / peak; for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= k; }
    return encodeWav(chans, sampleRate);
  }
}

// Microphone capture to a mono 16 kHz WAV.
export class Recorder {
  async start(ctx) {
    this.ctx = ctx;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.level = 0;
    this.proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      let m = 0; for (let i = 0; i < d.length; i += 16) m = Math.max(m, Math.abs(d[i]));
      this.level = m;
    };
    const mute = ctx.createGain(); mute.gain.value = 0;
    this.src.connect(this.proc); this.proc.connect(mute); mute.connect(ctx.destination);
    this.startTime = ctx.currentTime;
    return this.startTime;
  }
  stop() {
    this.proc.disconnect(); this.src.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());
    const total = this.chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(total);
    let o = 0; for (const c of this.chunks) { all.set(c, o); o += c.length; }
    return encodeWav([downsample(all, this.ctx.sampleRate, 16000)], 16000);
  }
}
