import Link from 'next/link';

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="container hero-grid">
        <div>
          <p className="eyebrow">T-Central Hub</p>
          <h1 className="hero-title">Your front door into Arma3 CTH and Rust Vanilla, built to welcome new players and keep regulars connected.</h1>
          <p className="hero-copy">
            Find the server you want, grab the connection details fast, join the Discord, and stay in the loop on what is happening across the hub. The layout is built to feel immersive without getting in your way.
          </p>
          <div className="button-row">
            <Link href="/servers/arma3-cth" className="button primary">Explore Arma3 CTH</Link>
            <Link href="/servers/rust-vanilla" className="button secondary">Explore Rust Vanilla</Link>
          </div>
          <div className="stats-grid compact">
            <div className="stat-card"><span>Games</span><strong>4 Active Servers</strong></div>
            <div className="stat-card"><span>Discord</span><strong>Join the community</strong></div>
            <div className="stat-card"><span>Support</span><strong>Support available</strong></div>
            <div className="stat-card"><span>Deploy</span><strong>Vercel Ready</strong></div>
          </div>
        </div>

        <div className="hero-orb">
          <div className="orb-backdrop" />
          <div className="orb-ring ring-a" />
          <div className="orb-ring ring-b" />
          <div className="orb-ring ring-c" />
          <div className="orb-core">
            <span className="pulse pulse-a" />
            <span className="pulse pulse-b" />
            <span className="pulse pulse-c" />
            <div className="orb-label">
              <p className="eyebrow">Core hub</p>
              <h3>Choose your path, find your server, and jump in.</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
