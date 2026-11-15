// Costs, competitors and standards. Every row carries a basis label and a source where one exists.
// basis: "seen" = retail listing seen 2026-11-15 (via search listing), "est" = estimate, "quote" = supplier quote required.
// Totals are computed in build.mjs from these rows, so tables always reconcile.

const SEEN = "listing seen 2026-11-15";

export const SRC = {
  flexi1: "https://slickdeals.net/f/18911953-bosch-gsr12v-300fcb22-12v-max-drill-driver-with-5-in-1-flexiclick-system-with-2-2-0-ah-batteries-139-92",
  flexi2: "https://toolup.com/products/bosch-gsr12v-300fcb22-12v-max-ec-brushless-flexiclick%C2%AE-5-in-1-drill-driver-system-2",
  flexi3: "https://zoro.com/bosch-cordless-drilldriver-120v-20ah-gsr12v-300fcb22/i/G4425385",
  m2505: "https://www.protoolreviews.com/milwaukee-m12-fuel-installation-driver/",
  m2505b: "https://empirerigging.com/milwaukee-2505-22",
  ra8510: "https://www.coastaltool.com/products/milwaukee-49-22-8510-right-angle-attachment",
  dwara: "https://gexpro.com/p/1062197/dewalt/right-angle-drill-attachment-/885911302401/dwara100",
  m2560: "https://thepowertoolstore.com/collections/m18-m12/products/milwaukee-2560-20",
  m2557: "https://thepowertoolstore.com/collections/m18-m12/products/milwaukee-2557-20",
  dcf500: "https://thepowertoolstore.com/collections/power-tools/products/dewalt-dcf500b",
  zyklop: "https://hausoftools.com/collections/wera/products/wera-05073230001-8001-a-zyklop-mini-1-bit-ratchet-sb-with-drive-2-pc",
  bondhus: "https://www.victornet.com/category/Bondhus-Balldriver-L-Wrench-Sets/405.html",
  wera950: "https://www.thepowertoolstore.com/collections/hand-tools-hex-keys/products/wera-05133164001",
  m2458: "https://empirerigging.com/milwaukee-2458-20",
  m2458b: "https://hdsupplysolutions.com/p/milwaukee-m12-12v-lithium-ion-cordless-palm-nailer-tool-only-p223571",
  pn50: "https://bostitch.co.uk/products/specification-sheets/tools/pn50-e/",
  pn50ca: "https://mississaugahardware.com/products/bostitch-pn50-mini-impact-palm-nailer",
  hercules: "https://go.harborfreight.com/sku/56564",
  pololu131: "https://pololu.com/product/4746/specs",
  pololu50: "https://www.pololu.com/product/4743",
  khk: "https://catalog.khkgears.us/printitems/miter-gears/injection-molded-miter-gears-dm",
  adafruitSol: "https://www.adafruit.com/product/413",
  hx711: "https://www.adafruit.com/product/5974",
  print3d: "https://d3ey8wiaid948t.cloudfront.net/3d-printing-pricing",
  xometry: "https://www.xometry.com/resources/calculating-the-cost-of-cnc-machining-custom-parts/",
  meRate: "https://www.cadcrowd.com/blog/?p=24975",
  meRate2: "https://www.contractrates.fyi/Mechanical-Engineer/hourly-rates",
  meSalary: "https://www.salary.com/research/salary/hiring/mechanical-eng-salary",
  mold: "https://www.wevolver.com/article/calculating-injection-molding-costs-tips-and-facts-you-need-to-know",
  ulCost: "https://jingsourcing.com/b-ul-certification-cost/",
  stampDie: "https://hplmachining.com/blog/is-sheet-metal-stamping-expensive/",
  fabVsStamp: "https://www.thefabricator.com/thefabricator/article/stamping/making-the-transition-from-fabricating-to-stamping",
  ssRound: "https://www.walmart.com/ip/Super-Sliders-3-1-2-Sliders-Wood-Beige-4-Pk/21279884",
  ssCarpet: "https://www.walmart.com/ip/Super-Sliders-5-3-4-x-9-1-2-Reusable-Furniture-Sliders-Carpet-Beige-4-Pk/43623484",
  megamaxx: "https://www.desertcart.vn/products/279698358-mega-maxx-heavy-duty-furniture-lifter-with-4-sliders-easy",
  genericKit: "https://www.walmart.com/ip/1148299648",
  hfDolly: "https://go.harborfreight.com/coupons/2020/09/haul-master-30-in-x-18-in-1000-lbs-capacity-hardwood-dolly-for-11-99/",
  harper: "https://www.homedepot.com/p/Harper-800-lb-Capacity-Appliance-Hand-Truck-6781/202259411",
  milDolly: "https://partssource.com/parts/milwaukee-hand-trucks/40710",
  airsled: "https://www.walmart.com/ip/Airsled-AM2400-VS-Heavy-Duty-Appliance-Mover-Variable-Speed-950-Pound-Lift-Max/1011963440",
  airsledLD: "https://reach.dog/shop/arclight-tool-supply-co/products/copy-of-light-duty-appliance-mover-by-airsled-single-speed",
  dayton: "https://sustainablesupply.com/products/dayton-desk-mover-cap-600-lb-d16xw40xh10-1-4-30e987-c1553622",
  hilman: "https://zoro.com/hilman-rollers-equipment-roller-kit-swivel-16-000-lb-cap-krs-8-4s/i/G2274842",
  mirfee: "https://www.bestbuy.com/product/mirfee-440lbs-folding-electric-stair-dolly-with-removable-tray-handles-1500-steps-for-large-furniture-moving-black/J7WC47YWF9",
  cytron: "https://www.robotshop.com/products/cytron-20a-6v-30v-dual-dc-motor-driver",
  litime: "https://www.litime.com/products/litime-12v-6ah-lifepo4-lithium-battery-built-in-6a-bms-76-8w-output-power-4000-deep-cycles-perfect-for-fish-finders-kids-scooters-led-lights-security-cameras-toys-camping",
  esp32: "https://www.digikey.com/short/dtwmv43r",
  plate: "https://www.zoro.com/zoro-select-plate-stock-al-6061-14-x-12-x-12-in-61p25x12-12/i/G0498836",
  ball: "https://apollocaster.com/store/ball-transfer-low-profile-1-steel-ball-round-flange-214-diameter-two-holes-134-inch-apart-steel-housing-75-58-inch-profile-88820-p-88820.html",
  pa14: "https://www.mrosupply.com/linear-motion/6426099_pa-14-4-150_mro-supply/",
  crr: "https://casterhq.com/downloads/rolling-resistance-spec-sheet",
  ada: "https://www.access-board.gov/ada/guides/chapter-4-entrances-doors-and-gates/",
  irc: "https://www.blockrenovation.com/guides/minimum-hallway-width-residential-code-guide",
  pbDresser: "https://www.potterybarnkids.com/products/emery-dresser",
  lmTables: "https://libertymmhtables.libertymutual.com/references",
  lmPaper: "https://pubmed.ncbi.nlm.nih.gov/33729096/",
  // standards
  ul62841: "https://www.ul.com/services/batteries-power-tools-safety-testing-and-certification",
  ulStatus: "https://www.ul.com/resources/standards-publication-status",
  ul2595: "https://datasheets.globalspec.com/ds/ULS/ul-2595/bcac4a44-cd75-4d5a-a3e4-0b1bda75cbf1",
  cfr173: "https://www.ecfr.gov/current/title-49/subtitle-B/chapter-I/subchapter-C/part-173/subpart-E/section-173.185",
  fcc15: "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15/subpart-B/section-15.101",
  prop65: "https://oehha.ca.gov/media/downloads/crnr/finalregtext112624approval.pdf",
  osha: "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-A/section-1910.7",
  ul3300: "https://www.govinfo.gov/content/pkg/FR-2025-12-31/pdf/2025-24076.pdf",
  ul3300b: "https://webstore.ansi.org/standards/ul/ansiul33002026",
  ul60335: "https://www.csagroup.org/store/product/2702315/",
  b301: "https://www.asme.org/getmedia/216191b1-33df-4e2f-8ea8-a8013c702a15/B30-1-Jacks-Industrial-Rollers-Air-Casters-and-Hydraulic-Gantries_2020.pdf",
  cpsa: "https://www.cpsc.gov/s3fs-public/cpsa.pdf",
  cfr1115: "https://www.govinfo.gov/content/pkg/CFR-2019-title16-vol2/pdf/CFR-2019-title16-vol2-part1115.pdf",
  iso4762: "https://www.iso.org/standard/56046.html",
};

