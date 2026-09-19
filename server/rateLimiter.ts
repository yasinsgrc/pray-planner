import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal in-memory fixed-window limiter — a single Railway instance and
 * a personal-scale app don't need a distributed store (Redis) for this;
 * hand-rolling ~20 lines avoids an extra dependency for something this
 * narrow (design-refresh-v3 Faz 15).
 */
export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  /** How many keys the limiter is currently holding. Exposed because the
   * eviction below is only provable by observing this: the map used to
   * keep every key it had ever seen, which grew without bound. */
  activeKeys(): number;
}

export function createRateLimiter({
  windowMs,
  max,
}: {
  windowMs: number;
  max: number;
}): RateLimiterMiddleware {
  const hits = new Map<string, { count: number; windowStart: number }>();
  let lastSweep = Date.now();

  /** Drops every window that has already elapsed. Swept at most once per
   * window rather than on every request, so a burst from many distinct
   * addresses costs one O(n) pass per window instead of one per request. */
  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, entry] of hits) {
      if (now - entry.windowStart >= windowMs) hits.delete(key);
    }
  }

  function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    sweep(now);
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= max) {
      res.status(429).json({ error: 'Çok fazla istek, biraz sonra tekrar deneyin.' });
      return;
    }

    entry.count++;
    next();
  }

  rateLimiter.activeKeys = (): number => hits.size;
  return rateLimiter;
}
