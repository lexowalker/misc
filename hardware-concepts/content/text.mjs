// Prose for both tabs. Numbers come from the model, so text and drawings stay in step.
import { DRIVER as d, MOVER as m, fmt } from "./model.mjs";
import { SRC } from "./business.mjs";

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const B = (kind) => `<span class="basis" data-b="${kind}">${{ src: "sourced", tgt: "target", meas: "measure", calc: "calc", est: "estimate", seen: "listing" }[kind]}</span>`;

export function toolkitText(extra) {
  return {
    verdict: `<p class="lede">Develop the driver head and pause the hammer head. Build the driver head as a passive attachment for drivers people already own. Commit to a shared power base only after the attachment proves people want it.</p>
<p>The D-head turns a 4 mm hex bolt 180 mm deep inside a 40 mm void, where the $48 right-angle adapter cannot enter. The mechanism is ordinary: a shaft, a 2.6:1 crown gear and a through-bore bit. The business case is weak, because most people meet J1 rarely and can tip the dresser over instead.</p>`,
    judgments: [
      { k: "Mechanical feasibility", v: "Likely", tone: "good", why: `Stack ${d.stack} mm ${B("calc")} fits the ${d.void} mm void ${B("meas")}, with ${fmt(d.slideClear, 1)} mm to spare while sliding in. Crown-gear tooth bending at ${d.torque} N·m is about ${fmt(d.gear.sigma)} MPa (Lewis, module 1, 5 mm face) ${B("calc")}, which needs case-hardened steel.` },
      { k: "Usable by one person", v: "Yes, two-handed", tone: "good", why: `Main hand on the driver, second hand on the sleeve pushing about ${fmt(d.reactN)} N against the reaction torque ${B("calc")}. The bolt takes ${fmt(d.seconds, 1)} s at ${fmt(d.outRpm)} rpm, against an estimated 2–3 min with an L-key ${B("est")}.` },
      { k: "Commercial promise", v: "Weak", tone: "bad", why: `It must sell near the ${a(SRC.ra8510, "$46–50 Milwaukee adapter")} and the ${a(SRC.dwara, "$20–49 DeWalt adapter")}. It only wins in voids between ${fmt(d.voidNeeded, 1)} and about 57 mm. Landed cost at 1,000 units is ${extra.tkUnit1000} ${B("est")}.` },
    ],
    unknown: `<strong>Unknown most likely to change the verdict:</strong> how often awkward fasteners sit in voids between ${fmt(d.voidNeeded, 1)} and 57 mm. If real voids are mostly 57 mm or more, the cheap adapter wins. If they are mostly under ${fmt(d.voidNeeded, 1)} mm, the D-head needs custom short bits and a thinner gear.`,
    family: `<p><strong>What to share across the family.</strong> Keep the heads mechanically passive and share the battery, controller, motor, gearbox and one bayonet coupling with a 1/4 in hex output (B1–B8). Engineering points this way for three reasons:</p>
<ul><li>A passive head costs ${extra.tkUnit1000} to land, while a head with its own motor costs about 3–4× that ${B("est")}.</li>
<li>Only the base needs UL 62841 and battery work.</li>
<li>Bosch FlexiClick and Milwaukee 2505 already prove that buyers accept swapping heads on a shared base.</li></ul>
<p>The bend angle is carried by the grip hinge (B6), which passes only wires, so no universal joint sits in the drivetrain. A variable-bend head would need a U-joint that adds at least 15 mm to the stack ${B("est")}, so the D-head stays at 90° and rotates in 12 steps of 30° about its input axis (D2).</p>
<p><strong>Where the hammer head fits.</strong> The H-head would plug into the same bayonet (B7). Its cam-spring striker would be driven from the 1/4 in output.</p>
<ul><li>A palm nailer delivers ${d.blowJ} J × ${fmt(d.bpm)} bpm, about ${fmt(d.blowW)} W of blow power ${B("calc")} from ${a(SRC.m2458, "published specs")}. That is within reach of a 12 V base.</li>
<li>Recoil then runs back through the bayonet and planetary gearbox. That needs a damper, and is a durability risk the D-head never puts on the base.</li></ul>`,
    hammer: `<p><strong>"Swing at an angle" means one of two mechanisms, compared for job J2:</strong> driving a 76 mm hanger nail with ${d.hammerGap} mm clear along the nail axis ${B("meas")}.</p>
<ul>
<li><strong>Pivoting striking face.</strong> A hammer face on a short arm swings about a pin inside the head. The face is square to the nail at only one point of its arc. As the nail sinks, the blow turns glancing, and the head has no surface that registers on the nail. Recoil loads the pivot pin on every blow.</li>
<li><strong>Linear striker in an adjustable head.</strong> A striker moves along the nail axis inside a nose that sits on the nail head, so every blow is coaxial. The angle adjustment (H3) is between head and handle, outside the impact line, but it still carries recoil to the handle, so it needs locking teeth.</li></ul>
<p>The linear striker wins. It needs about ${d.needLinear} mm at the start of a drive ${B("calc")}. The ${a(SRC.pn50, "Bostitch PN50")} needs ${d.needPalm} mm and the ${a(SRC.m2458, "Milwaukee 2458-20")} ${d.needPalmM12} mm ${B("calc")}. So the H-head only helps in bays between about ${d.needLinear} and ${d.needPalm} mm, and only where a hand cannot sit behind the nail. Palm nailers already handle the common case for $55–203. Pause the H-head.</p>`,
    choices: [
      { c: `Job J1: M6 bolt, ${d.void} mm void, ${d.boltDepth} mm deep, approached from the front`, mat: true, why: "Sets the stack height and arm length. Voids of 57 mm or more hand the job to a $48 adapter." },
      { c: `Rated output ${d.torque} N·m`, mat: true, why: "Sets gear module and face width, and with them the 16 mm body thickness. Furniture M6 joints take an estimated 4–8 N·m." },
      { c: "Standard 25 mm insert bits in a through-bore", mat: true, why: "Keeps bits off the shelf. Custom 16 mm tips would cut the stack to about 16 mm but lock users into our bits." },
      { c: "Passive attachment first (host = any 1/4 in driver)", mat: true, why: "Avoids battery and UL 62841 work in phase 1, and puts the price ceiling at about $50." },
      { c: "Fixed 90° head that rotates in 12 steps; bend carried by the grip hinge", mat: true, why: "A variable bend in the drivetrain needs a U-joint, which adds 15 mm or more to the stack." },
      { c: "12 V platform for the power base", mat: false, why: "Only matters in phase 2." },
      { c: `Hammer job J2: 76 mm nail, ${d.hammerGap} mm clear`, mat: false, why: "Any gap of 183 mm or more hands the job to a palm nailer." },
    ],
    stages: [
      { n: 0, title: "Disproof: measure real voids and try the existing tools", who: "Founder", time: "2 weekends", buy: "Milwaukee 49-22-8510 adapter, Wera Zyklop Mini, Bondhus ball-end L-keys, test bolts (return the adapter and ratchet if unused)", skills: "Caliper and tape measure, a stopwatch, a shared spreadsheet", measure: "Survey 20 or more hard-to-reach hex fasteners in your home and in 5 handymen's or assemblers' jobs: void height, depth to the fastener, hex size, torque by feel. Time each benchmark tool on a J1 mock-up.", pass: "Pass if 30 % or more of the awkward fasteners sit in voids of 36–57 mm and the benchmark tools take more than 60 s or cannot reach. Fail if 85 % or more are reachable by the adapter or an L-key in under 60 s: then pause." },
      { n: 1, title: "Bench proof: printed head with steel gears", who: "Founder builds; engineer sizes the gears (15–25 h)", time: "4–6 weeks", buy: "Host 12 V driver, steel pinion and crown gear pair, shaft, bearings, SLA housings, bits, HX711 torque arm", skills: "CAD (Onshape/Fusion), assembly, basic Arduino for the load cell; gear sizing from an engineer", measure: "Stack height, slip or fracture torque, backlash, temperature after 200 cycles at 6 N·m, and bolt time on the J1 rig", pass: "Pass: stack ≤ 26 mm, transmits 6 N·m for 200 cycles in a printed housing with steel inserts, bolt done in ≤ 15 s. Fail: gear or housing yields below 6 N·m. Ratings stay unverified until stage 2." },
      { n: 2, title: "Integrated prototype: 5 machined heads in the field", who: "Engineer (DFM, 20–30 h) and machine shop; founder runs the field test", time: "8–10 weeks", buy: "5 CNC 7075 housing sets, hardened gear pairs, collars, sleeves, incentives for 5 testers", skills: "Writing drawings for quotes, running a test protocol, interviewing users", measure: "Torque to failure on 1 unit, 500-cycle durability at 8 N·m, time per fastener against an L-key, failures in 2 weeks of use, and willingness to pay", pass: "Pass: no failure at 500 cycles × 8 N·m, at least 2× faster than an L-key, 3 of 5 testers would pay $49 or more. Fail: any gear failure below 8 N·m, or fewer than 2 of 5 willing to pay." },
    ],
    partners: `<ol class="tight">
<li><strong>First: a freelance mechanical engineer with gear or power-tool experience.</strong> Ask for a 2-page gear sizing and tolerance memo (module, face width, material, heat treatment, backlash), with printable CAD for the stage 1 head. Budget 15–25 h at about $75–130/h (${a(SRC.meRate, "rate guide")}).</li>
<li><strong>Second: a CNC shop through an instant-quote service</strong> for the stage 2 housings and gears (${a(SRC.xometry, "Xometry")}).</li>
<li><strong>Can wait until stage 0 passes:</strong> a patent attorney for a freedom-to-operate search (right-angle and offset heads are crowded), an injection moulder, and an NRTL lab. A lab is needed only if you build the power base.</li></ol>`,
    rec: { verdict: "Narrow", next: "Run the stage 0 void survey and benchmark test", budget: `${extra.tkStage0}, 2 weekends`, change: "Move to prototype if 30 % or more of surveyed awkward fasteners sit in 36–57 mm voids where the benchmarks fail. Pause if the $48 adapter or an L-key handles 85 % or more in under a minute. Revisit the hammer head only if the survey finds many nail bays between 146 and 183 mm." },
  };
}

