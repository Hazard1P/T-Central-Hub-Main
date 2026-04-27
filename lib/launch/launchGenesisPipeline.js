import crypto from 'node:crypto';
import { createEpochAnchor } from '@/lib/epochDysonEngine';
import { createBuildAnchor } from '@/lib/ndspAnchor';
import { resolveStarSingularity } from '@/lib/singularityEngine';
import { migrateDysonContinuityState, DYSON_CONTINUITY_SCHEMA_VERSION } from '@/lib/dysonContinuity';

function hashToken(parts = []) {
  return crypto.createHash('sha256').update(parts.join(':'), 'utf8').digest('hex').slice(0, 24);
}

export function runLaunchGenesisPipeline({ authContext, lobbyMode = 'private' } = {}) {
  const epoch = createEpochAnchor();
  const accountId = authContext?.accountId || 'guest-server';

  const genesisId = `genesis_${hashToken([accountId, String(epoch.unix), 'ndsp'])}`;
  const handshake = {
    ok: Boolean(accountId && epoch.unix),
    stage: 'NDSP_genesis_handshake',
    genesisId,
    accountId,
    epochUnix: epoch.unix,
    attestedAt: new Date().toISOString(),
  };

  if (!handshake.ok) {
    return {
      ok: false,
      failedStage: handshake.stage,
      reason: 'NDSP_GENESIS_HANDSHAKE_FAILED',
      stages: { handshake },
    };
  }

  const starAnchorBuild = createBuildAnchor(authContext?.steamUser, lobbyMode, {
    accountId,
    epochUnix: epoch.unix,
  });

  const singularity = resolveStarSingularity({
    gravity: 12,
    horizonFactor: Math.abs((epoch.dysonAlignment || 0) - (epoch.siderealDrift || 0)),
    coherencePercent: 64,
    entropyPercent: 48,
    speed: 6,
    epochPhase: epoch.phase,
    nearestKey: 'solar_system',
  });

  const singularityStateId = `singularity_${hashToken([starAnchorBuild.anchorSeed, String(singularity.resolvedWindow), 'state'])}`;
  const singularityState = {
    ok: Boolean(singularity.resolved),
    stage: 'Singularity_State_initialization',
    singularityStateId,
    diagnostics: singularity,
  };

  if (!singularityState.ok) {
    return {
      ok: false,
      failedStage: singularityState.stage,
      reason: 'SINGULARITY_STATE_INITIALIZATION_FAILED',
      stages: { handshake, starAnchorBuild, singularityState },
    };
  }

  const continuityState = migrateDysonContinuityState({}, {
    targetRelease: 'launch-genesis',
    now: handshake.attestedAt,
  });
  const continuityAttestation = {
    ok: continuityState.rollbackSafe && continuityState.schemaVersion === DYSON_CONTINUITY_SCHEMA_VERSION,
    stage: 'continuity_gate_pass',
    schemaVersion: continuityState.schemaVersion,
    rollbackSafe: continuityState.rollbackSafe,
    attestationId: `continuity_${hashToken([genesisId, String(continuityState.schemaVersion), continuityState.release])}`,
  };

  if (!continuityAttestation.ok) {
    return {
      ok: false,
      failedStage: continuityAttestation.stage,
      reason: 'CONTINUITY_GATE_FAILED',
      stages: {
        handshake,
        starAnchorBuild,
        singularityState,
        continuityAttestation,
      },
    };
  }

  return {
    ok: true,
    epoch,
    stages: {
      handshake,
      starAnchorBuild,
      singularityState,
      continuityAttestation,
    },
    launchRecord: {
      genesisId,
      starAnchorBuild,
      singularityStateId,
      continuityAttestation,
      createdAt: handshake.attestedAt,
    },
  };
}