// ---------- prototype bills of materials ----------
// stage: 0 = disproof experiment, 1 = bench proof, 2 = integrated prototype. pid ties a row to the drawings.
export const TOOLKIT_BOM = [
  { stage: 0, pid: "—", item: "Right-angle attachment, Milwaukee 49-22-8510 (benchmark)", qty: 1, unit: 48, basis: "seen", note: "$46–50", src: SRC.ra8510 },
  { stage: 0, pid: "—", item: "Zyklop Mini 1/4 in bit ratchet, Wera 8001 A (benchmark)", qty: 1, unit: 44, basis: "seen", note: "$41.99–46.99", src: SRC.zyklop },
  { stage: 0, pid: "—", item: "Ball-end metric L-key set, Bondhus 9-pc (benchmark)", qty: 1, unit: 31.99, basis: "seen", src: SRC.bondhus },
  { stage: 0, pid: "J1", item: "M6 × 30 socket-cap bolts, barrel nuts, scrap 18 mm panel", qty: 1, unit: 25, basis: "est" },
  { stage: 0, pid: "—", item: "Digital caliper (skip if owned)", qty: 1, unit: 25, basis: "est" },
  { stage: 1, pid: "B2", item: "Host driver: Hercules 12 V 1/4 in hex screwdriver (HF 56564)", qty: 1, unit: 39.99, basis: "seen", src: SRC.hercules },
  { stage: 1, pid: "D6, D7", item: "Steel pinion + crown gear pair, module 1, 10:26 (SDP/SI or KHK)", qty: 1, unit: 90, basis: "quote", note: "est. $60–120; plastic KHK miter gears ≈ CA$3.58 are too weak", src: SRC.khk },
  { stage: 1, pid: "D5", item: "Ø6 mm ground shaft and 2 needle bearings", qty: 1, unit: 18, basis: "est" },
  { stage: 1, pid: "D8", item: "Bearings 6700ZZ 10×15×4 (incl. spares)", qty: 4, unit: 3, basis: "est" },
  { stage: 1, pid: "D3, D4", item: "SLA-printed housing halves, 3 iterations", qty: 3, unit: 50, basis: "est", note: "SLA from $35/part", src: SRC.print3d },
  { stage: 1, pid: "D10", item: "4 mm hex × 25 mm insert bits", qty: 10, unit: 1.5, basis: "est" },
  { stage: 1, pid: "—", item: "HX711 load-cell amplifier (torque arm)", qty: 1, unit: 9.95, basis: "seen", src: SRC.hx711 },
  { stage: 1, pid: "—", item: "10 kg bar load cell and lever-arm fixture parts", qty: 1, unit: 27, basis: "est" },
  { stage: 2, pid: "D3, D4", item: "CNC 7075 housing sets (Xometry quote)", qty: 5, unit: 90, basis: "quote", note: "est. $300–600 for 5 sets", src: SRC.xometry },
  { stage: 2, pid: "D6, D7", item: "Hardened gear pairs", qty: 5, unit: 90, basis: "quote" },
  { stage: 2, pid: "D5, D8–D10", item: "Shafts, bearings, balls, bits per head", qty: 5, unit: 40, basis: "est" },
  { stage: 2, pid: "D2, D11", item: "Clocking collars and grip sleeves (printed TPU/nylon)", qty: 5, unit: 25, basis: "est" },
  { stage: 2, pid: "—", item: "Field-test incentives (installers, assemblers)", qty: 5, unit: 50, basis: "est" },
];

