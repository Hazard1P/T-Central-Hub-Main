import PageShell from '@/components/PageShell';
import HubCommunityForm from '@/components/HubCommunityForm';

export const metadata = { title: 'Community board' };

export default function HubFormPage() {
  return (
    <PageShell eyebrow="Community board" title="Community discussions." text="Explore Space & Time, game communities, project development and the community lounge. Sign in with Steam or Google to join the conversation. Use player reporting for moderation concerns.">
      <HubCommunityForm />
    </PageShell>
  );
}
