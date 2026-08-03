import type { NextFunction, Request, Response } from 'express';

/**
 * Hand-rolled instead of the `cors` package — the actual requirement is
 * narrow (exactly one allowed origin, no credentials, a handful of
 * methods) and doesn't need a general-purpose library. CORS is
 * fundamentally a BROWSER-enforced mechanism: a request with no Origin
 * header (Railway's own health checks, curl, a native mobile client) isn't
 * a browser cross-origin request at all, so it's let through unmodified
 * regardless of this allowlist (design-refresh-v3 Faz 15).
 */
export function createCorsMiddleware(allowedOrigin: string) {
  return function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    if (origin !== allowedOrigin) {
      // A mismatched preflight is rejected outright (not just "missing the
      // header and left to the browser") — an explicit, testable signal
      // rather than relying solely on the browser's own enforcement.
      if (req.method === 'OPTIONS') {
        res.status(403).end();
        return;
      }
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    next();
  };
}
