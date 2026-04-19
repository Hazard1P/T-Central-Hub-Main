import PageShell from '@/components/PageShell';

export const metadata = { title: 'Server Info' };

export default function ServerInfoPage() {
  return (
    <PageShell
      eyebrow="World status"
      title="The web-base game is the live system."
      text="This project is being built as a shared 3D multiplayer space where players sign in, fly, spectate, and use blackholes as server-entry systems."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">Current direction</p>
          <h3>Live shared world</h3>
          <p className="muted">
            The 3D environment remains the actual web-game layer rather than a decorative landing page.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Core roles</p>
          <h3>Pilot and spectate</h3>
          <p className="muted">
            Players can pilot ships, move through space, and observe the shared room while navigating to blackholes and server routes.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Target</p>
          <h3>Persistent growth</h3>
          <p className="muted">
            Each package continues toward a fuller multiplayer simulator with better visuals, stronger sync, and deeper server interiors.
          </p>
        </article>
      </div>
    </PageShell>
  );
}
