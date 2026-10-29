import { getSolarSystemState } from "./solarSystem.js";
import { SOLAR_WORLD_CENTER, SOLAR_UNITS_PER_AU } from "./universeSpace.js";

// Cache the expensive ephemerides at whole seconds. Every consumer samples the
// same continuous path between them; velocities are in world units / second.
const solarStateCache = new Map(),
  sampledCache = new Map();
const normal = (v) => {
  const r = Math.hypot(...v) || 1;
  return v.map((x) => x / r);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function secondState(tick) {
  if (!solarStateCache.has(tick)) {
    solarStateCache.set(
      tick,
      getSolarSystemState(tick).map((body) => ({
        ...body,
        position: body.position.map(
          (v, i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU,
        ),
        radius: body.radiusAu * SOLAR_UNITS_PER_AU,
      })),
    );
    if (solarStateCache.size > 8)
      solarStateCache.delete(solarStateCache.keys().next().value);
  }
  return solarStateCache.get(tick);
}
export function getUniverseSolarState(utcMs = Date.now()) {
  if (!Number.isFinite(utcMs))
    throw new TypeError("Physics requires a finite UTC epoch.");
  if (sampledCache.has(utcMs)) return sampledCache.get(utcMs);
  const tick = Math.floor(utcMs / 1000) * 1000,
    t = (utcMs - tick) / 1000,
    a = secondState(tick),
    b = secondState(tick + 1000);
  const states = a.map((body, i) => {
    let orientation = body.orientation;
    if (t !== 0) {
      const x = normal(mix(body.orientation.x, b[i].orientation.x, t)),
        rawY = mix(body.orientation.y, b[i].orientation.y, t);
      const dot = x.reduce((s, v, j) => s + v * rawY[j], 0),
        y = normal(rawY.map((v, j) => v - dot * x[j]));
      orientation = { x, y, z: normal(cross(x, y)) };
    }
    return {
      ...body,
      position: t === 0 ? body.position : mix(body.position, b[i].position, t),
      velocity: b[i].position.map((v, j) => v - body.position[j]),
      orientation,
    };
  });
  sampledCache.set(utcMs, states);
  if (sampledCache.size > 32)
    sampledCache.delete(sampledCache.keys().next().value);
  return states;
}
