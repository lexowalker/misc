// Single source for every dimension, target and calculation the page shows.
// Figures, readouts and prose all import from here, so a change propagates everywhere.
// Each value carries a basis: "src" (published / sourced), "tgt" (proposed design target, unverified),
// "meas" (assumed placeholder that must be measured), "calc" (derived here).

export const DRIVER = {
  // job J1: re-tightening an M6 socket-cap bolt (4 mm hex) that fixes a dresser carcass to its plinth,
  // reached through the void under the lowest drawer frame with the drawer removed.
  void: 40, // mm clear height, meas
  boltDepth: 180, // mm from front face to bolt axis, meas
  boltHead: 6, // mm, M6 socket cap head height (ISO 4762: k = 6), src
  socketDepth: 3.5, // mm hex engagement used, meas
  turns: 24, // 24 mm of thread engagement at 1.0 mm pitch, calc from job
  torque: 8, // N·m rated output, tgt
  ratio: 2.6, // 26T crown : 10T pinion, tgt
  hostRpm: 400, // typical 12 V driver low gear, src (FlexiClick 0–460, M12 2505 0–400)
  body: 16, // mm housing thickness at output, tgt
  bit: 25, // mm ISO 1173 C6.3 insert bit, src
  armLength: 230, // mm output axis to input end of arm, tgt
  lkeyLong: 100, // mm, long arm of a 4 mm ball-end L-key, meas (varies by brand)
  raHead: 51, // mm Milwaukee 49-22-8510 head height (published 2 in; other listings 1.75–1.80 in), src
  // hammer study
  hammerGap: 150, // mm clear along nail axis, meas
  nail: 76, // mm 10d common / hanger nail length, src (3 in)
  linearHead: 70, // mm striker head length along nail axis, tgt
  pivotHead: 70, // mm pivot head depth, tgt
  pivotR: 48, // mm striker arm radius, tgt
  palmLen: 107, // mm Bostitch PN50 height along nail axis (UK PN50-E spec sheet), src
  palmM12: 165, // mm Milwaukee 2458-20, 6.5 in H, src
  blowJ: 3.0, // J per blow, Milwaukee 2458-20 2.2 ft·lb, src
  bpm: 2700, // blows per minute, src
};

const d = DRIVER;
d.stack = d.body + (d.bit - d.body); // through-bore: bit back end flush with cover, so stack = bit length
d.protrude = d.bit - d.body;
d.voidNeeded = d.boltHead + d.stack + d.socketDepth + 1; // +1 mm sliding margin
d.slideClear = d.void - (d.boltHead + 0.5 + d.stack); // clearance above head while sliding in
d.outRpm = d.hostRpm / d.ratio;
d.seconds = (d.turns / d.outRpm) * 60;
d.hostTorque = d.torque / d.ratio / 0.9; // input torque needed at 90 % mesh efficiency
d.sleeveArm = d.armLength - 24; // mm from output axis to sleeve centre
d.reactN = d.torque / (d.sleeveArm / 1000);
// Lewis bending check for the crown gear tooth (module 1.0, face width 5 mm, form factor 0.33)
d.gear = { m: 1.0, b: 5, Y: 0.33, r: 13 };
d.gear.Ft = d.torque / (d.gear.r / 1000);
d.gear.sigma = d.gear.Ft / (d.gear.b * d.gear.m * d.gear.Y);
// hammer: clearance needed along nail axis at the start of a drive (nail held in the nose)
d.needLinear = d.nail + d.linearHead;
d.needPalm = d.nail + d.palmLen;
d.needPalmM12 = d.nail + d.palmM12;
d.blowW = (d.blowJ * d.bpm) / 60;

export const MOVER = {
  // representative item: emptied 4-drawer chest
  item: { mass: 60, L: 1100, D: 480, H: 1000, cgZ: 450, clear: 76, foot: 50 }, // clear: 3 in, low end of published dresser clearances
  plat: { L: 700, W: 360, stowed: 45, lift: 49.5, mass: 11 }, // tgt
  link: { len: 120, th0: 5, th1: 30, zb: 24.5 }, // toggle links, tgt
  screw: { lead: 2, eff: 0.35 }, // Tr10x2, self-locking, tgt
  wheel: { d: 38, n: 2 }, // drive wheels, tgt
  hall: 914, door: 737, wall: 140, // 36 in hall (IRC R311.6 min), 32 in door slab ≈ 29 in clear (meas)
  speed: 0.3, decel: 0.1, // m/s, g; tgt
  crr: { hard: 0.03, carpet: 0.09 }, // PU on hardwood 0.025–0.035; carpet ×2.5–3.5 (CasterHQ table)
  skates: { span: 1000, W: 300 }, // paired-skate alternative, tgt
};

