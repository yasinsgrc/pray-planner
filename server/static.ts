import path from 'node:path';
import express, { Express } from 'express';

/**
 * Serves the built SPA from `distDir` and falls back to index.html for any
 * non-/api route, so this server can be the single origin for both the
 * frontend and the API (design-refresh-v3 Faz 6 B4) — the app calls /api/*
 * with relative URLs, so frontend and API must share an origin unless a
 * reverse proxy handles that instead.
 *
 * index.html and sw.js must never be cached: the update-available banner
 * (App.tsx) and the service worker's own build-time-embedded version
 * (public/sw.js, design-refresh-v3 Faz 5 F1) both depend on a client
 * actually re-fetching these on the next load to notice a new deploy — a
 * cached index.html would never even request the new one to compare.
 * /assets/* is safe to cache forever: Vite renames those files on content
 * change, so the same URL never serves different bytes.
 */
export function attachStaticApp(app: Express, distDir: string): void {
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}
