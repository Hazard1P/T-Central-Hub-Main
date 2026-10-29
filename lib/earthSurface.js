import { getUniverseSolarState } from "./universeSolarState.js";
import { SHIP_CONTACT_RADIUS } from "./physics/mechanics.js";
import { sweepSphere } from "./physics/collisions.js";
import { EARTH_LAND_MASK } from "./earthLandMask.js";
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map((v) => v * s);
const normal = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Interpolate UTC ephemeris so the entire terrain and surface camera move smoothly.
export function getEarthSurfaceState(utcMs = Date.now()) {
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

export const EARTH_TERRAIN_SEGMENTS = 512;
export const EARTH_MAX_RELIEF = 6;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toLocal = (up, axes) => [
  dot(up, axes.x),
  dot(up, axes.y),
  dot(up, axes.z),
];
export function earthLandCoverage(direction) {
  const [x, y, z] = normal(direction);
  const u = (((Math.atan2(-z, x) / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
  const v = Math.acos(clamp(y, -1, 1)) / Math.PI;
  const fx = u * 128,
    fy = v * 64,
    ix = Math.floor(fx),
    iy = Math.min(63, Math.floor(fy));
  const sample = (x, y) =>
    parseInt(EARTH_LAND_MASK[y].slice((x % 128) * 2, (x % 128) * 2 + 2), 16) /
    255;
  const blend = (a, b, t) => a + (b - a) * t;
  return blend(
    blend(sample(ix, iy), sample(ix + 1, iy), fx - ix),
    blend(sample(ix, iy + 1), sample(ix + 1, iy + 1), fx - ix),
    fy - iy,
  );
}
// Original gameplay relief, masked to the globe's existing coastlines. This is
// deliberately not a surveyed elevation model. 3D functions avoid seam/pole cracks.
export function earthSurfaceHeight(direction) {
  const [x, y, z] = normal(direction),
    land = earthLandCoverage(direction);
  const ridge = 1 - Math.abs(Math.sin(x * 9 + z * 5 + Math.sin(y * 11) * 1.4));
  const hills = 0.5 + 0.5 * Math.sin(x * 15 + y * 8) * Math.cos(z * 13 - y * 6);
  return land * land * (0.18 + 3.7 * ridge * ridge + 1.9 * hills);
}
export function earthSurfacePoint(
  latitude,
  longitude,
  altitude = 0,
  utcMs = Date.now(),
) {
  const earth = getEarthSurfaceState(utcMs),
    lat = (latitude * Math.PI) / 180,
    lon = (longitude * Math.PI) / 180;
  const local = [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ];
  const up = worldVector(local, earth.orientation);
  return add(
    earth.position,
    scale(up, earth.radius + earthSurfaceHeight(local) + altitude),
  );
}
export function getEarthSurfaceDestinations(utcMs = Date.now()) {
  return [
    {
      id: "pacific",
      label: "Earth · Pacific coast",
      latitude: 48,
      longitude: -124,
      color: "#8bedd1",
    },
    {
      id: "sahara",
      label: "Earth · Sahara",
      latitude: 25,
      longitude: 15,
      color: "#ffd39a",
    },
    {
      id: "himalaya",
      label: "Earth · Himalayan region",
      latitude: 29,
      longitude: 87,
      color: "#cdeaff",
    },
    {
      id: "australia",
      label: "Earth · Australian interior",
      latitude: -25,
      longitude: 135,
      color: "#eab995",
    },
    {
      id: "antarctica",
      label: "Earth · Antarctica",
      latitude: -80,
      longitude: 30,
      color: "#e2f3ff",
    },
  ].map((region) => ({
    ...region,
    key: "earth-surface-" + region.id,
    kind: "surface region",
    position: earthSurfacePoint(region.latitude, region.longitude, 22, utcMs),
    radius: 2,
    approachRadius: 4,
    description:
      "Fly freely over Earth’s continuous terrain and oceans. Rise to return to orbit. Protected by the Earth safe zone.",
  }));
}
export function getEarthSurfaceStatus(
  position,
  velocity = [0, 0, 0],
  utcMs = Date.now(),
) {
  const earth = getEarthSurfaceState(utcMs),
    radial = position.map((v, i) => v - earth.position[i]);
  const up =
    Math.hypot(...radial) > 1e-8 ? normal(radial) : earth.orientation.y;
  const local = toLocal(up, earth.orientation),
    height = earthSurfaceHeight(local);
  const altitude = Math.hypot(...radial) - earth.radius - height;
  let east = cross(up, earth.orientation.y);
  if (Math.hypot(...east) < 0.001) east = cross(up, earth.orientation.x);
  const north = normal(cross(normal(east), up)),
    right = normal(cross(up, north));
  return {
    active: altitude < 120,
    altitude,
    up,
    right,
    north,
    orientation: basisOrientation(right, up, north),
    latitude: (Math.asin(clamp(local[1], -1, 1)) * 180) / Math.PI,
    longitude: (Math.atan2(-local[2], local[0]) * 180) / Math.PI,
    land: earthLandCoverage(local) > 0.5,
  };
}
// Every point on Earth uses this same height field. Sweep the near-surface
// portion in bounded increments and bisect first contact, so fast approaches
// cannot pass through mountains or cross the planet in a single frame.
export function constrainEarthSurfaceFlight(
  position,
  velocity,
  utcMs = Date.now(),
  from = position,
  clearance = SHIP_CONTACT_RADIUS,
) {
  const earth = getEarthSurfaceState(utcMs),
    outer = earth.radius + EARTH_MAX_RELIEF + clearance;
  const start = sweepSphere(from, position, earth.position, outer);
  if (!start) return { position, velocity, contacts: [] };
  const delta = position.map((v, i) => v - from[i]),
    travel = Math.hypot(...delta);
  const at = (t) => from.map((v, i) => v + delta[i] * t);
  const gap = (point) => {
    const radial = point.map((v, i) => v - earth.position[i]),
      r = Math.hypot(...radial);
    const up = r > 1e-8 ? scale(radial, 1 / r) : earth.orientation.y;
    return {
      distance:
        r -
        earth.radius -
        earthSurfaceHeight(toLocal(up, earth.orientation)) -
        clearance,
      up,
    };
  };
  let hit = at(start.time),
    sample = gap(hit),
    previous = start.time;
  if (sample.distance > 0) {
    const remaining = Math.min(1 - start.time, (outer * 2 + 1) / (travel || 1));
    const count = Math.max(
      1,
      Math.ceil(Math.min(travel * remaining, outer * 2 + 1) / 0.75),
    );
    let found = false;
    for (let i = 1; i <= count; i++) {
      const t = start.time + (remaining * i) / count,
        point = at(t),
        candidate = gap(point);
      if (candidate.distance <= 0) {
        let low = previous,
          high = t;
        for (let j = 0; j < 18; j++) {
          const mid = (low + high) / 2;
          if (gap(at(mid)).distance > 0) low = mid;
          else high = mid;
        }
        hit = at(high);
        sample = gap(hit);
        found = true;
        break;
      }
      previous = t;
    }
    if (!found) return { position, velocity, contacts: [] };
  }
  const inward = Math.min(0, dot(velocity, sample.up));
  return {
    position: add(hit, scale(sample.up, -sample.distance + 1e-5)),
    velocity: velocity.map((v, i) => v - sample.up[i] * inward),
    contacts: [
      { key: "earth-surface", normal: sample.up, impactSpeed: -inward },
    ],
  };
}
export function constrainEarthCamera(position, utcMs = Date.now()) {
  return constrainEarthSurfaceFlight(position, [0, 0, 0], utcMs, position, 1.2)
    .position;
}
