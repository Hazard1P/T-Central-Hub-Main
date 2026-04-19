export const MULTI_PLAYER_INSTANCE = '<[Multi_Player_Instance]>';
export const SINGLE_PLAYER_INSTANCE = '<[Single_Player_Instance]>';

export function getSteamAccessProfile(user, preferredLobbyMode = 'private') {
  const steamId = user?.steamid || '';
  const personaName = user?.personaname || 'Guest';
  const accountLabel = steamId ? `SteamID ${steamId}` : 'No Steam account linked';
  const lobbyMode = steamId ? (preferredLobbyMode || 'private') : 'private';
  const instanceType = lobbyMode === 'hub' ? MULTI_PLAYER_INSTANCE : SINGLE_PLAYER_INSTANCE;

  return {
    steamLinked: Boolean(steamId),
    steamId,
    personaName,
    accountLabel,
    lobbyMode,
    instanceType,
  };
}
