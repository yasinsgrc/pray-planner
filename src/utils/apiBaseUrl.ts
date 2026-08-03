import { joinApiUrl } from './urlJoin';

/**
 * The API can now live on a different origin than the frontend (Netlify
 * static site + Railway API, design-refresh-v3 Faz 15) — every fetch to
 * /health or /api/* must go through this instead of a bare relative path.
 * Empty (unset) preserves the original single-origin behavior: a relative
 * path, exactly as before, for the "tek origin Node host" deployment mode
 * where the frontend and API are served by the same process.
 */
// Optional-chained on `.env` itself, not just the key: import.meta.env
// only exists inside Vite's own runtime, and evaluates to undefined
// (not thrown) when this module is imported by a plain node:test process
// (e.g. transitively via useApiAvailable.test.ts) — `?.` short-circuits
// safely there instead of crashing the whole test file.
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return joinApiUrl(API_BASE_URL, path);
}