export const TOOLKIT_LABOR = [
  { stage: 1, who: "Freelance mechanical engineer (gear sizing, tolerance memo, CAD review)", hours: [15, 25], rate: [75, 130], src: SRC.meRate },
  { stage: 2, who: "Mechanical engineer (DFM for machined housing, fatigue check)", hours: [20, 30], rate: [75, 130], src: SRC.meRate2 },
];

export const MOVER_BOM = [
  { stage: 0, pid: "—", item: "Furniture lifter + 4 sliders, Mega Maxx (660 lb)", qty: 1, unit: 28.97, basis: "seen", src: SRC.megamaxx },
  { stage: 0, pid: "—", item: "Super Sliders 3.5 in, hard floor, 4-pack", qty: 1, unit: 13.95, basis: "seen", src: SRC.ssRound },
  { stage: 0, pid: "—", item: "Super Sliders 5.75 × 9.5 in, carpet, 4-pack", qty: 1, unit: 23.98, basis: "seen", src: SRC.ssCarpet },
  { stage: 0, pid: "—", item: "Digital hanging scale used as push-pull gauge", qty: 1, unit: 15, basis: "est" },
  { stage: 1, pid: "M5", item: "Lift gearmotor, Pololu 37D 131:1 12 V", qty: 1, unit: 32.95, basis: "seen", src: SRC.pololu131 },
  { stage: 1, pid: "M7", item: "Drive gearmotors, Pololu 37D 50:1 12 V", qty: 2, unit: 38.95, basis: "seen", src: SRC.pololu50 },
  { stage: 1, pid: "M11", item: "Dual motor driver, Cytron MDD20A", qty: 1, unit: 35, basis: "seen", note: "out of stock at listing; use any 2×20 A driver", src: SRC.cytron },
  { stage: 1, pid: "M11", item: "ESP32-DevKitC-32E", qty: 1, unit: 10, basis: "seen", src: SRC.esp32 },
  { stage: 1, pid: "M10", item: "LiFePO4 battery, LiTime 12 V 6 Ah", qty: 1, unit: 29.99, basis: "seen", src: SRC.litime },
  { stage: 1, pid: "M4", item: "Tr10×2 left/right-hand lead screw and 2 nuts", qty: 1, unit: 45, basis: "est" },
  { stage: 1, pid: "M3", item: "Laser-cut steel links and pins (SendCutSend quote)", qty: 1, unit: 60, basis: "quote" },
  { stage: 1, pid: "M1, M9", item: "6061 plate 1/4 × 12 × 12 in", qty: 4, unit: 37.69, basis: "seen", src: SRC.plate },
  { stage: 1, pid: "M8", item: "Low-profile ball transfers, 1 in", qty: 4, unit: 5.61, basis: "seen", note: "steel ball listed; specify nylon for floors", src: SRC.ball },
  { stage: 1, pid: "M6", item: "Ø38 mm polyurethane wheels and hubs", qty: 2, unit: 12, basis: "est" },
  { stage: 1, pid: "M12", item: "HX711 amplifier", qty: 1, unit: 9.95, basis: "seen", src: SRC.hx711 },
  { stage: 1, pid: "M12", item: "4 × 50 kg half-bridge load cells", qty: 1, unit: 18, basis: "est" },
  { stage: 1, pid: "M13", item: "Pendant parts: enclosure, hold-to-run switch, coil cord", qty: 1, unit: 25, basis: "est" },
  { stage: 1, pid: "—", item: "Test load: 4 × 50 lb sandbags", qty: 1, unit: 30, basis: "est" },
  { stage: 2, pid: "M1, M9", item: "Laser-cut and bent chassis and deck (SendCutSend/Xometry)", qty: 1, unit: 500, basis: "quote", note: "est. $350–700" },
  { stage: 2, pid: "M5, M7, M10–M12", item: "Second set of motors and electronics", qty: 1, unit: 220, basis: "est" },
  { stage: 2, pid: "M2, M14–M17", item: "Pad, manual-lower socket, skirt, handle, ramp", qty: 1, unit: 90, basis: "est" },
  { stage: 2, pid: "J3", item: "Used chest of drawers as test item", qty: 1, unit: 60, basis: "est" },
  { stage: 2, pid: "—", item: "Participant incentives (5 target users)", qty: 5, unit: 50, basis: "est" },
];

