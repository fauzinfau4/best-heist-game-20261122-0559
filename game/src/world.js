// The world: one job's live state and the fixed-step rules that move it. It owns the
// alarm meter, the loot, the pulsing tripwires, the grab timers, and the win / caught
// moments. Guards, cameras and the player each own their own step; this file wires them
// together and decides what the run is worth.
//
// The alarm is the game's heartbeat: it climbs while anyone hunts you or a camera holds
// you, and cools when you break away. At 100 the yard locks down and the job is lost —
// but a guard has to hold you in sight for a full second first, so getting caught is
// always a moment you could have avoided.

import { ALARM, JOB, LOOT } from './config.js';
import { JOBS } from './levels.js';
import { createGuard, guardCatchesPlayer, guardHearNoise, stepGuard, GUARD_STATE } from './guards.js';
import { createCamera, stepCamera } from './cameras.js';
import { createPlayer, popSmoke, stepPlayer, throwSpanner } from './player.js';
import { distance } from './geometry.js';

export const EVENT = {
  NONE: 0,
  CAUGHT: 1 << 0,
  ESCAPED: 1 << 1,
  LOOT: 1 << 2,
  PRIZE: 1 << 3,
  ALARM_UP: 1 << 4,
  SPOTTED: 1 << 5,
  TRIPWIRE: 1 << 6,
  NOISE: 1 << 7,
};

export const ALARM_STATE = {
  CALM: 'CALM',
  SUSPICIOUS: 'SUSPICIOUS',
  HUNTED: 'HUNTED',
  LOCKDOWN: 'LOCKDOWN',
};

/** Tripwires pulse: on for 3 seconds, off for 1.5 — cross in the dark gap. */
const TRIPWIRE_ON = 3.0;
const TRIPWIRE_OFF = 1.5;

/** Fresh live state for job `jobIndex` (0-based). */
export function createWorld(jobIndex, random) {
  const job = JOBS[jobIndex];
  return {
    jobIndex,
    job,
    random,
    player: createPlayer(job.playerStart),
    guards: job.guards.map(createGuard),
    cameras: job.cameras.map(createCamera),
    loot: job.loot.map((item) => ({ ...item, taken: false, grab: 0 })),
    tripwires: job.tripwires.map((wire) => ({
      ...wire,
      timer: random.range(0, TRIPWIRE_ON),
      on: true,
      tripped: false,
      coolTimer: 0,
    })),
    alarm: 0,
    alarmState: ALARM_STATE.CALM,
    timeLeft: job.parSeconds,
    elapsed: 0,
    score: 0,
    lootValue: 0,
    cratesTaken: 0,
    prizeHeld: false,
    exitOpen: false,
    spotted: false,
    maxAlarm: 0,
    everSpotted: false,
    over: false,
    won: false,
    timeBonus: 0,
    ghostBonus: 0,
    /** What just happened, for the renderer and the sound cues. */
    flash: null,
    flashTimer: 0,
    message: null,
    messageTimer: 0,
  };
}

/** True when the player stands inside any lamp's pool of light. */
export function playerInLight(world) {
  const p = world.player;
  return world.job.lamps.some((lamp) => distance(p.x, p.y, lamp.x, lamp.y) < lamp.r);
}

