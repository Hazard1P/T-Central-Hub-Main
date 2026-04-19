'use client';

import { getSteamAccessProfile, MULTI_PLAYER_INSTANCE, SINGLE_PLAYER_INSTANCE } from '@/lib/steamAccess';

export default function SteamAccessPanel({ steamUser, lobbyMode = 'private', onChange }) {
  const profile = getSteamAccessProfile(steamUser, lobbyMode);

  return (
    <div className="steam-access-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Pilot</span>
        <strong>{profile.personaName}</strong>
      </div>

      <div className="steam-access-grid">
        <div className="steam-access-item">
          <span>Name</span>
          <strong>{profile.personaName}</strong>
        </div>
        <div className="steam-access-item">
          <span>Identity</span>
          <strong>{profile.steamId || 'Guest'}</strong>
        </div>
        <div className="steam-access-item">
          <span>Mode</span>
          <strong>{profile.lobbyMode === 'hub' ? 'Shared Hub' : 'Private Universe'}</strong>
        </div>
        <div className="steam-access-item">
          <span>Session</span>
          <strong>{profile.instanceType}</strong>
        </div>
      </div>

      <div className="lobby-mode-actions">
        <button
          className={`button ${profile.lobbyMode === 'hub' ? 'primary' : 'secondary'}`}
          onClick={() => onChange?.('hub')}
          disabled={!profile.steamLinked}
        >
          {MULTI_PLAYER_INSTANCE}
        </button>
        <button
          className={`button ${profile.lobbyMode === 'private' ? 'primary' : 'secondary'}`}
          onClick={() => onChange?.('private')}
        >
          {SINGLE_PLAYER_INSTANCE}
        </button>
      </div>

      <p className="lobby-mode-note">
        {profile.steamLinked
          ? 'Steam is linked. You can enter either the shared hub or your private universe.'
          : 'Guest mode is active. Your private universe is always available, and linking Steam unlocks the shared hub.'}
      </p>
    </div>
  );
}
