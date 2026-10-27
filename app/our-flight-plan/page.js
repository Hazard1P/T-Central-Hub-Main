import Link from "next/link";
import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Our Flight plan",
  description:
    "The direction behind T-Central: a shared universe, a connected gaming community, and steady development shaped by the people who play.",
};

export default function FlightPlanPage() {
  return (
    <PageShell
      eyebrow="Where we’re headed"
      title="Our Flight plan"
      text="Build a universe worth exploring, and a community worth coming back to."
    >
      <section
        className="content-card flight-plan-intro"
        aria-labelledby="flight-plan-purpose"
      >
        <div>
          <p className="eyebrow">Our purpose</p>
          <h2 id="flight-plan-purpose">
            Explore together. Build what comes next.
          </h2>
          <p>
            T-Central brings space exploration, shared play and community
            conversation into one home. Our aim is a browser universe where a
            short flight can become a discovery, a mining run, or a session with
            other players.
          </p>
          <p>
            We’re developing this step by step, listening to feedback and making
            the core experience easier to join, understand and enjoy.
          </p>
          <div className="exploration-actions">
            <Link className="button primary" href="/system">
              Explore the universe
            </Link>
            <Link className="button secondary" href="/hub-form">
              Join the conversation
            </Link>
          </div>
        </div>
        <div
          className="flight-plan-orbit"
          aria-label="The exploration cycle: explore, gather resources, return to Earth and upgrade your ship"
        >
          <svg viewBox="0 0 360 240" fill="none" aria-hidden="true">
            <ellipse
              cx="180"
              cy="120"
              rx="145"
              ry="75"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="5 8"
            />
            <ellipse
              cx="180"
              cy="120"
              rx="75"
              ry="105"
              transform="rotate(38 180 120)"
              stroke="currentColor"
              strokeOpacity=".35"
            />
            <circle cx="180" cy="120" r="31" fill="#183b4b" stroke="#94d9e5" />
            <path
              d="M164 99l17 7-5 16 15 9-8 18m-31-33 17 5m22-29 13 11"
              stroke="#b6e697"
              strokeWidth="3"
            />
            <circle cx="51" cy="86" r="7" fill="#b6e697" />
            <circle cx="310" cy="150" r="5" fill="#a7c4ed" />
            <path d="m259 49 17 5-12 13-2-10-3-8Z" fill="#ecf6ff" />
          </svg>
          <p>
            Explore <span>→</span> Gather <span>→</span> Return <span>→</span>{" "}
            Upgrade
          </p>
        </div>
      </section>
      <section aria-labelledby="flight-plan-priorities">
        <p className="eyebrow">The route ahead</p>
        <h2 id="flight-plan-priorities">What we’re working toward</h2>
        <p className="muted">
          These are development priorities, not promised release dates. The plan
          will evolve as we test, learn and hear from the community.
        </p>
        <div className="card-grid three flight-plan-priorities">
          <article className="content-card">
            <span className="flight-plan-stage">01 · Building now</span>
            <h3>A stronger foundation</h3>
            <p>
              Improve shared flight, combat, shields, hull and the
              mining-to-upgrade cycle. Keep account identity, progress,
              reporting and moderation working together.
            </p>
          </article>
          <article className="content-card">
            <span className="flight-plan-stage">02 · Next priorities</span>
            <h3>A smoother journey</h3>
            <p>
              Refine mobile controls, screen sizing, performance and navigation.
              Make the Solar System and deeper space easier to traverse, with
              clearer destinations and more detailed cosmic objects.
            </p>
          </article>
          <article className="content-card">
            <span className="flight-plan-stage">
              03 · Longer-term direction
            </span>
            <h3>More reasons to return</h3>
            <p>
              Develop deeper exploration, more ship progression and more ways to
              play together. Let real player feedback shape the next additions
              rather than promising features before they are ready.
            </p>
          </article>
        </div>
      </section>
      <section
        className="card-grid two"
        aria-label="Community and project support"
      >
        <article className="content-card">
          <p className="eyebrow">The people on board</p>
          <h2>A community with a voice</h2>
          <p>
            Share discoveries, find a crew, suggest improvements and talk about
            Rust or Arma. Our community discussions and live chat are places to
            connect; private reports and appeals have their own support routes.
          </p>
          <p>
            Respectful play, account privacy and fair moderation are part of the
            experience we’re building.
          </p>
          <Link className="button secondary" href="/hub-form">
            Find your discussion
          </Link>
        </article>
        <article className="content-card">
          <p className="eyebrow">Keeping development moving</p>
          <h2>Support the next step</h2>
          <p>
            Voluntary contributions help fund ongoing development, marketing and
            hardware for the project. We want support to make the project
            stronger for the community.
          </p>
          <p>
            Contributions do not buy competitive power, redeemable credits or
            guaranteed future VIP benefits. VIP plans remain undefined.
          </p>
          <Link className="button secondary" href="/donate">
            See how support helps
          </Link>
        </article>
      </section>
      <section className="content-card flight-plan-invitation">
        <h2>Help shape our next flight.</h2>
        <p>
          Try the universe, tell us where you get stuck, and share what would
          make you want to come back. Specific feedback helps us choose the next
          useful improvement.
        </p>
        <div className="exploration-actions">
          <Link className="button primary" href="/hub-form">
            Share an idea
          </Link>
          <Link className="button secondary" href="/contact">
            Contact the team
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
