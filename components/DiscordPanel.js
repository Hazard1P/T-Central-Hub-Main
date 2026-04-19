export default function DiscordPanel() {
  return (
    <section className="section-block">
      <div className="container">
        <div className="discord-panel">
          <div>
            <p className="eyebrow">Community hub</p>
            <h3>Join the Discord to meet players, get updates, ask for help, and stay connected between sessions.</h3>
            <p className="muted">
              Whether you are looking for a squad, checking for server updates, or just want to stay close to the community, Discord is the fastest way to stay involved.
            </p>
          </div>
          <div className="button-column">
            <a href="https://discord.gg/8bJAEau9" target="_blank" rel="noreferrer" className="button primary">Join Discord</a>
            <a href="/information" className="button secondary">Open Information</a>
          </div>
        </div>
      </div>
    </section>
  );
}
