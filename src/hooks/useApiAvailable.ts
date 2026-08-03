import { useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiBaseUrl';

/**
 * Whether this deployment has the Express server behind it at all — the
 * same built bundle can be served fully standalone (no /api/*, e.g. a
 * static host) or alongside the server, so this can't be a build-time
 * decision (design-refresh-v3 Faz 6 B1/B4). A single /health probe,
 * cached at module scope so it only ever runs once per page load
 * regardless of how many components ask.
 *
 * `res.ok` alone is not sufficient (design-refresh-v3 Faz 9 M1): a static
 * host's SPA fallback (e.g. Netlify's `/* -> /index.html` with status 200)
 * answers a GET /health with a 200 too — its body is just the app's own
 * index.html, not a real health response. Measured false positive: the
 * whole notification section would render on a serverless deploy and
 * silently fail the moment a user tried to use it. The response must be
 * confirmed as genuinely coming from server/app.ts's own /health handler:
 * JSON content-type AND a `service` field matching what only that handler
 * sends. A 3s timeout keeps an unresponsive host from leaving the check
 * hanging indefinitely instead of resolving to "unavailable".
 */
const HEALTH_CHECK_TIMEOUT_MS = 3000;
const EXPECTED_SERVICE = 'vakit-api';

let cachedResult: Promise<boolean> | null = null;

/** Exported for direct testing (useApiAvailable.test.ts) without needing a DOM — the hook itself just wraps this with React state. */
export async function checkApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/health'), {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return false;

    const body = await res.json();
    return body?.service === EXPECTED_SERVICE;
  } catch {
    return false;
  }
}

function getCachedApiAvailable(): Promise<boolean> {
  if (!cachedResult) {
    cachedResult = checkApiAvailable();
  }
  return cachedResult;
}

/** null while the one-time check is still in flight. */
export function useApiAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedApiAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