export const MOVER_LABOR = [
  { stage: 0, who: "Occupational therapist or CAPS specialist (session protocol, recruit and observe 3 users)", hours: [6, 10], rate: [80, 150] },
  { stage: 1, who: "Mechanical engineer (link and screw sizing, frame)", hours: [30, 50], rate: [75, 150], src: SRC.meRate2 },
  { stage: 1, who: "Electrical / firmware engineer (motor control, hold-to-run, load-cell logic)", hours: [30, 60], rate: [75, 150] },
  { stage: 2, who: "Test lab pre-compliance EMC scan and safety review", hours: [1, 1], rate: [1000, 2000], flat: true },
];

// ---------- pilot and production runs (each scenario standalone, not cumulative) ----------
export const TOOLKIT_RUNS = {
  note: "D-head as a passive attachment for any 1/4 in hex driver. The power base is not in these runs.",
  runs: [
    {
      qty: 100,
      oneTime: [
        { item: "Engineering (finish design, DFM, drawings)", lo: 6000, hi: 15000, basis: "est", why: "60–120 h at $75–130/h" },
        { item: "Tooling (fixtures, CNC programming, gear setup)", lo: 1500, hi: 4000, basis: "est" },
        { item: "Testing and IP (durability rig, freedom-to-operate search)", lo: 3500, hi: 8000, basis: "est" },
      ],
      unit: [
        { item: "CNC housing halves", lo: 38, hi: 65 },
        { item: "Cut steel gears and shaft", lo: 14, hi: 24 },
        { item: "Bearings", lo: 4, hi: 6 },
        { item: "Collar, sleeve, ball, bit", lo: 5, hi: 8 },
        { item: "Assembly and QC", lo: 8, hi: 12 },
        { item: "Packaging", lo: 2, hi: 3 },
      ],
      freight: [0.05, 0.08],
    },
    {
      qty: 1000,
      oneTime: [
        { item: "Engineering (DFM for moulding and powder-metal gears, tolerance stack)", lo: 15000, hi: 30000, basis: "est" },
        { item: "Tooling (2 housing moulds, aluminium to P20 steel; gear tooling)", lo: 14000, hi: 45000, basis: "est", why: "moulds $1k–5k aluminium, $8k–25k P20 each", src: SRC.mold },
        { item: "Testing and IP (durability, FTO opinion)", lo: 6000, hi: 15000, basis: "est" },
      ],
      unit: [
        { item: "Glass-filled nylon housing with metal insert", lo: 4, hi: 7 },
        { item: "Powder-metal or hobbed gears, shaft", lo: 7, hi: 12 },
        { item: "Bearings", lo: 2, hi: 3 },
        { item: "Collar, sleeve, ball, bit", lo: 2, hi: 4 },
        { item: "Assembly and QC", lo: 3, hi: 5 },
        { item: "Packaging", lo: 1, hi: 2 },
      ],
      freight: [0.08, 0.12],
    },
  ],
  drivers: "The range is driven by gear process (cut vs powder metal), housing material (machined 7075 vs moulded nylon with insert), and whether a freedom-to-operate opinion finds a patent to design around.",
};

