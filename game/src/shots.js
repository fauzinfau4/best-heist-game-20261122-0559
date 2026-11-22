// The screenshot scenes behind ?shot=cover|suspicion|vault|hunt (with &seed=N). Each
// one plays the real rules forward from a fresh world for a fixed number of seconds,
// steered by a short script of waypoints and timed actions — sneak here, throw a
// spanner there, pop smoke, hold E on the prize — so the frame is what a short game
// really looks like, and the same seed always gives the same frame. The cover also
// carries the annotation callouts, drawn by the renderer as part of the frame.

import { STEP } from './config.js';
import { EVENT, stepWorld } from './world.js';
import { SCREEN } from './render.js';
import { distance } from './geometry.js';

const SAMPLE = STEP;

/**
 * A script is a list of legs. Each leg moves the player toward `to` (sneaking when
 * `sneak`, sprinting when `sprint`) for up to `seconds`, then does `action` once:
 * 'throw' (a spanner at `aim`), 'smoke', or 'interact' (hold E for `hold` seconds).
 * The leg ends early when the player arrives (within 10 px) or its time runs out.
 */
const SHOTS = {
  cover: {
    job: 0,
    legs: [
      { to: [96, 300], seconds: 6, sneak: true },
      { to: [150, 250], seconds: 5, sneak: true },
      { to: [300, 250], seconds: 5, sneak: true },
      { to: [300, 250], seconds: 2, sneak: true, action: 'throw', aim: [700, 260] },
      { wait: 4 },
    ],
    annotations: [
      { text: 'GUARD + VISION CONE — what they see', x: 700, y: 260, bx: 560, by: 100 },
      { text: 'CAMERA — sweeping arc', x: 640, y: 92, bx: 940, by: 100 },
      { text: 'PRIZE — the Brass Seal', x: 1030, y: 140, bx: 880, by: 240 },
      { text: 'YOU — hidden in shadow behind the boxcar', x: 300, y: 250, bx: 420, by: 620 },
      { text: 'SPANNER — throw it to pull a guard away', x: 700, y: 260, bx: 60, by: 620 },
      { text: 'EXIT — opens once you hold the prize', x: 1184, y: 606, bx: 800, by: 600 },
    ],
    notes: true,
  },
  suspicion: {
    job: 1,
    legs: [
      { to: [200, 606], seconds: 5, sneak: true },
      { to: [200, 500], seconds: 4, sneak: true },
      { to: [500, 470], seconds: 8, sneak: true },
      { to: [700, 470], seconds: 4, sneak: true },
      { to: [700, 470], seconds: 1, sneak: true, action: 'smoke' },
      { to: [900, 600], seconds: 4, sneak: true },
      { wait: 1, sneak: true },
    ],
    annotations: [
      { text: 'SMOKE — you cannot be seen inside it', x: 900, y: 600, bx: 800, by: 620 },
      { text: 'TRIPWIRE — pulses; cross in the dark gap', x: 900, y: 470, bx: 60, by: 620 },
      { text: 'GUARD — investigating the noise', x: 700, y: 470, bx: 640, by: 100 },
    ],
    notes: true,
  },
  vault: {
    job: 2,
    legs: [
      { to: [96, 300], seconds: 5, sneak: true },
      { to: [96, 470], seconds: 5, sneak: true },
      { to: [300, 540], seconds: 5, sneak: true },
      { to: [640, 560], seconds: 5, sneak: true },
      { wait: 3, sneak: true },
    ],
    annotations: [
      { text: 'THE STARLIGHT MANIFEST — the prize', x: 640, y: 375, bx: 700, by: 100 },
      { text: 'VAULT CAR — one door, two cameras', x: 640, y: 300, bx: 330, by: 100 },
      { text: 'TRIPWIRE — pulses; cross in the dark gap', x: 640, y: 470, bx: 820, by: 620 },
      { text: 'YOU — the vault car is just ahead', x: 640, y: 560, bx: 60, by: 620 },
    ],
    notes: true,
  },
  hunt: {
    job: 0,
    legs: [
      { to: [400, 580], seconds: 6, sneak: true },
      { to: [400, 300], seconds: 5, sneak: true },
      { to: [560, 260], seconds: 3, sneak: false },
      { wait: 12, sneak: false },
      { to: [560, 260], seconds: 1, sneak: true, action: 'smoke' },
      { to: [450, 450], seconds: 4, sneak: true },
    ],
    annotations: [
      { text: 'HUNTED — a guard knows where you are', x: 560, y: 260, bx: 640, by: 100 },
      { text: 'YOU — broke away in the smoke', x: 450, y: 450, bx: 60, by: 620 },
      { text: 'LAMPLIGHT — seen from afar', x: 700, y: 150, bx: 820, by: 560 },
    ],
    notes: true,
  },
};

