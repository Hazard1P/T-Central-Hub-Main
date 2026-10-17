import { createHash, randomBytes } from 'crypto';

// Public roster IDs are not credentials. A guest can resume only from its opaque browser cookie.
export function resolveGuestPilotSession(cookieValue) {
  const valid = typeof cookieValue === 'string' && /^[a-f0-9]{48}$/.test(cookieValue);
  const value = valid ? cookieValue : randomBytes(24).toString('hex');
  return {
    value,
    setCookie: !valid,
    id: 'guest-' + createHash('sha256').update(value).digest('hex').slice(0, 24),
  };
}
