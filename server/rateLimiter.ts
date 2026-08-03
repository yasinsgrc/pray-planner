import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal in-memory fixed-window limiter — a single Railway instance and
 * a personal-scale app don't need a distributed store (Redis) for this;
 * hand-rolling ~20 lines avoids an extra dependency for something this
 * narrow (design-refresh-v3 Faz 15).
 */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; windowStart: number }>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
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
  };
}
