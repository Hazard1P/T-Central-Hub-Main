import { createHash } from 'node:crypto';

export function defaultGoogleUsername(accountId) {
  return 'Pilot-' + createHash('sha256').update('google:' + accountId).digest('hex').slice(0, 16);
}
