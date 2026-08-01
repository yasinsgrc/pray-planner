# Günün Ayeti API Bağlantısı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Manevi" sekmesindeki günün ayeti UmmahAPI'den canlı ve Türkçe gelsin; hadis/dua havuzu 4'ten 10 kayda çıkarılıp tekrar sıklığı azalsın.

**Architecture:** Mevcut Express backend'e, geocoding ile aynı DI deseninde bir `dailyVerse.ts` servisi eklenir; tarihe göre cache'ler (günde 1 istek). Frontend, hadis/dua için değişmeden statik havuzu kullanmaya devam eder.

**Tech Stack:** Node'un global `fetch`'i (server tarafında, ek bağımlılık yok), `node:test`.

## Global Constraints

- `GET /api/daily-verse` aynı takvim günü içinde UmmahAPI'ye yalnızca 1 kez istek atar (cache).
- API başarısız olursa/yüklenmemişse frontend mevcut statik havuzun `verse`/`verseRef` alanına sessizce düşer — asla boş göstermez.
- "Hadis" ve "Dua" sekmeleri değişmeden statik havuzdan gelmeye devam eder.
- Tüm kullanıcıya görünen metinler Türkçe.

---

### Task 1: Günlük Ayet Servisi (server/dailyVerse.ts)

**Files:**
- Create: `server/dailyVerse.ts`
- Test: `server/dailyVerse.test.ts`

**Interfaces:**
- Produces: `DailyVerse` tipi (`{verse: string, verseRef: string}`); `DailyVerseService` arayüzü (`{getVerseOfTheDay(): Promise<DailyVerse>}`); `createDailyVerseService(deps?: {fetchImpl?: typeof fetch, now?: () => Date}): DailyVerseService` — Task 2/3 bunu `createDailyVerseService()` (parametresiz, gerçek `fetch`/`Date` ile) şeklinde çağıracak.

- [ ] **Step 1: Başarısız testi yaz — server/dailyVerse.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDailyVerseService } from './dailyVerse';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function makeApiBody(surahNumber: number, ayah: number, turkish: string) {
  return { data: { surah: { number: surahNumber }, verse: { ayah, translations: { turkish } } } };
}

test('fetches and maps a verse with the correct Turkish surah name', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(39, 59, 'Test meal metni'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: () => new Date('2026-08-01') });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verse, 'Test meal metni');
  assert.equal(result.verseRef, 'Zümer Suresi, 59. Ayet');
});

test('maps surah number 1 to Fâtiha correctly', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(1, 1, 'Test'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verseRef, 'Fâtiha Suresi, 1. Ayet');
});

test('maps surah number 114 to Nâs correctly', async () => {
  const fakeFetch = (async () => fakeResponse(makeApiBody(114, 6, 'Test'))) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  const result = await service.getVerseOfTheDay();
  assert.equal(result.verseRef, 'Nâs Suresi, 6. Ayet');
});

test('caches the verse for the same calendar day, only calling fetch once', async () => {
  let callCount = 0;
  const fakeFetch = (async () => {
    callCount++;
    return fakeResponse(makeApiBody(1, 1, 'İlk çağrı'));
  }) as typeof fetch;
  const fixedNow = () => new Date('2026-08-01T10:00:00Z');
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: fixedNow });

  await service.getVerseOfTheDay();
  await service.getVerseOfTheDay();

  assert.equal(callCount, 1);
});

test('refetches when the calendar day changes', async () => {
  let callCount = 0;
  let current = new Date('2026-08-01T10:00:00Z');
  const fakeFetch = (async () => {
    callCount++;
    return fakeResponse(makeApiBody(1, 1, 'Metin'));
  }) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch, now: () => current });

  await service.getVerseOfTheDay();
  current = new Date('2026-08-02T10:00:00Z');
  await service.getVerseOfTheDay();

  assert.equal(callCount, 2);
});

test('throws when the API responds with a non-ok status', async () => {
  const fakeFetch = (async () => fakeResponse({}, false, 500)) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  await assert.rejects(() => service.getVerseOfTheDay());
});

