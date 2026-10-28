import { getUniverseSolarState } from "./universeFlight.js";
import { sweepSphere } from "./physics/collisions.js";
import { SHIP_CONTACT_RADIUS } from "./physics/mechanics.js";

// The moving spherical boundary contains every Earth spawn and repair berth,
// while leaving the working asteroid field outside protected space.
export const EARTH_SAFE_ZONE_RADII = 6;
export function getEarthSafeZone(utcMs = Date.now()) {
  const earth = getUniverseSolarState(utcMs).find(
    (body) => body.id === "earth",
  );
  return {
    id: "earth-safe-zone",
    position: earth.position,
    radius: earth.radius * EARTH_SAFE_ZONE_RADII,
  };
}
export function isInEarthSafeZone(
  position,
  utcMs = Date.now(),
  zone = getEarthSafeZone(utcMs),
) {
  return (
    Array.isArray(position) &&
    position.length === 3 &&
    position.every(Number.isFinite) &&
    Math.hypot(...position.map((v, i) => v - zone.position[i])) <=
      zone.radius + SHIP_CONTACT_RADIUS
  );
}
export function earthSafeZoneContact(
  from,
  to,
  utcMs = Date.now(),
  zone = getEarthSafeZone(utcMs),
) {
  return sweepSphere(
    from,
    to,
    zone.position,
    zone.radius + SHIP_CONTACT_RADIUS,
  );
}
