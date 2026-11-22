// The yard guards: patrol a loop of waypoints, pause at each stop to look around,
// and react to what they see and hear. A guard's state machine is PATROL → SUSPICIOUS
// (something caught its eye) → INVESTIGATE (walk to the last seen spot) → HUNT (it
// knows where you are) → PATROL again once the trail goes cold. Suspicion is a meter,
// not a switch: a glimpse in shadow only makes a guard curious, and curiosity fades
// when you break line of sight. That is what makes a caught moment feel fair.

import { GUARD, PLAYER } from './config.js';
import {
  angleDiff,
  angleTo,
  distance,
  hasLineOfSight,
  pointInPolygon,
  visionPolygon,
} from './geometry.js';

export const GUARD_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  HUNT: 'hunt',
};

/** Build a guard's live state from its job definition. */
export function createGuard(def) {
  const start = def.waypoints[0];
  return {
    waypoints: def.waypoints,
    x: start[0],
    y: start[1],
    facing: def.facing,
    waypointIndex: 1 % def.waypoints.length,
    pause: 1.2,
    state: GUARD_STATE.PATROL,
    suspicion: 0,
    /** Seconds this guard has held you in unbroken sight. */
    seenTime: 0,
    /** Where it last saw (or heard) you. */
    lastSeen: null,
    investigateTimer: 0,
    /** '?' over its head while suspicious, '!' while hunting. */
    mark: null,
    markTimer: 0,
  };
}

/** The guard's current vision cone, cut short by walls and boxcars. */
export function guardCone(guard, blockers) {
  return visionPolygon(
    guard.x,
    guard.y,
    guard.facing,
    GUARD.viewHalfAngle,
    GUARD.viewDistance,
    blockers,
  );
}

/**
 * How fast suspicion grows while this guard can see the player: lamplight betrays you,
 * shadow and sneaking hide you, smoke blinds the guard outright.
 */
function sightRate(player, guard, inLight) {
  if (player.inSmoke) return 0;
  const base = inLight ? 1 / PLAYER.spotTimeLit : 1 / PLAYER.spotTimeShadow;
  return player.sneaking ? base * PLAYER.sneakSpotFactor : base;
}

/** True when the guard can currently see the player at all. */
export function guardSeesPlayer(guard, player, blockers, inLight) {
  if (player.inSmoke) return false;
  const d = distance(guard.x, guard.y, player.x, player.y);
  if (d > GUARD.viewDistance) return false;
  if (angleDiff(angleTo(guard.x, guard.y, player.x, player.y), guard.facing) > GUARD.viewHalfAngle) return false;
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y, blockers)) return false;
  return true;
}

/** Send a guard to investigate a point it heard or glimpsed (a clang, a footstep). */
export function guardHearNoise(guard, x, y, strength) {
  if (guard.state === GUARD_STATE.HUNT) return;
  guard.lastSeen = { x, y };
  guard.suspicion = Math.max(guard.suspicion, strength);
  if (guard.state === GUARD_STATE.PATROL) {
    guard.state = GUARD_STATE.SUSPICIOUS;
    guard.mark = '?';
    guard.markTimer = 1.2;
  }
}

/**
 * Advance one guard by `dt` seconds. Returns an event string for the world to act on:
 * 'spotted' when the guard becomes certain of you, 'lost' when it gives up the hunt.
 */
export function stepGuard(guard, dt, player, blockers, inLight) {
  const sees = guardSeesPlayer(guard, player, blockers, inLight);
  let event = null;

  if (sees) {
    guard.suspicion = Math.min(1, guard.suspicion + sightRate(player, guard, inLight) * dt);
    guard.seenTime += dt;
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.suspicion >= 1 && guard.state !== GUARD_STATE.HUNT) {
      guard.state = GUARD_STATE.HUNT;
      guard.mark = '!';
      guard.markTimer = 1.5;
      event = 'spotted';
    } else if (guard.suspicion > 0.35 && guard.state === GUARD_STATE.PATROL) {
      guard.state = GUARD_STATE.SUSPICIOUS;
      guard.mark = '?';
      guard.markTimer = 1.2;
    }
  } else {
    guard.seenTime = 0;
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.drainRate * dt);
    if (guard.markTimer > 0) {
      guard.markTimer -= dt;
      if (guard.markTimer <= 0) guard.mark = null;
    }
  }

  // Movement follows the state: patrol the loop, walk to the last seen spot, or chase.
  let speed = 0;
  let target = null;
  if (guard.state === GUARD_STATE.PATROL) {
    const wp = guard.waypoints[guard.waypointIndex];
    const d = distance(guard.x, guard.y, wp[0], wp[1]);
    if (d < 8) {
      guard.pause -= dt;
      if (guard.pause <= 0) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pause = 1.2;
        // Look down the next leg of the patrol while waiting.
        const next = guard.waypoints[guard.waypointIndex];
        guard.facing = angleTo(guard.x, guard.y, next[0], next[1]);
      }
    } else {
      speed = GUARD.patrolSpeed;
      target = { x: wp[0], y: wp[1] };
    }
  } else if (guard.state === GUARD_STATE.SUSPICIOUS) {
    // A suspicious guard turns toward what it glimpsed, then walks over to look.
    if (guard.lastSeen) {
      guard.facing = angleTo(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
      guard.investigateTimer += dt;
      if (guard.investigateTimer > 0.9) {
        guard.state = GUARD_STATE.INVESTIGATE;
        guard.investigateTimer = 0;
      }
    }
  } else if (guard.state === GUARD_STATE.INVESTIGATE) {
    if (!guard.lastSeen) {
      guard.state = GUARD_STATE.PATROL;
    } else {
      const d = distance(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y);
      if (d < 14) {
        guard.investigateTimer += dt;
        guard.facing += dt * 1.6; // Look around the spot before giving up.
        if (guard.investigateTimer > GUARD.investigateTime || guard.suspicion <= 0.02) {
          guard.state = GUARD_STATE.PATROL;
          guard.investigateTimer = 0;
          guard.lastSeen = null;
        }
      } else {
        speed = GUARD.investigateSpeed;
        target = guard.lastSeen;
      }
    }
  } else if (guard.state === GUARD_STATE.HUNT) {
    if (sees) {
      speed = GUARD.huntSpeed;
      target = { x: player.x, y: player.y };
    } else {
      // Lost sight while hunting: run to where you were last seen, then search.
      guard.state = GUARD_STATE.INVESTIGATE;
      guard.investigateTimer = 0;
      event = 'lost';
    }
  }

  if (target && speed > 0) {
    const a = angleTo(guard.x, guard.y, target.x, target.y);
    guard.facing = a;
    guard.x += Math.cos(a) * speed * dt;
    guard.y += Math.sin(a) * speed * dt;
  }
  return event;
}

/** True when the guard is close enough to grab the player. */
export function guardCatchesPlayer(guard, player) {
  return distance(guard.x, guard.y, player.x, player.y) < GUARD.radius + PLAYER.radius - 2;
}
