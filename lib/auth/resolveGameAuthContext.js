import { defaultGoogleUsername } from "@/lib/server/usernameDefaults";
import { decryptSession } from "@/lib/security";

function decodeCookieSession(cookieStore, cookieName) {
  const raw = cookieStore?.get(cookieName)?.value;
  if (!raw) return null;

  try {
    const value = decryptSession(
      raw,
      cookieName === "steam_session" ? "steam" : "google",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function buildSteamContext(steamSession) {
  if (!steamSession?.steamid) return null;

  return {
    authenticated: true,
    provider: "steam",
    accountId: String(steamSession.steamid),
    displayName: steamSession.personaname || "Steam Pilot",
    identityKind: "steam",
  };
}

function buildGoogleContext(googleSession) {
  if (!googleSession?.sub) return null;

  return {
    authenticated: true,
    provider: "google",
    accountId: String(googleSession.sub),
    displayName:
      googleSession.gamertag || defaultGoogleUsername(googleSession.sub),
    identityKind: "google",
  };
}

export function resolveGameAuthContext(cookieStore) {
  const steamSession = decodeCookieSession(cookieStore, "steam_session");
  const googleSession = decodeCookieSession(cookieStore, "google_session");

  const steamContext = buildSteamContext(steamSession);
  const googleContext = buildGoogleContext(googleSession);
  const authContext = steamContext ||
    googleContext || {
      authenticated: false,
      provider: null,
      accountId: null,
      displayName: null,
      identityKind: null,
    };

  return {
    ...authContext,
    steamUser: steamSession,
    googleUser: googleContext
      ? { ...googleSession, gamertag: googleContext.displayName }
      : null,
  };
}