const m = MOVER;
const rad = (deg) => (deg * Math.PI) / 180;
m.deckZ = (th) => m.link.zb + 4 + m.link.len * Math.sin(rad(th));
m.liftAt = (th) => m.deckZ(th) - m.deckZ(m.link.th0);
m.thAtLift = (lift) => (Math.asin((lift + m.deckZ(m.link.th0) - m.link.zb - 4) / m.link.len) * 180) / Math.PI;
m.gap = m.item.clear - m.plat.stowed; // free rise before contact
m.thContact = m.thAtLift(m.gap);
m.W = m.item.mass * 9.81;
// horizontal pull per end at contact angle: half the weight per end, two links per end
m.linkForceAt = (th) => (m.W / 2) / Math.tan(rad(th));
m.screwTorque = (F) => (F * m.screw.lead / 1000) / (2 * Math.PI * m.screw.eff);
m.Fcontact = m.linkForceAt(m.thContact);
m.Tcontact = m.screwTorque(m.Fcontact);
m.nutTravel = m.link.len * (Math.cos(rad(m.link.th0)) - Math.cos(rad(m.link.th1)));
m.turnsScrew = m.nutTravel / m.screw.lead;
// stability: decel (in g) that tips the item about the platform edge
m.tipAcross = (m.plat.W / 2) / m.item.cgZ;
m.tipAlong = (m.plat.L / 2) / m.item.cgZ;
m.tipAlongSk = (m.skates.span / 2) / m.item.cgZ;
// rolling
m.total = (m.item.mass + m.plat.mass) * 9.81;
m.rollHard = m.total * m.crr.hard;
m.rollCarpet = m.total * m.crr.carpet;
// threshold climb: horizontal force / wheel load for wheel radius r and step h
export const climbRatio = (r, h) => (h >= r ? Infinity : Math.sqrt(2 * r * h - h * h) / (r - h));
m.climb = (wheelD, h) => climbRatio(wheelD / 2, h);
// corridor-turn bound for a rectangle (w wide) turning from a corridor a into b
m.Lmax = (a, b, w) => {
  let best = Infinity;
  for (let t = 1; t < 89; t += 0.25) { const s = Math.sin(rad(t)), c = Math.cos(rad(t)); best = Math.min(best, (a * s + b * c - w) / (s * c)); }
  return best;
};
m.LmaxTurn = m.Lmax(m.hall, m.door, m.item.D);

export const fmt = (v, dp = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

// Lead-screw torque for both ends (left/right-hand screw drives two nuts), at the angle where the deck meets the load.
m.TcontactBoth = 2 * m.Tcontact;
m.motorLimit = 2.45; // N·m: Pololu 37D 131:1, maker's recommended instantaneous max 25 kg·cm (stall ≈ 45 kg·cm), src
// Lowest underside clearance the lift can pick up without exceeding the motor limit.
m.thMin = (() => { const F = (m.motorLimit / 2) * 2 * Math.PI * m.screw.eff / (m.screw.lead / 1000); return (Math.atan((m.W / 2) / F) * 180) / Math.PI; })();
m.minClear = Math.ceil(m.plat.stowed + m.liftAt(m.thMin));
// Ball transfers lead into a threshold; drive wheels supply the push.
m.ball = 25.4; // mm ball diameter, src (1 in low-profile ball transfer)
m.driveShare = 0.4; // share of total weight on the sprung drive wheels, tgt
m.mu = 0.5; // PU on dry hardwood, assumed
m.traction = m.mu * m.driveShare * m.total;
m.cornerLoad = ((1 - m.driveShare) * m.total) / 4;
m.climbForce = (h) => 2 * m.cornerLoad * climbRatio(m.ball / 2, h);
m.maxSillNoRamp = (() => { let h = 0; while (m.climbForce(h + 0.1) < m.traction) h += 0.1; return Math.round(h * 10) / 10; })();
