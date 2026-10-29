import { stepFrame } from "./stepFrame.js";

// Time is capped separately by the flight loop. Retain enough small samples for
// high-refresh displays without silently dropping unacknowledged movement.
export const MAX_PREDICTION_FRAMES = 512;
export function replayFlightInputs({
  frames = [],
  authoritativePosition = [0, 0, 18],
  authoritativeVelocity = [0, 0, 0],
  simulationSeed = "tcentral-main",
  gravitySources = [],
  utcMs = Date.now(),
} = {}) {
  let result = {
      position: authoritativePosition,
      velocity: authoritativeVelocity,
    },
    elapsed = 0;
  for (const frame of frames.slice(0, MAX_PREDICTION_FRAMES)) {
    if (!Number.isFinite(frame?.dt) || frame.dt <= 0 || frame.dt > 0.2)
      continue;
    elapsed += frame.dt;
    result = stepFrame({
      ...result,
      controlVector: frame.controlVector,
      dt: frame.dt,
      utcMs: utcMs + elapsed * 1000,
      worldSeed: simulationSeed,
      gravitySources,
      profile: "multiplayer",
    });
  }
  return result;
}
