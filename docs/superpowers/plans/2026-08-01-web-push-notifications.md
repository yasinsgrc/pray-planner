# Web Push Bildirimleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VAKİT uygulamasında namaz vakti girdiğinde (ve isteğe bağlı erken uyarı anında) sekme/uygulama kapalıyken bile gerçek bir tarayıcı bildirimi ulaştıran bir Web Push sistemi kurmak.

**Architecture:** Repo-içi bir Express backend (`server/`), abonelikleri `data/subscriptions.json` dosyasında tutar; her 60 saniyede bir mevcut `src/utils/prayerCalculator.ts` ile her abonelik için o anki vakit tablosunu hesaplar ve eşleşme olursa `web-push` ile push gönderir. Frontend bir service worker kaydeder, Push API ile abone olur ve aboneliği/ayarları backend'e senkronize eder.

**Tech Stack:** Express 4, `web-push` 3.6.7, Node'un yerleşik `node:test` test çalıştırıcısı (`tsx --test` üzerinden), `tsx` (zaten devDependency), `concurrently` (dev script'i için).

## Global Constraints

- Tüm kullanıcıya görünen metinler Türkçe.
- `src/utils/prayerCalculator.ts` değiştirilmez — backend'den olduğu gibi import edilir (tek doğruluk kaynağı).
- Abonelik depolama: basit JSON dosyası (`data/subscriptions.json`), veritabanı yok.
- Yeni bağımlılık sürümleri tam olarak: `web-push@^3.6.7`, `@types/web-push@^3.6.4`, `concurrently@^10.0.4`.
- Frontend için yeni bir test framework'ü eklenmez; sadece backend'in saf mantığı `node:test` ile test edilir, frontend/browser-API'ye bağımlı kod manuel doğrulanır.
- Kapsam dışı: Kıble pusulası gyroscope entegrasyonu, gerçek konum arama/geocoding, PWA manifest + Play Store paketleme, tasarım/UX cilası (bunlar ayrı alt projeler).

---

### Task 1: Bağımlılıklar ve Ortam Değişkenleri

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces: `web-push`, `@types/web-push`, `concurrently` node_modules'a kurulu; `npm run dev:server`, `npm run dev:all`, `npm run test:server`, `npm run test:push` script'leri tanımlı.

- [ ] **Step 1: package.json'ı güncelle**

`package.json` dosyasının tamamını şu içerikle değiştir:

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "dev:server": "tsx watch server/index.ts",
    "dev:all": "concurrently -n vite,server -c blue,green \"npm:dev\" \"npm:dev:server\"",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit",
    "test:server": "tsx --test server",
    "test:push": "tsx server/send-test-push.ts"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "adhan": "^4.4.4",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^6.2.3",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/express": "^4.17.21",
    "@types/web-push": "^3.6.4",
    "autoprefixer": "^10.4.21",
    "concurrently": "^10.0.4",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.3"
  }
}
```

- [ ] **Step 2: .env.example'a Web Push değişkenlerini ekle**

Dosyanın sonuna ekle:

```
# --- Web Push bildirim sunucusu ---
# `npx web-push generate-vapid-keys` ile bir kereye mahsus üretilir.
VAPID_PUBLIC_KEY="MY_VAPID_PUBLIC_KEY"
VAPID_PRIVATE_KEY="MY_VAPID_PRIVATE_KEY"
# Push servislerinin sorun durumunda ulaşabileceği iletişim adresi.
VAPID_SUBJECT="mailto:you@example.com"
# Express push sunucusunun dinleyeceği port.
SERVER_PORT="8787"
```

- [ ] **Step 3: Bağımlılıkları kur**

Run: `npm install`
Expected: Hatasız tamamlanır, `web-push`, `@types/web-push`, `concurrently` `node_modules` içinde görünür.

- [ ] **Step 4: Mevcut tip kontrolünün hâlâ geçtiğini doğrula**

Run: `npm run lint`
Expected: `TypeScript: No errors found`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add web-push, concurrently deps and VAPID env vars"
```

---

### Task 2: Abonelik Deposu (server/types.ts + server/subscriptionStore.ts)

