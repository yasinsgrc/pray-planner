import { useEffect, useState } from 'react';

/**
 * Whether this deployment has the Express server behind it at all — the
 * same built bundle can be served fully standalone (no /api/*, e.g. a
 * static host) or alongside the server, so this can't be a build-time
 * decision (design-refresh-v3 Faz 6 B1/B4). A single /health probe,
 * cached at module scope so it only ever runs once per page load
 * regardless of how many components ask.
 */
let cachedResult: Promise<boolean> | null = null;

function checkApiAvailable(): Promise<boolean> {
  if (!cachedResult) {
    cachedResult = fetch('/health', { method: 'GET' })
      .then((res) => res.ok)
      .catch(() => false);
  }
  return cachedResult;
}

/** null while the one-time check is still in flight. */
export function useApiAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkApiAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
