import PageShell from '@/components/PageShell';
import { legalDocuments } from '@/lib/legalContent';

export const metadata = { title: 'Terms and Conditions' };

const termsDocument = legalDocuments.terms;

export default function TermsPage() {
  return (
    <PageShell eyebrow={termsDocument.eyebrow} title={termsDocument.title} text={termsDocument.summary}>
      <section className="content-card" aria-labelledby="terms-legal-overview">
        <p className="eyebrow">{termsDocument.intro.eyebrow}</p>
        <h3 id="terms-legal-overview">{termsDocument.intro.title}</h3>
        <p className="muted">{termsDocument.intro.text}</p>
        <div className="arma-brief-grid" aria-label="Terms metadata">
          {termsDocument.metadata.map((item) => (
            <div className="arma-highlight" key={item.label}>
              <strong>{item.label}</strong>
              <span className="muted">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <nav className="content-card" aria-label="Terms summary">
        <p className="eyebrow">Summary</p>
        <h3>On this page</h3>
        <ul className="arma-list">
          {termsDocument.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="arma-brief-grid">
        {termsDocument.sections.map((section) => (
          <article className="content-card" id={section.id} key={section.id}>
            <p className="eyebrow">{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <p className="muted">{section.text}</p>
          </article>
        ))}
      </div>

      <section className="content-card" aria-labelledby="terms-support-cta">
        <p className="eyebrow">Need help?</p>
        <h3 id="terms-support-cta">Contact support or report conduct issues</h3>
        <p className="muted">
          Contact the T-Central team for account, route, service, refund, billing, or PayPal.Me account-linking questions. Use the report form for harassment, cheating, griefing, or other community conduct concerns.
        </p>
        <div className="donate-legal-links" aria-label="Terms support links">
          <a href="/contact">Contact support</a>
          <a href="/report-player">Report a player</a>
        </div>
      </section>
    </PageShell>
  );
}
