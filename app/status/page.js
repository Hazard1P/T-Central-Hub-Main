import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { WORLD_SUMMARY } from '@/lib/worldLayout';

export const metadata = { title: 'Project status' };

export default function StatusPage() {
  return <PageShell eyebrow="Project status" title="A universe in development." text="Follow the browser project, find community servers and help shape what comes next.">
    <div className="card-grid two">
      <article className="content-card"><h2>Browser universe</h2><p>Explore one continuous universe with {WORLD_SUMMARY.blackholes} blackholes, {WORLD_SUMMARY.dysonSpheres} Dyson spheres and a UTC-based Solar System. These are game-world features, not a count of hosted servers.</p><Link href="/system" className="button primary">Play in your browser</Link></article>
      <article className="content-card"><h2>Game server hosting</h2><p>T-Central does not currently operate active Rust or Arma 3 servers. Our discovery browser showcases independent communities using current third-party rankings when available.</p><Link href="/server-info" className="button secondary">Find community servers</Link></article>
      <article className="content-card"><h2>Community and feedback</h2><p>Use your Steam or Google account to publish ideas and updates under a heading and category. The board refreshes while you browse.</p><Link href="/hub-form" className="button secondary">Visit the board</Link></article>
      <article className="content-card"><h2>Keep development moving</h2><p>Voluntary contributions support ongoing development, marketing and project hardware. No contribution is required to play or participate.</p><Link href="/donate" className="button secondary">Support the project</Link></article>
    </div>
  </PageShell>;
}
