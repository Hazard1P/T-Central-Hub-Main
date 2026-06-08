import PageShell from '@/components/PageShell';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      eyebrow="Privacy policy"
      title="Privacy policy"
      text="This policy explains the core data used by the T-Central website, Steam-linked sign-in flow, multiplayer hub presence, private world isolation, and connected route portals."
    >
      <div className="legal-section-grid">
        <article className="content-card legal-card">
          <p className="eyebrow">Steam sign-in</p>
          <h3>Identity data</h3>
          <div className="legal-meta-row">
            <span>Steam-linked</span>
            <span>Session scoped</span>
          </div>
          <p className="muted">
            When you sign in with Steam, the system may process your SteamID, display name, profile URL, and avatar for session, lobby, and route-interface purposes.
          </p>
        </article>
        <article className="content-card legal-card">
          <p className="eyebrow">Multiplayer hub</p>
          <h3>Shared room presence</h3>
          <div className="legal-meta-row">
            <span>Shared room</span>
            <span>Lightweight</span>
          </div>
          <p className="muted">
            The public multiplayer hub may process lightweight shared presence data such as room membership, flight role, and in-system movement markers for Steam-linked users.
          </p>
        </article>
        <article className="content-card legal-card">
          <p className="eyebrow">Private world</p>
          <h3>Scoped personal state</h3>
          <div className="legal-meta-row">
            <span>User-scoped</span>
            <span>Secure sessions</span>
          </div>
          <p className="muted">
            Private world state should remain isolated to the linked Steam account. Sensitive private state should be encrypted at rest and transported only over secure sessions.
          </p>
        </article>
      </div>

      <aside className="content-card legal-summary-card">
        <p className="eyebrow">Related terms</p>
        <h3>How your access is governed</h3>
        <p className="muted">
          Review the terms and conditions for expectations around site use, multiplayer spaces, private worlds, and external route availability.
        </p>
        <a className="legal-cta" href="/terms-and-conditions">Read terms</a>
      </aside>
    </PageShell>
  );
}
