// Every tuning number and colour for EMBERLINE in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. A night freight yard: deep indigo dark, amber lamplight, rust-red
// boxcars, teal signal glow, gold loot. Safe cover, danger and loot each read at a glance.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sneakSpeed: 95,
  sprintSpeed: 265,
  /** Seconds a guard must hold you in sight, in shadow, before suspicion fills. */
  spotTimeShadow: 1.1,
  /** Same, standing in lamplight: lamps betray you. */
  spotTimeLit: 0.45,
  /** Sneaking halves how fast suspicion grows. */
  sneakSpotFactor: 0.5,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  investigateSpeed: 105,
  huntSpeed: 148,
  /** Vision cone: how far and how wide a guard sees. */
  viewDistance: 235,
  viewHalfAngle: 0.52,
  /** Suspicion 0..1; fills while the guard sees you, drains while it cannot. */
  fillRate: 1.0,
  drainRate: 0.35,
  /** Seconds a guard stares at the last seen spot before giving up and resuming patrol. */
  investigateTime: 4.0,
  /** Seconds of full sight before the guard is certain and the alarm jumps. */
  certainTime: 1.0,
};

export const CAMERA = {
  radius: 10,
  viewDistance: 215,
  viewHalfAngle: 0.42,
  /** Degrees per second the camera head sweeps. */
  sweepSpeed: 0.55,
  /** Suspicion fills slower than a guard's: cameras are dumb, guards are not. */
  fillRate: 0.55,
};

export const ALARM = {
  /** Alarm 0..100. While any guard hunts or a camera holds you, it climbs; else it cools. */
  huntRise: 9,
  suspectRise: 3.5,
  cameraRise: 5,
  coolRate: 2.2,
  tripwireJump: 22,
  /** At 100 the yard locks down and the run is over. */
  lockdown: 100,
};

export const TOOLS = {
  spanners: 3,
  smoke: 2,
  /** Seconds a thrown spanner's clang keeps guards investigating its landing spot. */
  clangLinger: 2.5,
  /** Radius a sprinting footstep is heard from. */
  sprintNoiseRadius: 170,
  /** Seconds a smoke puff blocks all sight. */
  smokeSeconds: 4.5,
  smokeRadius: 78,
};

export const LOOT = {
  /** Seconds holding E beside the prize before it is yours. */
  prizeGrabSeconds: 1.2,
  crateSeconds: 0.5,
};

export const JOB = { seconds: 180, max: 3 };

export const PALETTE = {
  backdrop: '#0b0f1c',
  floor: '#141a2b',
  floorDark: '#101524',
  gravel: '#1b2136',
  rail: '#3a4157',
  tie: '#232a3d',
  wall: '#2c3550',
  wallTop: '#3d4a6e',
  boxcar: '#7a2f26',
  boxcarDark: '#5d231d',
  boxcarStripe: '#d8a13c',
  hazard: '#e0a83c',
  lampGlow: '#ffb347',
  lampLight: '#ffcf7d',
  signalTeal: '#37d3b8',
  cone: '#ffb347',
  coneDanger: '#ff5d47',
  camera: '#8fb7ff',
  loot: '#ffd94d',
  prize: '#ffe98a',
  player: '#e8eefc',
  playerCoat: '#2f6fb2',
  guard: '#e8b23c',
  guardCoat: '#4a3a1c',
  smoke: '#9aa7bd',
  text: '#eef1f5',
  muted: '#93a0b8',
  panel: '#161d31',
  panelLine: '#2c3a5c',
  alarmCalm: '#37d3b8',
  alarmWarn: '#e0a83c',
  alarmHot: '#ff5d47',
  exit: '#3ddc84',
  shadow: '#05070f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberline.best';
