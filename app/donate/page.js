import DonateSupportClient from "@/components/DonateSupportClient";
import Link from "next/link";
import {
  SupportArrow as Arrow,
  SupportNoteIcon,
  SupportPurposeIcon,
} from "@/components/SupportIcons";

export const metadata = {
  title: "Support the project",
  description:
    "Help fund ongoing T-Central development, marketing and project hardware through voluntary one-time or recurring support.",
};

function OrbitArtwork() {
  return (
    <div className="donation-orbit" aria-hidden="true">
      <div className="donation-orbit-top">
        <span>T / C</span>
        <span>SPACE & TIME</span>
      </div>
      <svg viewBox="0 0 520 360" fill="none">
        <defs>
          <radialGradient id="support-glow">
            <stop stopColor="#6cceb6" stopOpacity=".22" />
            <stop offset="1" stopColor="#6cceb6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="support-planet" cx=".3" cy=".2" r=".85">
            <stop stopColor="#c3eee0" />
            <stop offset=".3" stopColor="#528b86" />
            <stop offset=".65" stopColor="#173c43" />
            <stop offset="1" stopColor="#07131e" />
          </radialGradient>
          <linearGradient id="support-ring">
            <stop stopColor="#b3e0d0" stopOpacity=".04" />
            <stop offset=".5" stopColor="#b3e0d0" stopOpacity=".65" />
            <stop offset="1" stopColor="#b3e0d0" stopOpacity=".04" />
          </linearGradient>
        </defs>
        <circle cx="260" cy="180" r="180" fill="url(#support-glow)" />
        <g stroke="#b1e6d1" strokeOpacity=".13">
          <ellipse
            cx="260"
            cy="180"
            rx="215"
            ry="115"
            transform="rotate(-24 260 180)"
          />
          <ellipse
            cx="260"
            cy="180"
            rx="170"
            ry="80"
            transform="rotate(-24 260 180)"
          />
          <circle cx="260" cy="180" r="136" strokeDasharray="2 8" />
        </g>
        <path
          d="M65 260 455 100M260 26v308"
          stroke="#c9e5dc"
          strokeOpacity=".07"
        />
        <circle
          cx="260"
          cy="180"
          r="65"
          fill="url(#support-planet)"
          stroke="#b0dfd1"
          strokeOpacity=".28"
        />
        <ellipse
          cx="260"
          cy="180"
          rx="113"
          ry="26"
          transform="rotate(-24 260 180)"
          stroke="url(#support-ring)"
          strokeWidth="9"
        />
        <path
          d="M201 154a65 65 0 0 1 117-2"
          stroke="#d5fff1"
          strokeOpacity=".5"
        />
        <circle cx="77" cy="220" r="5" fill="#e7c991" />
        <circle cx="394" cy="103" r="4" fill="#ace4d5" />
        <circle cx="341" cy="276" r="3" fill="#e7c991" />
        {[
          [55, 65],
          [144, 103],
          [437, 257],
          [88, 313],
          [372, 35],
          [473, 171],
          [195, 300],
          [309, 71],
          [26, 157],
          [450, 324],
          [177, 43],
          [308, 321],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="1" fill="#d7efeb" opacity=".45" />
        ))}
        <path
          d="M77 220H42v-22m352-95h44v21m-97 152h47v18"
          stroke="#c8e6dd"
          strokeOpacity=".3"
        />
      </svg>
      <div className="donation-orbit-caption">
        <span className="donation-signal" />
        <span>
          More to discover.
          <br />
          <strong>More to build, together.</strong>
        </span>
        <span className="donation-orbit-coordinate">SOL / ∞</span>
      </div>
    </div>
  );
}

const purposes = [
  {
    number: "01",
    label: "Development",
    title: "A deeper universe.",
    text: "More exploration, better graphics, responsive mobile play and continued multiplayer development.",
  },
  {
    number: "02",
    label: "Marketing",
    title: "A wider community.",
    text: "Creative material, project outreach and ways to bring more curious players into the community.",
  },
  {
    number: "03",
    label: "Hardware & infrastructure",
    title: "Room to keep growing.",
    text: "Testing devices, project hardware and infrastructure for ongoing development and operation.",
  },
];

