import express, { Express } from 'express';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';
import type { GeocodingClient } from './geocoding';
import { GeocodingRateLimitedError } from './geocoding';
import type { DailyVerseService } from './dailyVerse';

export interface CreateAppDeps {
  store: SubscriptionStore;
  vapidPublicKey: string;
  geocodingClient: GeocodingClient;
  dailyVerseService: DailyVerseService;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();
  app.use(express.json());

  // Two purposes (design-refresh-v3 Faz 6 B4/B1): a target for the host
  // platform's own health check, and a fast, single one-time probe the
  // frontend uses to decide whether /api/* exists at all — the identical
  // built bundle is deployed both standalone-static (no server) and
  // full-stack, so this can't be a build-time decision. `service` is a
  // discriminator the client checks (useApiAvailable.ts, design-refresh-v3
  // Faz 9 M1): a static host's SPA fallback (e.g. Netlify's /* -> 200
  // index.html) answers /health with 200 + an HTML document too, so `res.ok`
  // alone is a false positive there — the client must confirm the body is
  // genuinely this JSON shape, not just that *some* 200 came back.
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'vakit-api' });
  });

  app.get('/api/vapid-public-key', (_req, res) => {
    res.json({ publicKey: deps.vapidPublicKey });
  });

  app.post('/api/subscribe', async (req, res) => {
    const { endpoint, keys, location, calculationMethod, notifications } = req.body ?? {};

    if (!endpoint || !keys?.p256dh || !keys?.auth || !location || !calculationMethod || !notifications) {
      res.status(400).json({ error: 'Eksik abonelik alanları.' });
      return;
    }

    const record: PushSubscriptionRecord = {
      endpoint,
      keys,
      location,
      calculationMethod,
      notifications,
      updatedAt: new Date().toISOString(),
    };

    await deps.store.upsertSubscription(record);
    res.status(200).json({ ok: true });
  });

  app.post('/api/unsubscribe', async (req, res) => {
    const { endpoint } = req.body ?? {};

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint gerekli.' });
      return;
    }

    await deps.store.removeSubscription(endpoint);
    res.status(200).json({ ok: true });
  });

  // Gizlilik Politikası'nın "bildirimleri kapattığınızda kayıt silinir"
  // sözünü gerçekten tutan uç (design-refresh-v3 Faz 9 M5) — istemci
  // tarafında pushClient.ts'in unsubscribeFromPush'u, kullanıcı bildirimleri
  // kapattığında bunu çağırır. removeSubscription zaten var olmayan bir
  // endpoint için de sessizce başarılı döner (subscriptionStore.ts), yani
  // burada ayrıca "kayıt bulunamadı" hata dalı gerekmiyor.
  app.delete('/api/subscribe', async (req, res) => {
    const { endpoint } = req.body ?? {};

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint gerekli.' });
      return;
    }

    await deps.store.removeSubscription(endpoint);
    res.status(200).json({ ok: true });
  });

  app.get('/api/geocode', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (query.length < 3) {
      res.status(400).json({ error: 'q en az 3 karakter olmalı.' });
      return;
    }

    try {
      const results = await deps.geocodingClient.searchLocations(query);
      res.status(200).json({ results });
    } catch (err) {
      if (err instanceof GeocodingRateLimitedError) {
        res.status(503).json({ error: 'Arama servisi şu an yoğun, listeden seçebilirsiniz.' });
        return;
      }
      res.status(502).json({ error: 'Arama sırasında bir hata oluştu.' });
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat ve lng geçerli sayılar olmalı.' });
      return;
    }

    try {
      const location = await deps.geocodingClient.reverseGeocode(lat, lng);
      res.status(200).json({ location });
    } catch {
      res.status(502).json({ error: 'Konum çözümlenirken bir hata oluştu.' });
    }
  });

  app.get('/api/daily-verse', async (_req, res) => {
    try {
      const verse = await deps.dailyVerseService.getVerseOfTheDay();
      res.status(200).json(verse);
    } catch {
      res.status(502).json({ error: 'Günün ayeti alınamadı.' });
    }
  });

  return app;
}