export const MOVER_RUNS = {
  note: "P-1 platform with pendant and one ramp. Certification scope is unconfirmed (see standards).",
  runs: [
    {
      qty: 100,
      oneTime: [
        { item: "Engineering (ME, EE, firmware, hazard analysis)", lo: 60000, hi: 140000, basis: "est", why: "500–900 h at $75–150/h" },
        { item: "Tooling (weld and assembly jigs, harness boards)", lo: 5000, hi: 12000, basis: "est" },
        { item: "Testing and certification (UL 60335-1 ± UL 3300, FCC 15B, battery docs)", lo: 25000, hi: 80000, basis: "est", why: "no published UL 3300 fee; quote required" },
      ],
      unit: [
        { item: "Motors (3)", lo: 75, hi: 105 },
        { item: "Controller PCB, drivers, load cells", lo: 45, hi: 80 },
        { item: "Certified battery pack", lo: 40, hi: 70 },
        { item: "Fabricated chassis and deck", lo: 90, hi: 160 },
        { item: "Links, screw, nuts, pins", lo: 40, hi: 70 },
        { item: "Wheels and ball transfers", lo: 15, hi: 25 },
        { item: "Pendant and harness", lo: 20, hi: 35 },
        { item: "Assembly and QC", lo: 40, hi: 60 },
        { item: "Packaging", lo: 10, hi: 15 },
      ],
      freight: [0.06, 0.1],
    },
    {
      qty: 1000,
      oneTime: [
        { item: "Engineering (above plus cost-down and DFM)", lo: 80000, hi: 170000, basis: "est" },
        { item: "Tooling (extrusion die, stamping dies, moulded pendant)", lo: 30000, hi: 85000, basis: "est", why: "stamping dies $12k–35k each", src: SRC.stampDie },
        { item: "Testing, certification and reliability", lo: 30000, hi: 90000, basis: "est" },
      ],
      unit: [
        { item: "Motors (3)", lo: 54, hi: 75 },
        { item: "Controller PCB, drivers, load cells", lo: 28, hi: 50 },
        { item: "Certified battery pack", lo: 30, hi: 50 },
        { item: "Stamped/extruded chassis and deck", lo: 50, hi: 85 },
        { item: "Links, screw, nuts, pins", lo: 25, hi: 45 },
        { item: "Wheels and ball transfers", lo: 10, hi: 16 },
        { item: "Pendant and harness", lo: 12, hi: 22 },
        { item: "Assembly and QC", lo: 20, hi: 35 },
        { item: "Packaging", lo: 7, hi: 12 },
      ],
      freight: [0.08, 0.12],
    },
  ],
  drivers: "The range is driven by certification scope (appliance only vs also a robot under UL 3300), chassis process (fabricated vs stamped), and the battery (an off-the-shelf certified pack vs a custom one).",
};

