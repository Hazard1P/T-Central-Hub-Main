'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { legalDocuments } from '@/lib/legalContent';

const STORAGE_KEY = 'tcentral_consent_v1';

const consentDocuments = [
  { key: 'terms', label: 'Terms & Conditions' },
  { key: 'eula', label: 'EULA' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'multiplayer-policy', label: 'multiplayer policy' },
];

function LegalDocumentViewer({ documentKey, onClose }) {
  const document = legalDocuments[documentKey];

  if (!document) return null;

  return (
    <section className="consent-gate__document" aria-labelledby="consent-document-title">
      <div className="consent-gate__document-header">
        <div>
          <p className="eyebrow">{document.eyebrow}</p>
          <h3 id="consent-document-title">{document.title}</h3>
        </div>
        <button type="button" className="consent-gate__document-close" onClick={onClose} aria-label={`Close ${document.title} viewer`}>
          Back
        </button>
      </div>
      <div className="consent-gate__document-body" tabIndex="0">
        <p className="muted">{document.summary}</p>
        {document.intro ? (
          <article className="consent-gate__document-section">
            <p className="eyebrow">{document.intro.eyebrow}</p>
            <h4>{document.intro.title}</h4>
            <p>{document.intro.text}</p>
          </article>
        ) : null}
        {document.metadata?.length ? (
          <dl className="consent-gate__document-meta">
            {document.metadata.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {document.sections.map((section) => (
          <article className="consent-gate__document-section" key={section.id}>
            <p className="eyebrow">{section.eyebrow}</p>
            <h4>{section.title}</h4>
            <p>{section.text}</p>
          </article>
        ))}
        <p className="consent-gate__document-fallback">
          Need a full-page view?{' '}
          <Link href={document.route} className="consent-gate__link">
            Open {document.title}
          </Link>
        </p>
      </div>
    </section>
  );
}

function DocumentButton({ documentKey, children, onSelect }) {
  return (
    <button type="button" className="consent-gate__link consent-gate__document-trigger" onClick={() => onSelect(documentKey)}>
      {children}
    </button>
  );
}

export default function ConsentGate() {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [activeDocument, setActiveDocument] = useState('terms');

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
        <div className="consent-gate__document-tabs" aria-label="Legal documents to review">
          {consentDocuments.map((document) => (
            <button
              type="button"
              className="consent-gate__document-tab"
              aria-pressed={activeDocument === document.key}
              key={document.key}
              onClick={() => setActiveDocument(document.key)}
            >
              {document.label}
            </button>
          ))}
        </div>
        <LegalDocumentViewer documentKey={activeDocument} onClose={() => setActiveDocument(null)} />
        <div className="consent-gate__check">
          <input type="checkbox" checked={terms} aria-describedby="terms-consent-label" onChange={(e) => setTerms(e.target.checked)} />
          <span id="terms-consent-label">
            I accept the{' '}
            <DocumentButton documentKey="terms" onSelect={setActiveDocument}>Terms &amp; Conditions</DocumentButton>{' '}
            and{' '}
            <DocumentButton documentKey="eula" onSelect={setActiveDocument}>EULA</DocumentButton>.
          </span>
        </div>
        <div className="consent-gate__check">
          <input type="checkbox" checked={privacy} aria-describedby="privacy-consent-label" onChange={(e) => setPrivacy(e.target.checked)} />
          <span id="privacy-consent-label">
            I accept the{' '}
            <DocumentButton documentKey="privacy" onSelect={setActiveDocument}>Privacy Policy</DocumentButton>{' '}
            and understand the{' '}
            <DocumentButton documentKey="multiplayer-policy" onSelect={setActiveDocument}>multiplayer policy</DocumentButton>.
          </span>
        </div>
        <button type="button" className="consent-gate__action" disabled={!ready} onClick={handleAccept}>
          Enter T-Central
        </button>
      </div>
    </div>
  );
}
