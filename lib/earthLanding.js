import { getUniverseSolarState } from "./universeFlight.js";
import { SHIP_CONTACT_RADIUS } from "./physics/mechanics.js";

export const EARTH_PORTS = Object.freeze([
  {
    id: "pacific",
    name: "Pacific Spaceport",
    latitude: 49.2,
    longitude: -123.1,
    color: "#8bedd1",
  },
  {
    id: "atlantic",
    name: "Atlantic Spaceport",
    latitude: 28.5,
    longitude: -80.6,
    color: "#8edbff",
  },
  {
    id: "southern",
    name: "Southern Spaceport",
    latitude: -31.2,
    longitude: 136.8,
    color: "#ffd39a",
  },
]);
export const LANDING_SPEED = 8,
  LANDING_CAPTURE_RADIUS = 32,
  PAD_HEIGHT = 3.5,
  SHIP_LANDING_HEIGHT = 0.8;
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map((v) => v * s);
const normal = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Interpolate the cached UTC ephemeris so a docked ship never jumps each second.
export function landingEarthState(utcMs = Date.now()) {
  const second = Math.floor(utcMs / 1000) * 1000,
    t = (utcMs - second) / 1000;
  const a = getUniverseSolarState(second).find((b) => b.id === "earth"),
    b = getUniverseSolarState(second + 1000).find((b) => b.id === "earth");
  const x = normal(mix(a.orientation.x, b.orientation.x, t)),
    y = normal(mix(a.orientation.y, b.orientation.y, t));
  return {
    ...a,
    position: mix(a.position, b.position, t),
    orientation: { x, y, z: normal(cross(x, y)) },
  };
}
const worldVector = (v, axes) =>
  v.map((_, i) => axes.x[i] * v[0] + axes.y[i] * v[1] + axes.z[i] * v[2]);
