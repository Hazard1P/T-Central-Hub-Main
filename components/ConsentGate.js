'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tcentral_consent_v1';

export default function ConsentGate() {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.accepted) {
          setAccepted(true);
        }
      }
    } catch {}
  }, []);

  const ready = useMemo(() => terms && privacy, [terms, privacy]);

  const handleAccept = () => {
    if (!ready) return;
    const payload = {
      accepted: true,
      acceptedAt: Date.now(),
      version: 1,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setAccepted(true);
  };

  if (!mounted || accepted) return null;

  return (
    <div className="consent-gate" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="consent-gate__panel">
        <p className="eyebrow">System initialization</p>
        <h2 id="consent-title">Initialize system access</h2>
        <p className="muted">
          Before entering T-Central, review and accept the platform rules for privacy, shared-hub conduct, and in-game route systems.
        </p>
        <label className="consent-gate__check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>I accept the Terms & Conditions and EULA.</span>
        </label>
        <label className="consent-gate__check">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>I accept the Privacy Policy and understand the multiplayer policy.</span>
        </label>
        <button type="button" className="consent-gate__action" disabled={!ready} onClick={handleAccept}>
          Enter T-Central
        </button>
      </div>
    </div>
  );
}