/** True when the segment (ax,ay)-(bx,by) crosses the tripwire segment. */
function segmentsCross(ax, ay, bx, by, wire) {
  const d1 = (wire.x2 - wire.x1) * (ay - wire.y1) - (wire.y2 - wire.y1) * (ax - wire.x1);
  const d2 = (wire.x2 - wire.x1) * (by - wire.y1) - (wire.y2 - wire.y1) * (bx - wire.x1);
  const d3 = (bx - ax) * (wire.y1 - ay) - (by - ay) * (wire.x1 - ax);
  const d4 = (bx - ax) * (wire.y2 - ay) - (by - ay) * (wire.x2 - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function setMessage(world, text, seconds) {
  world.message = text;
  world.messageTimer = seconds;
}

function setFlash(world, text, seconds) {
  world.flash = text;
  world.flashTimer = seconds;
}

/**
 * Advance the world one fixed step. `input` is {move:{x,y}, sneak, sprint} and
 * `actions` is {throw, smoke, interact} for this step's tool use. Returns an EVENT
 * bitmask of what happened this step.
 */
export function stepWorld(world, dt, input, actions) {
  if (world.over) return EVENT.NONE;
  let events = EVENT.NONE;
  const job = world.job;
  const player = world.player;

  world.elapsed += dt;
  world.timeLeft = Math.max(0, job.parSeconds - world.elapsed);
  if (world.timeLeft <= 0) {
    world.over = true;
    world.won = false;
    setFlash(world, 'DAWN BREAKS — THE YARD WAKES UP', 3);
    return EVENT.CAUGHT;
  }
  if (world.flashTimer > 0) world.flashTimer -= dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;

  // Tools first: a throw or a smoke puff happens before the step's movement.
  if (actions.throw && throwSpanner(player)) events |= EVENT.NOISE;
  if (actions.smoke && popSmoke(player)) {
    setMessage(world, 'SMOKE — YOU ARE UNSEEN INSIDE IT', 2);
  }

  const inLight = playerInLight(world);
  const prevX = player.x;
  const prevY = player.y;
  stepPlayer(player, dt, input.move, input.sneak, input.sprint, job.blockers);

  // Noise pulls guards: a sprint is heard nearby, a clang is heard across the yard.
  for (const noise of player.noises) {
    for (const guard of world.guards) {
      if (distance(guard.x, guard.y, noise.x, noise.y) < noise.radius) {
        guardHearNoise(guard, noise.x, noise.y, noise.clang ? 0.6 : 0.35);
      }
    }
  }

  let hunting = false;
  let suspicious = false;
  for (const guard of world.guards) {
    const event = stepGuard(guard, dt, player, job.blockers, inLight);
    if (event === 'spotted') {
      events |= EVENT.SPOTTED;
      world.everSpotted = true;
      world.spotted = true;
      setFlash(world, 'SPOTTED!', 1.2);
    }
    if (guard.state === GUARD_STATE.HUNT) hunting = true;
    if (guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.INVESTIGATE) {
      suspicious = true;
    }
    if (guardCatchesPlayer(guard, player)) {
      world.over = true;
      world.won = false;
      setFlash(world, 'CAUGHT — THE YARD SWARMS', 3);
      return EVENT.CAUGHT;
    }
  }

  let cameraHot = false;
  for (const camera of world.cameras) {
    stepCamera(camera, dt, player, job.blockers);
    if (camera.suspicion >= 1) cameraHot = true;
  }

  // The alarm climbs while hunted or watched, and cools when you break away.
  if (hunting) world.alarm += ALARM.huntRise * dt;
  else if (cameraHot) world.alarm += ALARM.cameraRise * dt;
  else if (suspicious) world.alarm += ALARM.suspectRise * dt;
  else world.alarm -= ALARM.coolRate * dt;
  world.alarm = Math.max(0, Math.min(ALARM.lockdown, world.alarm));
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);
  const previousState = world.alarmState;
  world.alarmState =
    world.alarm >= ALARM.lockdown
      ? ALARM_STATE.LOCKDOWN
      : hunting || cameraHot
        ? ALARM_STATE.HUNTED
        : world.alarm > 35 || suspicious
          ? ALARM_STATE.SUSPICIOUS
          : ALARM_STATE.CALM;
  if (world.alarmState !== previousState && world.alarmState === ALARM_STATE.HUNTED) {
    events |= EVENT.ALARM_UP;
  }
  if (world.alarm >= ALARM.lockdown) {
    world.over = true;
    world.won = false;
    setFlash(world, 'LOCKDOWN — THE YARD IS SEALED', 3);
    return EVENT.CAUGHT;
  }

  // Tripwires pulse; crossing a live one jumps the alarm and marks every guard.
  for (const wire of world.tripwires) {
    wire.timer += dt;
    const period = TRIPWIRE_ON + TRIPWIRE_OFF;
    wire.on = wire.timer % period < TRIPWIRE_ON;
    if (wire.on && !wire.tripped && segmentsCross(prevX, prevY, player.x, player.y, wire)) {
      wire.tripped = true;
      wire.coolTimer = 2;
      world.alarm = Math.min(ALARM.lockdown, world.alarm + ALARM.tripwireJump);
      events |= EVENT.TRIPWIRE;
      setFlash(world, 'TRIPWIRE!', 1.2);
      for (const guard of world.guards) guardHearNoise(guard, player.x, player.y, 0.8);
    }
    if (wire.tripped) {
      wire.coolTimer -= dt;
      if (wire.coolTimer <= 0) wire.tripped = false;
    }
  }

  // Grabbing loot: hold E beside it. The prize takes longer and opens the exit.
  let nearLoot = null;
  for (const item of world.loot) {
    if (item.taken) continue;
    if (distance(player.x, player.y, item.x, item.y) < 52) {
      nearLoot = item;
      break;
    }
  }
  if (nearLoot && actions.interact) {
    const need = nearLoot.kind === 'prize' ? LOOT.prizeGrabSeconds : LOOT.crateSeconds;
    nearLoot.grab += dt;
    if (nearLoot.grab >= need) {
      nearLoot.taken = true;
      world.lootValue += nearLoot.value;
      world.score += nearLoot.value;
      if (nearLoot.kind === 'prize') {
        world.prizeHeld = true;
        world.exitOpen = true;
        events |= EVENT.PRIZE;
        setFlash(world, `${nearLoot.name} — YOURS. GET TO THE ${job.exit.label}!`, 2.5);
      } else {
        world.cratesTaken += 1;
        events |= EVENT.LOOT;
        setMessage(world, `${nearLoot.name} +$${nearLoot.value}`, 1.6);
      }
    }
  } else {
    for (const item of world.loot) item.grab = 0;
  }

  // The getaway: reach the open exit with the prize and the job is yours.
  if (world.exitOpen && distance(player.x, player.y, job.exit.x, job.exit.y) < 46) {
    world.over = true;
    world.won = true;
    const timeBonus = Math.round(world.timeLeft * 2);
    const ghostBonus = world.everSpotted ? 0 : 300;
    world.score += timeBonus + ghostBonus;
    world.timeBonus = timeBonus;
    world.ghostBonus = ghostBonus;
    setFlash(world, 'CLEAN GETAWAY', 3);
    return EVENT.ESCAPED;
  }
  return events;
}
