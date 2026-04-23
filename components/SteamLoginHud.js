'use client';

import { useSteamSession } from '@/components/SteamSessionProvider';

export default function SteamLoginHud() {
  const { steamUser: session, googleUser, support, universe, loading, presence } = useSteamSession();

  return (
    <div className="steam-login-hud">
      <div className="steam-login-card">
        <div className="steam-login-topline">
          <span className="steam-kicker">Steam Access</span>
          {session ? <span className="steam-status online">Steam linked</span> : <span className="steam-status">Steam guest</span>}
          {googleUser ? <span className="steam-status online">Google linked</span> : <span className="steam-status">Google guest</span>}
          {support ? <span className="steam-status support">Supporter</span> : null}
        </div>

        <div className="steam-login-body">
          {session?.avatar ? (
            <img className="steam-avatar" src={session.avatar} alt={session.personaname || 'Steam avatar'} />
          ) : (
            <div className="steam-avatar steam-avatar-fallback">S</div>
          )}

          <div className="steam-login-meta">
            {loading ? (
              <>
                <strong>Checking session…</strong>
                <small>Waiting for Steam profile</small>
              </>
            ) : session ? (
              <>
                <strong>{session.personaname || 'Steam user'}</strong>
                <small>{session.steamid}</small>
                <small className="steam-subtle">Observer and pilot layers synchronized</small>
                {universe?.privacy?.observanceScope ? <small className="steam-subtle">{universe.privacy.observanceScope}</small> : null}
              </>
            ) : (
              <>
                <strong>Sign in with Steam</strong>
                <small>Connect your Steam profile</small>
                <small className="steam-subtle">Guest observer shell stays synchronized until login</small>
                {universe?.privacy?.observanceScope ? <small className="steam-subtle">{universe.privacy.observanceScope}</small> : null}
              </>
            )}
          </div>
        </div>

        <div className="steam-login-actions">
          {universe?.prayerSeeds?.total ? <span className="steam-mini-link">Seeds {universe.prayerSeeds.total}</span> : null}
          {presence?.length ? <span className="steam-mini-link">Pilots {presence.length}</span> : null}
          {session || googleUser ? (
            <>
              {session.profileurl ? (
                <a className="steam-mini-link" href={session.profileurl} target="_blank" rel="noreferrer">
                  Profile
                </a>
              ) : null}
              <a className="steam-mini-link" href="/report-player">
                Report player
              </a>
              {session ? <a className="steam-mini-link" href="/api/auth/steam/logout">Sign out Steam</a> : null}
              {googleUser ? <a className="steam-mini-link" href="/api/auth/google/logout">Sign out Google</a> : null}
            </>
          ) : (
            <>
              <a className="steam-login-button" href="/api/auth/steam/login?redirectTo=/system">
                Continue with Steam
              </a>
              <a className="steam-login-button" href="/api/auth/google/login?redirectTo=/system">
                Continue with Google
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
