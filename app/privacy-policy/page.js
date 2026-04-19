import PageShell from '@/components/PageShell';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      eyebrow="Privacy policy"
      title="Privacy policy"
      text="This policy explains the core data used by the T-Central website, Steam-linked sign-in flow, multiplayer hub presence, private world isolation, and connected route portals."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">Steam sign-in</p>
          <h3>Identity data</h3>
          <p className="muted">
            When you sign in with Steam, the system may process your SteamID, display name, profile URL, and avatar for session, lobby, and route-interface purposes.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Multiplayer hub</p>
          <h3>Shared room presence</h3>
          <p className="muted">
            The public multiplayer hub may process lightweight shared presence data such as room membership, flight role, and in-system movement markers for Steam-linked users.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Private world</p>
          <h3>Scoped personal state</h3>
          <p className="muted">
            Private world state should remain isolated to the linked Steam account. Sensitive private state should be encrypted at rest and transported only over secure sessions.
          </p>
        </article>
      </div>
    </PageShell>
  );
}
