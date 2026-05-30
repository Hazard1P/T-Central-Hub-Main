import Link from 'next/link';
import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import SteamLoginHud from '@/components/SteamLoginHud';
import HubCommunityForm from '@/components/HubCommunityForm';

export const metadata = { title: 'Hub Form' };

export default function HubFormPage() {
  return (
    <main className="entry-page cosmic-entry-page simplified-home-page hub-form-entry-page">
      <CinematicUniverseCanvas mode="landing" className="entry-universe-canvas" />
      <SteamLoginHud />
      <div className="cosmic-overlay cinematic" />

      <section className="entry-shell simplified hub-form-entry-shell">
        <div className="entry-copy cosmic-hero-panel entry-hero-panel simplified-panel hub-form-hero-panel">
          <p className="eyebrow">T-Central board</p>
          <h1>Community form aligned to the main gateway.</h1>
          <p className="muted max-copy">
            Post feedback, event notes, server reports, route ideas, and game-system requests from a cleaner hub page that now matches the front-page visual stack.
          </p>
          <div className="entry-actions">
            <Link className="button primary" href="/system">Enter flight system</Link>
            <Link className="button secondary" href="/">Back to front page</Link>
            <Link className="button secondary" href="/report-player">Report player</Link>
          </div>
          <div className="entry-status-bar refined">
            <span>Steam-gated posting</span>
            <span>Community signal board</span>
            <span>Server feedback route</span>
          </div>
        </div>

        <HubCommunityForm />
      </section>
    </main>
  );
}
