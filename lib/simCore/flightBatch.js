import { stepFrame } from "./stepFrame.js";
import { MAX_PREDICTION_FRAMES } from "./prediction.js";

// Accept time only from the service budget, never from a submitted epoch.
export function advanceFlightBatch({
  position,
  velocity,
  snapshot = {},
  frameIndex = 0,
  elapsed = 0,
  worldSeed,
  gravitySources,
  utcMs = Date.now(),
}) {
  let budget = Math.max(0, Math.min(Number(elapsed) || 0, 0.6)),
    acknowledged = frameIndex;
  const accepted = [];
  if (Array.isArray(snapshot.inputs)) {
    const inputs = snapshot.inputs
      .slice(0, MAX_PREDICTION_FRAMES)
      .filter(
        (frame) =>
          Number.isSafeInteger(frame?.frameIndex) &&
          frame.frameIndex > frameIndex,
      )
      .sort((a, b) => a.frameIndex - b.frameIndex);
    for (const frame of inputs) {
      if (frame.frameIndex <= acknowledged) continue;
      if (budget <= 0) break;
      if (
        !Number.isFinite(frame.dt) ||
        frame.dt < 1e-6 ||
        frame.dt > 0.05 ||
        frame.dt > budget + Math.min(1e-9, frame.dt * 1e-6)
      )
        break;
      accepted.push(frame);
      budget -= frame.dt;
      acknowledged = frame.frameIndex;
    }
  } else {
    let remaining = Math.min(budget, 0.45);
    while (remaining >= 1e-6) {
      const dt = Math.min(remaining, 1 / 30);
      accepted.push({ dt, controlVector: snapshot.controlVector });
      remaining -= dt;
    }
    if (accepted.length)
      acknowledged = Number.isSafeInteger(snapshot.frameIndex)
        ? Math.max(frameIndex, snapshot.frameIndex)
        : frameIndex + 1;
  }
  let next = { position, velocity },
    remaining = accepted.reduce((sum, frame) => sum + frame.dt, 0);
  for (const frame of accepted) {
    remaining -= frame.dt;
    next = stepFrame({
      ...next,
      controlVector: frame.controlVector,
      dt: frame.dt,
      worldSeed,
      gravitySources,
      utcMs: utcMs - remaining * 1000,
      profile: "multiplayer",
    });
  }
  return { ...next, frameIndex: acknowledged };
}
