export const SECURITY_CONFIG = {
  transport: 'HTTPS only',
  sessionStorage: 'Secure, HttpOnly, SameSite cookies recommended',
  encryption: 'AES-256-GCM for stored sensitive payloads',
  identifierHandling: 'Hash Steam identifiers for analytics or non-session indexing',
  lobbyIsolation: 'Private world state is scoped per Steam account',
  multiplayerHub: 'Shared presence is limited to the public multiplayer hub',
  standards: [
    'Data minimization',
    'Purpose limitation',
    'Access control',
    'Audit logging',
    'Encrypted at rest',
    'Encrypted in transit',
  ],
};

export function getPrivateWorldKey(steamId) {
  return steamId ? `private:${steamId}` : 'private:guest';
}
