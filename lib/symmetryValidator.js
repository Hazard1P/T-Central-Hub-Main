function sanitizeVector(input, fallback = [0, 0, 0]) {
  if (!Array.isArray(input) || input.length < 3) return fallback;
  return [Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0];
}

function vectorDeltaMagnitude(a, b) {
  return Math.sqrt(((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2));
}

export function validateSimulationSymmetry(events = [], thresholds = { positionDelta: 0.75, velocityDelta: 1.25 }) {
  const ordered = [...events].sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());
  const drift = [];
  let maxPositionDelta = 0;
  let maxVelocityDelta = 0;

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous.player_id !== current.player_id) continue;

    const previousOutput = previous.physics_output || {};
    const currentInput = current.physics_input || {};
    const positionDelta = vectorDeltaMagnitude(
      sanitizeVector(previousOutput.position, [0, 0, 0]),
      sanitizeVector(currentInput.position, [0, 0, 0])
    );
    const velocityDelta = vectorDeltaMagnitude(
      sanitizeVector(previousOutput.velocity, [0, 0, 0]),
      sanitizeVector(currentInput.velocity, [0, 0, 0])
    );

    maxPositionDelta = Math.max(maxPositionDelta, positionDelta);
    maxVelocityDelta = Math.max(maxVelocityDelta, velocityDelta);

    if (positionDelta > thresholds.positionDelta || velocityDelta > thresholds.velocityDelta) {
      drift.push({
        playerId: current.player_id,
        previousEventId: previous.event_id,
        currentEventId: current.event_id,
        timestamp: current.event_timestamp,
        positionDelta: Number(positionDelta.toFixed(6)),
        velocityDelta: Number(velocityDelta.toFixed(6)),
      });
    }
  }

  return {
    checked: ordered.length,
    drift,
    summary: {
      maxPositionDelta: Number(maxPositionDelta.toFixed(6)),
      maxVelocityDelta: Number(maxVelocityDelta.toFixed(6)),
      driftCount: drift.length,
    },
  };
}
