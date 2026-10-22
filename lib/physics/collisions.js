import { distance } from "./mechanics.js";
const EPS = 1e-7;
export function sweepSphere(from, to, center, radius) {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    dz = to[2] - from[2];
  const ox = from[0] - center[0],
    oy = from[1] - center[1],
    oz = from[2] - center[2];
  if (Math.hypot(ox, oy, oz) <= radius) return { time: 0, point: [...from] };
  const travel = Math.hypot(dx, dy, dz);
  if (travel < 1e-10) return null;
  // Closest approach avoids subtracting nearly equal squared terms in the
  // quadratic discriminant on long deep-space sweeps past small targets.
  const direction = [dx / travel, dy / travel, dz / travel];
  const along = -(ox * direction[0] + oy * direction[1] + oz * direction[2]);
  const perpendicular = [ox, oy, oz].map((v, i) => v + direction[i] * along);
  const squared = perpendicular.reduce((sum, v) => sum + v * v, 0);
  if (squared > radius * radius) return null;
  const entry = along - Math.sqrt(Math.max(0, radius * radius - squared));
  const time = entry / travel;
  return time >= 0 && time <= 1
    ? {
        time,
        point: from.map((v, i) => v + direction[i] * entry),
      }
    : null;
}
export function sweepBounds(from, to, center, radius) {
  for (let i = 0; i < 3; i++)
    if (
      center[i] + radius < Math.min(from[i], to[i]) ||
      center[i] - radius > Math.max(from[i], to[i])
    )
      return false;
  return true;
}
// Shared first contact for hulls, projectiles, visual impacts and mining rays.
// Radius inflates the obstacle by the moving body's contact sphere.
export function firstSphereContact(from, to, bodies, { radius = 0 } = {}) {
  let closest = null;
  for (const body of bodies) {
    const r = (body.collisionRadius ?? body.radius) + radius;
    if (!(r > 0) || !sweepBounds(from, to, body.position, r)) continue;
    const hit = sweepSphere(from, to, body.position, r);
    if (!hit) continue;
    if (
      !closest ||
      hit.time < closest.time ||
      (hit.time === closest.time &&
        String(body.key ?? body.id).localeCompare(
          String(closest.body.key ?? closest.body.id),
        ) < 0)
    )
      closest = { ...hit, body, radius: r };
  }
  return closest;
}

// Re-sweep each tangent remainder. The bounded solver stops at its last safe
// contact when exhausted, rather than allowing untested movement through solids.
export function resolveStaticContacts({
  from,
  position,
  velocity,
  bodies = [],
  radius = 0,
}) {
  let point = [...from],
    remaining = position.map((v, i) => v - from[i]),
    nextVelocity = [...velocity];
  const contacts = [];
  for (let pass = 0; pass < 8; pass++) {
    const end = point.map((v, i) => v + remaining[i]);
    const hit = firstSphereContact(point, end, bodies, { radius });
    if (!hit) {
      point = end;
      break;
    }
    let normal = hit.point.map((v, i) => v - hit.body.position[i]);
    let magnitude = Math.hypot(...normal);
    if (magnitude < EPS) {
      normal = [0, 0, -1];
      magnitude = 1;
    }
    normal = normal.map((v) => v / magnitude);
    const slop = Math.max(
      EPS,
      Number.EPSILON *
        Math.max(hit.radius, ...hit.body.position.map(Math.abs)) *
        4,
    );
    point = hit.body.position.map(
      (v, i) => v + normal[i] * (hit.radius + slop),
    );
    const inward = Math.min(
      0,
      nextVelocity.reduce((sum, v, i) => sum + v * normal[i], 0),
    );
    nextVelocity = nextVelocity.map((v, i) => v - inward * normal[i]);
    contacts.push({
      key: hit.body.key ?? hit.body.id,
      normal,
      impactSpeed: -inward,
    });
    remaining = remaining.map((v) => v * (1 - hit.time));
    const blocked = Math.min(
      0,
      remaining.reduce((sum, v, i) => sum + v * normal[i], 0),
    );
    remaining = remaining.map((v, i) => v - blocked * normal[i]);
  }
  return { position: point, velocity: nextVelocity, contacts };
}

// Deterministic pair order, swept broad-phase and mass-weighted impulses.
export function resolveBodyPairs(bodies, seconds, { restitution = 0.15 } = {}) {
  const ordered = [...bodies].sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    ),
    contacts = [];
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i],
        b = ordered[j],
        r = a.radius + b.radius;
      let separated = false;
      for (let axis = 0; axis < 3; axis++) {
        const from = a.previousPosition[axis] - b.previousPosition[axis],
          to = a.position[axis] - b.position[axis];
        if (Math.min(from, to) > r || Math.max(from, to) < -r) {
          separated = true;
          break;
        }
      }
      if (separated) continue;
      const start = a.previousPosition.map((v, k) => v - b.previousPosition[k]),
        end = a.position.map((v, k) => v - b.position[k]);
      if (!sweepBounds(start, end, [0, 0, 0], r)) continue;
      const hit = sweepSphere(start, end, [0, 0, 0], r);
      if (!hit) continue;
      let n = hit.point,
        magnitude = Math.hypot(...n);
      if (magnitude < EPS) {
        n = [1, 0, 0];
        magnitude = 1;
      }
      const normal = n.map((v) => v / magnitude),
        inverseA = 1 / a.mass,
        inverseB = 1 / b.mass;
      const closing = a.velocity.reduce(
        (sum, v, k) => sum + (v - b.velocity[k]) * normal[k],
        0,
      );
      const impulse =
        closing < 0
          ? (-(1 + restitution) * closing) / (inverseA + inverseB)
          : 0;
      a.velocity = a.velocity.map((v, k) => v + impulse * inverseA * normal[k]);
      b.velocity = b.velocity.map((v, k) => v - impulse * inverseB * normal[k]);
      if (hit.time > 0 || impulse > 0) {
        a.position = a.previousPosition.map(
          (v, k) =>
            v +
            (a.position[k] - v) * hit.time +
            a.velocity[k] * seconds * (1 - hit.time),
        );
        b.position = b.previousPosition.map(
          (v, k) =>
            v +
            (b.position[k] - v) * hit.time +
            b.velocity[k] * seconds * (1 - hit.time),
        );
      }
      const separation = distance(a.position, b.position),
        overlap = Math.max(0, r - separation) + EPS;
      a.position = a.position.map(
        (v, k) => v + (normal[k] * overlap * inverseA) / (inverseA + inverseB),
      );
      b.position = b.position.map(
        (v, k) => v - (normal[k] * overlap * inverseB) / (inverseA + inverseB),
      );
      if (impulse > 0)
        contacts.push({ a: a.id, b: b.id, impactSpeed: -closing, impulse });
    }
  return contacts;
}
