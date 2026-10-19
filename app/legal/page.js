import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { LEGAL_CONTACT, LEGAL_DRAFT_NOTICE, legalDocuments, legalDocumentOrder } from '@/lib/legalContent';

export const metadata = { title: 'Community legal documents' };

export default function LegalPage() {
  return (
    <PageShell eyebrow="Community and trust" title="Community legal documents" text="Read the rules, understand your privacy and find help with accounts, contributions and shared play.">
      <div className="legal-document">
        <aside className="content-card legal-draft" aria-label="Document status">
          <h2>Draft for review</h2>
          <p>{LEGAL_DRAFT_NOTICE}</p>
        </aside>
        <section className="content-card legal-section" aria-labelledby="legal-operator-title">
          <h2 id="legal-operator-title">Operator and contact</h2>
          <p>Michael Rybaltowicz, operating as Central Synaptic Intelligence Systems, British Columbia, Canada.</p>
          <p>For legal, privacy, account, billing or moderation-review requests, email <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>. Contact and reporting remain accessible without accepting an agreement.</p>
        </section>
        <nav className="legal-document-list" aria-label="Legal documents">
          {legalDocumentOrder.map((key) => (
            <Link className="content-card" href={legalDocuments[key].route} key={key}>
              <h2>{legalDocuments[key].title}</h2><p>{legalDocuments[key].summary}</p><span>Read document →</span>
            </Link>
          ))}
        </nav>
        <div className="legal-related"><Link href="/contact">Contact support</Link><Link href="/report-player">Report a player</Link></div>
      </div>
    </PageShell>
  );
}
