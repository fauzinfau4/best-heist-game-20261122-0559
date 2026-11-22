// The thief, Wren: movement with walk / sneak / sprint, the two tools, and noise.
// Every tool costs something, so every use is a decision: a spanner thrown to pull a
// guard away is a spanner you cannot throw later, and a sprint across lamplight is
// fast but loud enough to be heard across the yard.

import { FIELD, PLAYER, TOOLS } from './config.js';
import { circleHitsRect, slideOutOfRects } from './geometry.js';

/** Build the player's live state at the job's start. */
export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    moving: false,
    sneaking: false,
    sprinting: false,
    inSmoke: false,
    spanners: TOOLS.spanners,
    smoke: TOOLS.smoke,
    /** Where the mouse aims a thrown spanner. */
    aimX: start.x + 60,
    aimY: start.y,
    /** The spanner currently flying, if any. */
    thrown: null,
    /** Seconds left on the current smoke puff. */
    smokeTimer: 0,
    /** Noise rings the world should show (and guards should hear). */
    noises: [],
  };
}

/**
 * Move the player one fixed step. `move` is {x, y} in [-1, 1]; `sneak` and `sprint`
 * are held keys. Returns true when the step made a noise guards can hear.
 */
export function stepPlayer(player, dt, move, sneak, sprint, blockers) {
  const length = Math.hypot(move.x, move.y);
  player.moving = length > 0.05;
  player.sneaking = sneak && !sprint;
  player.sprinting = sprint && length > 0.05;
  let speed = PLAYER.walkSpeed;
  if (player.sneaking) speed = PLAYER.sneakSpeed;
  if (player.sprinting) speed = PLAYER.sprintSpeed;
  let madeNoise = false;
  if (player.moving) {
    const nx = move.x / (length || 1);
    const ny = move.y / (length || 1);
    player.facing = Math.atan2(ny, nx);
    const next = slideOutOfRects(
      player.x + nx * speed * dt,
      player.y + ny * speed * dt,
      PLAYER.radius,
      blockers,
    );
    player.x = Math.max(24 + PLAYER.radius, Math.min(FIELD.width - 24 - PLAYER.radius, next.x));
    player.y = Math.max(72 + PLAYER.radius, Math.min(FIELD.height - 40 - PLAYER.radius, next.y));
    if (player.sprinting) {
      madeNoise = true;
      player.noises.push({
        x: player.x,
        y: player.y,
        radius: TOOLS.sprintNoiseRadius,
        ttl: 0.5,
      });
    }
  }
  // Smoke fades; while it lasts, nobody can see you.
  if (player.smokeTimer > 0) {
    player.smokeTimer -= dt;
    player.inSmoke = true;
    if (player.smokeTimer <= 0) player.inSmoke = false;
  }
  // A thrown spanner flies until it lands, then clangs.
  if (player.thrown) {
    const t = player.thrown;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.ttl -= dt;
    const hitWall = blockers.some((b) => circleHitsRect(t.x, t.y, 4, b));
    if (t.ttl <= 0 || hitWall || t.x < 24 || t.x > FIELD.width - 24 || t.y < 72 || t.y > FIELD.height - 40) {
      player.noises.push({ x: t.x, y: t.y, radius: 240, ttl: TOOLS.clangLinger, clang: true });
      player.thrown = null;
    }
  }
  for (const noise of player.noises) noise.ttl -= dt;
  player.noises = player.noises.filter((n) => n.ttl > 0);
  return madeNoise;
}

/** Throw a spanner toward the aim point; returns false when none are left. */
export function throwSpanner(player) {
  if (player.spanners <= 0 || player.thrown) return false;
  player.spanners -= 1;
  const dx = player.aimX - player.x;
  const dy = player.aimY - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const flight = Math.min(0.6, d / 520);
  player.thrown = {
    x: player.x,
    y: player.y,
    vx: (dx / d) * (d / flight),
    vy: (dy / d) * (d / flight),
    ttl: flight,
  };
  return true;
}

/** Pop a smoke puff at your feet; returns false when none are left. */
export function popSmoke(player) {
  if (player.smoke <= 0 || player.smokeTimer > 0) return false;
  player.smoke -= 1;
  player.smokeTimer = TOOLS.smokeSeconds;
  return true;
}
