import 'dotenv/config';
import { createApp } from './app';
import { createSubscriptionStore, DEFAULT_DATA_FILE } from './subscriptionStore';
import { configureWebPush, createPushSender, defaultSendNotification } from './push';
import { createScheduler } from './scheduler';
import { calculatePrayerTimes } from '../src/utils/prayerCalculator';

const PORT = Number(process.env.SERVER_PORT) || 8787;
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

const store = createSubscriptionStore(DEFAULT_DATA_FILE);
const sendPush = createPushSender({
  sendNotification: defaultSendNotification,
  onExpired: store.removeSubscription,
});

const scheduler = createScheduler({ store, calculatePrayerTimes, sendPush });
scheduler.start(60000);

const app = createApp({ store, vapidPublicKey: VAPID_PUBLIC_KEY });

app.listen(PORT, () => {
  console.log(`VAKİT push sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
});
