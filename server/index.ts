import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from './app';
import { createPostgresPushStore, createInMemoryPushStore } from './pushStore';
import type { PushStore } from './pushStore';
import { configureWebPush, defaultSendNotification } from './push';
import { createPushCron } from './pushCron';
import { createGeocodingClient, withCacheAndRateLimit } from './geocoding';
import { createDailyVerseService } from './dailyVerse';
import { attachStaticApp } from './static';

// Most PaaS platforms (Render, Railway, Fly, Heroku) inject the port to
// bind via PORT — SERVER_PORT is kept as a fallback for local dev, where
// .env.example already documents it (design-refresh-v3 Faz 6 B4).
const PORT = Number(process.env.PORT ?? process.env.SERVER_PORT) || 8787;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:test@example.com';
// The frontend now typically lives on a different origin (Netlify) than
// this API (Railway) — design-refresh-v3 Faz 15. Defaults to the real
// production frontend so a misconfigured deploy fails closed (rejects
// everyone) rather than open (accepts everyone).
const CORS_ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN ?? 'https://vakit.yasinsigirci.com.tr';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error(
    'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY .env dosyasında tanımlı değil. ' +
      '`npx web-push generate-vapid-keys` ile üretip .env dosyasına ekleyin.'
  );
  process.exit(1);
}

configureWebPush(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);

// Most PaaS filesystems are ephemeral, and a single Node process has no
// shared memory across instances anyway — DATABASE_URL (the conventional
// name for a Postgres connection string) switches to Railway Postgres; the
// in-memory store remains the zero-setup default for local development
// (design-refresh-v3 Faz 15 — replaces the old file-based store, since
// push schedules don't need to survive a dev-server restart).
let pushStore: PushStore;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pushStore = await createPostgresPushStore(pool);
  console.log('[server] Bildirim zamanlama deposu: Postgres (DATABASE_URL).');
} else {
  pushStore = createInMemoryPushStore();
  console.log(
    '[server] Bildirim zamanlama deposu: bellek içi (DATABASE_URL tanımlı değil — yalnızca geliştirme için, kalıcı değil).'
  );
}

// Coordinate-free by design (design-refresh-v3 Faz 15): this cron only
// ever sees {endpoint, p256dh, auth, fireAt, prayerKey} — never a
// location, city, or calculation method. defaultSendNotification's
// {endpoint, keys: {p256dh, auth}} shape is the web-push library's own,
// kept as-is rather than changed to match pushCron's flatter shape.
const cron = createPushCron({
  store: pushStore,
  sendNotification: (sub, payload) =>
    defaultSendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload),
});
cron.start(60000);

const app = createApp({
  pushStore,
  vapidPublicKey: VAPID_PUBLIC_KEY,
  geocodingClient: withCacheAndRateLimit(createGeocodingClient()),
  dailyVerseService: createDailyVerseService(),
  corsAllowedOrigin: CORS_ALLOWED_ORIGIN,
});

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(distDir)) {
  attachStaticApp(app, distDir);
} else {
  console.warn(
    `[server] dist/ bulunamadı (${distDir}) — statik dosya servisi devre dışı. ` +
      'Bu, API-only bir dağıtımda (ör. Railway, sadece server/ kökünden) beklenen bir durumdur; ' +
      '`npm run build` sonrası tek-origin dağıtımlarda devreye girer.'
  );
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VAKİT push sunucusu 0.0.0.0:${PORT} adresinde çalışıyor.`);
});
