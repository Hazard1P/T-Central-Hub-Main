export const SECURITY_CONFIG = {
  transport: "HTTPS / WSS required for public production traffic",
  sessionStorage:
    "HttpOnly, Secure on HTTPS, SameSite=Lax; server-enforced seven-day expiry",
  encryption:
    "AES-256-GCM envelopes; HKDF-SHA256 purpose separation and rotating key IDs",
  identifierHandling:
    "Verified provider/account IDs; private data excluded from public responses",
  lobbyIsolation:
    "Private account records require verified Google or Steam sign-in",
  multiplayerHub:
    "Signed short-lived tickets; authoritative flight and account-ban checks",
  standards: [
    "Authenticated encryption",
    "Purpose-separated keys",
    "Least-privilege database access",
    "Same-origin API mutations",
    "Bounded request bodies",
    "Private moderation audit records",
  ],
};
export function getPrivateWorldKey(steamId) {
  return steamId ? `private:${steamId}` : "private:guest";
}
