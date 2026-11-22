// The pole cameras: dumb, predictable, and therefore readable. Each sweeps its arc
// back and forth; while you stand in its cone its suspicion climbs, and a full meter
// feeds the alarm. Smoke blinds a camera the same way it blinds a guard.

import { CAMERA } from './config.js';
import {
  angleDiff,
  angleTo,
  distance,
  hasLineOfSight,
  visionPolygon,
} from './geometry.js';

/** Build a camera's live state from its job definition. */
export function createCamera(def) {
  return {
    x: def.x,
    y: def.y,
    base: def.base,
    sweep: def.sweep,
    angle: def.base - def.sweep,
    direction: 1,
    suspicion: 0,
    phase: 0,
  };
}

/** The camera's current vision cone, cut short by walls and boxcars. */
export function cameraCone(camera, blockers) {
  return visionPolygon(
    camera.x,
    camera.y,
    camera.angle,
    CAMERA.viewHalfAngle,
    CAMERA.viewDistance,
    blockers,
  );
}

/** True when the camera can currently see the player. */
export function cameraSeesPlayer(camera, player, blockers) {
  if (player.inSmoke) return false;
  const d = distance(camera.x, camera.y, player.x, player.y);
  if (d > CAMERA.viewDistance) return false;
  if (angleDiff(angleTo(camera.x, camera.y, player.x, player.y), camera.angle) > CAMERA.viewHalfAngle) {
    return false;
  }
  return hasLineOfSight(camera.x, camera.y, player.x, player.y, blockers);
}

/**
 * Advance one camera by `dt` seconds. Returns true when its suspicion just filled —
 * the moment it starts feeding the alarm.
 */
export function stepCamera(camera, dt, player, blockers) {
  camera.angle += camera.direction * CAMERA.sweepSpeed * dt;
  if (camera.angle > camera.base + camera.sweep) {
    camera.angle = camera.base + camera.sweep;
    camera.direction = -1;
  } else if (camera.angle < camera.base - camera.sweep) {
    camera.angle = camera.base - camera.sweep;
    camera.direction = 1;
  }
  const wasFull = camera.suspicion >= 1;
  if (cameraSeesPlayer(camera, player, blockers)) {
    camera.suspicion = Math.min(1, camera.suspicion + CAMERA.fillRate * dt);
  } else {
    camera.suspicion = Math.max(0, camera.suspicion - 0.4 * dt);
  }
  return !wasFull && camera.suspicion >= 1;
}
