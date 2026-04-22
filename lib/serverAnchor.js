function safeUrlCandidate(raw) {
  if (!raw) return null;
  try {
    return new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function hashToken(input) {
  const source = String(input || 'tcentral-local-anchor');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36).padStart(8, '0');
}

export function getServerUniverseAnchor() {
  const candidate =
    safeUrlCandidate(process.env.NEXT_PUBLIC_APP_URL)
    || safeUrlCandidate(process.env.APP_URL)
    || safeUrlCandidate(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    || safeUrlCandidate(process.env.VERCEL_URL)
    || safeUrlCandidate('http://localhost:3000');

  const host = candidate?.host || 'localhost:3000';
  return {
    host,
    token: `srv-${hashToken(host)}`,
    address: host,
  };
}
