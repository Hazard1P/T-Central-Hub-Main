import PageShell from '@/components/PageShell';

export const metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About the hub"
      title="A cleaner front-end shell for T-Central"
      text="T-Central Hub keeps the observer view simple while the deeper world layer continues running background cinematics, route logic, Steam-aware session flows, and server access panels."
    >
      <div className="content-grid">
        <article className="content-card">
          <h3>What this build focuses on</h3>
          <p>Defined player-facing layers, cleaner route access, support flows, and a cinematic background that stays active without drowning the interface.</p>
        </article>
        <article className="content-card">
          <h3>System layers</h3>
          <p>The hub surface, observer HUD, route panels, and the world canvas are separated so the live scene remains readable and the system objects stay visually ordered.</p>
        </article>
      </div>
    </PageShell>
  );
}
