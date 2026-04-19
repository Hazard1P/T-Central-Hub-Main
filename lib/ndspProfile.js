export function getNDSPInstanceScope(lobbyMode = 'private') {
  return lobbyMode === 'hub' ? 'multi_player_instance' : 'single_player_instance';
}

export function createNDSPProfileContext(steamUser, lobbyMode = 'private') {
  const steamId = steamUser?.steamid || 'guest';
  const personaName = steamUser?.personaname || 'Guest';
  const instanceScope = getNDSPInstanceScope(lobbyMode);

  return {
    steamId,
    personaName,
    lobbyMode,
    instanceScope,
    namespace: `ndsp:${steamId}:${instanceScope}`,
    buildAnchorKey: `ndsp-anchor:${steamId}:${instanceScope}`,
    profileLedgerKey: `ndsp-ledger:${steamId}:${instanceScope}`,
    privateProfileLabel: `${personaName} ${instanceScope} profile`,
    description:
      'NDSP keeps the linked player profile discrete from other users by scoping the build anchor, ledger path, and profile namespace to the Steam-linked account and current instance type.',
  };
}
