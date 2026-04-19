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

      <section className="donate-action-grid">
        <article className="content-card donate-primary-card">
          <p className="eyebrow">Monthly support</p>
          <h3>Donate through a protected Steam-linked flow</h3>
          <p className="muted">
            Use the protected PayPal checkout below to create a server-side donation order bound to your authenticated Steam account, blackhole anchor, and solar system path.
          </p>

          <div className="donate-button-stack">
            <a
              className="button primary"
              href="https://paypal.me/TCentralG"
              target="_blank"
              rel="noreferrer"
            >
              Open PayPal fallback
            </a>
          </div>

          <DonateSupportClient />
        </article>

        <article className="content-card donate-secondary-card">
          <p className="eyebrow">Flexible support</p>
          <h3>Donate any amount directly</h3>
          <p className="muted">
            Prefer to choose your own amount instead of joining the recurring lane? Use the PayPal.Me link below for a direct contribution.
          </p>

          <div className="donate-button-stack">
            <a
              className="button primary"
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
              and keep building toward a larger long-term experience.
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
