'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import LegalDocumentBody from '@/components/LegalDocumentBody';
import { hasCurrentLegalAcknowledgement, LEGAL_DRAFT_NOTICE, LEGAL_OPEN_ROUTES, LEGAL_REVISION, legalDocuments } from '@/lib/legalContent';

const STORAGE_KEY = 'tcentral_consent_v1';

const consentDocuments = [
  { key: 'terms', label: 'Terms & Conditions' },
  { key: 'eula', label: 'EULA' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'multiplayer-policy', label: 'multiplayer policy' },
  { key: 'payments', label: 'Support & payments' },
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
        <p className="legal-draft-note">{LEGAL_DRAFT_NOTICE}</p>
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
            <h4>{section.title}</h4>
            <LegalDocumentBody section={section} />
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
  const pathname = usePathname();
  const dialogRef = useRef(null);
  const legalPage = LEGAL_OPEN_ROUTES.includes(pathname?.replace(/\/$/, '') || '/');
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [activeDocument, setActiveDocument] = useState('terms');

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (hasCurrentLegalAcknowledgement(parsed)) {
          setAccepted(true);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted || accepted || legalPage) return;
    const previousFocus = document.activeElement;
    const content = document.getElementById('site-content');
    const previousInert = content?.inert;
    const previousOverflow = document.body.style.overflow;
    if (content) content.inert = true;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    function trapFocus(event) {
      if (event.key !== 'Tab') return;
      const controls = [...dialogRef.current.querySelectorAll('a[href], button:not(:disabled), input, [tabindex="0"]')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first?.focus();
      }
    }
    const dialog = dialogRef.current;
    dialog.addEventListener('keydown', trapFocus);
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      if (content) content.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [mounted, accepted, legalPage]);

  const ready = useMemo(() => terms && privacy && adult, [terms, privacy, adult]);

  const handleAccept = () => {
    if (!ready) return;
    const payload = {
      accepted: true,
      acceptedAt: Date.now(),
      version: 1,
      revision: LEGAL_REVISION,
      age19OrOlder: true,
    };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
    setAccepted(true);
  };

  if (!mounted || accepted || legalPage) return null;

  return (
    <div ref={dialogRef} tabIndex={-1} className="consent-gate" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="consent-gate__panel">
        <p className="eyebrow">Community access</p>
        <h2 id="consent-title">Review the community documents</h2>
        <p className="muted">
          T-Central is for players aged 19 and over. These are review drafts, not yet adopted as final policies. Your declarations are saved in this browser; they do not verify your identity or age and are not an account-level agreement record.
        </p>
        <div className="legal-related"><Link href="/legal">Read all documents</Link><Link href="/contact">Contact support</Link><Link href="/report-player">Report a concern</Link></div>
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
          <input type="checkbox" checked={terms} aria-labelledby="terms-consent-label" onChange={(e) => setTerms(e.target.checked)} />
          <span id="terms-consent-label">
            For access during development, I agree to follow the draft{' '}
            <DocumentButton documentKey="terms" onSelect={setActiveDocument}>Terms &amp; Conditions</DocumentButton>,{' '}
            <DocumentButton documentKey="eula" onSelect={setActiveDocument}>EULA</DocumentButton>{' '}
            and <DocumentButton documentKey="multiplayer-policy" onSelect={setActiveDocument}>community policy</DocumentButton>.
          </span>
        </div>
        <div className="consent-gate__check">
          <input type="checkbox" checked={privacy} aria-labelledby="privacy-consent-label" onChange={(e) => setPrivacy(e.target.checked)} />
          <span id="privacy-consent-label">
            I have read the{' '}
            <DocumentButton documentKey="privacy" onSelect={setActiveDocument}>Privacy Policy</DocumentButton>{' '}
            notice. This acknowledgement is not consent to optional advertising or analytics.
          </span>
        </div>
        <div className="consent-gate__check">
          <input type="checkbox" checked={adult} aria-labelledby="age-consent-label" onChange={(event) => setAdult(event.target.checked)} />
          <span id="age-consent-label">I am at least 19 years old and meet any higher age requirement that applies to my use of the service.</span>
        </div>
        <button type="button" className="consent-gate__action" disabled={!ready} onClick={handleAccept}>
          Enter T-Central
        </button>
      </div>
    </div>
  );
}
