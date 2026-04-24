import PageShell from '@/components/PageShell';
import HubCommunityForm from '@/components/HubCommunityForm';

export const metadata = { title: 'Hub Form' };

export default function HubFormPage() {
  return (
    <PageShell
      eyebrow="T-Central board"
      title="Post to the community form"
      text="Steam-authenticated users can publish hub feedback, route ideas, bug reports, and event notes from one clean posting page."
      heroImage={{
        src: '/arma-cth-shot.png',
        alt: 'T-Central in-game tactical environment',
      }}
    >
      <HubCommunityForm />
    </PageShell>
  );
}
