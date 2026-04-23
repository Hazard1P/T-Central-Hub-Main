function sanitizeVector(input, fallback = [0, 0, 0]) {
  if (!Array.isArray(input) || input.length < 3) return fallback;
  return [Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0];
}

function vectorDeltaMagnitude(a, b) {
  return Math.sqrt(((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2));
}

function toFiniteNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function classifyConfidence(coverage, strictMode = false) {
  if (coverage >= 0.95) return 'high';
  if (coverage >= 0.8) return strictMode ? 'low' : 'medium';
  if (coverage >= 0.6) return 'medium';
  return 'low';
}

function buildContinuityReport(events = []) {
  const perPlayer = new Map();
  for (const event of events) {
    const playerId = String(event?.player_id || '');
    if (!playerId) continue;
    const list = perPlayer.get(playerId) || [];
    list.push(event);
    perPlayer.set(playerId, list);
  }

  let expectedTransitions = 0;
  let completeTransitions = 0;
  const frameGaps = [];

  for (const [playerId, playerEvents] of perPlayer.entries()) {
    const ordered = [...playerEvents].sort((a, b) => {
      const tickA = toFiniteNumber(a?.tick, Number(new Date(a?.event_timestamp || 0)));
      const tickB = toFiniteNumber(b?.tick, Number(new Date(b?.event_timestamp || 0)));
      return tickA - tickB;
    });

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const previousFrame = toFiniteNumber(previous?.frame_index);
      const currentFrame = toFiniteNumber(current?.frame_index);
      if (previousFrame === null || currentFrame === null) continue;

      expectedTransitions += 1;
      const frameStep = currentFrame - previousFrame;
      if (frameStep === 1) {
        completeTransitions += 1;
        continue;
      }

      frameGaps.push({
        playerId,
        previousEventId: previous?.event_id || null,
        currentEventId: current?.event_id || null,
        previousFrameIndex: previousFrame,
        currentFrameIndex: currentFrame,
        missingFrames: frameStep > 1 ? frameStep - 1 : 0,
      });
    }
  }

  const coverage = expectedTransitions > 0 ? completeTransitions / expectedTransitions : 1;
  return {
    expectedTransitions,
    completeTransitions,
    gapCount: frameGaps.length,
    coverage: Number(coverage.toFixed(4)),
    frameGaps,
  };
}

export function validateSimulationSymmetry(
  events = [],
  {
    thresholds = { positionDelta: 0.75, velocityDelta: 1.25 },
    strictMode = false,
    minCoverage = 0.8,
  } = {}
) {
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

  const continuity = buildContinuityReport(ordered);
  const meetsCoverage = continuity.coverage >= minCoverage;
  const confidence = classifyConfidence(continuity.coverage, strictMode);
  const coverageFailed = strictMode && !meetsCoverage;

  return {
    checked: ordered.length,
    drift,
    continuity,
    confidence,
    thresholds: {
      ...thresholds,
      minCoverage: Number(minCoverage),
      strictMode: Boolean(strictMode),
    },
    summary: {
      maxPositionDelta: Number(maxPositionDelta.toFixed(6)),
      maxVelocityDelta: Number(maxVelocityDelta.toFixed(6)),
      driftCount: drift.length,
      gapCount: continuity.gapCount,
      coverage: continuity.coverage,
      confidence,
      strictCoverageFailed: coverageFailed,
      meetsCoverage,
    },
  };
}
