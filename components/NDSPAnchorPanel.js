'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBuildAnchor } from '@/lib/ndspAnchor';
import { buildDysonEncryptionState, createStellarProfile } from '@/lib/stellarPhysics';
import { createEpochAnchor } from '@/lib/epochDysonEngine';

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function NDSPAnchorPanel({ steamUser, lobbyMode = 'private', selected }) {
  const active = selected?.key === 'ss' || selected?.label === 'Synaptics.Systems Dyson Sphere';
  const anchor = useMemo(() => createBuildAnchor(steamUser, lobbyMode), [steamUser, lobbyMode]);
  const epochAnchor = useMemo(() => createEpochAnchor({ now: Date.now(), dysonKey: 'ss' }), []);
  const stellarProfile = useMemo(() => createStellarProfile({ seed: `${anchor.anchorSeed}:synaptics-dyson`, classHint: 'F8V', label: 'Synaptics.Systems Core Star' }), [anchor.anchorSeed]);
  const dysonState = useMemo(() => buildDysonEncryptionState({ epochAnchor, stellarProfile, seed: anchor.anchorSeed }), [epochAnchor, stellarProfile, anchor.anchorSeed]);
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
        <strong>Synaptics.Systems Dyson sphere</strong>
      </div>

      <p className="muted">
        This Dyson sphere anchors into NDSP and couples a tri-ring shell to its stellar core. Ring I collects the star, Ring II stabilizes habitat flow,
        and Ring III keeps the encryption lattice discrete from player-spammable surfaces.
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
        <div className="ndsp-anchor-item">
          <span>Stellar class</span>
          <strong>{stellarProfile.spectralClass}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Star temperature</span>
          <strong>{stellarProfile.temperatureK.toLocaleString()} K</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Ring I</span>
          <strong>{dysonState.ringOneLabel}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Ring II</span>
          <strong>{dysonState.ringTwoLabel}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Ring III</span>
          <strong>{dysonState.ringThreeLabel}</strong>
        </div>
        <div className="ndsp-anchor-item">
          <span>Encryption</span>
          <strong>{Math.round(dysonState.encryptionStrength * 100)}%</strong>
        </div>
      </div>

      <div className="focus-meta">
        <span>{anchor.anchorLabel}</span>
        <span>{epochAnchor.unix}</span>
      </div>
    </div>
  );
}