test('throws when the Turkish translation is missing', async () => {
  const fakeFetch = (async () =>
    fakeResponse({ data: { surah: { number: 1 }, verse: { ayah: 1, translations: {} } } })) as typeof fetch;
  const service = createDailyVerseService({ fetchImpl: fakeFetch });
  await assert.rejects(() => service.getVerseOfTheDay());
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --import tsx --test "server/dailyVerse.test.ts"`
Expected: FAIL — `Cannot find module './dailyVerse'`

- [ ] **Step 3: server/dailyVerse.ts implementasyonunu yaz**

```ts
const TURKISH_SURAH_NAMES: string[] = [
  'Fâtiha', 'Bakara', 'Âl-i İmrân', 'Nisâ', 'Mâide', 'En\'âm', 'A\'râf', 'Enfâl', 'Tevbe', 'Yûnus',
  'Hûd', 'Yûsuf', 'Ra\'d', 'İbrâhîm', 'Hicr', 'Nahl', 'İsrâ', 'Kehf', 'Meryem', 'Tâhâ',
  'Enbiyâ', 'Hac', 'Mü\'minûn', 'Nûr', 'Furkân', 'Şuarâ', 'Neml', 'Kasas', 'Ankebût', 'Rûm',
  'Lokman', 'Secde', 'Ahzâb', 'Sebe\'', 'Fâtır', 'Yâsîn', 'Sâffât', 'Sâd', 'Zümer', 'Mü\'min',
  'Fussilet', 'Şûrâ', 'Zuhruf', 'Duhân', 'Câsiye', 'Ahkâf', 'Muhammed', 'Fetih', 'Hucurât', 'Kâf',
  'Zâriyât', 'Tûr', 'Necm', 'Kamer', 'Rahmân', 'Vâkıa', 'Hadîd', 'Mücâdele', 'Haşr', 'Mümtehine',
  'Saff', 'Cuma', 'Münâfikûn', 'Tegâbün', 'Talâk', 'Tahrîm', 'Mülk', 'Kalem', 'Hâkka', 'Meâric',
  'Nûh', 'Cin', 'Müzzemmil', 'Müddessir', 'Kıyâme', 'İnsân', 'Mürselât', 'Nebe\'', 'Nâziât', 'Abese',
  'Tekvîr', 'İnfitâr', 'Mutaffifîn', 'İnşikâk', 'Bürûc', 'Târık', 'A\'lâ', 'Gâşiye', 'Fecr', 'Beled',
  'Şems', 'Leyl', 'Duhâ', 'İnşirâh', 'Tîn', 'Alak', 'Kadr', 'Beyyine', 'Zilzâl', 'Âdiyât',
  'Kâria', 'Tekâsür', 'Asr', 'Hümeze', 'Fîl', 'Kureyş', 'Mâûn', 'Kevser', 'Kâfirûn', 'Nasr',
  'Tebbet', 'İhlâs', 'Felak', 'Nâs',
];

export interface DailyVerse {
  verse: string;
  verseRef: string;
}

interface UmmahApiQuranRandomResponse {
  data: {
    surah: { number: number };
    verse: {
      ayah: number;
      translations: { turkish?: string };
    };
  };
}

export interface DailyVerseServiceDeps {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface DailyVerseService {
  getVerseOfTheDay(): Promise<DailyVerse>;
}

export function createDailyVerseService(deps: DailyVerseServiceDeps = {}): DailyVerseService {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  let cachedDateKey: string | null = null;
  let cachedVerse: DailyVerse | null = null;

  function dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async function getVerseOfTheDay(): Promise<DailyVerse> {
    const today = dateKey(now());
    if (cachedDateKey === today && cachedVerse) {
      return cachedVerse;
    }

    const res = await fetchImpl('https://ummahapi.com/api/quran/random');
    if (!res.ok) {
      throw new Error(`UmmahAPI isteği başarısız: ${res.status}`);
    }

    const body = (await res.json()) as UmmahApiQuranRandomResponse;
    const turkish = body.data.verse.translations.turkish;
    if (!turkish) {
      throw new Error('Türkçe meal bulunamadı.');
    }

    const surahName = TURKISH_SURAH_NAMES[body.data.surah.number - 1] ?? 'Kur\'an';
    const verse: DailyVerse = {
      verse: turkish,
      verseRef: `${surahName} Suresi, ${body.data.verse.ayah}. Ayet`,
    };

    cachedDateKey = today;
    cachedVerse = verse;
    return verse;
  }

  return { getVerseOfTheDay };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "server/dailyVerse.test.ts"`
Expected: 7 test, hepsi PASS

- [ ] **Step 5: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit` (NOT `npm run lint`)
Expected: `TypeScript: No errors found`

- [ ] **Step 6: Commit**

```bash
git add server/dailyVerse.ts server/dailyVerse.test.ts
git commit -m "feat: add daily verse service with UmmahAPI + date-keyed cache"
```

---

### Task 2: Express Route'u (server/app.ts)

**Files:**
- Modify: `server/app.ts`
- Modify: `server/app.test.ts`

**Interfaces:**
- Consumes: `DailyVerseService` (Task 1, `./dailyVerse`)
- Produces: `CreateAppDeps`'e yeni zorunlu alan `dailyVerseService: DailyVerseService` eklenir; yeni route: `GET /api/daily-verse` (200 → `{verse, verseRef}`, 502 → servis hata fırlatırsa)

- [ ] **Step 1: server/app.ts'e import ve route ekle**

Dosyanın en üstündeki import bloğuna ekle:

```ts
import type { DailyVerseService } from './dailyVerse';
```

`CreateAppDeps` interface'ini şununla değiştir:

```ts
export interface CreateAppDeps {
  store: SubscriptionStore;
  vapidPublicKey: string;
  geocodingClient: GeocodingClient;
  dailyVerseService: DailyVerseService;
}
```

`return app;` satırının hemen üstüne ekle:

```ts
  app.get('/api/daily-verse', async (_req, res) => {
    try {
      const verse = await deps.dailyVerseService.getVerseOfTheDay();
      res.status(200).json(verse);
    } catch {
      res.status(502).json({ error: 'Günün ayeti alınamadı.' });
    }
  });

```

- [ ] **Step 2: server/app.test.ts'e sahte servis ve testleri ekle**

Import bloğuna ekle:

```ts
import type { DailyVerseService } from './dailyVerse';
```

`createFakeGeocodingClient` fonksiyonunun hemen altına ekle:

```ts
function createFakeDailyVerseService(overrides: Partial<DailyVerseService> = {}): DailyVerseService {
  return {
    getVerseOfTheDay: async () => ({ verse: 'Test ayet', verseRef: 'Test Suresi, 1. Ayet' }),
    ...overrides,
  };
}
```

`withServer` fonksiyonunun tamamını şununla değiştir:

```ts
async function withServer(
  run: (baseUrl: string, store: ReturnType<typeof createSubscriptionStore>) => Promise<void>,
  geocodingClient: GeocodingClient = createFakeGeocodingClient(),
  dailyVerseService: DailyVerseService = createFakeDailyVerseService()
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'vakit-app-'));
  const store = createSubscriptionStore(path.join(dir, 'subs.json'));
  const app = createApp({ store, vapidPublicKey: 'test-public-key', geocodingClient, dailyVerseService });
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
```

Dosyanın sonuna ekle:

```ts
test('GET /api/daily-verse returns the verse from the daily verse service', async () => {
  const fakeService = createFakeDailyVerseService({
    getVerseOfTheDay: async () => ({ verse: 'Örnek meal', verseRef: 'Fâtiha Suresi, 1. Ayet' }),
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/daily-verse`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.verse, 'Örnek meal');
      assert.equal(body.verseRef, 'Fâtiha Suresi, 1. Ayet');
    },
    undefined,
    fakeService
  );
});

