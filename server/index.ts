import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createApp } from './app';
import {
  createSubscriptionStore,
  createPostgresSubscriptionStore,
  DEFAULT_DATA_FILE,
} from './subscriptionStore';
import type { SubscriptionStore } from './subscriptionStore';
import { configureWebPush, createPushSender, defaultSendNotification } from './push';
import { createScheduler } from './scheduler';
import { createGeocodingClient, withCacheAndRateLimit } from './geocoding';
import { createDailyVerseService } from './dailyVerse';
import { attachStaticApp } from './static';
import { calculatePrayerTimes } from '../src/utils/prayerCalculator';

// Most PaaS platforms (Render, Railway, Fly, Heroku) inject the port to
// bind via PORT — SERVER_PORT is kept as a fallback for local dev, where
// .env.example already documents it (design-refresh-v3 Faz 6 B4).
const PORT = Number(process.env.PORT ?? process.env.SERVER_PORT) || 8787;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:test@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error(
    'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY .env dosyasında tanımlı değil. ' +
      '`npx web-push generate-vapid-keys` ile üretip .env dosyasına ekleyin.'
  );
  process.exit(1);
}

configureWebPush(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);

// Most PaaS filesystems are ephemeral — every deploy/restart wipes the
// file-based store's subscriptions.json, and users silently stop getting
// notifications without any error surfaced anywhere (design-refresh-v3 Faz
// 6 B5). DATABASE_URL (the conventional name for a Postgres connection
// string) switches to a real persistent backend; the file store remains
// the zero-setup default for local development.
let store: SubscriptionStore;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  store = await createPostgresSubscriptionStore(pool);
  console.log('[server] Abonelik deposu: Postgres (DATABASE_URL).');
} else {
  store = createSubscriptionStore(DEFAULT_DATA_FILE);
  console.log('[server] Abonelik deposu: yerel dosya (DATABASE_URL tanımlı değil — üretimde kalıcı değildir).');
}

const sendPush = createPushSender({
  sendNotification: defaultSendNotification,
  onExpired: store.removeSubscription,
});

const scheduler = createScheduler({ store, calculatePrayerTimes, sendPush });
scheduler.start(60000);

const app = createApp({
  store,
  vapidPublicKey: VAPID_PUBLIC_KEY,
  geocodingClient: withCacheAndRateLimit(createGeocodingClient()),
  dailyVerseService: createDailyVerseService(),
});

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(distDir)) {
  attachStaticApp(app, distDir);
} else {
  console.warn(
    `[server] dist/ bulunamadı (${distDir}) — statik dosya servisi devre dışı. ` +
      '`npm run build` sonrası devreye girer; dev sırasında beklenen bir durumdur.'
  );
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VAKİT push sunucusu 0.0.0.0:${PORT} adresinde çalışıyor.`);
});
