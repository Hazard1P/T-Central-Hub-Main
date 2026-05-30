import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import DonateSupportClient from '@/components/DonateSupportClient';
import Link from 'next/link';

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

const supportStatus = ['PayPal protected flow', 'Steam-linked receipts', 'Fallback route open', 'Monthly and one-time lanes'];

const supportTelemetry = [
  { label: 'Support modes', value: '2' },
  { label: 'Checkout provider', value: 'PayPal' },
  { label: 'Account binding', value: 'Steam' },
  { label: 'Direct route', value: 'Live' }
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
    <main className="entry-page cosmic-entry-page landing-entry donate-entry">
      <CinematicUniverseCanvas mode="landing" className="entry-universe-canvas" />
      <div className="cosmic-overlay cinematic" />

      <section className="entry-shell simplified donate-shell">
        <div className="entry-copy entry-hero-copy cosmic-hero-panel entry-hero-panel simplified-panel donate-hero-panel">
          <p className="eyebrow">Support T-Central</p>
          <h1>Back the hub, the servers, and the people building it.</h1>
          <p className="muted max-copy">
            This page is tuned for supporters, regular players, and patron-style backers who want to help T-Central keep growing in a lasting way.
          </p>

          <div className="entry-actions">
            <a className="button primary" href="#protected-paypal-flow">Open protected PayPal flow</a>
            <a className="button secondary" href="https://paypal.me/TCentralG" target="_blank" rel="noreferrer">
              Donate with PayPal.Me
            </a>
            <Link className="button secondary" href="/">Return to gateway</Link>
          </div>

          <div className="entry-status-bar refined">
            {supportStatus.map((item) => <span key={item}>{item}</span>)}
          </div>

          <div className="entry-telemetry-grid">
            {supportTelemetry.map((item) => (
              <article className="telemetry-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <article className="content-card entry-panel polished minimal-route-card donate-support-brief">
            <span className="entry-panel-kicker">Why support matters</span>
            <strong>Every contribution helps the hub stay active, improve faster, and grow further.</strong>
            <p>
              Support goes toward server uptime, feature work, website upgrades, visual polish, moderation workflows, and the long-term expansion of the T-Central ecosystem.
            </p>
            <div className="donate-impact-grid">
              {impactPoints.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </article>

          <article className="content-card entry-panel polished minimal-route-card donate-protected-flow" id="protected-paypal-flow">
            <span className="entry-panel-kicker">Protected PayPal flow</span>
            <strong>Donate or subscribe through a Steam-linked checkout area.</strong>
            <p>
              Use the protected PayPal checkout below to create a server-side donation order or monthly membership bound to your authenticated Steam account, blackhole anchor, and solar system path.
            </p>
            <DonateSupportClient />
          </article>
        </div>

        <div className="entry-panel-grid enhanced simplified-grid donate-panel-grid">
          {supportLanes.map((lane) => (
            <article key={lane.name} className="content-card entry-panel polished minimal-route-card donate-package-panel">
              <span className="entry-panel-kicker">{lane.badge}</span>
              <strong>{lane.title}</strong>
              <p>{lane.text}</p>
              <ul className="lane-feature-list">
                {lane.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}

          {modelComparison.map((item) => (
            <article key={item.model} className="content-card entry-panel polished minimal-route-card donate-package-panel">
              <span className="entry-panel-kicker">{item.model}</span>
              <strong>{item.bestFor}</strong>
              <p>{item.value}</p>
              <ul className="lane-feature-list">
                {item.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </article>
          ))}

          <article className="content-card entry-panel polished minimal-route-card donate-paypal-panel">
            <span className="entry-panel-kicker">Why PayPal integration helps</span>
            <strong>Built to support both subscriptions and one-time donations.</strong>
            <p>
              Integrating PayPal into the central hub gives supporters a familiar checkout path while giving the team a durable way to run recurring and flexible funding models side by side.
            </p>
            <ul className="lane-feature-list">
              {paypalBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </article>
        </div>
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
            <div className="entry-actions">
              <a className="button primary" href="https://paypal.me/TCentralG" target="_blank" rel="noreferrer">
                Donate any amount
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