// ---------- competition ----------
export const TOOLKIT_COMP = [
  { model: "Bosch GSR12V-300FCB22 FlexiClick 5-in-1 kit", price: "$139.92–$237.99", basis: SEEN, link: SRC.flexi2, alt: SRC.flexi1, spec: "300 in·lb (34 N·m); 0–460 / 0–1,750 rpm; right-angle and offset heads included; GFA12-W head height not published", task: "Modular heads already exist and torque is ample. On J1 the right-angle head plus bit is likely over 40 mm tall (measure); if it fits, this kit is the product to beat." },
  { model: "Milwaukee M12 FUEL Installation Driver 2505-22", price: "$199–$248 kit", basis: SEEN, link: SRC.m2505b, alt: SRC.m2505, spec: "300 in·lb; 0–400 / 0–1,600 rpm; 4 heads incl. right-angle, 16 lock positions; head height not published", task: "Same modular idea from a pro brand with an installed battery base. Its right-angle head must enter the 40 mm void to compete (measure)." },
  { model: "Milwaukee 49-22-8510 right-angle attachment", price: "$46–$50", basis: SEEN, link: SRC.ra8510, spec: "2 in (51 mm) head height (other listings 1.75–1.80 in); 6.5 in long; 235 in·lb max", task: "Cannot enter J1: head plus a 6 mm bolt head needs about 57 mm. At ≥ 57 mm voids it does the job for $48, which caps the D-head's price." },
  { model: "DeWalt DWARA100 right-angle attachment", price: "$19.99–$48.99", basis: SEEN, link: SRC.dwara, spec: "4.88 in long; 7.68 oz; head height not published", task: "The low-price anchor: a buyer compares the D-head with a $20–49 adapter." },
  { model: "Milwaukee M12 FUEL 3/8 in extended-reach ratchet 2560-20", price: "$249 bare", basis: SEEN, link: SRC.m2560, spec: "0.75 in (19 mm) head profile; 200 rpm; 2.3 lb", task: "Thin head and long reach suit voids, but the 3/8 in square drive plus a 4 mm hex bit socket likely stacks past 40 mm (measure), and it costs 5× the D-head." },
  { model: "DeWalt DCF500B 12 V sealed-head ratchet", price: "$228–$249 bare", basis: SEEN, link: SRC.dcf500, spec: "50 ft·lb; 0–450 rpm; 13 in long; head height not published", task: "Far more torque than J1 needs (8 N·m); same stack question as the Milwaukee ratchet." },
  { model: "Wera 8001 A Zyklop Mini 1/4 in bit ratchet", price: "$41.99–$46.99", basis: SEEN, link: SRC.zyklop, spec: "Manual; takes 1/4 in bits directly", task: "Low enough to fit, but the hand must be at the bolt, 180 mm inside a 40 mm slot. Fails on J1, wins wherever a hand fits." },
  { model: "Bondhus 9-piece metric ball-end L-keys", price: "$31.99", basis: SEEN, link: SRC.bondhus, spec: "Ball end works up to about 25° off-axis", task: "Reaches J1 only if the long arm is ≥ 100 mm (measure), then takes an estimated 2–3 min of quarter-turns versus 9 s powered. The strongest reason to keep it: you already own one." },
  { model: "Workaround: tip the emptied dresser onto its back", price: "$0", basis: "estimate", spec: "About 10 min, maybe a second person", task: "Free and always works. This is what most homeowners will do for a once-a-year job." },
  { model: "Milwaukee M12 palm nailer 2458-20 (hammer head comparison)", price: "$139–$203 bare", basis: SEEN, link: SRC.m2458, alt: SRC.m2458b, spec: "2.2 ft·lb (3.0 J) per blow; 2,700 bpm; 6d–16d nails; 7.5 × 6.5 × 2.5 in; 3.4 lb", task: "Needs about 241 mm along the nail axis at the start of a 76 mm nail. Covers every hanger bay wider than that." },
  { model: "Bostitch PN50 pneumatic palm nailer (hammer head comparison)", price: "CA$54–90; US price not found", basis: SEEN, link: SRC.pn50, alt: SRC.pn50ca, spec: "107 mm tall (UK PN50-E sheet); 0.55 kg; 70–120 psi", task: "Needs 183 mm along the nail axis. Cheap and compact if you own a compressor." },
];

