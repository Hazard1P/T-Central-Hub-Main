import crypto from 'node:crypto';
import { createNDSPProfileContext } from '@/lib/ndspProfile';
import { getUnixEpochSeconds } from '@/lib/epochDysonEngine';

function deriveDeterministicAnchorSeed({ accountKey, epochUnix, instanceScope }) {
  const derivation = `${accountKey}:${epochUnix}:${instanceScope}`;
  const digest = crypto.createHash('sha256').update(derivation, 'utf8').digest('hex').slice(0, 24);
  return `ndsp_anchor_${digest}`;
}

export function createBuildAnchor(authContext = null, lobbyMode = 'private', { accountId = null, accountKey = null, epochUnix = null } = {}) {
  const profile = createNDSPProfileContext(authContext, lobbyMode);
  const createdAt = new Date().toISOString();
  const resolvedEpochUnix = Number.isFinite(Number(epochUnix)) ? Number(epochUnix) : getUnixEpochSeconds();
  const resolvedAccountKey = String(accountKey || profile.accountKey || accountId || 'guest:guest-server');
  const resolvedAccountId = String(profile.accountId || resolvedAccountKey);
  const anchorSeed = deriveDeterministicAnchorSeed({
    accountKey: resolvedAccountKey,
    epochUnix: resolvedEpochUnix,
    instanceScope: profile.instanceScope,
  });

  return {
    steamId: profile.steamId,
    provider: profile.provider,
    accountKey: resolvedAccountKey,
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
