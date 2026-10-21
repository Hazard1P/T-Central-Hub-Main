'use client';

import Link from 'next/link';
import { useSteamSession } from '@/components/SteamSessionProvider';

export default function HomeAccount() {
  const { steamUser, googleUser, loading } = useSteamSession();
  const user = steamUser || googleUser;
  return <section className="home-account" aria-labelledby="home-account-title">
    <div><p className="home-eyebrow">YOUR PLACE IN THE UNIVERSE</p><h2 id="home-account-title">{loading ? 'Get ready to explore.' : user ? `Welcome back, ${steamUser?.personaname || googleUser?.name || 'explorer'}.` : 'One account. Your own journey.'}</h2><p>{user ? 'Your profile, discoveries and contribution history are a click away.' : 'Play as a guest, or sign in to connect your profile and join the conversation.'}</p></div>
    <div className="home-account-actions">{loading ? <p role="status">Checking your account…</p> : user ? <Link className="home-account-button" href="/profile">Open your profile <span aria-hidden="true">↗</span></Link> : <><a className="home-account-button" href="/api/auth/steam/login?redirectTo=/">Continue with Steam</a><a className="home-account-button" href="/api/auth/google/login?redirectTo=/">Continue with Google</a></>}</div>
  </section>;
}
