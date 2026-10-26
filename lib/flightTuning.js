import { MAX_FLIGHT_SPEED } from "./universeSpace.js";

// One balanced flight setup for authoritative flight, prediction and cruise.
export const FLIGHT_TUNING = Object.freeze({
  thrust: 12,
  localSpeed: 20,
  maxControl: 1.75,
  maxAssist: 200_000,
  governorSeconds: 0.65,
  brakingSeconds: 0.6,
  controllerResponse: 1.6,
  cruiseFraction: 0.85,
  approachMargin: 0.65,
  brakeLeadSeconds: 1.2,
});

export function flightEnvelope(clearance, radius = 0, physicalSolar = false) {
  const gap = Math.max(0, clearance);
  const precisionZone = physicalSolar
    ? Math.max(160, Math.min(340, radius * 2))
    : 60;
  const distance = Math.max(0, gap - precisionZone);
  const scale = Math.min(
    FLIGHT_TUNING.maxAssist,
    1 + (distance / (physicalSolar ? 65 : 45)) ** 1.35,
  );
  // Leave braking room as assistance changes with clearance. This is a game
  // travel envelope; vacuum coasting still applies away from its boundary.
  const stoppingSpeed = Math.sqrt(
    FLIGHT_TUNING.localSpeed ** 2 +
      2 *
        FLIGHT_TUNING.thrust *
        scale *
        distance *
        FLIGHT_TUNING.approachMargin ** 2,
  );
  return {
    scale,
    clearance: gap,
    speedLimit: Math.min(
      MAX_FLIGHT_SPEED,
      FLIGHT_TUNING.localSpeed * scale,
      stoppingSpeed,
    ),
    mode: scale <= 2 ? "Precision" : scale < 1000 ? "Transit" : "Deep space",
  };
}

export function governedThrust(velocity, thrust, speedLimit, availableThrust) {
  const speed = Math.hypot(...velocity);
  if (speed < 1e-9) return thrust;
  const direction = velocity.map((v) => v / speed);
  const along = thrust.reduce((sum, v, i) => sum + v * direction[i], 0);
  const normalBudget = availableThrust * FLIGHT_TUNING.maxControl;
  // Brakes retain enough authority when leaving fast travel; their force must
  // not collapse to the local manoeuvring budget while the ship is still fast.
  const brakeBudget = Math.min(
    FLIGHT_TUNING.thrust * FLIGHT_TUNING.maxAssist * FLIGHT_TUNING.maxControl,
    Math.max(normalBudget, speed / FLIGHT_TUNING.brakingSeconds),
  );
  const commanded = along < 0 ? (along * brakeBudget) / normalBudget : along;
  const headroom = (speedLimit - speed) / FLIGHT_TUNING.governorSeconds;
  const radial =
    speed > speedLimit
      ? Math.max(-brakeBudget, Math.min(commanded, headroom))
      : Math.min(commanded, Math.max(0, headroom));
  const next = thrust.map((v, i) => v + (radial - along) * direction[i]);
  const magnitude = Math.hypot(...next),
    cap = brakeBudget;
  return magnitude > cap ? next.map((v) => (v * cap) / magnitude) : next;
}
