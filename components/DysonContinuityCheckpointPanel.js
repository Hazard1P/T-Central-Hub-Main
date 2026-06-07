'use client';

import { useEffect, useMemo, useState } from 'react';

function StatusPill({ label, value, tone = 'cyan' }) {
  return (
    <span className={`checkpoint-pill ${tone}`}>
      <strong>{label}</strong>
      <em>{value}</em>
    </span>
  );
}

export default function DysonContinuityCheckpointPanel({ activeNode, steamUser }) {
  const [health, setHealth] = useState(null);
  const [policy, setPolicy] = useState(null);

  const identityScope = useMemo(() => {
    if (steamUser?.steamid) return `steam:${steamUser.steamid}`;
    return 'guest';
  }, [steamUser?.steamid]);

  useEffect(() => {
    let cancelled = false;
    const selectedSlug = activeNode?.serverSlug || activeNode?.slug || 'arma3-cth';

    Promise.all([
      fetch('/api/continuity/health', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)),
      fetch(`/api/playable-section?server=${encodeURIComponent(selectedSlug)}&scope=${encodeURIComponent(identityScope)}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([healthPayload, policyPayload]) => {
        if (cancelled) return;
        setHealth(healthPayload?.snapshot || healthPayload?.status || null);
        setPolicy(policyPayload?.policy || null);
      })
      .catch(() => {
        if (cancelled) return;
        setHealth(null);
        setPolicy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeNode?.serverSlug, activeNode?.slug, identityScope]);

  const selected = policy?.selected;
  const avatarRuntime = selected?.avatarRuntime;
  const ringHealthEntries = Object.entries(health?.ringHealth || {});
  const checkpointTypes = policy?.checkpoint?.checkpointTypes || [];

  return (
    <article className="dyson-checkpoint-panel content-card">
      <div className="dyson-checkpoint-head">
        <div>
          <p className="eyebrow">Dyson continuity checkpoint</p>
          <h3>Playable map anchor + encrypted handoff</h3>
        </div>
        <StatusPill
          label="Gate"
          value={health?.gateStatus || 'metering'}
          tone={health?.gateStatus === 'open' ? 'green' : 'gold'}
        />
      </div>

      <p className="muted">
        The game hub is anchored into the private map asset, then routed through a signed playable policy so Arma human avatars,
        human entities, VR observer sessions, and Steam quick-connect routes know what each server allows.
      </p>

      <div className="checkpoint-grid">
        <StatusPill label="Selected" value={selected?.title || 'Arma3 CTH'} />
        <StatusPill label="VR" value={policy?.mapAnchor?.vrReady ? 'Ready' : 'Guarded'} tone={policy?.mapAnchor?.vrReady ? 'green' : 'gold'} />
        <StatusPill label="Avatar" value={avatarRuntime?.enabled ? 'Human' : 'Route only'} tone={avatarRuntime?.enabled ? 'green' : 'cyan'} />
        <StatusPill label="Integrity" value={health?.crossSphereIntegrity ?? 'pending'} />
      </div>

      <div className="checkpoint-lists">
        <div>
          <strong>Continuity rings</strong>
          <ul>
            {ringHealthEntries.length ? ringHealthEntries.map(([sphereId, ring]) => (
              <li key={sphereId}>{sphereId}: {ring.status} v{ring.stateVersion}</li>
            )) : <li>Awaiting continuity meter.</li>}
          </ul>
        </div>
        <div>
          <strong>Checkpoint scope</strong>
          <ul>
            <li>{policy?.checkpoint?.scope || 'checkpoint:arma3-cth:guest'}</li>
            {checkpointTypes.map((checkpoint) => <li key={checkpoint}>{checkpoint}</li>)}
          </ul>
        </div>
      </div>

      <div className="checkpoint-security-strip">
        <span>{policy?.encryption?.payload || 'AES-256-GCM payload encryption'}</span>
        <span>{policy?.encryption?.sessionSignature || 'HMAC-SHA512 signatures'}</span>
      </div>
    </article>
  );
}
