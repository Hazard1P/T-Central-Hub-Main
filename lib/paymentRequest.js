import { getRequestBaseUrl } from './runtimeConfig.js';

export function isSameOriginPaymentRequest(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  // Next may normalize request.url to its internal hostname. Use the existing
  // configured/trusted-host resolver for the browser-visible checkout origin.
  return !origin || origin === new URL(getRequestBaseUrl(request)).origin;
}
