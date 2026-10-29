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

// Rendering, flight and walking all sample the same continuous Solar path.
export function getEarthSurfaceState(utcMs = Date.now()) {
  return getUniverseSolarState(utcMs).find((body) => body.id === "earth");
}
export const earthWorldVector = (v, axes) =>
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
export const EARTH_MAX_RELIEF = 0.18;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const earthLocalVector = (up, axes) => [
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
  const large = land * land * (0.003 + 0.11 * ridge * ridge + 0.055 * hills);
  // Decimetre ground variation is visible in the local detail tiles, not the
  // globe silhouette. Evaluate the same function in movement and rendering.
  const ground =
    0.000003 *
    Math.sin(x * 280000 + y * 140000) *
    Math.cos(z * 310000 - y * 180000);
  return Math.max(0, large + land * land * ground);
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
  const up = earthWorldVector(local, earth.orientation);
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
      "Fly freely over Earth’s continuous terrain and oceans. Rise to return to orbit. Protected by the Earth safe zone. Approach slowly and choose Land & walk to explore on foot.",
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
  const local = earthLocalVector(up, earth.orientation),
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
// Velocity of an Earth-fixed point, including orbital translation and spin.
export function earthSurfaceVelocity(position, utcMs = Date.now()) {
  const earth = getEarthSurfaceState(utcMs),
    before = getEarthSurfaceState(utcMs - 20);
  const local = earthLocalVector(
    position.map((v, i) => v - earth.position[i]),
    earth.orientation,
  );
  const old = earthWorldVector(local, before.orientation).map(
    (v, i) => v + before.position[i],
  );
  return position.map((v, i) => (v - old[i]) * 50);
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
  dt = 0,
) {
  const earth = getEarthSurfaceState(utcMs),
    outer = earth.radius + EARTH_MAX_RELIEF + clearance;
  if (dt > 0) {
    const previous = getEarthSurfaceState(utcMs - dt * 1000);
    from = from.map((v, i) => v + earth.position[i] - previous.position[i]);
  }
  const gap = (point) => {
    const radial = point.map((v, i) => v - earth.position[i]),
      r = Math.hypot(...radial);
    const up = r > 1e-8 ? scale(radial, 1 / r) : earth.orientation.y;
    return {
      distance:
        r -
        earth.radius -
        earthSurfaceHeight(earthLocalVector(up, earth.orientation)) -
        clearance,
      up,
    };
  };
  const firstContact = (a, b) => {
    const start = sweepSphere(a, b, earth.position, outer);
    if (!start) return null;
    const delta = b.map((v, i) => v - a[i]),
      travel = Math.hypot(...delta),
      at = (t) => a.map((v, i) => v + delta[i] * t);
    let hit = at(start.time),
      sample = gap(hit),
      previous = start.time;
    if (sample.distance > 0) {
      const interval = Math.min(
        1 - start.time,
        (outer * 2 + 1) / (travel || 1),
      );
      const count = Math.max(
        1,
        Math.ceil(Math.min(travel * interval, outer * 2 + 1) / 0.75),
      );
      let found = false;
      for (let i = 1; i <= count; i++) {
        const t = start.time + (interval * i) / count,
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
      if (!found) return null;
    }
    return { point: hit, ...sample };
  };
  let point = from,
    remaining = position.map((v, i) => v - from[i]),
    nextVelocity = [...velocity];
  const contacts = [];
  for (let pass = 0; pass < 8; pass++) {
    const end = add(point, remaining),
      hit = firstContact(point, end);
    if (!hit) {
      point = end;
      break;
    }
    const surfaceVelocity = earthSurfaceVelocity(hit.point, utcMs);
    const inward = Math.min(
      0,
      dot(
        nextVelocity.map((v, i) => v - surfaceVelocity[i]),
        hit.up,
      ),
    );
    nextVelocity = nextVelocity.map((v, i) => v - hit.up[i] * inward);
    contacts.push({
      key: "earth-surface",
      normal: hit.up,
      impactSpeed: -inward,
      bodyVelocity: surfaceVelocity,
    });
    point = add(
      hit.point,
      scale(hit.up, -hit.distance + Math.min(1e-5, clearance * 0.01)),
    );
    remaining = end.map((v, i) => v - hit.point[i]);
    const blocked = Math.min(0, dot(remaining, hit.up));
    remaining = remaining.map((v, i) => v - hit.up[i] * blocked);
  }
  return { position: point, velocity: nextVelocity, contacts };
}

export function constrainEarthCamera(position, utcMs = Date.now()) {
  return constrainEarthSurfaceFlight(position, [0, 0, 0], utcMs, position, 1.2)
    .position;
}
