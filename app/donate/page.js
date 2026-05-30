import PageShell from '@/components/PageShell';
import DonateSupportClient from '@/components/DonateSupportClient';

export const metadata = { title: 'Donate' };

const impactPoints = [
  'Help keep the servers online, stable, and better staffed.',
  'Back new map work, web-game upgrades, and visual polish.',
  'Support events, community growth, and future supporter rewards.',
  'Give the hub more room to expand without locking the experience behind a login.'
];

const supportLanes = [
  {
    name: 'Recurring Support',
    badge: 'Live now',
    title: 'Join as a monthly supporter',
    text: 'This is the strongest option for players who want to help the hub grow steadily over time.',
    features: ['Recurring support through PayPal', 'Best for long-term backers', 'Keeps future upgrades moving forward']
  },
  {
    name: 'Flexible Support',
    badge: 'Open amount',
    title: 'Donate any amount',
    text: 'Use the direct PayPal.Me link if you want a one-time contribution or your own custom amount.',
    features: ['Any amount you choose', 'Fast direct support path', 'Great for one-time backing']
  },
  {
    name: 'Patron Path',
    badge: 'Community-first',
    title: 'Support like a patron',
    text: 'This lane is built for players who want to back the world, the servers, and the long-term vision behind the hub.',
    features: ['Ideal for core supporters', 'Fits future patron-style perks', 'Built to grow with the project']
  }
];

const paypalBenefits = [
  'Trusted global checkout that players already recognize and use.',
  'Secure payment handling that keeps sensitive billing details outside the hub.',
  'Support for both recurring subscriptions and one-time donations in one ecosystem.',
  'Fast payout and transaction records that improve donation tracking and planning.',
  'Lower friction on mobile and desktop so more supporters can complete checkout.'
];


const protectedPackages = [
  {
    name: 'One-time support',
    text: 'Select a Steam-linked one-time package, review the anchor and solar-system defaults, then create the PayPal order through the protected checkout.',
  },
  {
    name: 'Monthly supporter',
    text: 'Choose the recurring lane to use the configured PayPal subscription plan and link the verified subscription to your account.',
  },
  {
    name: 'Patron / core supporter',
    text: 'Use the core supporter path for long-term backing while keeping receipts, subscription identifiers, and PayPal references visible in the account panel.',
  },
];

const modelComparison = [
  {
    model: 'Subscription model',
    bestFor: 'Players who want to fund steady monthly growth.',
    value: 'Predictable support for hosting, moderation, and ongoing feature delivery.',
    examples: ['Monthly supporter tiers', 'Roadmap-backed recurring support', 'Future supporter perks']
  },
  {
    model: 'Donation model',
    bestFor: 'Players who want flexible one-time contributions.',
    value: 'On-demand support during events, launches, and community milestones.',
    examples: ['Any-amount PayPal.Me gifts', 'Seasonal event boosts', 'One-time thank-you backing']
  }
];

export default function DonatePage() {
  return (
    <PageShell
      eyebrow="Support T-Central"
      title="Back the hub, the servers, and the people building it."
      text="This page is tuned for supporters, regular players, and patron-style backers who want to help T-Central keep growing in a lasting way."
    >
      <section className="support-banner">
        <div className="support-banner-copy">
          <p className="eyebrow">Why support matters</p>
          <h3>Every contribution helps the hub stay active, improve faster, and grow further.</h3>
          <p className="muted">
            Support goes toward server uptime, feature work, website upgrades, visual polish, moderation workflows, and the long-term expansion of the T-Central ecosystem.
          </p>
        </div>

        <div className="support-impact-grid">
          {impactPoints.map((point) => (
            <div key={point} className="impact-pill">
              {point}
            </div>
          ))}
        </div>
      </section>

      <section className="support-lanes-grid">
        {supportLanes.map((lane) => (
          <article key={lane.name} className="content-card support-lane-card">
            <div className="lane-topline">
              <span className="lane-badge">{lane.badge}</span>
              <span className="lane-name">{lane.name}</span>
            </div>
            <h3>{lane.title}</h3>
            <p className="muted">{lane.text}</p>
            <ul className="lane-feature-list">
              {lane.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="content-card patron-appeal-card">
        <p className="eyebrow">Why PayPal integration helps</p>
        <h3>Built to support both subscriptions and one-time donations.</h3>
        <p className="muted">
          Integrating PayPal into the central hub gives supporters a familiar checkout path while giving the team a durable way to run recurring and flexible funding models side by side.
        </p>
        <ul className="lane-feature-list">
          {paypalBenefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </section>

      <section className="support-lanes-grid">
        {modelComparison.map((item) => (
          <article key={item.model} className="content-card support-lane-card">
            <p className="eyebrow">{item.model}</p>
            <h3>{item.bestFor}</h3>
            <p className="muted">{item.value}</p>
            <ul className="lane-feature-list">
              {item.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="donate-action-grid">
        <article className="content-card donate-primary-card">
          <p className="eyebrow">Account-linked protected flow</p>
          <h3>Donate or subscribe through the protected Steam-linked checkout</h3>
          <p className="muted">
            Use the primary protected PayPal flow below to create a server-side donation order or monthly membership bound to your authenticated Steam account, blackhole anchor, and solar system path.
          </p>

          <DonateSupportClient />
        </article>

        <article className="content-card donate-secondary-card">
          <p className="eyebrow">Secondary fallback flow</p>
          <h3>Use PayPal.Me for flexible direct support</h3>
          <p className="muted">
            Prefer to choose your own amount, send a direct gift, or use a simpler fallback path? PayPal.Me is available for flexible direct support, but it may not automatically bind your contribution to the Steam-linked account used by the protected flow.
          </p>

          <div className="donate-button-stack">
            <a
              className="button secondary"
              href="https://paypal.me/TCentralG"
              target="_blank"
              rel="noreferrer"
            >
              Open PayPal.Me fallback
            </a>
            <a
              className="button secondary"
              href="https://paypal.me/TCentralG"
              target="_blank"
              rel="noreferrer"
            >
              Donate any amount
            </a>
          </div>

          <div className="donate-note-box">
            <strong>Supporter note</strong>
            <p>
              Whether you give once or support monthly, you are helping the T-Central hub stay active, improve faster,
              and keep building toward a larger long-term experience. Use the protected flow when you want account-linked support tracking.
            </p>
          </div>
        </article>
      </section>

      <section className="content-card patron-appeal-card">
        <p className="eyebrow">For supporters and patrons</p>
        <h3>Back the direction, not just the current version.</h3>
        <p className="muted">
          T-Central is being built as more than a basic server page. Supporters and patron-style backers help push the project
          toward better systems, stronger visuals, smoother experiences, and a more complete long-term community hub.
        </p>
      </section>
    </PageShell>
  );
}
