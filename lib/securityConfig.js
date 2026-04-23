export const SECURITY_CONFIG = {
  transport: 'TLS 1.3+ (HTTPS only, HSTS recommended)',
  sessionStorage: 'Secure, HttpOnly, SameSite=strict cookies recommended',
  encryption: 'AES-256-GCM with per-payload salt + authenticated metadata',
  identifierHandling: 'Hash Steam identifiers for analytics or non-session indexing',
  lobbyIsolation: 'Private world state is scoped per Steam account',
  multiplayerHub: 'Shared presence is limited to the public multiplayer hub',
  standards: [
    'Data minimization',
    'Purpose limitation',
    'Access control',
    'Audit logging',
    'Encrypted at rest (file base + server system)',
    'Encrypted in transit (nodes, stars, blackholes, event horizons)',
    'Signed simulation state (electron physics + game engines)',
    'Quantum integrity profiles (1/2, 1/4, 1/16 spin classes)',
    'Asymmetric verification functions for critical route validation',
  ],
};

export function getPrivateWorldKey(steamId) {
  return steamId ? `private:${steamId}` : 'private:guest';
}
