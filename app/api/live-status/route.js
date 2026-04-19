import { mergeStatusesWithDefaults } from '@/lib/serverData';

export async function GET() {
  const url = process.env.STATUS_SOURCE_URL;

  if (!url) {
    return Response.json({
      ok: true,
      mode: 'unconfigured',
      statuses: mergeStatusesWithDefaults(),
    });
  }

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return Response.json({
        ok: false,
        mode: 'error',
        error: `Status source returned ${res.status}`,
        statuses: mergeStatusesWithDefaults(),
      });
    }

    const data = await res.json();
    return Response.json({
      ok: true,
      mode: 'remote',
      statuses: mergeStatusesWithDefaults(data.statuses || {}),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      mode: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      statuses: mergeStatusesWithDefaults(),
    });
  }
}
