import Link from 'next/link';
import PageShell from '@/components/PageShell';
import LegalDocumentBody from '@/components/LegalDocumentBody';
import { LEGAL_CONTACT, LEGAL_DRAFT_NOTICE, legalDocuments, legalDocumentOrder } from '@/lib/legalContent';

export default function LegalDocumentPage({ documentKey }) {
  const document = legalDocuments[documentKey];
  return (
    <PageShell eyebrow={document.eyebrow} title={document.title} text={document.summary}>
      <div className="legal-document">
        <aside className="content-card legal-draft" aria-label="Document status">
          <h2>Draft for review</h2>
          <p>{LEGAL_DRAFT_NOTICE}</p>
          <dl className="legal-metadata">
            {document.metadata.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.text}</dd></div>)}
          </dl>
        </aside>
        <nav className="content-card legal-contents" aria-label="On this page">
          <h2>On this page</h2>
          <ol>{document.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\. /, '')}</a></li>)}</ol>
        </nav>
        {document.sections.map((section) => (
          <section className="content-card legal-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            <LegalDocumentBody section={section} />
          </section>
        ))}
        <section className="content-card legal-section" aria-labelledby="legal-help-title">
          <h2 id="legal-help-title">Questions and related documents</h2>
          <p>Email <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> for legal, privacy, payment or review requests. You can read these documents, contact support and report a concern without accepting the access-screen agreement.</p>
          <nav className="legal-related" aria-label="Related documents and help">
            <Link href="/legal">All legal documents</Link>
            {legalDocumentOrder.filter((key) => key !== documentKey).map((key) => <Link key={key} href={legalDocuments[key].route}>{legalDocuments[key].title}</Link>)}
            <Link href="/contact">Contact support</Link>
            <Link href="/report-player">Report a player</Link>
          </nav>
        </section>
      </div>
    </PageShell>
  );
}
