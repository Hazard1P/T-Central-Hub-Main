import { getSiteUrl } from '@/lib/runtimeConfig';

export function getGoogleAuthBaseUrl() {
  return getSiteUrl();
}

export function shouldUseSecureGoogleCookie(baseUrl) {
  return String(baseUrl || '').startsWith('https://');
}

