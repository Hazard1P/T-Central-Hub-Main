import Link from 'next/link';
import PageShell from '@/components/PageShell';
import ServerCards from '@/components/ServerCards';

export const metadata = { title: 'Servers' };

export default function ServerInfoPage() {
  return (
    <PageShell eyebrow="Game servers" title="Find your next server." text="Compare Arma 3 and Rust routes. Open a server for its game mode, address, and Steam connection options.">
      <ServerCards />
      <article className="content-card server-connection-help">
        <h2>Ready to connect?</h2>
        <p className="muted">Install the matching game in Steam, open a server page, and choose Quick Connect. If your browser cannot open Steam, copy the server address and join from the game’s server browser.</p>
        <div className="entry-actions">
          <Link className="button secondary" href="/information">Read the player guide</Link>
          <Link className="button secondary" href="/contact">Get connection help</Link>
        </div>
      </article>
    </PageShell>
  );
}
