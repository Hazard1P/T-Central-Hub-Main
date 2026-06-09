import PageShell from '@/components/PageShell';

export const metadata = { title: 'EULA' };

export default function EulaPage() {
  return (
    <PageShell
      eyebrow="License agreement"
      title="End User License Agreement"
      text="This agreement governs your use of the T-Central game, systems, universe structures, and multiplayer hub."
    >
      <section className="content-card" aria-labelledby="eula-template-review">
        <p className="eyebrow">Template/legal review</p>
        <h3 id="eula-template-review">Draft template notice</h3>
        <p className="muted">
          This EULA is draft template language for planning and transparency. It should be reviewed and approved by qualified legal counsel before production use or reliance.
        </p>
      </section>

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
        <article className="content-card">
          <p className="eyebrow">Support/perks</p>
          <h3>Supporter recognition and future perks</h3>
          <p className="muted">Any supporter recognition, cosmetic acknowledgement, or future perk is revocable, non-transferable, and not a sale of game ownership, platform ownership, intellectual property, account ownership, or a permanent entitlement.</p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Service rules</p>
          <h3>Benefits remain governed by the EULA</h3>
          <p className="muted">In-game items, access, credits, acknowledgements, or benefits remain subject to this EULA, multiplayer policy, moderation decisions, technical availability, and other T-Central service rules.</p>
        </article>
      </div>
    </PageShell>
  );
}
