import { createNDSPProfileContext } from '@/lib/ndspProfile';

export function createBuildAnchor(steamUser, lobbyMode = 'private') {
  const profile = createNDSPProfileContext(steamUser, lobbyMode);
  const now = new Date().toISOString();
  const anchorSeed = `${profile.steamId}:${profile.instanceScope}:${now}`;

  return {
    steamId: profile.steamId,
    persona: profile.personaName,
    scope: profile.instanceScope,
    anchorId: profile.buildAnchorKey,
    anchorLabel: profile.privateProfileLabel,
    anchorSeed,
    createdAt: now,
    namespace: profile.namespace,
    profileLedgerKey: profile.profileLedgerKey,
    description: profile.description,
  };
}
