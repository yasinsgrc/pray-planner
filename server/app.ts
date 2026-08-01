import express, { Express } from 'express';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';

export interface CreateAppDeps {
  store: SubscriptionStore;
  vapidPublicKey: string;
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

  return app;
}
