import PageShell from '@/components/PageShell';

export const metadata = { title: 'Multiplayer Policy' };

export default function MultiplayerPolicyPage() {
  return (
    <PageShell
      eyebrow="Shared hub policy"
      title="Multiplayer policy"
      text="These rules apply when entering the shared hub, interacting with other pilots, and using multiplayer mission systems."
    >
      <section className="content-card" aria-labelledby="multiplayer-template-review">
        <p className="eyebrow">Template/legal review</p>
        <h3 id="multiplayer-template-review">Draft template notice</h3>
        <p className="muted">
          This multiplayer policy is draft template language for planning and transparency. It should be reviewed and approved by qualified legal counsel before production use or reliance.
        </p>
      </section>

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
          <p className="muted">E_s Credits and other in-game yield values are gameplay-only units. They are not currency, stored value, cash-out rights, property, or a guarantee of external payout, real-world value, or real-world return.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Donations</p>
          <h3>No gameplay or moderation purchase</h3>
          <p className="muted">Donations and supporter status do not buy moderation immunity, competitive advantage, preferential enforcement, guaranteed matchmaking, guaranteed server capacity, or guaranteed access to the shared hub.</p>
        </article>
      </div>
    </PageShell>
  );
}