/** Move toward (tx, ty): the unit vector, or {x:0, y:0} once arrived. */
function steerToward(player, tx, ty) {
  const dx = tx - player.x;
  const dy = ty - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}

/**
 * Set `world` to the named scene and return what to draw over it: the play screen
 * with the shot's annotations and field notes. Unknown names fall back to 'cover'.
 */
export function stageShot(name, world) {
  const shot = SHOTS[name] || SHOTS.cover;
  world.shotTrace = [];
  const trace = (legLabel) => {
    world.shotTrace.push({
      leg: legLabel,
      x: Math.round(world.player.x),
      y: Math.round(world.player.y),
      alarm: Math.round(world.alarm),
      alarmState: world.alarmState,
      over: world.over,
      won: world.won,
      time: Math.round(world.elapsed * 10) / 10,
      spanners: world.player.spanners,
      smoke: world.player.smoke,
    });
  };
  world.player.aimX = world.player.x + 60;
  world.player.aimY = world.player.y;
  let actionDone = false;
  let holdLeft = 0;

  for (let legIndex = 0; legIndex < shot.legs.length; legIndex += 1) {
    const leg = shot.legs[legIndex];
    if (leg.wait) {
      const waitSteps = Math.round(leg.wait / SAMPLE);
      for (let i = 0; i < waitSteps; i += 1) {
        if (world.over) break;
        stepWorld(world, SAMPLE, { move: { x: 0, y: 0 }, sneak: !!leg.sneak, sprint: false }, { throw: false, smoke: false, interact: false });
      }
      trace(`wait ${legIndex}`);
      if (world.over) break;
      continue;
    }
    const legSteps = Math.round(leg.seconds / SAMPLE);
    actionDone = false;
    holdLeft = leg.hold || 0;
    // Stuck detection: if the player barely moved in the last half second, sidestep
    // around whatever is pinning it (usually a crate) for a short burst.
    let lastCheck = 0;
    let lastX = world.player.x;
    let lastY = world.player.y;
    let detour = 0;
    let detourDir = 1;
    for (let i = 0; i < legSteps; i += 1) {
      if (world.over) break;
      let move = steerToward(world.player, leg.to[0], leg.to[1]);
      const dist = distance(world.player.x, world.player.y, leg.to[0], leg.to[1]);
      if (i - lastCheck >= 30) {
        const moved = distance(world.player.x, world.player.y, lastX, lastY);
        if (moved < 10 && dist > 12) {
          detour = 60;
          detourDir = -detourDir;
        }
        lastX = world.player.x;
        lastY = world.player.y;
        lastCheck = i;
      }
      if (detour > 0) {
        detour -= 1;
        move = { x: -move.y * detourDir, y: move.x * detourDir };
      }
      const arrived = move.x === 0 && move.y === 0;
      const actions = { throw: false, smoke: false, interact: false };
      let aimSet = false;
      if (leg.action === 'throw' && arrived && !actionDone) {
        world.player.aimX = leg.aim[0];
        world.player.aimY = leg.aim[1];
        actions.throw = true;
        actionDone = true;
        aimSet = true;
      }
      if (leg.action === 'smoke' && arrived && !actionDone) {
        actions.smoke = true;
        actionDone = true;
      }
      if (leg.action === 'interact' && arrived && holdLeft > 0) {
        actions.interact = true;
        holdLeft -= SAMPLE;
      }
      if (!aimSet) {
        world.player.aimX = world.player.x + Math.cos(world.player.facing) * 60;
        world.player.aimY = world.player.y + Math.sin(world.player.facing) * 60;
      }
      stepWorld(world, SAMPLE, { move, sneak: !!leg.sneak, sprint: !!leg.sprint }, actions);
      // The step runs first: a throw or smoke fired on arrival still happens.
      if (arrived && leg.action !== 'interact') break;
      if (leg.action === 'interact' && arrived && holdLeft <= 0) break;
    }
    trace(`leg ${legIndex} -> ${JSON.stringify(leg.to || 'wait')}`);
    if (world.over) break;
  }
  return {
    screen: world.over ? SCREEN.OVER : SCREEN.PLAY,
    annotations: shot.annotations,
    notes: shot.notes,
  };
}

/** The job index a shot stages on, for the boot code. */
export function shotJob(name) {
  const shot = SHOTS[name];
  return shot ? shot.job : 0;
}
