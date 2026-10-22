import { distance } from "./mechanics.js";
const EPS = 1e-7;
export function sweepSphere(from, to, center, radius) {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    dz = to[2] - from[2];
  const ox = from[0] - center[0],
    oy = from[1] - center[1],
    oz = from[2] - center[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  if (c <= 0) return { time: 0, point: [...from] };
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-20) return null;
  const b = ox * dx + oy * dy + oz * dz,
    discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= 0 && time <= 1
    ? {
        time,
        point: [from[0] + dx * time, from[1] + dy * time, from[2] + dz * time],
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
// Swept contact plus tangential sliding. Stop at the first surface, then project
// any initial overlaps. Ship radius is optional for existing point-ship callers.
export function resolveStaticContacts({
  from,
  position,
  velocity,
  bodies = [],
  radius = 0,
}) {
  let point = [...position],
    nextVelocity = [...velocity];
  const contacts = [];
  const hits = [];
  for (const body of bodies) {
    const r = body.collisionRadius + radius;
    if (!sweepBounds(from, point, body.position, r)) continue;
    const hit = sweepSphere(from, point, body.position, r);
    if (hit) hits.push({ body, r, ...hit });
  }
  if (!hits.length)
    return { position: point, velocity: nextVelocity, contacts };
  hits.sort(
    (a, b) =>
      a.time - b.time || String(a.body.key).localeCompare(String(b.body.key)),
  );
  const project = (body, r, origin, normalFallback) => {
    let offset = origin.map((v, i) => v - body.position[i]),
      n = Math.hypot(...offset);
    if (n < EPS) {
      offset = normalFallback;
      n = Math.hypot(...offset) || 1;
    }
    const normal = offset.map((v) => v / n),
      inward = Math.min(
        0,
        nextVelocity.reduce((sum, v, i) => sum + v * normal[i], 0),
      );
    point = body.position.map((v, i) => v + normal[i] * (r + EPS));
    nextVelocity = nextVelocity.map((v, i) => v - inward * normal[i]);
    contacts.push({ key: body.key, normal, impactSpeed: -inward });
  };
  if (hits.length) {
    const hit = hits[0];
    project(hit.body, hit.r, hit.point, [0, 0, -1]);
    // Retain the unblocked part of this step along the tangent plane.
    const remaining = position.map((v, i) => v - hit.point[i]),
      normal = contacts[0].normal;
    const inward = Math.min(
      0,
      remaining.reduce((s, v, i) => s + v * normal[i], 0),
    );
    point = point.map((v, i) => v + remaining[i] - inward * normal[i]);
  }
  for (let pass = 0; pass < 3; pass++)
    for (const body of bodies) {
      const r = body.collisionRadius + radius;
      if (distance(point, body.position) < r)
        project(body, r, point, [0, 0, -1]);
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
      if (hit.time > 0) {
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
