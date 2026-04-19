import PageShell from '@/components/PageShell';

export const metadata = { title: 'EULA' };

export default function EulaPage() {
  return (
    <PageShell
      eyebrow="License agreement"
      title="End User License Agreement"
      text="This agreement governs your use of the T-Central game, systems, universe structures, and multiplayer hub."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">License scope</p>
          <h3>Limited use</h3>
          <p className="muted">You are granted a limited, revocable, non-transferable license to access and use T-Central for personal gameplay and related community participation.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Restrictions</p>
          <h3>No reverse engineering</h3>
          <p className="muted">You may not reverse engineer, exploit, duplicate, interfere with, or automate protected game systems, account logic, moderation functions, or multiplayer state systems.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Ownership</p>
          <h3>System ownership</h3>
          <p className="muted">All game systems, visuals, route structures, engine logic, and related platform components remain the property of the operator and licensors of T-Central.</p>
        </article>
      </div>
    </PageShell>
  );
}
