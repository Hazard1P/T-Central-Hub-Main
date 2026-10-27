import Link from "next/link";
import PageShell from "@/components/PageShell";
import ModerationDashboard from "@/components/ModerationDashboard";
import { resolveModerationAdmin } from "@/lib/auth/resolveModerationAdmin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Player moderation",
  robots: { index: false, follow: false },
};
export default async function ModerationPage() {
  const { authorized, auth } = await resolveModerationAdmin();
  return (
    <PageShell
      eyebrow="Community administration"
      title="Player moderation"
      text="Review private reports and manage access to T-Central shared play."
    >
      {authorized ? (
        <ModerationDashboard />
      ) : (
        <section className="content-card">
          <h2>Administrator access required</h2>
          <p>
            {auth.authenticated
              ? "This account is not on the moderation administrator allowlist. Your stable account ID is available in your profile."
              : "Sign in with your authorized Google or Steam account to continue."}
          </p>
          <Link className="button secondary" href="/profile">
            Open your account
          </Link>
        </section>
      )}
    </PageShell>
  );
}
