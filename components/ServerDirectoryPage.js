import { Suspense } from 'react';
import PageShell from '@/components/PageShell';
import ServerDirectory from '@/components/ServerDirectory';

export default function ServerDirectoryPage({ initialGame = 'rust' }) {
  return (
    <PageShell eyebrow="Community server discovery" title="Find your next session." text="Explore populated Rust and Arma 3 communities, compare servers and choose where to play.">
      <Suspense fallback={<p role="status">Loading server browser…</p>}><ServerDirectory initialGame={initialGame} /></Suspense>
    </PageShell>
  );
}
