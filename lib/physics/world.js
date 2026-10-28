import {
  getFlightObstacles,
  getFlightSolids,
  getUniverseSolarState,
} from "../universeFlight.js";
import {
  solarMu,
  muFromKilograms,
  GAME_GRAVITY_CONSTANT,
  vector,
} from "./mechanics.js";
import { getEarthPortColliders } from "../earthLanding.js";
// Standard gravitational parameters (km³/s²), not generated game mass values.
export const SOLAR_GM = Object.freeze({
  sun: 132712440041.9394,
  mercury: 22031.86855,
  venus: 324858.592,
  earth: 398600.4418,
  moon: 4902.800066,
  mars: 42828.375214,
  jupiter: 126686534,
  saturn: 37931207.8,
  uranus: 5793951.3,
  neptune: 6835099.97,
  pluto: 869.6138178,
});
let cached;
export function createPhysicsFrame({
  utcMs = Date.now(),
  gravitySources = [],
  extraColliders = [],
} = {}) {
  if (!Number.isFinite(utcMs))
    throw new TypeError("Physics requires a finite UTC epoch.");
  if (cached?.utcMs !== utcMs) {
    const solar = getUniverseSolarState(utcMs);
    cached = {
      utcMs,
      obstacles: getFlightObstacles(utcMs),
      bodies: [...getFlightSolids(utcMs), ...getEarthPortColliders(utcMs)],
      solarSources: solar.map((body) => ({
        key: "solar-" + body.id,
        kind: body.type === "star" ? "solar" : body.type,
        position: body.position,
        mu: solarMu(SOLAR_GM[body.id]),
        physical: true,
        softening: body.radius,
        radius: body.radius,
      })),
    };
  }
  const cosmic = gravitySources
    .filter(
      (source) =>
        source &&
        typeof source === "object" &&
        source.key !== "solar_system" &&
        !(source.key?.startsWith("solar-") && SOLAR_GM[source.key.slice(6)]),
    )
    .map((source) => ({
      ...source,
      position: vector(source.position),
      mu:
        Number.isFinite(source.mu) && source.mu >= 0
          ? source.mu
          : Number.isFinite(source.massKg) && source.massKg > 0
            ? muFromKilograms(source.massKg)
            : source.stellarProfile?.massSolar > 0
              ? solarMu(SOLAR_GM.sun) * source.stellarProfile.massSolar
              : GAME_GRAVITY_CONSTANT *
                Math.max(0, Math.min(1e6, Number(source.mass) || 0)),
      physical: Boolean(
        source.physical ||
        (Number.isFinite(source.massKg) && source.massKg > 0) ||
        source.stellarProfile?.massSolar > 0,
      ),
    }));
  const privateBodies = gravitySources.filter(
    (source) =>
      source?.privateOnly &&
      Array.isArray(source.position) &&
      Number.isFinite(source.radius) &&
      source.radius > 0,
  );
  const extras = [...privateBodies, ...extraColliders];
  const extraSolids = extras
    .map((body) => ({
      ...body,
      position: vector(body.position),
      collisionRadius:
        body.collisionRadius ?? (body.solidRadius || body.radius) * 1.02 + 2,
    }))
    .filter(
      (body) =>
        body.collisionRadius > 0 && Number.isFinite(body.collisionRadius),
    );
  return {
    ...cached,
    sources: [...cosmic, ...cached.solarSources],
    bodies: [...cached.bodies, ...extraSolids],
    obstacles: [...cached.obstacles, ...extras],
  };
}
