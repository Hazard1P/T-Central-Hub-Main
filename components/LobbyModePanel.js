'use client';

export default function LobbyModePanel({ lobbyMode, onChange, steamUser, universe = null }) {
  return (
    <div className="lobby-mode-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Game mode</span>
        <strong>{lobbyMode === 'hub' ? 'Shared Hub' : 'Private Universe'}</strong>
      </div>

      <p className="lobby-mode-copy">
        {lobbyMode === 'hub'
          ? 'Join the shared universe to meet other pilots, roam the multiverse, and take on live objectives together under a discrepant shared star system that helps hub synchronization.'
          : 'Stay in your own isolated universe with your private map, ship, blackhole anchor, and sealed 9-planet epoch system.'}
      </p>

      <div className="lobby-mode-actions">
        <button
          className={`button ${lobbyMode === 'hub' ? 'primary' : 'secondary'}`}
          onClick={() => onChange?.('hub')}
        >
          Shared hub
        </button>
        <button
          className={`button ${lobbyMode === 'private' ? 'primary' : 'secondary'}`}
          onClick={() => onChange?.('private')}
        >
          Private universe
        </button>
      </div>

      <div className="lobby-mode-note">
        {steamUser?.steamid
          ? <span>Steam linked: your private universe stays tied to your account.</span>
          : <span>Guest mode: your private universe stays tied to your local sealed identity.</span>}
        {universe?.privacy?.observanceScope ? <span>Privacy: {universe.privacy.observanceScope}</span> : null}
      </div>
    </div>
  );
}
