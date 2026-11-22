// The three jobs of the Emberline heist, each a fixed hand-built yard: every wall,
// boxcar, lamp, patrol, camera, tripwire, crate and prize placed so several routes
// reach the prize and the getaway gate, and no route is a dead end. Coordinates are
// in the 1280x720 playfield; the top 64 and bottom 36 pixels belong to the HUD bars,
// so nothing playable sits above y=72 or below y=676.
//
//   blocker: {x, y, w, h, kind} — 'wall' | 'boxcar' | 'crate' | 'office'; all block
//     movement and cut vision cones (see geometry.js).
//   lamp: {x, y, r} — a pool of lamplight; standing in one makes you seen from afar.
//   guard: {waypoints: [[x,y],...], facing} — walks its loop, pauses at each stop.
//   camera: {x, y, base, sweep} — a pole camera sweeping base ± sweep radians.
//   loot: {x, y, kind: 'crate'|'prize', name, value} — crates are optional, the prize
//     is the job's target and opens the exit.
//   tripwire: {x1,y1,x2,y2} — a laser that pulses on and off; crossing it while lit
//     jumps the alarm.
//   exit: {x, y} — the getaway gate; opens once the prize is held.

export const JOBS = [
  {
    id: 1,
    name: 'JOB 1 — THE SIDING YARD',
    brief: 'Lift the Brass Seal from the signal office, then slip out the east gate.',
    prizeName: 'THE BRASS SEAL',
    prizeValue: 500,
    parSeconds: 150,
    playerStart: { x: 96, y: 606 },
    exit: { x: 1184, y: 606, label: 'EAST GATE' },
    blockers: [
      // Signal office, top right: the prize sits inside; enter through the south door.
      { x: 880, y: 84, w: 300, h: 18, kind: 'wall' },
      { x: 880, y: 84, w: 18, h: 130, kind: 'wall' },
      { x: 1162, y: 84, w: 18, h: 130, kind: 'wall' },
      { x: 880, y: 196, w: 118, h: 18, kind: 'wall' },
      { x: 1062, y: 196, w: 118, h: 18, kind: 'wall' },
      // Boxcars parked across the yard: the cover every route threads between.
      { x: 250, y: 150, w: 250, h: 66, kind: 'boxcar' },
      { x: 620, y: 300, w: 250, h: 66, kind: 'boxcar' },
      { x: 210, y: 430, w: 220, h: 64, kind: 'boxcar' },
      { x: 830, y: 470, w: 260, h: 66, kind: 'boxcar' },
      // A low coal heap wall, bottom centre.
      { x: 520, y: 560, w: 180, h: 20, kind: 'wall' },
      // Loot crates double as cover.
      { x: 560, y: 150, w: 36, h: 36, kind: 'crate' },
      { x: 1080, y: 380, w: 36, h: 36, kind: 'crate' },
      { x: 150, y: 320, w: 36, h: 36, kind: 'crate' },
    ],
    lamps: [
      { x: 180, y: 130, r: 120 },
      { x: 700, y: 150, r: 120 },
      { x: 1030, y: 320, r: 120 },
      { x: 420, y: 560, r: 120 },
      { x: 1030, y: 150, r: 95 },
    ],
    guards: [
      {
        waypoints: [[330, 260], [700, 260], [700, 420], [330, 420]],
        facing: 0,
      },
      {
        waypoints: [[950, 280], [1150, 280], [1150, 560], [950, 560]],
        facing: Math.PI,
      },
    ],
    cameras: [{ x: 640, y: 92, base: Math.PI / 2, sweep: 0.85 }],
    tripwires: [],
    loot: [
      { x: 578, y: 168, kind: 'crate', name: 'BRASS FITTINGS', value: 120 },
      { x: 1098, y: 398, kind: 'crate', name: 'COPPER COILS', value: 120 },
      { x: 168, y: 338, kind: 'crate', name: 'RAIL SPIKES', value: 120 },
      { x: 1030, y: 140, kind: 'prize', name: 'THE BRASS SEAL', value: 500 },
    ],
  },
  {
    id: 2,
    name: 'JOB 2 — THE SORTING HALL',
    brief: "Take the Conductor's Ledger from the sorting hall. Tripwires pulse — cross in the dark gap.",
    prizeName: "THE CONDUCTOR'S LEDGER",
    prizeValue: 800,
    parSeconds: 170,
    playerStart: { x: 96, y: 606 },
    exit: { x: 1184, y: 120, label: 'ROOF HATCH' },
    blockers: [
      // Sorting hall walls: a big room top-left with two doors.
      { x: 120, y: 84, w: 420, h: 18, kind: 'wall' },
      { x: 120, y: 84, w: 18, h: 200, kind: 'wall' },
      { x: 522, y: 84, w: 18, h: 90, kind: 'wall' },
      { x: 522, y: 210, w: 18, h: 74, kind: 'wall' },
      { x: 120, y: 266, w: 190, h: 18, kind: 'wall' },
      { x: 380, y: 266, w: 160, h: 18, kind: 'wall' },
      // Long conveyor belts down the middle: cover with gaps at both ends.
      { x: 600, y: 200, w: 300, h: 40, kind: 'boxcar' },
      { x: 600, y: 380, w: 300, h: 40, kind: 'boxcar' },
      { x: 620, y: 520, w: 240, h: 40, kind: 'boxcar' },
      // Parcel stacks.
      { x: 1020, y: 300, w: 36, h: 36, kind: 'crate' },
      { x: 1020, y: 480, w: 36, h: 36, kind: 'crate' },
      { x: 240, y: 480, w: 36, h: 36, kind: 'crate' },
      { x: 430, y: 480, w: 36, h: 36, kind: 'crate' },
    ],
    lamps: [
      { x: 330, y: 170, r: 130 },
      { x: 750, y: 300, r: 120 },
      { x: 1080, y: 200, r: 110 },
      { x: 500, y: 600, r: 120 },
      { x: 1080, y: 560, r: 110 },
    ],
    guards: [
      {
        waypoints: [[640, 150], [1080, 150], [1080, 460], [640, 460]],
        facing: Math.PI / 2,
      },
      {
        waypoints: [[300, 320], [300, 600], [560, 600], [560, 320]],
        facing: 0,
      },
      {
        waypoints: [[950, 620], [1150, 620], [1150, 300], [950, 300]],
        facing: -Math.PI / 2,
      },
    ],
    cameras: [
      { x: 560, y: 92, base: Math.PI / 2, sweep: 0.9 },
      { x: 940, y: 92, base: Math.PI / 2, sweep: 0.7 },
    ],
    tripwires: [
      { x1: 560, y1: 470, x2: 940, y2: 470 },
      { x1: 980, y1: 120, x2: 980, y2: 460 },
    ],
    loot: [
      { x: 1038, y: 318, kind: 'crate', name: 'PARCEL GOLD', value: 150 },
      { x: 1038, y: 498, kind: 'crate', name: 'PARCEL SILVER', value: 150 },
      { x: 258, y: 498, kind: 'crate', name: 'STAMP CHEST', value: 150 },
      { x: 448, y: 498, kind: 'crate', name: 'TICKET BUNDLE', value: 150 },
      { x: 330, y: 170, kind: 'prize', name: "THE CONDUCTOR'S LEDGER", value: 800 },
    ],
  },
  {
    id: 3,
    name: 'JOB 3 — THE VAULT CAR',
    brief: 'The Starlight Manifest rides in the vault car. Three guards, two cameras, live wires. Get in, get out.',
    prizeName: 'THE STARLIGHT MANIFEST',
    prizeValue: 1500,
    parSeconds: 200,
    playerStart: { x: 96, y: 120 },
    exit: { x: 96, y: 606, label: 'GETAWAY TRUCK' },
    blockers: [
      // The vault car: a long boxcar across the middle with one door on its south side.
      { x: 380, y: 300, w: 520, h: 18, kind: 'wall' },
      { x: 380, y: 300, w: 18, h: 150, kind: 'wall' },
      { x: 882, y: 300, w: 18, h: 150, kind: 'wall' },
      { x: 380, y: 432, w: 200, h: 18, kind: 'wall' },
      { x: 680, y: 432, w: 220, h: 18, kind: 'wall' },
      // Parked boxcars flanking the vault car.
      { x: 150, y: 200, w: 180, h: 62, kind: 'boxcar' },
      { x: 960, y: 150, w: 190, h: 62, kind: 'boxcar' },
      { x: 150, y: 500, w: 180, h: 62, kind: 'boxcar' },
      { x: 980, y: 480, w: 180, h: 62, kind: 'boxcar' },
      // Coal bunkers.
      { x: 560, y: 520, w: 200, h: 20, kind: 'wall' },
      { x: 560, y: 150, w: 200, h: 20, kind: 'wall' },
      // Crates.
      { x: 1080, y: 320, w: 36, h: 36, kind: 'crate' },
      { x: 200, y: 380, w: 36, h: 36, kind: 'crate' },
    ],
    lamps: [
      { x: 640, y: 375, r: 110 },
      { x: 300, y: 320, r: 110 },
      { x: 1000, y: 320, r: 110 },
      { x: 640, y: 600, r: 120 },
      { x: 1100, y: 120, r: 100 },
    ],
    guards: [
      {
        waypoints: [[300, 240], [940, 240], [940, 500], [300, 500]],
        facing: Math.PI / 2,
      },
      {
        waypoints: [[1050, 260], [1150, 260], [1150, 620], [1050, 620]],
        facing: Math.PI,
      },
      {
        waypoints: [[180, 300], [180, 580], [420, 580], [420, 300]],
        facing: 0,
      },
    ],
    cameras: [
      { x: 640, y: 288, base: Math.PI / 2, sweep: 0.8 },
      { x: 640, y: 462, base: -Math.PI / 2, sweep: 0.8 },
    ],
    tripwires: [
      { x1: 580, y1: 470, x2: 700, y2: 470 },
      { x1: 940, y1: 120, x2: 940, y2: 280 },
      { x1: 340, y1: 120, x2: 340, y2: 280 },
    ],
    loot: [
      { x: 1098, y: 338, kind: 'crate', name: 'GOLD BULLION', value: 250 },
      { x: 218, y: 398, kind: 'crate', name: 'SILVER INGOTS', value: 250 },
      { x: 640, y: 375, kind: 'prize', name: 'THE STARLIGHT MANIFEST', value: 1500 },
    ],
  },
];

/** The rails that run through every job: drawn, never blocking, pure yard flavour. */
export const RAILS = [
  { x: 40, y: 250, w: 1200 },
  { x: 40, y: 640, w: 1200 },
];
