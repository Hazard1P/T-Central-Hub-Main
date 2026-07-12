import PageShell from '@/components/PageShell';
import { legalDocuments } from '@/lib/legalContent';

export const metadata = { title: 'Privacy Policy' };

const privacyDocument = legalDocuments.privacy;

export default function PrivacyPolicyPage() {
  return (
    <PageShell eyebrow={privacyDocument.eyebrow} title={privacyDocument.title} text={privacyDocument.summary}>
      <section className="content-card" aria-labelledby="privacy-legal-overview">
        <p className="eyebrow">{privacyDocument.intro.eyebrow}</p>
        <h3 id="privacy-legal-overview">{privacyDocument.intro.title}</h3>
        <p className="muted">{privacyDocument.intro.text}</p>
        <div className="arma-brief-grid" aria-label="Privacy policy metadata">
          {privacyDocument.metadata.map((item) => (
            <div className="arma-highlight" key={item.label}>
              <strong>{item.label}</strong>
              <span className="muted">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <nav className="content-card" aria-label="Privacy policy summary">
        <p className="eyebrow">Summary</p>
        <h3>On this page</h3>
        <ul className="arma-list">
          {privacyDocument.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="arma-brief-grid">
        {privacyDocument.sections.map((section) => (
          <article className="content-card" id={section.id} key={section.id}>
            <p className="eyebrow">{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <p className="muted">{section.text}</p>
          </article>
        ))}
      </div>

      <section className="content-card" aria-labelledby="privacy-support-cta">
        <p className="eyebrow">Need help?</p>
        <h3 id="privacy-support-cta">Contact support or report abuse</h3>
        <p className="muted">
          For privacy questions, account-linked receipt metadata, data access, or removal requests, contact the T-Central team. If a privacy issue involves harassment, cheating, or player misconduct, use the player report flow too.
        </p>
        <div className="donate-legal-links" aria-label="Privacy support links">
          <a href="/contact">Contact support</a>
          <a href="/report-player">Report a player</a>
        </div>
      </section>
    </PageShell>
  );
}