test('GET /api/daily-verse returns 502 when the service throws', async () => {
  const fakeService = createFakeDailyVerseService({
    getVerseOfTheDay: async () => {
      throw new Error('network down');
    },
  });

  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/daily-verse`);
      assert.equal(res.status, 502);
    },
    undefined,
    fakeService
  );
});
```

- [ ] **Step 3: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "server/app.test.ts"`
Expected: 12 test, hepsi PASS

- [ ] **Step 4: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: Hata verir (`server/index.ts` henüz `dailyVerseService` geçmiyor) — beklenen ara durum, Task 3'te düzelecek.

- [ ] **Step 5: Commit**

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: add /api/daily-verse route"
```

---

### Task 3: Sunucu Bağlama (server/index.ts)

**Files:**
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `createDailyVerseService` (Task 1, `./dailyVerse`)

- [ ] **Step 1: server/index.ts'i güncelle**

`import { createGeocodingClient } from './geocoding';` satırının hemen altına ekle:

```ts
import { createDailyVerseService } from './dailyVerse';
```

`const app = createApp({...})` çağrısını şununla değiştir:

```ts
const app = createApp({
  store,
  vapidPublicKey: VAPID_PUBLIC_KEY,
  geocodingClient: createGeocodingClient(),
  dailyVerseService: createDailyVerseService(),
});
```

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Manuel doğrulama**

Run: `npx tsx server/index.ts` (VAPID anahtarları `.env`'de zaten mevcut)

Başka bir terminalde:
```bash
curl -s "http://localhost:8787/api/daily-verse"
```
Expected: `{"verse":"...", "verseRef":"... Suresi, N. Ayet"}` — gerçek UmmahAPI sonucu (internet bağlantısı gerekir). Aynı isteği tekrar atınca aynı sonuç dönmeli (cache).

Sunucuyu durdur (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: wire daily verse service into server"
```

---

### Task 4: Frontend Bağlama ve İçerik Havuzu Genişletme

**Files:**
- Modify: `src/data/dailyContent.ts`
- Modify: `src/components/DailyInspirationCard.tsx`

**Interfaces:** Yok — doğrudan `/api/daily-verse`'i `fetch` ile çağırır, Vite proxy'si zaten kurulu.

- [ ] **Step 1: src/data/dailyContent.ts'in sonundaki `];` satırını (mevcut 4. kaydın kapanışı) şununla değiştir**

```ts
  {
    verse: 'Şüphesiz Allah, adaleti, iyilik yapmayı ve yakınlara yardım etmeyi emreder; hayasızlığı, kötülüğü ve azgınlığı yasaklar.',
    verseRef: 'Nahl Suresi, 90. Ayet',
    hadith: 'Ameller ancak niyetlere göredir. Herkese niyet ettiği şey vardır.',
    hadithRef: 'Buhârî, Bed’ü’l-Vahy, 1',
    dua: 'Allah’ım! Senden hidayet, takva, iffet ve gönül zenginliği isterim.',
    duaRef: 'Müslim, Zikir, 72',
  },
  {
    verse: 'Şüphesiz namaz, hayasızlıktan ve kötülükten alıkoyar.',
    verseRef: 'Ankebût Suresi, 45. Ayet',
    hadith: 'Müslüman, elinden ve dilinden diğer Müslümanların emin olduğu kimsedir.',
    hadithRef: 'Buhârî, Îmân, 4-5',
    dua: 'Rabbimiz! Bizi doğru yola ilettikten sonra kalplerimizi saptırma, katından bize bir rahmet bağışla.',
    duaRef: 'Âl-i İmrân Suresi, 8. Ayet',
  },
  {
    verse: 'Kim bir iyilik yaparsa kendi lehinedir; kim de kötülük yaparsa kendi aleyhinedir.',
    verseRef: 'Fussilet Suresi, 46. Ayet',
    hadith: 'Sizden biriniz, kendisi için istediğini kardeşi için de istemedikçe gerçek anlamda iman etmiş olmaz.',
    hadithRef: 'Buhârî, Îmân, 7',
    dua: 'Allah’ım! Beni sana şükreden, seni zikreden, senden korkan ve sana itaat eden bir kul eyle.',
    duaRef: 'Tirmizî, Deavât, 23',
  },
  {
    verse: 'Şüphesiz güçlükle beraber bir kolaylık vardır.',
    verseRef: 'İnşirâh Suresi, 6. Ayet',
    hadith: 'Veren el, alan elden hayırlıdır.',
    hadithRef: 'Buhârî, Zekât, 18',
    dua: 'Allah’ım! İşimin başını da sonunu da hayırlı eyle.',
    duaRef: 'Müslim, Zikir, 76',
  },
  {
    verse: 'Allah hiçbir kimseye gücünün yeteceğinden başka yük yüklemez.',
    verseRef: 'Bakara Suresi, 286. Ayet',
    hadith: 'Kuvvetli mümin, Allah katında zayıf müminden daha hayırlı ve daha sevimlidir.',
    hadithRef: 'Müslim, Kader, 34',
    dua: 'Allah’ım! Bizi sıhhat, afiyet ve emniyet içinde daim eyle.',
    duaRef: 'Ebû Dâvûd, Edeb, 101',
  },
  {
    verse: 'Kuşkusuz Allah, sabredenlerle beraberdir.',
    verseRef: 'Bakara Suresi, 153. Ayet',
    hadith: 'Kişi, sevdiğiyle beraberdir.',
    hadithRef: 'Buhârî, Edeb, 96',
    dua: 'Allah’ım! Senin rızan için yaptığım işlerde bana yardım et, beni bir an bile nefsimle baş başa bırakma.',
    duaRef: 'Ebû Dâvûd, Vitr, 25',
  },
];
```

(Not: `’` karakteri, dosyada zaten kullanılan tipografik kesme işareti `’`dir — mevcut kayıtlardaki `Allah’ım` yazımıyla birebir aynı karakteri kullan, düz tırnak `'` değil.)

- [ ] **Step 2: src/components/DailyInspirationCard.tsx'i güncelle**

İlk satırı şununla değiştir:

```tsx
import React, { useEffect, useState } from 'react';
```

`const [copied, setCopied] = useState(false);` satırının hemen altına ekle:

```tsx
  const [apiVerse, setApiVerse] = useState<{ verse: string; verseRef: string } | null>(null);
```

`const content = DAILY_INSPIRATIONS[todayIndex] || DAILY_INSPIRATIONS[0];` satırının hemen altına ekle:

```tsx

  useEffect(() => {
    let ignore = false;

    fetch('/api/daily-verse')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!ignore && data?.verse && data?.verseRef) {
          setApiVerse({ verse: data.verse, verseRef: data.verseRef });
        }
      })
      .catch(() => {
        // Ağ hatası: sessizce statik havuzdaki ayete düş
      });

    return () => {
      ignore = true;
    };
  }, []);

  const verseText = apiVerse?.verse ?? content.verse;
  const verseRefText = apiVerse?.verseRef ?? content.verseRef;
```

`getTextToCopy` fonksiyonunun içindeki ilk satırı değiştir:

```tsx
  const getTextToCopy = () => {
    if (tab === 'verse') return `"${verseText}" — ${verseRefText}`;
```

JSX içindeki ayet gösterim kısmını güncelle — `{tab === 'verse' && content.verse}` satırını `{tab === 'verse' && verseText}` ile, `{tab === 'verse' && content.verseRef}` satırını `{tab === 'verse' && verseRefText}` ile değiştir (hadith/dua satırları aynı kalır).

- [ ] **Step 3: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 4: Manuel doğrulama**

Run: `npm run dev:all`, tarayıcıda uygulamayı aç, "Maneviyat" sekmesine git.
Expected: "Âyet" sekmesinde birkaç saniye içinde canlı (UmmahAPI'den gelen) bir ayet ve gerçek sure adı görünür; "Hadis"/"Dua" sekmeleri değişmeden çalışır.

- [ ] **Step 5: Commit**

```bash
git add src/data/dailyContent.ts src/components/DailyInspirationCard.tsx
git commit -m "feat: fetch daily verse from API, expand static hadith/dua pool to 10 entries"
```
