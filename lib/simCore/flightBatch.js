import { stepFrame } from './stepFrame.js';

// Each rendered input is acknowledged once, with a server-time budget to bound fast-forward attempts.
export function advanceFlightBatch({ position, velocity, snapshot = {}, frameIndex = 0, elapsed = 0, worldSeed, gravitySources }) {
  let next = { position, velocity };
  let acknowledged = frameIndex;
  let budget = Math.max(0, Math.min(Number(elapsed) || 0, .6));
  if (Array.isArray(snapshot.inputs)) {
    const inputs = snapshot.inputs.slice(0, 72).filter((frame) => Number.isSafeInteger(frame?.frameIndex) && frame.frameIndex > frameIndex).sort((a, b) => a.frameIndex - b.frameIndex);
    for (const frame of inputs) {
      if (frame.frameIndex <= acknowledged) continue;
      if (!Number.isFinite(frame.dt) || frame.dt < 1 / 240 || frame.dt > .05) break;
      if (frame.dt > budget + .00001) break;
      next = stepFrame({ ...next, controlVector: frame.controlVector, dt: frame.dt, worldSeed, gravitySources, profile: 'multiplayer' });
      budget -= frame.dt;
      acknowledged = frame.frameIndex;
    }
  } else {
    // Older clients send one control vector. Integrate elapsed time in small steps.
    if (budget < 1 / 240) return { ...next, frameIndex: acknowledged };
    let remaining = Math.min(budget, .45);
    while (remaining >= 1 / 240) {
      const dt = Math.min(remaining, 1 / 30);
      next = stepFrame({ ...next, controlVector: snapshot.controlVector, dt, worldSeed, gravitySources, profile: 'multiplayer' });
      remaining -= dt;
    }
    acknowledged = Number.isSafeInteger(snapshot.frameIndex) ? Math.max(frameIndex, snapshot.frameIndex) : frameIndex + 1;
  }
  return { ...next, frameIndex: acknowledged };
}
