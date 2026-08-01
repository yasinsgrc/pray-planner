import express, { Express } from 'express';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';
import type { GeocodingClient } from './geocoding';

export interface CreateAppDeps {
  store: SubscriptionStore;
  vapidPublicKey: string;
  geocodingClient: GeocodingClient;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/vapid-public-key', (_req, res) => {
    res.json({ publicKey: deps.vapidPublicKey });
  });

  app.post('/api/subscribe', (req, res) => {
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

    deps.store.upsertSubscription(record);
    res.status(200).json({ ok: true });
  });

  app.post('/api/unsubscribe', (req, res) => {
    const { endpoint } = req.body ?? {};

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint gerekli.' });
      return;
    }

    deps.store.removeSubscription(endpoint);
    res.status(200).json({ ok: true });
  });

  app.get('/api/geocode', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (query.length < 2) {
      res.status(400).json({ error: 'q en az 2 karakter olmalı.' });
      return;
    }

    try {
      const results = await deps.geocodingClient.searchLocations(query);
      res.status(200).json({ results });
    } catch {
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

  return app;
}
