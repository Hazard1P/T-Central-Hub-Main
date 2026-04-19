const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const ALLOWED_PROTOCOLS = new Set(['http', 'https']);

function stripTrailingSlash(value) {
  return value.replace(/\/$/, '');
}

function normalizeUrl(raw) {
  if (!raw) return null;
  const candidate = raw.trim();
  if (!candidate) return null;

  const withProtocol = candidate.startsWith('http://') || candidate.startsWith('https://') ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (!ALLOWED_PROTOCOLS.has(url.protocol.replace(':', ''))) return null;
    return stripTrailingSlash(url.toString());
  } catch {
    return null;
  }
}

function sanitizeForwardedValue(value) {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  if (!first) return null;
  if (/[\s/@?#\\]/.test(first)) return null;
  return first;
}

function isValidHost(value) {
  if (!value) return false;
  const hostname = value.toLowerCase();
  const domainOrIpv4 = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/i;
  const ipv6 = /^\[[a-f0-9:]+\](?::\d{1,5})?$/i;
  return domainOrIpv4.test(hostname) || ipv6.test(hostname);
}

function getHostWithoutPort(host) {
  if (!host) return '';
  if (host.startsWith('[')) {
    const endIndex = host.indexOf(']');
    if (endIndex >= 0) return host.slice(0, endIndex + 1).toLowerCase();
  }
  return host.split(':')[0].toLowerCase();
}

function buildTrustedHosts() {
  const configured = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map(normalizeUrl)
    .find(Boolean);

  const hosts = new Set();
  if (configured) hosts.add(new URL(configured).host.toLowerCase());

  const envAllowlist = process.env.APP_URL_ALLOWED_HOSTS || process.env.TRUSTED_HOSTS || '';
  for (const value of envAllowlist.split(',')) {
    const host = sanitizeForwardedValue(value);
    if (host && isValidHost(host)) hosts.add(host.toLowerCase());
  }

  const vercelHosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .map((value) => sanitizeForwardedValue(value))
    .filter(Boolean);
  for (const host of vercelHosts) {
    if (isValidHost(host)) hosts.add(host.toLowerCase());
  }

  for (const host of LOCAL_DEV_HOSTS) hosts.add(host);

  return hosts;
}

export function getCanonicalAppUrl() {
  return [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
    .map(normalizeUrl)
    .find(Boolean) || null;
}

export function getSiteUrl() {
  const canonical = getCanonicalAppUrl();
  if (canonical) return canonical;

  const fallback = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    || normalizeUrl(process.env.VERCEL_URL)
    || 'http://localhost:3000';

  return stripTrailingSlash(fallback);
}

function getValidatedHeaderBaseUrl(request) {
  const trustedHosts = buildTrustedHosts();
  const rawHost = request?.headers.get('x-forwarded-host') || request?.headers.get('host');
  const host = sanitizeForwardedValue(rawHost);
  if (!host || !isValidHost(host)) return null;

  const normalizedHost = host.toLowerCase();
  const hostname = getHostWithoutPort(normalizedHost);
  if (!trustedHosts.has(normalizedHost) && !trustedHosts.has(hostname)) return null;

  const rawProto = sanitizeForwardedValue(request?.headers.get('x-forwarded-proto'));
  const proto = rawProto?.toLowerCase();
  if (proto && !ALLOWED_PROTOCOLS.has(proto)) return null;

  const defaultProto = LOCAL_DEV_HOSTS.has(hostname) ? 'http' : 'https';
  const selectedProto = proto || defaultProto;
  return `${selectedProto}://${normalizedHost}`;
}

export function getRequestBaseUrl(request) {
  const canonical = getCanonicalAppUrl();
  if (canonical) return canonical;

  const fromHeaders = getValidatedHeaderBaseUrl(request);
  if (fromHeaders) return fromHeaders;

  return 'http://localhost:3000';
}

export function shouldUseSecureCookies(request) {
  const canonical = getCanonicalAppUrl();
  if (canonical) return canonical.startsWith('https://');

  const baseUrl = getValidatedHeaderBaseUrl(request);
  if (baseUrl) return baseUrl.startsWith('https://');

  return process.env.NODE_ENV === 'production';
}
