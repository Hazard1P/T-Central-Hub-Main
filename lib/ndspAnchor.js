import crypto from 'node:crypto';
import { createNDSPProfileContext } from '@/lib/ndspProfile';
import { getUnixEpochSeconds } from '@/lib/epochDysonEngine';

function deriveDeterministicAnchorSeed({ accountId, epochUnix, instanceScope }) {
  const derivation = `${accountId}:${epochUnix}:${instanceScope}`;
  const digest = crypto.createHash('sha256').update(derivation, 'utf8').digest('hex').slice(0, 24);
  return `ndsp_anchor_${digest}`;
}

export function createBuildAnchor(steamUser, lobbyMode = 'private', { accountId = null, epochUnix = null } = {}) {
  const profile = createNDSPProfileContext(steamUser, lobbyMode);
  const createdAt = new Date().toISOString();
  const resolvedEpochUnix = Number.isFinite(Number(epochUnix)) ? Number(epochUnix) : getUnixEpochSeconds();
  const resolvedAccountId = String(accountId || profile.steamId || 'guest-server');
  const anchorSeed = deriveDeterministicAnchorSeed({
    accountId: resolvedAccountId,
    epochUnix: resolvedEpochUnix,
    instanceScope: profile.instanceScope,
  });

  return {
    steamId: profile.steamId,
    persona: profile.personaName,
    scope: profile.instanceScope,
    anchorId: profile.buildAnchorKey,
    anchorLabel: profile.privateProfileLabel,
    anchorSeed,
    epochUnix: resolvedEpochUnix,
    accountId: resolvedAccountId,
    createdAt,
    namespace: profile.namespace,
    profileLedgerKey: profile.profileLedgerKey,
    description: profile.description,
  };
}
