import { track } from '@vercel/analytics/server';

function canEmitTelemetry() {
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production';
}

function sanitizeProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value == null),
  );
}

export async function trackServerEvent(eventName, properties = {}) {
  if (!eventName || !canEmitTelemetry()) return;

  try {
    await track(eventName, sanitizeProperties(properties));
  } catch {
    // Best-effort analytics: never interrupt API or persistence flows.
  }
}
