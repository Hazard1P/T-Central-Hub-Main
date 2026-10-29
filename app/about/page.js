import Link from "next/link";
import PageShell from "@/components/PageShell";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About the hub"
      title="One community. More ways to play."
      text="T-Central brings Arma 3 and Rust server routes together with an interactive space universe and a shared community hub."
    >
      <p>
        <Link className="button secondary" href="/our-flight-plan">
          Read our Flight plan
        </Link>
      </p>
      <div className="card-grid two">
        <article className="content-card">
          <h2>Find your server</h2>
          <p className="muted">
            Discover independent Rust and Arma 3 communities, review player
            counts and connect through Steam. T-Central does not currently
            operate active game servers.
          </p>
          <Link className="button secondary" href="/server-info">
            Browse servers
          </Link>
        </article>
        <article className="content-card">
          <h2>Explore the universe</h2>
          <p className="muted">
            Fly through one shared universe, explore the Solar System and land
            over Earth’s continuous 3D terrain and oceans. You can start as a guest.
          </p>
          <Link className="button secondary" href="/system">
            Launch the system
          </Link>
        </article>
        <article className="content-card">
          <h2>Shape the community</h2>
          <p className="muted">
            Share feedback, suggest an event, or discuss a server on the
            community board. Sign in with Steam or Google to post.
          </p>
          <Link className="button secondary" href="/hub-form">
            Visit the community board
          </Link>
        </article>
        <article className="content-card">
          <h2>Get help</h2>
          <p className="muted">
            Contact the team for account and server questions, or use player
            reporting for cheating, abuse, and rule violations.
          </p>
          <Link className="button secondary" href="/contact">
            Contact the team
          </Link>
        </article>
      </div>
      <section className="content-card">
        <h2>Project logo</h2>
        <p className="muted">
          Download the original transparent PNG used throughout T-Central.
        </p>
        <a
          className="button secondary"
          href="/brand/tcentral-mark.png"
          download="T-Central-logo.png"
        >
          Download logo (PNG)
        </a>
      </section>
    </PageShell>
  );
}
