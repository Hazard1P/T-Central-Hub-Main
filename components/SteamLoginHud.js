'use client';

import { useSteamSession } from '@/components/SteamSessionProvider';

export default function SteamLoginHud() {
  const { steamUser: session, support, universe, loading, presence } = useSteamSession();

  return (
    <div className="steam-login-hud">
      <div className="steam-login-card">
        <div className="steam-login-topline">
          <span className="steam-kicker">Steam Access</span>
          {session ? <span className="steam-status online">Linked</span> : <span className="steam-status">Guest</span>}
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
          {session ? (
            <>
              {session.profileurl ? (
                <a className="steam-mini-link" href={session.profileurl} target="_blank" rel="noreferrer">
                  Profile
                </a>
              ) : null}
              <a className="steam-mini-link" href="/report-player">
                Report player
              </a>
              <a className="steam-mini-link" href="/api/auth/steam/logout">
                Sign out
              </a>
            </>
          ) : (
            <a className="steam-login-button" href="/api/auth/steam/login">
              Continue with Steam
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
