import PageShell from '@/components/PageShell';

export const metadata = { title: 'Multiplayer Policy' };

export default function MultiplayerPolicyPage() {
  return (
    <PageShell
      eyebrow="Shared hub policy"
      title="Multiplayer policy"
      text="These rules apply when entering the shared hub, interacting with other pilots, and using multiplayer mission systems."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">Conduct</p>
          <h3>Respect shared play</h3>
          <p className="muted">Harassment, cheating, griefing, spam, exploit abuse, and disruption of shared play are not allowed in the shared hub.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Enforcement</p>
          <h3>Moderation rights</h3>
          <p className="muted">T-Central may restrict, suspend, or remove shared-hub access when reports, investigation, or system integrity checks indicate abuse or rule violations.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Economy notice</p>
          <h3>In-game values only</h3>
          <p className="muted">E_s Credits and other in-game yield values are gameplay units only. They are not currency, stored value, external payout rights, or a guarantee of real-world return.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Support fairness</p>
          <h3>No paid gameplay advantage</h3>
          <p className="muted">One-time donations, recurring support, supporter recognition, account displays, community roles, previews, and future supporter perks do not provide paid gameplay advantage in shared multiplayer play and have no real-world value.</p>
        </article>
      </div>
    </PageShell>
  );
}
