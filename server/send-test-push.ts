import 'dotenv/config';
import { Pool } from 'pg';
import { createPostgresPushStore, createInMemoryPushStore } from './pushStore';
import type { PushStore } from './pushStore';
import { configureWebPush, defaultSendNotification } from './push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:test@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY .env dosyasında tanımlı değil.');
  process.exit(1);
}

configureWebPush(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);

let pushStore: PushStore;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pushStore = await createPostgresPushStore(pool);
} else {
  pushStore = createInMemoryPushStore();
  console.error('DATABASE_URL tanımlı değil — bellek içi depoda test edilecek abonelik yok, çıkılıyor.');
  process.exit(1);
}

const subs = await pushStore.listSubscriptions();

if (subs.length === 0) {
  console.error('Kayıtlı abonelik yok. Önce uygulamada "Bildirimlere İzin Ver" butonuna basın.');
  process.exit(1);
}

const payload = JSON.stringify({ title: 'Test Bildirimi', body: 'VAKİT push altyapısı çalışıyor.' });

await Promise.all(
  subs.map((sub) =>
    defaultSendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
  )
);
console.log(`${subs.length} aboneliğe test bildirimi gönderildi.`);
