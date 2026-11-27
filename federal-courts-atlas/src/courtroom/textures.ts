// Procedural canvas textures for the courtroom (wood grain, carpet, flags, soft glow).
// Everything is drawn locally on a <canvas>: no image, model or font is fetched.
// These functions return plain canvases; scene.ts wraps them in three.js textures.

/** Deterministic pseudo-random numbers (mulberry32), so the room looks the same on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise on a fixed lattice. */
function noise1(seed: number, size = 1024): (t: number) => number {
  const r = rng(seed);
  const lattice = Array.from({ length: size }, () => r());
  return (t: number) => {
    const i = Math.floor(t);
    const f = t - i;
    const a = lattice[((i % size) + size) % size]!;
    const b = lattice[(((i + 1) % size) + size) % size]!;
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/**
 * Grayscale wood grain (light values, so the material color carries the hue).
 * Grain runs along the canvas x axis; it tiles horizontally and vertically.
 */
export function woodGrainCanvas(size = 512, seed = 7): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const n1 = noise1(seed, size);
  const n2 = noise1(seed + 1, size);
  const n3 = noise1(seed + 2, size);
  const r = rng(seed + 3);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // A gentle waviness that repeats exactly across the tile (integer cycles).
      const wave = 5 * Math.sin((x / size) * TAU * 2 + n2(y * 0.02) * 4) + 2.5 * Math.sin((x / size) * TAU * 5 + y * 0.01);
      const t = y + wave;
      const band = n1(t * 0.06);
      const ring = Math.pow(Math.abs(Math.sin(t * 0.19 + n3(t * 0.015) * 5)), 7);
      let v = 0.8 + 0.13 * band - 0.13 * ring + 0.035 * (r() - 0.5);
      v = Math.max(0, Math.min(1, v));
      const i = (y * size + x) * 4;
      const g = Math.round(v * 255);
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Carpet: a fine diamond lattice with a faint speckle (light values; color comes from the material). */
export function carpetCanvas(size = 256, seed = 11): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = 'rgb(236,236,236)';
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < 2600; i++) {
    const g = 210 + Math.round(r() * 45);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 1);
  }
  ctx.strokeStyle = 'rgba(150,150,150,0.55)';
  ctx.lineWidth = 2;
  const step = size / 4;
  ctx.beginPath();
  for (let k = -size; k <= size * 2; k += step) {
    ctx.moveTo(k, 0);
    ctx.lineTo(k + size, size);
    ctx.moveTo(k, size);
    ctx.lineTo(k + size, 0);
  }
  ctx.stroke();
  // Small dots at the lattice crossings.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let y = 0; y <= size; y += step) {
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.arc(x + step / 2, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

/** The U.S. flag (proportions after 4 U.S.C. § 1 and Executive Order 10834), hoist on the left. */
export function usFlagCanvas(): HTMLCanvasElement {
  const H = 260;
  const W = Math.round(H * 1.9);
  const [c, ctx] = canvas(W, H);
  const stripe = H / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 ? '#f4f1ea' : '#a3263a';
    ctx.fillRect(0, i * stripe, W, Math.ceil(stripe));
  }
  const ch = stripe * 7;
  const cw = H * 0.76;
  ctx.fillStyle = '#2b3168';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#f4f1ea';
  const sx = cw / 12;
  const sy = ch / 10;
  for (let row = 0; row < 9; row++) {
    const even = row % 2 === 0;
    const count = even ? 6 : 5;
    for (let k = 0; k < count; k++) {
      const x = sx * (even ? 1 + 2 * k : 2 + 2 * k);
      star(ctx, x, sy * (row + 1), H * 0.0616 * 0.5 * 0.95);
    }
  }
  return c;
}

/** A plain navy court banner with a gold border: no seal, no lettering. */
export function bannerCanvas(): HTMLCanvasElement {
  const H = 260;
  const W = Math.round(H * 1.9);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#1d2a5c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c9a45c';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.fillStyle = '#c9a45c';
  // A ring of thirteen stars, a common motif on federal court banners.
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 13;
    star(ctx, W * 0.55 + Math.cos(a) * H * 0.27, H / 2 + Math.sin(a) * H * 0.27, H * 0.035);
  }
  return c;
}
