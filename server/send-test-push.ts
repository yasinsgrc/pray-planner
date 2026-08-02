import 'dotenv/config';
import { createSubscriptionStore, DEFAULT_DATA_FILE } from './subscriptionStore';
import { configureWebPush, createPushSender, defaultSendNotification } from './push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:test@example.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY .env dosyasında tanımlı değil.');
  process.exit(1);
}

configureWebPush(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT);

const store = createSubscriptionStore(DEFAULT_DATA_FILE);
const subs = await store.loadSubscriptions();

if (subs.length === 0) {
  console.error('Kayıtlı abonelik yok. Önce uygulamada "Bildirimlere İzin Ver" butonuna basın.');
  process.exit(1);
}

const sendPush = createPushSender({
  sendNotification: defaultSendNotification,
  onExpired: store.removeSubscription,
});

const testEvent = {
  type: 'prayer' as const,
  prayerName: 'ogle' as const,
  label: 'Test Bildirimi',
  soundMode: 'ezan' as const,
};

await Promise.all(subs.map((sub) => sendPush(sub, testEvent)));
console.log(`${subs.length} aboneliğe test bildirimi gönderildi.`);
