import express, { Express } from 'express';
import type { PushStore, ScheduleEntry } from './pushStore';
import type { GeocodingClient } from './geocoding';
import { GeocodingRateLimitedError } from './geocoding';
import type { DailyVerseService } from './dailyVerse';
import { createCorsMiddleware } from './corsMiddleware';
import { createRateLimiter } from './rateLimiter';

// 30 days x 6 prayers x 2 (main + early-warning) = 360, the client's own
// upper bound (src/utils/pushSchedule.ts) — a margin above that, not an
// exact match, so a legitimate client isn't rejected by an off-by-one
// between the two independently-maintained numbers.
const MAX_SCHEDULE_ENTRIES = 400;
const SUBSCRIBE_RATE_LIMIT = { windowMs: 60_000, max: 10 };

export interface CreateAppDeps {
  pushStore: PushStore;
  vapidPublicKey: string;
  geocodingClient: GeocodingClient;
  dailyVerseService: DailyVerseService;
  corsAllowedOrigin: string;
}

interface ScheduleRequestBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  schedule?: unknown;
}

type ParsedScheduleRequest =
  | { status: 'ok'; endpoint: string; p256dh: string; auth: string; schedule: ScheduleEntry[] }
  | { status: 'error'; error: string };

/** Validates and normalizes a subscribe/schedule request body, or returns
 * an error message for the caller to respond with. Shared by both
 * endpoints — they only differ in intent, not in what a valid body looks
 * like. A string-literal `status` discriminant, not a boolean `ok` one —
 * this project's tsconfig doesn't set `strict: true`, and a plain boolean
 * discriminant doesn't reliably narrow a union without it (verified: TS
 * accepts `status: 'ok' | 'error'` narrowing, rejects `ok: true | false`
 * narrowing, under this exact tsconfig). */
function parseScheduleRequest(body: ScheduleRequestBody): ParsedScheduleRequest {
  const { endpoint, keys, schedule } = body ?? {};

  if (typeof endpoint !== 'string' || !endpoint) {
    return { status: 'error', error: 'endpoint gerekli.' };
  }
  if (typeof keys?.p256dh !== 'string' || !keys.p256dh || typeof keys?.auth !== 'string' || !keys.auth) {
    return { status: 'error', error: 'keys.p256dh ve keys.auth gerekli.' };
  }
  if (!Array.isArray(schedule)) {
    return { status: 'error', error: 'schedule bir dizi olmalı.' };
  }
  if (schedule.length > MAX_SCHEDULE_ENTRIES) {
    return { status: 'error', error: `schedule en fazla ${MAX_SCHEDULE_ENTRIES} girdi içerebilir.` };
  }

  const parsed: ScheduleEntry[] = [];
  for (const entry of schedule) {
    const fireAtRaw = (entry as { fireAt?: unknown })?.fireAt;
    const prayerKey = (entry as { prayerKey?: unknown })?.prayerKey;
    if (typeof fireAtRaw !== 'string' || typeof prayerKey !== 'string' || !prayerKey) {
      return { status: 'error', error: 'her schedule girdisi geçerli bir fireAt (string) ve prayerKey içermeli.' };
    }
    const fireAt = new Date(fireAtRaw);
    if (Number.isNaN(fireAt.getTime())) {
      return { status: 'error', error: `geçersiz fireAt: "${fireAtRaw}"` };
    }
    parsed.push({ fireAt, prayerKey });
  }

  return { status: 'ok', endpoint, p256dh: keys.p256dh, auth: keys.auth, schedule: parsed };
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(createCorsMiddleware(deps.corsAllowedOrigin));
  app.use(express.json({ limit: '256kb' }));

  const subscribeRateLimiter = createRateLimiter(SUBSCRIBE_RATE_LIMIT);

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
  //
  // Now also genuinely checks DB connectivity (design-refresh-v3 Faz 15) —
  // subscribe/schedule are meaningless without it, so treating the API as
  // "down" during a DB outage is the honest signal, not a false one.
  app.get('/health', async (_req, res) => {
    const dbHealthy = await deps.pushStore.checkHealth();
    if (!dbHealthy) {
      res.status(503).json({ ok: false, service: 'vakit-api', db: 'disconnected' });
      return;
    }
    res.status(200).json({ ok: true, service: 'vakit-api', db: 'connected' });
  });

  app.get('/api/vapid-public-key', (_req, res) => {
    res.json({ publicKey: deps.vapidPublicKey });
  });

  // Coordinate-free by design (design-refresh-v3 Faz 15 — non-negotiable
  // architecture decision): the client computes every fire_at itself
  // (src/utils/pushSchedule.ts, using the same prayerCalculator.ts the UI
  // does) and sends nothing but a list of future UTC instants + a label.
  // The server never sees a location, a city, or a calculation method.
  app.post('/api/push/subscribe', subscribeRateLimiter, async (req, res) => {
    const parsed = parseScheduleRequest(req.body);
    if (parsed.status === 'error') {
      res.status(400).json({ error: parsed.error });
      return;
    }
    await deps.pushStore.upsertSubscriptionAndSchedule(
      { endpoint: parsed.endpoint, p256dh: parsed.p256dh, auth: parsed.auth },
      parsed.schedule
    );
    res.status(200).json({ ok: true });
  });

  // Same body shape and the same underlying operation as /subscribe — a
  // changed location or calculation method must REPLACE the schedule, not
  // merge with it, so both endpoints share this exact upsert-and-replace
  // behavior (design-refresh-v3 Faz 15).
  app.post('/api/push/schedule', subscribeRateLimiter, async (req, res) => {
    const parsed = parseScheduleRequest(req.body);
    if (parsed.status === 'error') {
      res.status(400).json({ error: parsed.error });
      return;
    }
    await deps.pushStore.upsertSubscriptionAndSchedule(
      { endpoint: parsed.endpoint, p256dh: parsed.p256dh, auth: parsed.auth },
      parsed.schedule
    );
    res.status(200).json({ ok: true });
  });

  app.delete('/api/push/unsubscribe', async (req, res) => {
    const { endpoint } = req.body ?? {};
    if (typeof endpoint !== 'string' || !endpoint) {
      res.status(400).json({ error: 'endpoint gerekli.' });
      return;
    }
    await deps.pushStore.removeSubscription(endpoint);
    res.status(200).json({ ok: true });
  });

  // /api/reverse-geocode (GPS coordinate -> place name) was removed
  // entirely (design-refresh-v3 Faz 16): it silently sent the user's real
  // GPS coordinate to this server on every "Konumumu Otomatik Kullan" tap,
  // which is exactly the automatic, invisible-to-the-user coordinate
  // exposure the "Mevcut Konum" honesty decision (Faz 14) was meant to
  // rule out. /api/geocode (below) is kept: it only ever carries a search
  // STRING the user deliberately typed after tapping "İnternette Ara" —
  // no coordinate, and a visibly opt-in action, not an automatic one.
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