export function basisOrientation(right, up, forward) {
  const [m00, m10, m20] = right,
    [m01, m11, m21] = up,
    [m02, m12, m22] = forward;
  const trace = m00 + m11 + m22;
  let q;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  return scale(q, 1 / Math.hypot(...q));
}
const siteCache = new Map();
export function getEarthLandingSites(utcMs = Date.now()) {
  if (siteCache.has(utcMs)) return siteCache.get(utcMs);
  const earth = landingEarthState(utcMs),
    radius = earth.radius * 1.02 + 2;
  const sites = EARTH_PORTS.map((port) => {
    const lat = (port.latitude * Math.PI) / 180,
      lon = (port.longitude * Math.PI) / 180;
    const up = worldVector(
      [
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        -Math.cos(lat) * Math.sin(lon),
      ],
      earth.orientation,
    );
    const north = worldVector(
      [
        -Math.sin(lat) * Math.cos(lon),
        Math.cos(lat),
        Math.sin(lat) * Math.sin(lon),
      ],
      earth.orientation,
    );
    const right = normal(cross(up, north)),
      orientation = basisOrientation(right, up, north);
    const position = add(earth.position, scale(up, radius));
    const pads = [
      [-10, -10],
      [10, -10],
      [-10, 10],
      [10, 10],
    ].map(([x, z], index) => ({
      id: port.id + "-" + (index + 1),
      siteId: port.id,
      name: port.name + " · Pad " + (index + 1),
      number: index + 1,
      up,
      north,
      right,
      orientation,
      position: add(
        add(position, scale(right, x)),
        add(scale(north, z), scale(up, PAD_HEIGHT + SHIP_LANDING_HEIGHT)),
      ),
      offset: [x, PAD_HEIGHT, z],
    }));
    return {
      ...port,
      position,
      up,
      north,
      right,
      orientation,
      radius,
      earth,
      pads,
    };
  });
  siteCache.set(utcMs, sites);
  if (siteCache.size > 8) siteCache.delete(siteCache.keys().next().value);
  return sites;
}
export function getEarthLandingPad(id, utcMs = Date.now()) {
  return (
    getEarthLandingSites(utcMs)
      .flatMap((s) => s.pads)
      .find((p) => p.id === id) || null
  );
}
export function landingPadVelocity(id, utcMs = Date.now()) {
  const a = getEarthLandingPad(id, utcMs - 50),
    b = getEarthLandingPad(id, utcMs);
  return a && b
    ? b.position.map((v, i) => (v - a.position[i]) * 20)
    : [0, 0, 0];
}
export function getEarthLandingDestinations(utcMs = Date.now()) {
  return getEarthLandingSites(utcMs).map((site) => ({
    key: "earth-port-" + site.id,
    label: site.name,
    kind: "landing zone",
    padId: site.pads[0].id,
    color: site.color,
    position: add(site.pads[0].position, scale(site.up, 16)),
    radius: 4,
    approachRadius: 5,
    description:
      "Protected Earth spaceport. Approach slowly, choose a free landing pad, then land. Take off to explore the surface or return to orbit.",
  }));
}
export function getEarthSurfaceStatus(
  position,
  velocity = [0, 0, 0],
  utcMs = Date.now(),
  occupied = [],
) {
  const earth = landingEarthState(utcMs),
    radial = position.map((v, i) => v - earth.position[i]),
    up = normal(radial);
  const altitude = Math.hypot(...radial) - (earth.radius * 1.02 + 2);
  const nearest =
    getEarthLandingSites(utcMs)
      .flatMap((s) => s.pads)
      .filter((p) => !occupied.includes(p.id))
      .map((p) => ({ ...p, distance: distance(position, p.position) }))
      .sort((a, b) => a.distance - b.distance)[0] || null;
  const relativeSpeed = nearest
    ? Math.hypot(
        ...velocity.map((v, i) => v - landingPadVelocity(nearest.id, utcMs)[i]),
      )
    : Math.hypot(...velocity);
  let east = cross(up, earth.orientation.y);
  if (Math.hypot(...east) < 0.001) east = cross(up, earth.orientation.x);
  east = normal(east);
  const north = normal(cross(east, up));
  const right = normal(cross(up, north));
  return {
    active: altitude < 120,
    altitude,
    up,
    right,
    north,
    orientation: basisOrientation(right, up, north),
    nearest,
    relativeSpeed,
    canLand: Boolean(
      nearest &&
      nearest.distance <= LANDING_CAPTURE_RADIUS &&
      relativeSpeed <= LANDING_SPEED,
    ),
  };
}
export function validateEarthLanding(
  { position, velocity, padId, occupied = [] },
  utcMs = Date.now(),
) {
  const pad = getEarthLandingPad(padId, utcMs);
  if (!pad)
    return {
      ok: false,
      status: 400,
      error: "Choose a designated Earth landing pad.",
    };
  if (occupied.includes(pad.id))
    return {
      ok: false,
      status: 409,
      error: "That pad is occupied. Choose another landing pad.",
    };
  if (distance(position, pad.position) > LANDING_CAPTURE_RADIUS)
    return {
      ok: false,
      status: 409,
      error: "Approach within 32 units of the landing pad.",
    };
  if (
    Math.hypot(
      ...velocity.map((v, i) => v - landingPadVelocity(pad.id, utcMs)[i]),
    ) > LANDING_SPEED
  )
    return {
      ok: false,
      status: 409,
      error: "Brake below 8 u/s relative to the pad before landing.",
    };
  return { ok: true, pad };
}
export function earthTerrainHeight(x, z, radius) {
  const curve =
    Math.sqrt(Math.max(1, radius * radius - x * x - z * z)) - radius;
  const edge = Math.max(0, Math.min(1, (Math.hypot(x, z) - 34) / 18));
  return (
    curve * edge +
    edge *
      (0.8 +
        0.7 * Math.sin(x * 0.23) * Math.cos(z * 0.19) +
        0.4 * Math.sin((x + z) * 0.53)) -
    Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 42) / 14) * 8
  );
}
// Flying hulls remain above the same height field the renderer uses. Docking
// explicitly lowers the ship onto its gear and bypasses ordinary hull clearance.
export function constrainEarthSurfaceFlight(
  position,
  velocity,
  utcMs = Date.now(),
) {
  for (const site of getEarthLandingSites(utcMs)) {
    const delta = position.map((v, i) => v - site.position[i]);
    const dot = (axis) => delta.reduce((sum, v, i) => sum + v * axis[i], 0);
    const x = dot(site.right),
      z = dot(site.north),
      height = dot(site.up);
    if (Math.abs(x) > 56 || Math.abs(z) > 56 || height < -24 || height > 120)
      continue;
    let ground = earthTerrainHeight(x, z, site.radius);
    for (const pad of site.pads)
      if (Math.hypot(x - pad.offset[0], z - pad.offset[2]) <= 6.5)
        ground = Math.max(ground, PAD_HEIGHT);
    const clearance = ground + SHIP_CONTACT_RADIUS;
    if (height >= clearance) continue;
    const inward = Math.min(
      0,
      velocity.reduce((sum, v, i) => sum + v * site.up[i], 0),
    );
    return {
      position: position.map((v, i) => v + site.up[i] * (clearance - height)),
      velocity: velocity.map((v, i) => v - site.up[i] * inward),
      contacts: [
        {
          key: "earth-surface-" + site.id,
          normal: site.up,
          impactSpeed: -inward,
        },
      ],
    };
  }
  return { position, velocity, contacts: [] };
}
export function getEarthPortColliders(utcMs = Date.now()) {
  return getEarthLandingSites(utcMs).flatMap((site) =>
    [
      { offset: [-29, 4, 0], radius: 5 },
      { offset: [27, 3, 0], radius: 4 },
      { offset: [0, 7, 30], radius: 4 },
    ].map((body, index) => ({
      key: site.id + "-structure-" + index,
      collisionRadius: body.radius,
      position: add(
        site.position,
        add(
          scale(site.right, body.offset[0]),
          add(
            scale(site.up, body.offset[1]),
            scale(site.north, body.offset[2]),
          ),
        ),
      ),
    })),
  );
}
export function takeoffEarthPose(padId, utcMs = Date.now()) {
  const pad = getEarthLandingPad(padId, utcMs);
  if (!pad) return null;
  return {
    position: add(pad.position, scale(pad.up, SHIP_CONTACT_RADIUS + 8)),
    velocity: add(landingPadVelocity(padId, utcMs), scale(pad.up, 4)),
    orientation: pad.orientation,
    direction: pad.north,
  };
}