export const MOVER_COMP = [
  { model: "Super Sliders 3.5 in reusable, 4-pack (hard floor)", price: "$13.95", basis: SEEN, link: SRC.ssRound, spec: "3.5 in discs", task: "Moves the chest on hardwood with an estimated 120–240 N push (sliding friction about 0.2–0.4, not measured). Someone still has to tip each corner up to place them." },
  { model: "Super Sliders 5.75 × 9.5 in, 4-pack (carpet)", price: "$23.98", basis: SEEN, link: SRC.ssCarpet, spec: "Hard plastic base, EVA foam top", task: "Works on carpet, where P-1 does not. That is the main reason to keep using them." },
  { model: "Mega Maxx heavy-duty furniture lifter + 4 sliders", price: "$28.97", basis: SEEN, link: SRC.megamaxx, spec: "660 lb rating; lever lifts one edge so sliders go under", task: "Does the insert-and-lift step with a lever. The open question for P-1 is whether target users can work the lever." },
  { model: "Generic furniture lift mover set (lever + 4 wheeled skates)", price: "$12.99–$14.99", basis: SEEN, link: SRC.genericKit, spec: "4 swivel-wheel skates; wheel size and lift height not published", task: "The cheapest lift-and-roll kit. Small swivel wheels share P-1's threshold problem." },
  { model: "Haul-Master 30 × 18 in hardwood dolly (HF 61897)", price: "$11.99–$14.99 (2020–22 coupons; current price not verified)", basis: "old coupon", link: SRC.hfDolly, spec: "1,000 lb; 3 in casters", task: "Rolls well, but you must lift the chest onto it." },
  { model: "Harper 6781 appliance hand truck", price: "$145.66", basis: SEEN, link: SRC.harper, spec: "800 lb; 6 × 2 in wheels; strap", task: "The tool for refrigerators. Large wheels cross sills easily, but tilting a 60 kg chest back takes strength." },
  { model: "Milwaukee DC40710 appliance truck", price: "$220.09–$369", basis: SEEN, link: SRC.milDolly, spec: "800 lb; 60 in tall; belt", task: "Same as above, pro grade." },
  { model: "Dayton desk mover 30E987 (lift-and-roll)", price: "$491.56", basis: SEEN, link: SRC.dayton, spec: "600 lb; 10¼ in raised height", task: "The closest commercial 'slide under, lift, roll' product. It is manual and office-oriented, and it costs as much as P-1 would." },
  { model: "Airsled AM2200-VS / Light Duty (air-bearing)", price: "$741.99 / $529.99", basis: SEEN, link: SRC.airsled, alt: SRC.airsledLD, spec: "750 lb lift; 9 × 36 in air beams", task: "A thin under-item mover that floats on air. It is used by pros for appliances and proves the 'thin and powered' form can sell at about $530–840." },
  { model: "Hilman KRS-8-4S machinery skates", price: "$1,534.99", basis: SEEN, link: SRC.hilman, spec: "16,000 lb; 4 in tall", task: "Industrial. Too tall to slide under furniture (4 in)." },
  { model: "Mirfee electric stair dolly", price: "≈ $903", basis: SEEN, link: SRC.mirfee, spec: "440 lb; powered stair climbing", task: "Shows that consumers pay about $900 for powered moving help, but it does a different job." },
  { model: "Consumer powered under-furniture lift-and-drive platform", price: "none found", basis: "search 2026-11-15", spec: "No US product found", task: "An open niche, or evidence that demand is too thin. The first experiment has to tell which." },
];

