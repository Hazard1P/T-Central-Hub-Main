import PageShell from '@/components/PageShell';

export const metadata = { title: 'Privacy Policy' };

const privacySections = [
  {
    id: 'template-legal-review',
    eyebrow: 'Template/legal review',
    title: 'Draft template notice',
    text: 'This privacy policy is draft template language for planning and transparency. It should be reviewed and approved by qualified legal counsel before production use or reliance.',
  },
  {
    id: 'what-we-collect',
    eyebrow: 'Steam sign-in',
    title: 'What we collect',
    text: 'When you sign in with Steam, the system may process your SteamID, display name, profile URL, and avatar for session, lobby, and route-interface purposes.',
  },
  {
    id: 'how-it-is-used',
    eyebrow: 'Multiplayer hub',
    title: 'How it is used',
    text: 'Steam-linked data supports account sessions, shared room presence, flight roles, server routing, moderation context, and continuity between public hub features and protected player spaces.',
  },
  {
    id: 'private-world-data',
    eyebrow: 'Private world',
    title: 'Private world data',
    text: 'Private world state should remain isolated to the linked Steam account. Sensitive private state should be encrypted at rest and transported only over secure sessions.',
  },
  {
    id: 'external-routes',
    eyebrow: 'Route portals',
    title: 'External routes',
    text: 'Connected portals may send you to game servers, Steam-linked authentication surfaces, PayPal payment surfaces, or community systems that operate under their own notices and controls.',
  },
  {
    id: 'payment-routing',
    eyebrow: 'Payment routing',
    title: 'Payment routing and PayPal processing',
    text: 'One-time donations and recurring support are routed to PayPal as the external payment processor. T-Central does not need to collect or store sensitive card, bank, or PayPal credential details handled by PayPal checkout.',
  },
  {
    id: 'receipt-metadata',
    eyebrow: 'Receipt metadata',
    title: 'Account-linked receipt metadata',
    text: 'When support is connected to a Steam-linked account, T-Central may keep account-linked receipt metadata such as package choice, support status, PayPal order or subscription references, timestamps, and fallback notes needed for support, reconciliation, and account display.',
  },
  {
    id: 'payment-provider-routing',
    eyebrow: 'Payment routing',
    title: 'Payment provider routing to PayPal',
    text: 'Donation and support flows may route you away from T-Central to PayPal for external payment processing, account authorization, receipts, recurring billing management, cancellation, and dispute handling.',
  },
  {
    id: 'supporter-metadata',
    eyebrow: 'Supporter records',
    title: 'Steam-linked receipt and account metadata',
    text: 'T-Central may use Steam-linked account identifiers, supporter status, transaction or subscription references, receipt metadata, timestamps, and support notes to track supporter recognition, troubleshoot payments, and prevent duplicate or fraudulent records.',
  },
  {
    id: 'payment-data-limits',
    eyebrow: 'Payment details',
    title: 'No full card or PayPal credential storage',
    text: 'The hub should not store full payment card numbers, security codes, bank credentials, or PayPal login credentials. Those details should be handled by PayPal or other applicable payment providers.',
  },
  {
    id: 'paypal-privacy',
    eyebrow: 'PayPal privacy',
    title: 'PayPal has separate privacy terms',
    text: 'PayPal operates independently and applies its own privacy terms, data collection, retention, security, dispute, fraud-prevention, and account-control practices when you use PayPal support flows.',
  },
  {
    id: 'contact-and-removal-requests',
    eyebrow: 'Support requests',
    title: 'Contact and removal requests',
    text: 'You can contact the T-Central team to ask privacy questions, request review of account-linked records, or request removal where deletion is technically and legally available.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      eyebrow="Privacy policy"
      title="Privacy policy"
      text="This policy explains the core data used by the T-Central website, Steam-linked sign-in flow, multiplayer hub presence, private world isolation, and connected route portals."
    >
      <section className="content-card" aria-labelledby="privacy-legal-overview">
        <p className="eyebrow">Legal notice</p>
        <h3 id="privacy-legal-overview">Privacy at T-Central</h3>
        <p className="muted">
          This page summarizes how account-linked data, public lobby presence, protected player world state, and off-site routing are handled across the T-Central hub.
        </p>
        <div className="arma-brief-grid" aria-label="Privacy policy metadata">
          <div className="arma-highlight">
            <strong>Last updated</strong>
            <span className="muted">June 9, 2026</span>
          </div>
          <div className="arma-highlight">
            <strong>Applies to</strong>
            <span className="muted">Website, Steam sign-in, multiplayer hub, private worlds, route portals, and PayPal-routed support</span>
          </div>
          <div className="arma-highlight">
            <strong>Support channel</strong>
            <span className="muted">Privacy questions, access requests, payment metadata questions, and removal requests</span>
          </div>
        </div>
      </section>

      <nav className="content-card" aria-label="Privacy policy summary">
        <p className="eyebrow">Summary</p>
        <h3>On this page</h3>
        <ul className="arma-list">
          {privacySections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="arma-brief-grid">
        {privacySections.map((section) => (
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
