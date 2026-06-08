import PageShell from '@/components/PageShell';

export const metadata = { title: 'Terms and Conditions' };

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms and conditions"
      title="Terms and conditions"
      text="These terms cover use of the T-Central website, the multiplayer hub, private player worlds, linked identity features, and route portals into game servers and external systems."
    >
      <div className="legal-section-grid">
        <article className="content-card legal-card">
          <p className="eyebrow">Use of service</p>
          <h3>General use</h3>
          <div className="legal-meta-row">
            <span>Community rules</span>
            <span>Responsible use</span>
          </div>
          <p className="muted">
            Users are expected to use the site, shared hub, private worlds, and connected route portals responsibly and in accordance with applicable community rules.
          </p>
        </article>
        <article className="content-card legal-card">
          <p className="eyebrow">Lobby modes</p>
          <h3>Public and private spaces</h3>
          <div className="legal-meta-row">
            <span>Public hub</span>
            <span>Private worlds</span>
          </div>
          <p className="muted">
            The multiplayer hub is intended as a shared Steam-linked room. Private worlds are intended to remain user-scoped while still allowing server and route access.
          </p>
        </article>
        <article className="content-card legal-card">
          <p className="eyebrow">Security baseline</p>
          <h3>Privacy and protections</h3>
          <div className="legal-meta-row">
            <span>Secure transport</span>
            <span>Availability varies</span>
          </div>
          <p className="muted">
            User-linked systems should use secure transport, controlled session handling, and encryption for sensitive stored data. External routes can vary in availability and platform behavior.
          </p>
        </article>
      </div>

      <aside className="content-card legal-summary-card">
        <p className="eyebrow">Privacy policy</p>
        <h3>How data handling fits in</h3>
        <p className="muted">
          Review the privacy policy for the core identity, presence, and private-world data that may be processed by T-Central features.
        </p>
        <a className="legal-cta" href="/privacy-policy">Read privacy policy</a>
      </aside>
    </PageShell>
  );
}