// ---------- standards ----------
export const TOOLKIT_STD = [
  { std: "UL 62841-1 (hand-held motor-operated tools)", status: "confirmed for the power base", note: "End-product standard for the phase-2 base. Whether a passive head sold alone is in scope is a lab question.", src: SRC.ul62841 },
  { std: "UL 62841-2-2 (screwdrivers and impact wrenches)", status: "lab question", note: "Expected Part 2 for the base driving the D-head; confirm current edition and status.", src: SRC.ulStatus },
  { std: "UL 62841-2-16 (fastener driving tools)", status: "lab question", note: "UL lists it as in process. Ask whether an H-head falls under 2-16, 2-2 or a hazard-based assessment.", src: SRC.ulStatus },
  { std: "UL 2595 (battery-powered appliances)", status: "confirmed", note: "Applies to tools with detachable packs. Licensing an existing 12 V platform moves pack compliance to its owner.", src: SRC.ul2595 },
  { std: "UN 38.3 and 49 CFR 173.185 (lithium shipping)", status: "confirmed", note: "Cells and packs need a UN 38.3 test summary before shipping.", src: SRC.cfr173 },
  { std: "FCC Part 15 Subpart B (unintentional radiators)", status: "confirmed rule; scope is a lab question", note: "SDoC route. Whether the BLDC controller is a 'digital device' or exempt under §15.103 needs a lab answer.", src: SRC.fcc15 },
  { std: "California Prop 65", status: "confirmed", note: "Warning label if brass, PVC or coatings contain listed chemicals.", src: SRC.prop65 },
  { std: "OSHA 29 CFR 1910.7 (NRTL)", status: "confirmed for workplaces", note: "Not required for consumer sale, but pro buyers' employers expect a listing mark.", src: SRC.osha },
];
export const MOVER_STD = [
  { std: "Consumer Product Safety Act, §15(b) reporting (16 CFR 1115)", status: "confirmed", note: "A home product is under CPSC jurisdiction. A defect that could create a substantial hazard must be reported within 24 hours.", src: SRC.cfr1115 },
  { std: "UL 60335-1 (household appliances)", status: "lab question", note: "Most likely base standard for a mains-charged home device.", src: SRC.ul60335 },
  { std: "UL 3300 (service, consumer and education robots)", status: "lab question", note: "OSHA NRTL recognition took effect 2025-12-31. Is a hand-steered platform with no autonomy a 'robot'? This answer moves the certification cost most.", src: SRC.ul3300 },
  { std: "UN 38.3 and 49 CFR 173.185", status: "confirmed for lithium packs", note: "Buy a pack that already has a test summary.", src: SRC.cfr173 },
  { std: "FCC Part 15 Subpart B", status: "confirmed rule", note: "Host device needs 15B evaluation; a radio pendant would add a pre-certified module.", src: SRC.fcc15 },
  { std: "ASME B30.1 (jacks, industrial rollers)", status: "design reference only", note: "Scope excludes jacks built into other equipment. Use its load-holding and marking practice as a guide.", src: SRC.b301 },
  { std: "ADA 404.2.5 thresholds (1/2 in max, beveled above 1/4 in)", status: "reference for home sills", note: "Sets the ramp accessory's target: any sill up to 13 mm.", src: SRC.ada },
];