**Files:**
- Create: `server/types.ts`
- Create: `server/subscriptionStore.ts`
- Test: `server/subscriptionStore.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `LocationItem`, `NotificationSettings` (`src/types.ts`, değişmedi)
- Produces: `PushSubscriptionRecord` tipi; `SubscriptionStore` arayüzü (`loadSubscriptions(): PushSubscriptionRecord[]`, `upsertSubscription(record): void`, `removeSubscription(endpoint): void`); `createSubscriptionStore(filePath: string): SubscriptionStore`; `DEFAULT_DATA_FILE: string`

- [ ] **Step 1: .gitignore'a veri dosyasını ekle**

`.gitignore` dosyasının sonuna ekle:

```
data/
```

- [ ] **Step 2: server/types.ts oluştur**

```ts
import type { LocationItem, NotificationSettings } from '../src/types';

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  location: LocationItem;
  calculationMethod: string;
  notifications: NotificationSettings;
  updatedAt: string;
}
```

- [ ] **Step 3: Başarısız testi yaz — server/subscriptionStore.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';

function makeRecord(endpoint: string): PushSubscriptionRecord {
  return {
    endpoint,
    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    location: {
      id: 'uskudar-istanbul',
      cityName: 'İstanbul',
      districtName: 'Üsküdar',
      country: 'Türkiye',
      lat: 41.0264,
      lng: 29.0152,
    },
    calculationMethod: 'Diyanet',
    notifications: {
      imsak: 'ezan',
      gunes: 'sessiz',
      ogle: 'ezan',
      ikindi: 'ezan',
      aksam: 'ezan',
      yatsi: 'ezan',
      earlyWarningMinutes: 15,
      earlyWarningSound: 'tini',
    },
    updatedAt: new Date().toISOString(),
  };
}

test('creates an empty subscriptions file on first load', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  const subs = store.loadSubscriptions();

  assert.deepEqual(subs, []);
  assert.equal(existsSync(filePath), true);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription adds a new record and persists it to disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/a');

  const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
  assert.equal(onDisk.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('upsertSubscription replaces an existing record with the same endpoint', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));
  const updated = { ...makeRecord('https://push.example.com/a'), calculationMethod: 'MWL' };
  store.upsertSubscription(updated);

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].calculationMethod, 'MWL');
  rmSync(dir, { recursive: true, force: true });
});

test('removeSubscription deletes a record by endpoint', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-store-'));
  const filePath = path.join(dir, 'subs.json');
  const store = createSubscriptionStore(filePath);

  store.upsertSubscription(makeRecord('https://push.example.com/a'));
  store.upsertSubscription(makeRecord('https://push.example.com/b'));
  store.removeSubscription('https://push.example.com/a');

  const subs = store.loadSubscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/b');
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 4: Testin başarısız olduğunu doğrula**

Run: `npx tsx --test server/subscriptionStore.test.ts`
Expected: FAIL — `Cannot find module './subscriptionStore'`

- [ ] **Step 5: server/subscriptionStore.ts implementasyonunu yaz**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PushSubscriptionRecord } from './types';

export interface SubscriptionStore {
  loadSubscriptions(): PushSubscriptionRecord[];
  upsertSubscription(record: PushSubscriptionRecord): void;
  removeSubscription(endpoint: string): void;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DATA_FILE = path.resolve(currentDir, '..', 'data', 'subscriptions.json');

export function createSubscriptionStore(filePath: string): SubscriptionStore {
  function ensureFile(): void {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '[]', 'utf-8');
    }
  }

  function loadSubscriptions(): PushSubscriptionRecord[] {
    ensureFile();
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as PushSubscriptionRecord[];
  }

  function saveSubscriptions(subs: PushSubscriptionRecord[]): void {
    ensureFile();
    writeFileSync(filePath, JSON.stringify(subs, null, 2), 'utf-8');
  }

  function upsertSubscription(record: PushSubscriptionRecord): void {
    const subs = loadSubscriptions();
    const idx = subs.findIndex((s) => s.endpoint === record.endpoint);
    if (idx >= 0) {
      subs[idx] = record;
    } else {
      subs.push(record);
    }
    saveSubscriptions(subs);
  }

  function removeSubscription(endpoint: string): void {
    const subs = loadSubscriptions().filter((s) => s.endpoint !== endpoint);
    saveSubscriptions(subs);
  }

  return { loadSubscriptions, upsertSubscription, removeSubscription };
}
```

- [ ] **Step 6: Testlerin geçtiğini doğrula**

Run: `npx tsx --test server/subscriptionStore.test.ts`
Expected: 4 test, hepsi PASS

- [ ] **Step 7: Commit**

```bash
git add .gitignore server/types.ts server/subscriptionStore.ts server/subscriptionStore.test.ts
git commit -m "feat: add JSON-backed push subscription store"
```

---

### Task 3: Zamanlayıcı (server/scheduler.ts)

**Files:**
- Create: `server/scheduler.ts`
- Test: `server/scheduler.test.ts`

**Interfaces:**
- Consumes: `SubscriptionStore` (Task 2), `PushSubscriptionRecord` (Task 2), `DayPrayerSchedule` (`src/utils/prayerCalculator.ts`, değişmedi), `PrayerName`/`SoundMode`/`NotificationSettings`/`LocationItem` (`src/types.ts`, değişmedi)
- Produces: `NotificationEvent` tipi (`{type:'prayer', prayerName, label, soundMode}` | `{type:'early-warning', prayerName, label, soundMode, minutesBefore}`); `shouldNotifyNow(prayer, now, notifications, toleranceMs?): NotificationEvent | null`; `createScheduler(deps): { tick(): Promise<void>; start(intervalMs?): () => void }`

- [ ] **Step 1: Başarısız testi yaz — server/scheduler.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldNotifyNow, createScheduler } from './scheduler';
import type { PushSubscriptionRecord } from './types';
import type { NotificationSettings } from '../src/types';
import type { DayPrayerSchedule } from '../src/utils/prayerCalculator';

function makeNotifications(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    imsak: 'ezan',
    gunes: 'sessiz',
    ogle: 'ezan',
    ikindi: 'ezan',
    aksam: 'ezan',
    yatsi: 'ezan',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'tini',
    ...overrides,
  };
}

test('shouldNotifyNow returns a prayer event when now matches the prayer time', () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const now = new Date('2026-08-01T12:00:10.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.deepEqual(event, { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'ezan' });
});

