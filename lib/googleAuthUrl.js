import { getSteamAuthBaseUrl } from './steamAuthUrl.js';

export function getGoogleAuthBaseUrl() {
  return getSteamAuthBaseUrl();
}

export function shouldUseSecureGoogleCookie(baseUrl) {
  return String(baseUrl || '').startsWith('https://');
}

