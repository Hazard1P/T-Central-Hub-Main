const LOCAL_DEV_DEFAULT = 'http://localhost:3000';

function validateConfiguredUrl(raw) {
  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('NEXT_PUBLIC_APP_URL must be a valid absolute URL (for example, https://example.com).');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('NEXT_PUBLIC_APP_URL must use http:// or https://.');
  }

  if (!parsed.hostname) {
    throw new Error('NEXT_PUBLIC_APP_URL must include a hostname.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('NEXT_PUBLIC_APP_URL must not include username or password.');
  }

  return parsed.origin;
}

export function getSteamAuthBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Steam auth requires NEXT_PUBLIC_APP_URL to be configured in production.');
    }

    return LOCAL_DEV_DEFAULT;
  }

  return validateConfiguredUrl(configured);
}

export function shouldUseSecureSteamCookie(baseUrl) {
  const hostname = new URL(baseUrl).hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return !isLocalhost;
}
