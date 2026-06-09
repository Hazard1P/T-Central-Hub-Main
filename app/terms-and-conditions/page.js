import PageShell from '@/components/PageShell';

export const metadata = { title: 'Terms and Conditions' };

const termsSections = [
  {
    id: 'template-legal-review',
    eyebrow: 'Template/legal review',
    title: 'Draft template notice',
    text: 'These terms are draft template language for planning and transparency. They should be reviewed and approved by qualified legal counsel before production use or reliance.',
  },
  {
    id: 'use-of-service',
    eyebrow: 'Use of service',
    title: 'Use of service',
    text: 'Users are expected to use the site, shared hub, private worlds, and connected route portals responsibly and in accordance with applicable community rules.',
  },
  {
    id: 'community-conduct',
    eyebrow: 'Community conduct',
    title: 'Community conduct',
    text: 'Do not harass, exploit, impersonate, disrupt services, evade moderation, or interfere with another player\'s ability to participate safely in T-Central spaces.',
  },
  {
    id: 'public-private-spaces',
    eyebrow: 'Lobby modes',
    title: 'Public/private spaces',
    text: 'The multiplayer hub is intended as a shared Steam-linked room. Private worlds are intended to remain user-scoped while still allowing server and route access.',
  },
  {
    id: 'external-services',
    eyebrow: 'External services',
    title: 'External services',
    text: 'Route portals, Steam authentication, payment providers, game servers, and community platforms may have separate rules, account requirements, uptime behavior, and privacy practices.',
  },
  {
    id: 'payment-terms',
    eyebrow: 'Payment terms',
    title: 'Payment terms',
    text: 'One-time donations and recurring support are voluntary contributions processed by PayPal. Support does not buy in-game currency, stored value, external payout rights, real-world return, ownership in T-Central, or a paid gameplay advantage.',
  },
  {
    id: 'recurring-support',
    eyebrow: 'Recurring support',
    title: 'Recurring support and cancellation',
    text: 'Monthly support recurs until cancelled through PayPal or the available account-management path. Cancellation stops future recurring billing according to PayPal and account-management timing, but it does not automatically reverse previously completed payments.',
  },
  {
    id: 'refunds-and-support',
    eyebrow: 'Refunds and support',
    title: 'Refund and support handling',
    text: 'Refund, billing, account-linking, and PayPal.Me fallback questions should be sent through the contact path. PayPal.Me fallback may not automatically bind to a Steam-linked account, so supporters should include useful receipt and account details when asking for help.',
  },
  {
    id: 'availability-and-changes',
    eyebrow: 'Availability',
    title: 'Availability and changes',
    text: 'Features, servers, private spaces, route links, and policies may change, pause, or become unavailable as systems are maintained, secured, moderated, or updated.',
  },
  {
    id: 'donations-and-support',
    eyebrow: 'Donations',
    title: 'Voluntary donations and recurring support',
    text: 'Donations and recurring support are voluntary contributions to help maintain T-Central. They are not required for ordinary community participation unless a specific optional support flow states otherwise.',
  },
  {
    id: 'paypal-payments',
    eyebrow: 'PayPal',
    title: 'External PayPal processing',
    text: 'PayPal processes donation and support payments externally. PayPal may require its own account, payment method, terms, privacy notice, dispute process, cancellation tools, and availability controls.',
  },
  {
    id: 'monthly-subscriptions',
    eyebrow: 'Recurring support',
    title: 'Monthly subscriptions and cancellation',
    text: 'Monthly subscriptions recur until canceled through PayPal or through the provided account path where available. Cancellation timing, billing cutoffs, receipts, and failed-payment handling may be controlled by PayPal.',
  },
  {
    id: 'no-guaranteed-benefits',
    eyebrow: 'No stored value',
    title: 'No guaranteed perks, payout, or ownership',
    text: 'Donations do not guarantee perks, currency, payout, stored value, ownership interest, uninterrupted service, or continued access to any specific feature, server, route, recognition, or benefit.',
  },
  {
    id: 'refund-support',
    eyebrow: 'Refunds',
    title: 'Refund and support questions',
    text: 'Refund, billing, receipt, cancellation, or supporter-account questions should be sent through /contact so the T-Central team can review the request and direct you to any applicable PayPal support path.',
  },
];

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms and conditions"
      title="Terms and conditions"
      text="These terms cover use of the T-Central website, the multiplayer hub, private player worlds, linked identity features, and route portals into game servers and external systems."
    >
      <section className="content-card" aria-labelledby="terms-legal-overview">
        <p className="eyebrow">Legal notice</p>
        <h3 id="terms-legal-overview">Terms for T-Central services</h3>
        <p className="muted">
          These terms set expectations for using T-Central web pages, shared community spaces, private player worlds, Steam-linked features, and routes into external systems.
        </p>
        <div className="arma-brief-grid" aria-label="Terms metadata">
          <div className="arma-highlight">
            <strong>Last updated</strong>
            <span className="muted">June 9, 2026</span>
          </div>
          <div className="arma-highlight">
            <strong>Applies to</strong>
            <span className="muted">Website, multiplayer hub, private worlds, linked identity, route portals, and voluntary support payments</span>
          </div>
          <div className="arma-highlight">
            <strong>Support channel</strong>
            <span className="muted">General support, payment questions, conduct reports, access issues, and route questions</span>
          </div>
        </div>
      </section>

      <nav className="content-card" aria-label="Terms summary">
        <p className="eyebrow">Summary</p>
        <h3>On this page</h3>
        <ul className="arma-list">
          {termsSections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="arma-brief-grid">
        {termsSections.map((section) => (
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
