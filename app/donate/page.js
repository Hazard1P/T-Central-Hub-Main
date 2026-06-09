import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import DonateSupportClient from '@/components/DonateSupportClient';
import Link from 'next/link';

export const metadata = { title: 'Donate' };

const supportLanes = [
  {
    name: 'Recurring Support',
    badge: 'Live now',
    title: 'Join as a monthly supporter',
    text: 'Help fund stable hosting, moderation coverage, and steady feature delivery over time.',
    features: ['Recurring support through PayPal', 'Best for long-term backers', 'Keeps future upgrades moving forward']
  },
  {
    name: 'Flexible Support',
    badge: 'Open amount',
    title: 'Donate any amount',
    text: 'Use the direct PayPal.Me fallback when you want a one-time gift or custom amount.',
    features: ['Any amount you choose', 'Fast direct support path', 'Great for one-time backing']
  },
  {
    name: 'Patron Path',
    badge: 'Community-first',
    title: 'Support like a patron',
    text: 'Back the servers, website upgrades, events, and long-term worldbuilding behind the hub.',
    features: ['Ideal for core supporters', 'Fits future patron-style perks', 'Built to grow with the project']
  }
];

const paypalBenefits = [
  'Trusted global checkout that players already recognize and use.',
  'Secure payment handling that keeps sensitive billing details outside the hub.',
  'Support for both recurring subscriptions and one-time donations in one ecosystem.'
];

const legalDisclosureLinks = [
  { href: '/terms-and-conditions', label: 'Terms' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/eula', label: 'EULA' },
  { href: '/multiplayer-policy', label: 'Multiplayer Policy' },
  { href: '/contact', label: 'Contact' }
];

function PaymentLegalDisclosure() {
  return (
    <aside className="donate-legal-disclosure" aria-label="Payment legal disclosure">
      <strong>Payment disclosure</strong>
      <p>
        One-time donations and recurring subscriptions are processed by PayPal. Monthly memberships recur until
        cancelled through PayPal or the account-management path provided. Donations/support do not guarantee in-game
        currency, stored value, external payout, or real-world return. PayPal.Me fallback may not automatically bind to
        the Steam-linked account. Refund/support questions should use <Link href="/contact">contact</Link>.
      </p>
      <nav className="donate-legal-links" aria-label="Donation legal links">
        {legalDisclosureLinks.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
      </nav>
    </aside>
  );
}

export default function DonatePage() {
  return (
    <main className="entry-page cosmic-entry-page landing-entry donate-entry">
      <CinematicUniverseCanvas mode="landing" className="entry-universe-canvas" />
      <div className="cosmic-overlay cinematic" />

      <section className="entry-shell simplified donate-shell">
        <div className="entry-copy entry-hero-copy cosmic-hero-panel entry-hero-panel simplified-panel donate-hero-panel">
          <p className="eyebrow">Support T-Central donations</p>
          <h1>Back the hub, servers, and community roadmap.</h1>
          <p className="muted max-copy">
            Choose the protected Steam-linked PayPal flow for account-bound support, or use the direct PayPal.Me fallback for flexible one-time giving.
          </p>

          <div className="entry-actions">
            <a className="button primary" href="#protected-paypal-flow">Open protected PayPal flow</a>
            <a className="button secondary" href="https://paypal.me/TCentralG" target="_blank" rel="noreferrer">
              Donate with PayPal.Me
            </a>
            <Link className="button secondary" href="/">Return to gateway</Link>
          </div>

          <article className="content-card entry-panel polished minimal-route-card donate-protected-flow" id="protected-paypal-flow">
            <span className="entry-panel-kicker">Protected PayPal flow</span>
            <strong>Donate or subscribe through a Steam-linked checkout area.</strong>
            <p>
              Create a server-side donation order or monthly membership tied to your authenticated Steam account, blackhole anchor, and solar-system path.
            </p>
            <DonateSupportClient />
          </article>
        </div>

        <div className="entry-panel-grid enhanced simplified-grid donate-panel-grid">
          <article className="content-card entry-panel polished minimal-route-card donate-secondary-card">
            <span className="entry-panel-kicker">Secondary fallback flow</span>
            <strong>Use PayPal.Me for flexible direct support.</strong>
            <p>
              Prefer to choose your own amount or send a simpler direct gift? PayPal.Me remains available, but it may not automatically bind your contribution to the Steam-linked protected flow.
            </p>
            <div className="entry-actions">
              <a className="button secondary" href="https://paypal.me/TCentralG" target="_blank" rel="noreferrer">
                Open PayPal.Me fallback
              </a>
            </div>
            <ul className="lane-feature-list">
              {paypalBenefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <PaymentLegalDisclosure />
          </article>

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
        </div>
      </section>
    </main>
  );
}
