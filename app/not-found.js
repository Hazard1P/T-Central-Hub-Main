import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function NotFound() {
  return (
    <PageShell eyebrow="Page not found" title="Let’s get you back on course." text="This address does not lead to a page in the hub. Choose a destination below.">
      <div className="entry-actions">
        <Link href="/" className="button primary">Return home</Link>
        <Link href="/server-info" className="button secondary">Find a server</Link>
        <Link href="/contact" className="button secondary">Get help</Link>
      </div>
    </PageShell>
  );
}
