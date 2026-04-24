import PageShell from '@/components/PageShell';
import DiscordPanel from '@/components/DiscordPanel';

const blocks = [
  {
    title: 'Community standards',
    text: 'Use this area for fair-play standards, anti-cheat expectations, comms expectations, and cross-community behavior guidelines.'
  },
  {
    title: 'Announcements and updates',
    text: 'Use this area for wipes, event nights, map changes, restarts, downtime messages, and featured notices.'
  },
  {
    title: 'New player guidance',
    text: 'Use this section for onboarding, join instructions, quick-start notes, and an overview of how each server is meant to be played.'
  },
  {
    title: 'Support and moderation',
    text: 'Point players toward Discord, moderation contact flow, and the dedicated player reporting page without building any account system.'
  },
  {
    title: 'Blackhole route interlink',
    text: 'Route subsections are designed to function alone (direct join instructions) and together (shared 3D/15D universe navigation and status sync).'
  }
];

export const metadata = {
  title: 'Information',
  description: 'T-Central information page for updates, onboarding, standards, and community guidance.'
};

export default function InformationPage() {
  return (
    <PageShell
      eyebrow="Information"
      title="A central page for updates, expectations, and helping players settle in."
      text="Keep both communities informed with one easy place for expectations, update notes, and quick guidance."
      heroImage={{
        src: '/cosmic-map-reference.jpg',
        alt: 'Cosmic map reference art used by T-Central Hub',
      }}
    >
      <div className="card-grid two">
            {blocks.map((block) => (
              <article key={block.title} className="content-card">
                <h3>{block.title}</h3>
                <p className="muted">{block.text}</p>
              </article>
            ))}
      </div>
      <DiscordPanel />
    </PageShell>
  );
}
