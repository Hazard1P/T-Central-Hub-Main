import PageShell from '@/components/PageShell';
import HubCommunityForm from '@/components/HubCommunityForm';

export const metadata = { title: 'Community board' };

export default function HubFormPage() {
  return (
    <PageShell eyebrow="Community board" title="Share what’s happening in the hub." text="Read player posts, suggest events, and share server feedback. Sign in with Steam or Google to join the conversation. Use player reporting for moderation concerns.">
      <HubCommunityForm />
    </PageShell>
  );
}