test('shouldNotifyNow returns null outside the tolerance window', () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const now = new Date('2026-08-01T12:05:00.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.equal(event, null);
});

test('shouldNotifyNow returns null when the prayer sound is set to sessiz', () => {
  const prayerTime = new Date('2026-08-01T06:00:00.000Z');
  const now = new Date('2026-08-01T06:00:00.000Z');
  const event = shouldNotifyNow({ name: 'gunes', label: 'Güneş', dateObj: prayerTime }, now, makeNotifications());

  assert.equal(event, null);
});

test('shouldNotifyNow returns an early-warning event before the prayer time', () => {
  const prayerTime = new Date('2026-08-01T12:15:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, makeNotifications());

  assert.deepEqual(event, {
    type: 'early-warning',
    prayerName: 'ogle',
    label: 'Öğle',
    soundMode: 'tini',
    minutesBefore: 15,
  });
});

test('shouldNotifyNow skips the early warning when earlyWarningMinutes is 0', () => {
  const prayerTime = new Date('2026-08-01T12:15:00.000Z');
  const now = new Date('2026-08-01T12:00:00.000Z');
  const notifications = makeNotifications({ earlyWarningMinutes: 0 });
  const event = shouldNotifyNow({ name: 'ogle', label: 'Öğle', dateObj: prayerTime }, now, notifications);

  assert.equal(event, null);
});

function makeSubscription(overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord {
  return {
    endpoint: 'https://push.example.com/a',
    keys: { p256dh: 'p', auth: 'a' },
    location: {
      id: 'uskudar-istanbul',
      cityName: 'İstanbul',
      districtName: 'Üsküdar',
      country: 'Türkiye',
      lat: 41.0264,
      lng: 29.0152,
    },
    calculationMethod: 'Diyanet',
    notifications: makeNotifications(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSchedule(prayerTime: Date): DayPrayerSchedule {
  const prayer = {
    name: 'ogle' as const,
    label: 'Öğle',
    timeString: '12:00',
    dateObj: prayerTime,
    isPast: false,
    isActive: true,
    isNext: false,
  };
  return {
    date: prayerTime,
    location: makeSubscription().location,
    prayers: [prayer],
    activePrayer: prayer,
    nextPrayer: prayer,
    timeRemainingSeconds: 0,
    timeRemainingFormatted: '00:00:00',
    ringProgress: 0,
    kerahetTimes: [],
    currentKerahet: null,
  };
}

test('scheduler tick sends a push once and skips duplicate sends in the same minute window', async () => {
  const prayerTime = new Date('2026-08-01T12:00:00.000Z');
  const sub = makeSubscription();
  const sent: unknown[] = [];

  const scheduler = createScheduler({
    store: {
      loadSubscriptions: () => [sub],
      upsertSubscription: () => {},
      removeSubscription: () => {},
    },
    calculatePrayerTimes: () => makeSchedule(prayerTime),
    sendPush: async (record, event) => {
      sent.push({ endpoint: record.endpoint, event });
    },
    now: () => prayerTime,
  });

  await scheduler.tick();
  await scheduler.tick();

  assert.equal(sent.length, 1);
});

test('scheduler tick sends again on a new day for the same prayer key', async () => {
  const day1 = new Date('2026-08-01T12:00:00.000Z');
  const day2 = new Date('2026-08-02T12:00:00.000Z');
  const sub = makeSubscription();
  const sent: unknown[] = [];
  let current = day1;

  const scheduler = createScheduler({
    store: {
      loadSubscriptions: () => [sub],
      upsertSubscription: () => {},
      removeSubscription: () => {},
    },
    calculatePrayerTimes: () => makeSchedule(current),
    sendPush: async () => {
      sent.push(current);
    },
    now: () => current,
  });

  await scheduler.tick();
  current = day2;
  await scheduler.tick();

  assert.equal(sent.length, 2);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx tsx --test server/scheduler.test.ts`
Expected: FAIL — `Cannot find module './scheduler'`

- [ ] **Step 3: server/scheduler.ts implementasyonunu yaz**

```ts
import type { LocationItem, NotificationSettings, PrayerName, SoundMode } from '../src/types';
import type { DayPrayerSchedule } from '../src/utils/prayerCalculator';
import type { SubscriptionStore } from './subscriptionStore';
import type { PushSubscriptionRecord } from './types';

export type NotificationEvent =
  | { type: 'prayer'; prayerName: PrayerName; label: string; soundMode: SoundMode }
  | {
      type: 'early-warning';
      prayerName: PrayerName;
      label: string;
      soundMode: SoundMode;
      minutesBefore: number;
    };

export interface PrayerLike {
  name: PrayerName;
  label: string;
  dateObj: Date;
}

export function shouldNotifyNow(
  prayer: PrayerLike,
  now: Date,
  notifications: NotificationSettings,
  toleranceMs = 30000
): NotificationEvent | null {
  const soundMode = notifications[prayer.name];
  const diffToExactTime = Math.abs(now.getTime() - prayer.dateObj.getTime());

  if (diffToExactTime <= toleranceMs && soundMode !== 'sessiz') {
    return { type: 'prayer', prayerName: prayer.name, label: prayer.label, soundMode };
  }

  const { earlyWarningMinutes, earlyWarningSound } = notifications;
  if (earlyWarningMinutes > 0 && earlyWarningSound !== 'sessiz') {
    const warningTime = prayer.dateObj.getTime() - earlyWarningMinutes * 60000;
    const diffToWarningTime = Math.abs(now.getTime() - warningTime);

    if (diffToWarningTime <= toleranceMs) {
      return {
        type: 'early-warning',
        prayerName: prayer.name,
        label: prayer.label,
        soundMode: earlyWarningSound,
        minutesBefore: earlyWarningMinutes,
      };
    }
  }

  return null;
}

type CalculatePrayerTimesFn = (
  location: LocationItem,
  date: Date,
  calculationMethod: string
) => DayPrayerSchedule;

export interface SchedulerDeps {
  store: SubscriptionStore;
  calculatePrayerTimes: CalculatePrayerTimesFn;
  sendPush: (record: PushSubscriptionRecord, event: NotificationEvent) => Promise<void>;
  now?: () => Date;
}

export interface Scheduler {
  tick: () => Promise<void>;
  start: (intervalMs?: number) => () => void;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const sentToday = new Set<string>();
  let lastDayKey = '';

  function dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async function tick(): Promise<void> {
    const now = (deps.now ?? (() => new Date()))();
    const today = dayKey(now);

    if (today !== lastDayKey) {
      sentToday.clear();
      lastDayKey = today;
    }

    const subscriptions = deps.store.loadSubscriptions();

    for (const sub of subscriptions) {
      const schedule = deps.calculatePrayerTimes(sub.location, now, sub.calculationMethod);

      for (const prayer of schedule.prayers) {
        const event = shouldNotifyNow(prayer, now, sub.notifications);
        if (!event) continue;

        const key = `${sub.endpoint}:${event.type}:${event.prayerName}:${today}`;
        if (sentToday.has(key)) continue;

        sentToday.add(key);
        await deps.sendPush(sub, event);
      }
    }
  }

  function start(intervalMs = 60000): () => void {
    const id = setInterval(() => {
      tick().catch((err) => console.error('Zamanlayıcı hatası:', err));
    }, intervalMs);
    return () => clearInterval(id);
  }

  return { tick, start };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npx tsx --test server/scheduler.test.ts`
Expected: 7 test, hepsi PASS

- [ ] **Step 5: Commit**

```bash
git add server/scheduler.ts server/scheduler.test.ts
git commit -m "feat: add prayer-time notification scheduler"
```

---

### Task 4: Push Gönderimi (server/push.ts + manuel test aracı)

**Files:**
- Create: `server/push.ts`
- Create: `server/send-test-push.ts`
- Test: `server/push.test.ts`

**Interfaces:**
- Consumes: `NotificationEvent` (Task 3), `PushSubscriptionRecord` (Task 2), `SubscriptionStore`/`createSubscriptionStore`/`DEFAULT_DATA_FILE` (Task 2)
- Produces: `configureWebPush(publicKey, privateKey, subject): void`; `defaultSendNotification(subscription, payload): Promise<unknown>`; `createPushSender(deps): (record, event) => Promise<void>`

- [ ] **Step 1: Başarısız testi yaz — server/push.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushSender } from './push';
import type { PushSubscriptionRecord } from './types';

function makeRecord(): PushSubscriptionRecord {
  return {
    endpoint: 'https://push.example.com/a',
    keys: { p256dh: 'p', auth: 'a' },
    location: {
      id: 'uskudar-istanbul',
      cityName: 'İstanbul',
      districtName: 'Üsküdar',
      country: 'Türkiye',
      lat: 41.0264,
      lng: 29.0152,
    },
    calculationMethod: 'Diyanet',
    notifications: {
      imsak: 'ezan',
      gunes: 'sessiz',
      ogle: 'ezan',
      ikindi: 'ezan',
      aksam: 'ezan',
      yatsi: 'ezan',
      earlyWarningMinutes: 15,
      earlyWarningSound: 'tini',
    },
    updatedAt: new Date().toISOString(),
  };
}

test('sends a payload containing the prayer title and does not call onExpired on success', async () => {
  const calls: { subscription: unknown; payload: string }[] = [];
  let expiredEndpoint: string | null = null;

  const sendPush = createPushSender({
    sendNotification: async (subscription, payload) => {
      calls.push({ subscription, payload });
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'ezan' });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].payload);
  assert.equal(body.title, 'Öğle Vakti Girdi');
  assert.equal(expiredEndpoint, null);
});

test('removes the subscription when the push service reports it as gone (410)', async () => {
  let expiredEndpoint: string | null = null;

  const sendPush = createPushSender({
    sendNotification: async () => {
      const err = new Error('Gone') as Error & { statusCode: number };
      err.statusCode = 410;
      throw err;
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'ezan' });

  assert.equal(expiredEndpoint, 'https://push.example.com/a');
});

test('does not call onExpired for a non-expiry error', async () => {
  let expiredEndpoint: string | null = null;
  const originalConsoleError = console.error;
  console.error = () => {};

  const sendPush = createPushSender({
    sendNotification: async () => {
      throw new Error('network down');
    },
    onExpired: (endpoint) => {
      expiredEndpoint = endpoint;
    },
  });

  await sendPush(makeRecord(), { type: 'prayer', prayerName: 'ogle', label: 'Öğle', soundMode: 'ezan' });

  console.error = originalConsoleError;
  assert.equal(expiredEndpoint, null);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx tsx --test server/push.test.ts`
Expected: FAIL — `Cannot find module './push'`

- [ ] **Step 3: server/push.ts implementasyonunu yaz**

```ts
import webpush from 'web-push';
import type { NotificationEvent } from './scheduler';
import type { PushSubscriptionRecord } from './types';

export function configureWebPush(publicKey: string, privateKey: string, subject: string): void {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function defaultSendNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<unknown> {
  return webpush.sendNotification(subscription, payload);
}

function buildPayload(event: NotificationEvent): string {
  const title =
    event.type === 'prayer'
      ? `${event.label} Vakti Girdi`
      : `${event.label} Vaktine ${event.minutesBefore} Dakika Kaldı`;
  const body =
    event.type === 'prayer' ? 'Hayırlı namazlar.' : 'Abdest ve hazırlık için hatırlatma.';

  return JSON.stringify({ title, body, icon: '/icons/notification-icon.png' });
}

export interface PushSenderDeps {
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
  onExpired: (endpoint: string) => void;
}

export function createPushSender(
  deps: PushSenderDeps
): (record: PushSubscriptionRecord, event: NotificationEvent) => Promise<void> {
  return async function sendPushNotification(record, event) {
    const payload = buildPayload(event);

    try {
      await deps.sendNotification({ endpoint: record.endpoint, keys: record.keys }, payload);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deps.onExpired(record.endpoint);
      } else {
        console.error('Push gönderim hatası:', err);
      }
    }
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npx tsx --test server/push.test.ts`
Expected: 3 test, hepsi PASS

- [ ] **Step 5: Manuel test aracını yaz — server/send-test-push.ts**

Bu script gerçek zamanı beklemeden, kayıtlı ilk aboneliğe hemen bir test bildirimi gönderir (Task 12'deki uçtan uca doğrulama için kullanılacak).

```ts
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
const subs = store.loadSubscriptions();

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
```

- [ ] **Step 6: Commit**

```bash
git add server/push.ts server/push.test.ts server/send-test-push.ts
git commit -m "feat: add web-push sender with expired-subscription cleanup"
```

---

### Task 5: Express Uygulaması (server/app.ts)

**Files:**
- Create: `server/app.ts`
- Test: `server/app.test.ts`

**Interfaces:**
- Consumes: `SubscriptionStore`, `createSubscriptionStore` (Task 2), `PushSubscriptionRecord` (Task 2)
- Produces: `createApp(deps: { store: SubscriptionStore; vapidPublicKey: string }): Express` — route'lar: `GET /api/vapid-public-key`, `POST /api/subscribe`, `POST /api/unsubscribe`

- [ ] **Step 1: Başarısız testi yaz — server/app.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { createSubscriptionStore } from './subscriptionStore';

async function withServer(
  run: (baseUrl: string, store: ReturnType<typeof createSubscriptionStore>) => Promise<void>
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-app-'));
  const store = createSubscriptionStore(path.join(dir, 'subs.json'));
  const app = createApp({ store, vapidPublicKey: 'test-public-key' });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

const validBody = {
  endpoint: 'https://push.example.com/a',
  keys: { p256dh: 'p', auth: 'a' },
  location: {
    id: 'uskudar-istanbul',
    cityName: 'İstanbul',
    districtName: 'Üsküdar',
    country: 'Türkiye',
    lat: 41.0264,
    lng: 29.0152,
  },
  calculationMethod: 'Diyanet',
  notifications: {
    imsak: 'ezan',
    gunes: 'sessiz',
    ogle: 'ezan',
    ikindi: 'ezan',
    aksam: 'ezan',
    yatsi: 'ezan',
    earlyWarningMinutes: 15,
    earlyWarningSound: 'tini',
  },
};

test('GET /api/vapid-public-key returns the configured key', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/vapid-public-key`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.publicKey, 'test-public-key');
  });
});

test('POST /api/subscribe stores a valid subscription', async () => {
  await withServer(async (baseUrl, store) => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    assert.equal(res.status, 200);
    const subs = store.loadSubscriptions();
    assert.equal(subs.length, 1);
    assert.equal(subs[0].endpoint, validBody.endpoint);
  });
});

test('POST /api/subscribe rejects a request missing required fields', async () => {
  await withServer(async (baseUrl, store) => {
    const { location, ...incomplete } = validBody;
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incomplete),
    });

    assert.equal(res.status, 400);
    assert.equal(store.loadSubscriptions().length, 0);
  });
});

test('POST /api/unsubscribe removes a stored subscription', async () => {
  await withServer(async (baseUrl, store) => {
    store.upsertSubscription({ ...validBody, updatedAt: new Date().toISOString() });

    const res = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });

    assert.equal(res.status, 200);
    assert.equal(store.loadSubscriptions().length, 0);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx tsx --test server/app.test.ts`
Expected: FAIL — `Cannot find module './app'`

- [ ] **Step 3: server/app.ts implementasyonunu yaz**

```ts
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
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npx tsx --test server/app.test.ts`
Expected: 4 test, hepsi PASS

- [ ] **Step 5: Commit**

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: add Express app with subscribe/unsubscribe routes"
```

---

### Task 6: Sunucu Giriş Noktası (server/index.ts)

**Files:**
- Create: `server/index.ts`

**Interfaces:**
- Consumes: `createApp` (Task 5), `createSubscriptionStore`/`DEFAULT_DATA_FILE` (Task 2), `configureWebPush`/`createPushSender`/`defaultSendNotification` (Task 4), `createScheduler` (Task 3), `calculatePrayerTimes` (`src/utils/prayerCalculator.ts`, değişmedi)
- Produces: Çalışan bir Express sunucusu (`http://localhost:$SERVER_PORT`) + arka planda çalışan zamanlayıcı

- [ ] **Step 1: server/index.ts implementasyonunu yaz**

```ts
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
```

- [ ] **Step 2: VAPID anahtarlarını üret ve .env dosyasını hazırla**

Run: `npx web-push generate-vapid-keys`
Expected: Bir "Public Key" ve "Private Key" çifti basılır.

`.env` dosyası yoksa oluştur (`.env.example`'dan kopyala) ve üretilen anahtarları `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` alanlarına yapıştır.

- [ ] **Step 3: Sunucuyu başlat ve uçtan uca kontrol et**

Run: `npx tsx server/index.ts`
Expected: `VAKİT push sunucusu http://localhost:8787 adresinde çalışıyor.`

Başka bir terminalde:

```bash
curl -s http://localhost:8787/api/vapid-public-key
```
Expected: `{"publicKey":"..."}"` (gerçek public key)

```bash
curl -s -X POST http://localhost:8787/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://example.com/x","keys":{"p256dh":"p","auth":"a"},"location":{"id":"uskudar-istanbul","cityName":"İstanbul","districtName":"Üsküdar","country":"Türkiye","lat":41.0264,"lng":29.0152},"calculationMethod":"Diyanet","notifications":{"imsak":"ezan","gunes":"sessiz","ogle":"ezan","ikindi":"ezan","aksam":"ezan","yatsi":"ezan","earlyWarningMinutes":15,"earlyWarningSound":"tini"}}'
```
Expected: `{"ok":true}` ve `data/subscriptions.json` dosyasında kayıt oluşur.

Sunucuyu durdur (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: add push server entrypoint wiring store, scheduler and app"
```

---

### Task 7: Vite Dev Proxy

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: Vite dev sunucusunda (`:3000`) `/api/*` istekleri backend'e (`:$SERVER_PORT`) proxy'lenir.

- [ ] **Step 1: vite.config.ts'e proxy ekle**

`server` bloğunu şu şekilde güncelle (dosyanın geri kalanı aynı kalır):

```ts
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.SERVER_PORT ?? '8787'}`,
          changeOrigin: true,
        },
      },
    },
```

- [ ] **Step 2: Proxy'i doğrula**

İki ayrı terminalde çalıştır: `npx tsx server/index.ts` ve `npm run dev`. Sonra:

Run: `curl -s http://localhost:3000/api/vapid-public-key`
Expected: Doğrudan `:8787`'ye yapılan istekle aynı `{"publicKey":"..."}` yanıtı (Vite üzerinden proxy'lenmiş).

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: proxy /api requests to the push server in dev"
```

---

### Task 8: Service Worker

**Files:**
- Create: `public/sw.js`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `/sw.js` üzerinden servis edilen, `push` ve `notificationclick` event'lerini işleyen bir service worker.

- [ ] **Step 1: tsconfig.json'ı public/ klasörünü hariç tutacak şekilde güncelle**

`tsconfig.json` dosyasının tamamını şu içerikle değiştir (compilerOptions aynı kalır, sona `exclude` eklenir):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "exclude": [
    "node_modules",
    "public"
  ]
}
```

`public/` hariç tutulmazsa, aşağıda oluşturulacak `sw.js` içindeki `self.registration`/`event.waitUntil` gibi Service-Worker'a özgü API'ler tarayıcı (`Window`) tipleriyle çakışıp `npm run lint`'i kırar.

- [ ] **Step 2: public/sw.js oluştur**

```js
self.addEventListener('push', (event) => {
  let data = {
    title: 'VAKİT',
    body: 'Namaz vakti bildirimi',
    icon: '/icons/notification-icon.png',
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (err) {
    // Bozuk payload — varsayılan metinlerle devam et.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
```

Not: `/icons/notification-icon.png` şu an mevcut değil — bu, tasarım/store-varlıkları alt projesinde eklenecek. Dosya yokken bildirim ikonu göstermeden, hatasız şekilde çalışır.

- [ ] **Step 3: Değişiklikleri doğrula**

Run: `npm run lint`
Expected: `TypeScript: No errors found` (public/ artık hariç tutulduğu için sw.js kontrole dahil edilmez)

- [ ] **Step 4: Commit**

```bash
git add public/sw.js tsconfig.json
git commit -m "feat: add push notification service worker"
```

---

### Task 9: Frontend Push İstemcisi (src/utils/pushClient.ts)

**Files:**
- Create: `src/utils/pushClient.ts`

**Interfaces:**
- Consumes: `AppSettings` (`src/types.ts`, değişmedi)
- Produces: `PushStatus` tipi (`'idle'|'loading'|'granted'|'denied'|'error'`); `PushSyncResult` tipi; `registerServiceWorker(): Promise<ServiceWorkerRegistration|null>`; `getExistingPushSubscription(): Promise<PushSubscription|null>`; `syncSubscription(subscription, settings): Promise<PushSyncResult>`; `subscribeToPush(settings): Promise<PushSyncResult>`

- [ ] **Step 1: src/utils/pushClient.ts oluştur**

```ts
import { AppSettings } from '../types';

const SERVICE_WORKER_URL = '/sw.js';

export type PushStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error';
export type PushSyncResult = { ok: true } | { ok: false; reason: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function syncSubscription(
  subscription: PushSubscription,
  settings: AppSettings
): Promise<PushSyncResult> {
  const { keys } = subscription.toJSON();
  if (!keys) {
    return { ok: false, reason: 'Abonelik anahtarları okunamadı.' };
  }

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys,
        location: settings.location,
        calculationMethod: settings.calculationMethod,
        notifications: settings.notifications,
      }),
    });

    if (!res.ok) {
      return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
  }
}

export async function subscribeToPush(settings: AppSettings): Promise<PushSyncResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Bu tarayıcı bildirimleri desteklemiyor.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Bildirim izni verilmedi.' };
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) {
      return { ok: false, reason: 'Service worker kaydedilemedi.' };
    }

    const keyRes = await fetch('/api/vapid-public-key');
    if (!keyRes.ok) {
      return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
    }
    const { publicKey } = await keyRes.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    return syncSubscription(subscription, settings);
  } catch {
    return { ok: false, reason: 'Bildirim aboneliği başarısız oldu.' };
  }
}
```

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npm run lint`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add src/utils/pushClient.ts
git commit -m "feat: add frontend push subscription client"
```

---

### Task 10: Ayarlar Ekranına Bildirim Etkinleştirme Bloğu

**Files:**
- Modify: `src/components/SpiritualSettings.tsx:1-37` (import'lar + props arayüzü + component imzası)
- Modify: `src/components/SpiritualSettings.tsx:49-51` (yeni blok eklenir)

**Interfaces:**
- Consumes: `PushStatus` (Task 9)
- Produces: `SpiritualSettingsProps` yeni alanlar: `pushStatus: PushStatus`, `pushError: string | null`, `onEnablePush: () => void`

- [ ] **Step 1: Import ve props arayüzünü güncelle**

`src/components/SpiritualSettings.tsx` dosyasının başındaki import ve interface bloğunu (satır 1-21) şununla değiştir:

```tsx
import React from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Volume2,
  VolumeX,
  Clock,
  Moon,
  ShieldCheck,
  Check,
  Play,
  Settings2,
} from 'lucide-react';
import { AppSettings, PrayerName, SoundMode } from '../types';
import { playSoftChime, playEzanSample } from '../utils/audio';
import type { PushStatus } from '../utils/pushClient';

interface SpiritualSettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateNotification: (prayer: PrayerName, mode: SoundMode) => void;
  pushStatus: PushStatus;
  pushError: string | null;
  onEnablePush: () => void;
}
```

- [ ] **Step 2: Component imzasını güncelle**

Satır 32-37'deki component parametrelerini şununla değiştir:

```tsx
export const SpiritualSettings: React.FC<SpiritualSettingsProps> = ({
  settings,
  onUpdateSettings,
  onUpdateNotification,
  pushStatus,
  pushError,
  onEnablePush,
}) => {
```

- [ ] **Step 3: Başlık bloğunun hemen altına yeni kartı ekle**

"Başlık" `</div>`'inin (satır 49) hemen altına, "1. Vakit Bazlı Bildirim Seçimi" yorumundan (satır 51) önce ekle:

```tsx
      {/* 0. Bildirimleri Etkinleştir */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#D6A84D]" />
          <div>
            <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Bildirimleri Etkinleştir
            </div>
            <div className="text-[11px] text-[var(--mist)]">
              Vakit girdiğinde tarayıcı bildirimi alabilmek için izin verin
            </div>
          </div>
        </div>

        {pushStatus === 'granted' ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <Check className="w-4 h-4" /> Bildirimler etkin
          </div>
        ) : (
          <button
            onClick={onEnablePush}
            disabled={pushStatus === 'loading'}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {pushStatus === 'loading' ? 'Bekleniyor...' : 'Bildirimlere İzin Ver'}
          </button>
        )}

        {pushStatus === 'denied' && (
          <p className="text-[11px] text-red-500">
            Bildirim izni reddedildi. Tarayıcı ayarlarından bu site için bildirimlere izin verip tekrar deneyin.
          </p>
        )}
        {pushStatus === 'error' && pushError && (
          <p className="text-[11px] text-red-500">{pushError}</p>
        )}
      </div>

```

- [ ] **Step 4: Tip kontrolünü doğrula**

Run: `npm run lint`
Expected: Hata verir (App.tsx henüz yeni prop'ları geçmiyor) — bu beklenen bir ara durum, Task 11'de düzelecek. `SpiritualSettings.tsx`'in kendisinde sözdizimi/tip hatası olmadığını gözle doğrula.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpiritualSettings.tsx
git commit -m "feat: add notification opt-in UI to settings screen"
```

---

### Task 11: App.tsx Bağlama

**Files:**
- Modify: `src/App.tsx:1-21` (import'lar)
- Modify: `src/App.tsx:56-60` (state)
- Modify: `src/App.tsx:69-77` (yeni effect'ler eklenir)
- Modify: `src/App.tsx:112-132` (yeni handler eklenir)
- Modify: `src/App.tsx:196-202` (SpiritualSettings'e yeni prop'lar)

**Interfaces:**
- Consumes: `registerServiceWorker`, `subscribeToPush`, `syncSubscription`, `getExistingPushSubscription`, `PushStatus` (Task 9)

- [ ] **Step 1: Import ekle**

Satır 15-16 arasına (`LiveActivityWidgetModal` import'ından sonra) ekle:

```tsx
import {
  registerServiceWorker,
  subscribeToPush,
  syncSubscription,
  getExistingPushSubscription,
  PushStatus,
} from './utils/pushClient';
```

- [ ] **Step 2: State ekle**

Modal state'lerinin (satır 57-60) hemen altına ekle:

```tsx
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushError, setPushError] = useState<string | null>(null);
```

- [ ] **Step 3: Mount ve senkronizasyon effect'lerini ekle**

Timer effect'inin (satır 72-77) hemen altına ekle:

```tsx
  // Service worker'ı kaydet ve daha önce izin verilmişse aboneliği tespit et
  useEffect(() => {
    registerServiceWorker();
    (async () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const existing = await getExistingPushSubscription();
        if (existing) {
          setPushStatus('granted');
        }
      }
    })();
  }, []);

  // Ayarlar değiştikçe backend'deki aboneliği güncel tut
  useEffect(() => {
    if (pushStatus !== 'granted') return;
    (async () => {
      const existing = await getExistingPushSubscription();
      if (existing) {
        await syncSubscription(existing, settings);
      }
    })();
  }, [settings, pushStatus]);
```

- [ ] **Step 4: Handler ekle**

`handleToggleDarkMode`'un (satır 127-132) hemen altına ekle:

```tsx
  const handleEnablePush = async () => {
    setPushStatus('loading');
    setPushError(null);
    const result = await subscribeToPush(settings);
    if (result.ok) {
      setPushStatus('granted');
    } else {
      setPushStatus(result.reason === 'Bildirim izni verilmedi.' ? 'denied' : 'error');
      setPushError(result.reason);
    }
  };
```

- [ ] **Step 5: SpiritualSettings'e yeni prop'ları geç**

Satır 196-202'deki `<SpiritualSettings ... />` çağrısını şununla değiştir:

```tsx
        {activeTab === 'settings' && (
          <SpiritualSettings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onUpdateNotification={handleUpdateNotification}
            pushStatus={pushStatus}
            pushError={pushError}
            onEnablePush={handleEnablePush}
          />
        )}
```

- [ ] **Step 6: Tip kontrolünü doğrula**

Run: `npm run lint`
Expected: `TypeScript: No errors found`

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire push notification state into App"
```

---

### Task 12: Uçtan Uca Manuel Doğrulama

**Files:** Yok (kod değişikliği içermez, önceki task'ları doğrular)

- [ ] **Step 1: Tüm backend testlerini çalıştır**

Run: `npm run test:server`
Expected: `server/subscriptionStore.test.ts`, `server/scheduler.test.ts`, `server/push.test.ts`, `server/app.test.ts` — toplam 18 test, hepsi PASS

- [ ] **Step 2: Tüm sistemi başlat**

Run: `npm run dev:all`
Expected: Hem Vite (`:3000`) hem push sunucusu (`:8787`) loglarda görünür, ikisi de hatasız ayakta.

- [ ] **Step 3: Chrome'da bildirim izni ver**

`http://localhost:3000` adresini Chrome'da aç, Ayarlar sekmesine git, "Bildirimlere İzin Ver" butonuna bas, tarayıcı izin isteğini onayla.
Expected: Buton "Bildirimler etkin" durumuna geçer; `data/subscriptions.json` dosyasında bir kayıt oluşur.

- [ ] **Step 4: Gerçek push gönderimini doğrula**

Sekmeyi arka plana al (minimize etme, sadece başka sekmeye geç). Başka bir terminalde:

Run: `npm run test:push`
Expected: `1 aboneliğe test bildirimi gönderildi.` ve işletim sisteminin bildirim alanında "Test Bildirimi Vakti Girdi" başlıklı bir bildirim belirir — sekme arka plandayken bile.

- [ ] **Step 5: Bildirime tıklamayı doğrula**

Gelen bildirime tıkla.
Expected: Tarayıcı VAKİT sekmesine odaklanır (yeni sekme açmaz, çünkü zaten açık bir sekme var).

- [ ] **Step 6: İzin reddi senaryosunu doğrula**

Chrome'da site ayarlarından bildirim iznini "Engelle" yap, sayfayı yenile, "Bildirimlere İzin Ver" butonuna tekrar bas.
Expected: "Bildirim izni reddedildi. Tarayıcı ayarlarından..." uyarısı görünür, uygulamanın geri kalanı (vakit gösterimi vb.) normal çalışmaya devam eder.

Bu task bir commit içermez — önceki task'larda yapılan işi doğrular.
