import { getSolarSystemState } from "./solarSystem.js";
import { SOLAR_WORLD_CENTER, SOLAR_UNITS_PER_AU } from "./universeSpace.js";

// Prediction can replay the previous UTC second while the renderer samples
// the current one. Retain a bounded history instead of recalculating both.
const solarStateCache = new Map();
export function getUniverseSolarState(utcMs = Date.now()) {
  const tick = Math.floor(utcMs / 1000) * 1000;
  if (!solarStateCache.has(tick)) {
    const bodies = getSolarSystemState(tick).map((body) => ({
      ...body,
      position: body.position.map(
        (v, i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU,
      ),
      radius: body.radiusAu * SOLAR_UNITS_PER_AU,
    }));
    solarStateCache.set(tick, bodies);
    if (solarStateCache.size > 4)
      solarStateCache.delete(solarStateCache.keys().next().value);
  }
  return solarStateCache.get(tick);
}
