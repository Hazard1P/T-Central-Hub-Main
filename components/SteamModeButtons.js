'use client';

import { getSteamAccessProfile, MULTI_PLAYER_INSTANCE, SINGLE_PLAYER_INSTANCE } from '@/lib/steamAccess';

export default function SteamModeButtons({ steamUser, lobbyMode = 'private', onChange }) {
  const profile = getSteamAccessProfile(steamUser, lobbyMode);

  return (
    <div className="steam-mode-buttons-wrap">
      <div className="steam-mode-intro">
        <span className="pilot-assist-kicker">Mode switch</span>
        <strong>Choose your universe</strong>
        <p className="muted">
          Private universe keeps you isolated. Shared hub places you with other players. Your build stays tied to your own identity in both modes.
        </p>
      </div>

      <button
        className={`button ${profile.lobbyMode === 'private' ? 'primary' : 'secondary'} steam-mode-button`}
        onClick={() => onChange?.('private')}
        title={SINGLE_PLAYER_INSTANCE}
      >
        Enter Private Universe
      </button>

      <button
        className={`button ${profile.lobbyMode === 'hub' ? 'primary' : 'secondary'} steam-mode-button`}
        onClick={() => onChange?.('hub')}
        disabled={!profile.steamLinked}
        title={profile.steamLinked ? MULTI_PLAYER_INSTANCE : 'Sign in with Steam to unlock the shared hub'}
      >
        Enter Shared Hub
      </button>
    </div>
  );
}
