// Flat 2D geometry the stealth rules stand on: segment intersection, raycasts against
// the yard's rectangular cover, point-in-polygon tests for vision cones, and line of sight.
// Walls and boxcars are axis-aligned rectangles; every sight check goes through here.

/** Distance between two points. */
export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Angle from (ax, ay) to (bx, by), in radians. */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Where segments (p1,p2) and (p3,p4) cross, as {x, y, t} with t the fraction along
 * (p1,p2); null when they do not cross (parallel or apart).
 */
export function segmentHit(p1, p2, p3, p4) {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + dx1 * t, y: p1.y + dy1 * t, t };
}

/** The four edges of an axis-aligned rectangle, as segment endpoints. */
export function rectEdges(rect) {
  const { x, y, w, h } = rect;
  return [
    [{ x, y }, { x: x + w, y }],
    [{ x: x + w, y }, { x: x + w, y: y + h }],
    [{ x: x + w, y: y + h }, { x, y: y + h }],
    [{ x, y: y + h }, { x, y }],
  ];
}

/**
 * Cast a ray from (ox, oy) along `angle` up to `maxDistance` and return how far it
 * travels before hitting one of the rectangles (or maxDistance when it hits nothing).
 */
export function raycastDistance(ox, oy, angle, maxDistance, blockers) {
  const end = { x: ox + Math.cos(angle) * maxDistance, y: oy + Math.sin(angle) * maxDistance };
  let best = maxDistance;
  for (const blocker of blockers) {
    for (const [a, b] of rectEdges(blocker)) {
      const hit = segmentHit({ x: ox, y: oy }, end, a, b);
      if (hit && hit.t * maxDistance < best) best = hit.t * maxDistance;
    }
  }
  return best;
}

/**
 * The vision polygon of a watcher at (ox, oy) facing `angle` with a cone of
 * `halfAngle` and reach `distance`: rays fan across the cone and stop at the first
 * wall or boxcar, so cover really does cut the cone short.
 */
export function visionPolygon(ox, oy, angle, halfAngle, distance, blockers) {
  const rays = 26;
  const points = [{ x: ox, y: oy }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = raycastDistance(ox, oy, a, distance, blockers);
    points.push({ x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d });
  }
  return points;
}

/** True when (x, y) lies inside the polygon (ray-casting point-in-polygon test). */
export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when nothing rectangular blocks the straight line from (ax, ay) to (bx, by). */
export function hasLineOfSight(ax, ay, bx, by, blockers) {
  const from = { x: ax, y: ay };
  const to = { x: bx, y: by };
  for (const blocker of blockers) {
    for (const [a, b] of rectEdges(blocker)) {
      if (segmentHit(from, to, a, b)) return false;
    }
  }
  return true;
}

/** True when the circle at (x, y, r) overlaps rectangle `rect`. */
export function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
}

/** Push a circle at (x, y, r) out of every rectangle it overlaps; returns the new position. */
export function slideOutOfRects(x, y, r, rects) {
  let px = x;
  let py = y;
  for (const rect of rects) {
    if (!circleHitsRect(px, py, r, rect)) continue;
    const left = px - (rect.x - r);
    const right = rect.x + rect.w + r - px;
    const top = py - (rect.y - r);
    const bottom = rect.y + rect.h + r - py;
    const min = Math.min(left, right, top, bottom);
    if (min === left) px = rect.x - r;
    else if (min === right) px = rect.x + rect.w + r;
    else if (min === top) py = rect.y - r;
    else py = rect.y + rect.h + r;
  }
  return { x: px, y: py };
}
