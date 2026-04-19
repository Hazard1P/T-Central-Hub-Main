'use client';

export default function AccountProgressPanel({ profile = null, lobbyMode = 'private' }) {
  const progression = profile?.progression;
  const stats = profile?.progress || {};
  const width = Math.max(6, Math.round((progression?.progressToNext || 0) * 100));

  return (
    <section className="content-card stable-card stable-card-layer account-progress-panel">
      <p className="eyebrow">Pilot progression</p>
      <h3>{profile?.identity?.displayName || 'Guest Pilot'}</h3>
      <p className="muted">
        Persistent account state stays tied to the active identity while carrying route, mining, and settlement progress forward into future builds.
      </p>

      <div className="account-progress-grid">
        <div>
          <span>Rank</span>
          <strong>{progression?.title || 'Cadet'}</strong>
        </div>
        <div>
          <span>Level</span>
          <strong>{progression?.level || 1}</strong>
        </div>
        <div>
          <span>XP</span>
          <strong>{progression?.xp || 0}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{lobbyMode === 'hub' ? 'Shared Hub' : 'Private Universe'}</strong>
        </div>
      </div>

      <div className="account-progress-bar">
        <span style={{ width: `${width}%` }} />
      </div>

      <div className="stable-chip-row">
        <span>{stats.visitedNodes?.length || 0} anchors visited</span>
        <span>{stats.routeTrips || 0} route trips</span>
        <span>{stats.entropyMined || 0} entropy mined</span>
        <span>{stats.credits?.toFixed ? stats.credits.toFixed(2) : Number(stats.credits || 0).toFixed(2)} E_s</span>
      </div>
    </section>
  );
}