export function moverText(extra) {
  const it = m.item;
  return {
    verdict: `<p class="lede">Narrow before building. A powered thin platform can lift and steer a 60 kg chest on hard floors. It cannot slide under items with less than ${m.minClear} mm of underside clearance, cannot cross sills over about ${m.maxSillNoRamp} mm without a ramp, and does not work on carpet.</p>
<p>Inside those limits the hard part is not the machine. The hard part is whether people living alone fail at the lift step of a $29 lever kit, or at the push step. That decides whether this should be a lift-only aid, a full mover, or nothing.</p>`,
    judgments: [
      { k: "Mechanical feasibility", v: "Feasible, narrow", tone: "mid", why: `Toggle links lift ${fmt(m.plat.lift, 1)} mm from a ${m.plat.stowed} mm tray ${B("tgt")}. The lead screw needs ${fmt(m.TcontactBoth, 2)} N·m at deck contact ${B("calc")}, against a ${m.motorLimit} N·m motor limit ${B("src")}. With Ø${m.wheel.d} mm wheels and 1 in ball transfers, sills over ${m.maxSillNoRamp} mm stall the drive ${B("calc")}.` },
      { k: "Usable by one person", v: "Conditional", tone: "mid", why: `No lifting by the user and hold-to-run steering. But the item must have legs (${m.minClear} mm or more clearance), the user pushes the platform in with a handle, and placing a ramp at each sill is a bend-down task. Flush-bottom items need a second person or a lever accessory.` },
      { k: "Commercial promise", v: "Weak to unproven", tone: "bad", why: `Landed cost is ${extra.mvUnit1000} at 1,000 units ${B("est")}, implying a $650–900 retail price, against a ${a(SRC.megamaxx, "$29 lever kit")} and ${a(SRC.ssRound, "$14 sliders")}. No consumer powered competitor was found, and Airsled sells a thin powered mover to pros at $530–840.` },
    ],
    unknown: `<strong>Unknown most likely to change the verdict:</strong> which step of a manual move target users cannot do: tipping the item to insert sliders, pushing it, or crossing sills. Stage 0 measures this directly with a $90 kit.`,
    choices: [
      { c: `Item: emptied 4-drawer chest, ${it.mass} kg, ${it.L} × ${it.D} × ${it.H} mm, CG ${it.cgZ} mm up and centred`, mat: true, why: "Mass sets motor sizing. CG height and depth set the tipping margin (0.40 g across the platform)." },
      { c: `Underside clearance ${it.clear} mm (3 in, the low end of ${"<a href='" + SRC.pbDresser + "' target='_blank' rel='noopener'>published dresser specs</a>"})`, mat: true, why: `Sets the stowed height. Below ${m.minClear} mm the lift motor stalls; below ${m.plat.stowed + 10} mm the platform does not fit at all.` },
      { c: `Platform ${m.plat.L} × ${m.plat.W} mm, stowed ${m.plat.stowed} mm, lift ${fmt(m.plat.lift, 1)} mm`, mat: true, why: "A larger footprint raises the tip margin but stops it fitting between feet." },
      { c: "Hard floors only; ramps for sills over about 2 mm", mat: true, why: `Carpet roughly triples rolling resistance (${a(SRC.crr, "CasterHQ table")}) and the ball transfers sink in. Carpet needs larger wheels and therefore a taller tray.` },
      { c: `Route: ${m.hall} mm (36 in) hallway into a 737 mm clear (32 in) door`, mat: true, why: "Narrower doors stop longer items, whatever the mover." },
      { c: `Speed ${m.speed} m/s, programmed stops at ${m.decel} g, wired hold-to-run pendant`, mat: false, why: "Safety defaults; easy to change in firmware." },
      { c: "One lift motor with a left/right-hand screw", mat: false, why: "Keeps the deck level. Two motors would allow tilting but add cost." },
    ],
    stages: [
      { n: 0, title: "Disproof: three target users, one real chest, a $29 kit", who: "Founder plus an occupational therapist or aging-in-place specialist (6–10 h)", time: "2–3 weeks to recruit, 1 day to test", buy: "Lever-and-slider kit, hard-floor and carpet sliders, hanging scale used as a push gauge", skills: "Running a safe, consented user session; a therapist sets the force limits and stops the session if needed", measure: "For each user and step (tip and insert, push on hardwood, push on carpet, cross a sill, turn into a door): peak force, time, help needed, and the user's own rating. Ask what they paid last time to have furniture moved.", pass: "Continue if 2 of 3 users cannot complete a step they want to do, and that step is one P-1 removes. Pause if all 3 complete the move with the kit in under 15 min without help." },
      { n: 1, title: "Bench proof: one lift module and one drive module", who: "Founder builds; ME and EE contractors size and review (60–110 h total)", time: "6–8 weeks", buy: "Gearmotors, motor driver, ESP32, LiFePO4 pack, lead screw, laser-cut links, aluminium plate, ball transfers, wheels, load cells, pendant parts, sandbags", skills: "Mechanical assembly, Arduino/ESP32 firmware, current and force logging", measure: "Lift time and current at 30 kg per end, creep with power off over 12 h, stowed height, drive force on hardwood and carpet, highest sill climbed, braking distance from 0.3 m/s", pass: `Pass: stowed ≤ ${m.plat.stowed} mm, lifts 50 mm in ≤ 15 s, creep < 1 mm in 12 h with power off, climbs a 13 mm sill with the ramp. Fail: stowed height over 50 mm, or the screw back-drives under load.` },
      { n: 2, title: "Integrated prototype: full platform, five users, full route", who: "Founder runs sessions; lab does a pre-compliance scan", time: "10–12 weeks", buy: "Fabricated chassis and deck, second electronics set, skirt, pad, handle, ramp, test chest, incentives", skills: "Test protocol, incident logging, firmware tuning", measure: "Setup time, peak user force, route completion without help, tip events during 0.1 g stops with an offset load, floor marks, and recovery from a simulated power cut", pass: "Pass: 4 of 5 users finish the route in ≤ 15 min with no help, peak user force ≤ 50 N, no tip or slide event, item lowered by hand crank in ≤ 2 min after power loss. Load rating stays unverified until third-party testing." },
    ],
    partners: `<ol class="tight">
<li><strong>First: an occupational therapist or a Certified Aging-in-Place Specialist.</strong> Ask for a one-page session protocol with force and posture stop limits, and help recruiting 3 users. Deliverable: observation notes per step. Budget 6–10 h ${B("est")}.</li>
<li><strong>Second, only if stage 0 passes: a mechatronics contractor (ME and EE).</strong> Ask for link and screw sizing, a motor-control and hold-to-run architecture, and a hazard list (pinch, tip, runaway, stall).</li>
<li><strong>Then: an NRTL scoping call</strong> to settle UL 60335-1 alone versus also UL 3300, and a product-liability insurance broker. Both can wait until the integrated prototype works.</li></ol>`,
    rec: { verdict: "Narrow, then decide", next: "Stage 0 user test with the lever-and-slider kit", budget: `${extra.mvStage0} in parts plus about $500–1,500 for the specialist, 3 weeks`, change: "If users fail only at tipping the item to insert sliders, build a lift-only wedge (no drive): far cheaper. If they fail at pushing or sills, prototype P-1. If they finish with the kit, pause." },
    sequence: [
      "1 · Start: the chest stands on its feet; the platform is beside it, deck down.",
      `2 · Insert: the user pushes the platform under with the handle (M16). ${m.gap} mm of air remains between the deck and the underside.`,
      `3 · Engage: the deck rises ${m.gap} mm to touch the underside; the load cells (M12) confirm contact at all four pivots.`,
      `4 · Lift: 10 mm more lifts the feet clear. The chest tips across at ${fmt(m.tipAcross, 2)} g of braking or side push.`,
      `5 · Drive and turn at ${m.speed} m/s, hold-to-run (M13). See the plan view for the tightest turn.`,
      `6 · Stop: the controller limits braking to ${m.decel} g; the screw is self-locking, so height holds with power off.`,
      "7 · Lower: the deck descends until the feet carry the chest again. If power is lost, crank down at M14.",
      "8 · Retrieve: the user pulls the platform out with the handle.",
    ],
  };
}
