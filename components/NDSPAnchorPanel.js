'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBuildAnchor } from '@/lib/ndspAnchor';

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function NDSPAnchorPanel({ steamUser, lobbyMode = 'private', selected }) {
  const active = selected?.key === 'ss' || selected?.label === 'Synaptic Systems';
  const anchor = useMemo(() => createBuildAnchor(steamUser, lobbyMode), [steamUser, lobbyMode]);
  const [buildHash, setBuildHash] = useState('');

  useEffect(() => {
    let live = true;
    sha256Hex(anchor.anchorSeed).then((hash) => {
      if (!live) return;
      setBuildHash(hash.slice(0, 20));
    });
    return () => { live = false; };
  }, [anchor.anchorSeed]);

  if (!active) return null;

  return (
    <div className="ndsp-anchor-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">NDSP anchor</span>
        <strong>Synaptic Systems Dyson sphere</strong>
      </div>

      <p className="muted">
        This Dyson sphere anchors into NDSP and keeps the Steam-linked build profile discrete from other players by scoping the build anchor, namespace, and ledger path to the current instance.
      </p>

      <div className="ndsp-anchor-grid">
        <div className="ndsp-anchor-item">
          <span>Build anchor</span>
          <strong>{anchor.anchorId}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Build hash</span>
          <strong>{buildHash || 'Generating…'}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Scope</span>
          <strong>{anchor.scope}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Protocol target</span>
          <strong>NDSP</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Namespace</span>
          <strong>{anchor.namespace}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Ledger key</span>
          <strong>{anchor.profileLedgerKey}</strong>
        </div>
      </div>

      <div className="focus-meta">
        <span>{anchor.anchorLabel}</span>
        <span>{anchor.createdAt}</span>
      </div>
    </div>
  );
}
