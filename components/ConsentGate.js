'use client';

import Link from 'next/link';
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
        <div className="consent-gate__check">
          <input type="checkbox" checked={terms} aria-describedby="terms-consent-label" onChange={(e) => setTerms(e.target.checked)} />
          <span id="terms-consent-label">
            I accept the{' '}
            <Link className="consent-gate__link" href="/terms-and-conditions" aria-label="Read Terms & Conditions" onClick={(e) => e.stopPropagation()}>
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link className="consent-gate__link" href="/eula" aria-label="Read EULA" onClick={(e) => e.stopPropagation()}>
              EULA
            </Link>.
          </span>
        </div>
        <div className="consent-gate__check">
          <input type="checkbox" checked={privacy} aria-describedby="privacy-consent-label" onChange={(e) => setPrivacy(e.target.checked)} />
          <span id="privacy-consent-label">
            I accept the{' '}
            <Link className="consent-gate__link" href="/privacy-policy" aria-label="Read Privacy Policy" onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </Link>{' '}
            and understand the{' '}
            <Link className="consent-gate__link" href="/multiplayer-policy" aria-label="Read multiplayer policy" onClick={(e) => e.stopPropagation()}>
              multiplayer policy
            </Link>.
          </span>
        </div>
        <button type="button" className="consent-gate__action" disabled={!ready} onClick={handleAccept}>
          Enter T-Central
        </button>
      </div>
    </div>
  );
}