export default function DonatePage() {
  return (
    <main className="content-page donation-page">
      <div className="donation-shell">
        <nav className="donation-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">T-Central</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Support the project</span>
        </nav>
        <header className="donation-hero">
          <div className="donation-hero-copy">
            <p className="eyebrow">Independent universe. Shared ambition.</p>
            <h1>
              Help build
              <br />
              <em>what comes next.</em>
            </h1>
            <p className="donation-intro">
              A little support. A bigger universe.
            </p>
            <p className="donation-description">
              Help T-Central keep moving forward. Your voluntary contributions
              support the development, marketing and hardware behind this
              growing project.
            </p>
            <div className="donation-hero-actions">
              <a className="button primary" href="#give">
                Find your way to support <Arrow down />
              </a>
              <Link className="donation-text-link" href="/system">
                Explore the project <Arrow />
              </Link>
            </div>
            <p className="donation-hero-note">
              <span className="donation-signal" /> Community supported{" "}
              <span aria-hidden="true">·</span> Free to explore
            </p>
          </div>
          <OrbitArtwork />
        </header>

        <section
          className="donation-give"
          id="give"
          aria-labelledby="donation-give-title"
        >
          <div className="donation-section-heading">
            <div>
              <p className="eyebrow">Make a contribution</p>
              <h2 id="donation-give-title">Two ways to move us forward.</h2>
            </div>
            <p>
              Choose the option that suits you.
              <br />
              Every contribution is voluntary.
            </p>
          </div>
          <div className="donation-routes">
            <div className="donation-account-route" id="account-support">
              <DonateSupportClient />
            </div>
            <section
              className="donation-direct"
              aria-labelledby="direct-support-title"
            >
              <div className="donation-route-top">
                <span className="donation-route-label">Direct support</span>
                <span className="donation-paypal-wordmark">
                  PayPal.Me{" "}
                  <span aria-hidden="true">
                    <Arrow diagonal />
                  </span>
                </span>
              </div>
              <h2 id="direct-support-title">
                A simple way
                <br />
                to say “keep going.”
              </h2>
              <p>
                Prefer to give directly? Choose your amount on PayPal and help
                support what’s next.
              </p>
              <a
                className="button donation-paypal-button"
                href="https://paypal.me/TCentralG"
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue to PayPal.Me <Arrow />
              </a>
              <div className="donation-recipient">
                <span>Official support link</span>
                <strong>paypal.me/TCentralG</strong>
              </div>
              <p className="donation-direct-review">
                Check the recipient, currency and final total on PayPal before
                approving.
              </p>
              <div className="donation-external-note">
                <SupportNoteIcon />
                <p>
                  External gifts don’t automatically appear in your T-Central
                  account. Already contributed?{" "}
                  <Link href="/contact">Request a receipt review.</Link>
                </p>
              </div>
            </section>
          </div>
        </section>

        <section
          className="donation-impact"
          aria-labelledby="donation-impact-title"
        >
          <div className="donation-section-heading">
            <div>
              <p className="eyebrow">What you make possible</p>
              <h2 id="donation-impact-title">
                One project. Three ways to grow.
              </h2>
            </div>
            <p>
              Support goes toward the work
              <br />
              and resources the project needs.
            </p>
          </div>
          <div className="donation-purpose-grid">
            {purposes.map((item) => (
              <article key={item.number}>
                <div className="donation-purpose-top">
                  <span>
                    {item.number} / {item.label}
                  </span>
                  <i aria-hidden="true">
                    <SupportPurposeIcon number={item.number} />
                  </i>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <p className="donation-allocation-note">
            Contributions support the whole project. These areas don’t represent
            fixed allocations or guaranteed delivery dates.
          </p>
        </section>

        <section className="donation-faq" aria-labelledby="support-faq-title">
          <div>
            <p className="eyebrow">A few things to know</p>
            <h2 id="support-faq-title">
              Clear expectations.
              <br />
              No surprises.
            </h2>
            <p>
              Questions about a payment?
              <br />
              <Link href="/contact">
                We’re here to help{" "}
                <span aria-hidden="true">
                  <Arrow diagonal />
                </span>
              </Link>
            </p>
          </div>
          <div className="donation-questions">
            <details>
              <summary>What will my contribution fund?</summary>
              <p>
                Ongoing development, marketing, hardware and project
                infrastructure. Funds are used across project needs rather than
                reserved for a selected area or game location. We do not
                currently operate active Rust or Arma 3 servers.
              </p>
            </details>
            <details>
              <summary>How is support recorded for the future?</summary>
              <p>
                Verified account-linked payments stay in your private account
                history, including their amount, currency, support focus and any
                refunds. This can support future recognition or eligibility
                under separately announced terms. VIP plans remain undefined and
                unavailable; contributions do not automatically buy future
                benefits. PayPal.Me gifts need receipt review to be associated
                with an account.
              </p>
            </details>
            <details>
              <summary>
                Does support unlock credits, power or ownership?
              </summary>
              <p>
                No. Contributions are voluntary project support. They do not
                purchase redeemable credits, seeds, competitive power, equity or
                financial returns. We do not represent payments as
                tax-deductible charitable gifts.
              </p>
            </details>
            <details>
              <summary>How does monthly support work?</summary>
              <p>
                One-time account-linked contributions support Steam and Google.
                Monthly subscription management currently requires Steam. When a
                verified monthly plan is available, its amount and currency
                appear before checkout. It renews until cancelled. Use PayPal’s
                automatic-payment controls or the account cancellation option
                when provided.
              </p>
            </details>
            <details>
              <summary>Need a receipt, refund or payment help?</summary>
              <p>
                <Link href="/contact">Contact us</Link> with the transaction
                reference, amount, currency, date and your T-Central account. Do
                not send passwords or full payment details. Mandatory consumer
                rights and payment-provider dispute processes remain available.
              </p>
            </details>
          </div>
        </section>

        <aside className="donation-community">
          <div>
            <p className="eyebrow">There’s more than one way to help</p>
            <h2>Your ideas belong here, too.</h2>
            <p>
              Play, share a discovery or tell us what you’d love to see next.
              Being part of the community is always free.
            </p>
          </div>
          <div className="donation-community-actions">
            <Link className="button secondary" href="/hub-form">
              Join the conversation <Arrow />
            </Link>
            <Link className="donation-text-link" href="/system">
              Take a flight <Arrow />
            </Link>
          </div>
        </aside>
        <footer className="donation-disclosure">
          <div>
            <strong>Voluntary support · 19+</strong>
            <p>
              PayPal processes payments externally. Recurring support renews
              until cancelled. Contributions do not guarantee features or future
              benefits. Review the payment policy and checkout terms before
              paying.
            </p>
          </div>
          <nav aria-label="Donation legal links">
            <Link href="/support-policy">Payment policy</Link>
            <Link href="/terms-and-conditions">Terms</Link>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
