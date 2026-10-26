import UsernameSettings from '@/components/UsernameSettings';
import { resolveAccountUsername } from '@/lib/server/accountUsernameStore';
import Link from 'next/link';
import { cookies } from 'next/headers';
import PageShell from '@/components/PageShell';
import ContributionHistory from '@/components/ContributionHistory';
import ShipProgress from '@/components/ShipProgress';
import PrayerSeedCollection from '@/components/PrayerSeedCollection';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account', description: 'Your private account and universe discoveries.', robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const auth = await resolveAccountUsername(resolveGameAuthContext(cookies()));
  return <PageShell eyebrow="Your space" title="Your account." text={auth.authenticated ? `Welcome, ${auth.displayName || 'explorer'}. Your discoveries follow your account.` : 'Sign in to keep your discoveries across visits.'}>
    {auth.authenticated ? <><UsernameSettings key={`username:${auth.provider}:${auth.accountId}`} ownerKey={`${auth.provider}:${auth.accountId}`} provider={auth.provider} /><ShipProgress key={`ship:${auth.provider}:${auth.accountId}`} ownerKey={`${auth.provider}:${auth.accountId}`} /><PrayerSeedCollection key={`${auth.provider}:${auth.accountId}`} provider={auth.provider} /><ContributionHistory key={`payments:${auth.provider}:${auth.accountId}`} /></> : <div className="seed-profile-card"><h2>Continue your journey</h2><div className="exploration-actions"><a className="button primary" href="/api/auth/steam/login?redirectTo=/profile">Continue with Steam</a><a className="button secondary" href="/api/auth/google/login?redirectTo=/profile">Continue with Google</a></div></div>}
    <Link className="button secondary" href="/system">Return to the universe</Link>
  </PageShell>;
}
