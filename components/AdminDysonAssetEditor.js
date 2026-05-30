'use client';

import { useMemo, useState } from 'react';

const dysonProfiles = [
  { id: 'dyson.csis', label: 'CSIS defense sphere', ringOne: 100, ringTwo: 100, ringThree: 100 },
  { id: 'dyson.synaptics', label: 'Synaptics tri-ring sphere', ringOne: 88, ringTwo: 93, ringThree: 97 },
  { id: 'dyson.affiliates', label: 'Affiliates expansion sphere', ringOne: 64, ringTwo: 71, ringThree: 79 },
];

export default function AdminDysonAssetEditor({ adminContext }) {
  const [selectedId, setSelectedId] = useState(dysonProfiles[0].id);
  const selectedProfile = useMemo(
    () => dysonProfiles.find((profile) => profile.id === selectedId) || dysonProfiles[0],
    [selectedId]
  );

  return (
    <article className="content-card">
      <p className="eyebrow">Authorized Dyson asset editor</p>
      <h3>Server-approved admin workspace</h3>
      <p className="muted">
        This editor is only mounted after the server verifies the active account against the configured admin identity.
      </p>

      <div className="report-form">
        <label htmlFor="dyson-profile-select">
          <span>Dyson asset profile</span>
          <select
            id="dyson-profile-select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {dysonProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="arma-brief-grid" aria-label="Dyson ring integrity preview">
        <div className="content-card">
          <p className="eyebrow">Ring 1</p>
          <h3>{selectedProfile.ringOne}%</h3>
          <p className="muted">Collector and intelligence metering surface.</p>
        </div>
        <div className="content-card">
          <p className="eyebrow">Ring 2</p>
          <h3>{selectedProfile.ringTwo}%</h3>
          <p className="muted">Ingress, egress, and database routing surface.</p>
        </div>
        <div className="content-card">
          <p className="eyebrow">Ring 3</p>
          <h3>{selectedProfile.ringThree}%</h3>
          <p className="muted">Entropy regeneration and encryption surface.</p>
        </div>
      </div>

      <p className="muted">
        Signed in as {adminContext?.authContext?.displayName || 'admin'} through {adminContext?.authContext?.provider || 'unknown'}.
      </p>
    </article>
  );
}
