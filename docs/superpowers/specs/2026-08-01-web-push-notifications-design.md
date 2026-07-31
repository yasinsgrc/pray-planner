# Web Push Bildirimleri — Tasarım

## Amaç

VAKİT uygulamasının en kritik eksiği: Ayarlar sekmesinde vakit başına bildirim sesi seçilebiliyor (Ezan/Tını/Sessiz) ama hiçbir yerde gerçek zamanlanmış bir bildirim/alarm mekanizması yok. Kullanıcı uygulamayı kapatınca (hatta sekmeyi arka plana alınca bile) vakit girdiğinde hiçbir uyarı almıyor. Bu tasarım, tarayıcı tabanlı gerçek Web Push bildirimlerini (uygulama/sekme kapalıyken de çalışan) hayata geçirir.

Kapsam dışı (ayrı alt projeler): Kıble pusulasının canlı gyroscope takibi, gerçek konum arama/geocoding, PWA manifest + ikonlar + Play Store paketleme, tasarım/UX cilası. Bu tasarım sadece bildirim/alarm altyapısını kapsar.

## Mimari

```
[Frontend/React]                [Backend/Express]              [Tarayıcı Push Servisi]
  App.tsx                         server/index.ts
    │ mount + ayar değişimi          │ POST /api/subscribe
    ▼                                ▼
  pushClient.ts ───POST───────► subscriptionStore.ts
    │                                │  data/subscriptions.json
    │ register SW                    │
    ▼                                ▼
  public/sw.js ◄──push event───  server/scheduler.ts (her 60sn)
                                      │  calculatePrayerTimes() [aynı,
                                      │  src/utils/prayerCalculator.ts]
                                      ▼
                                   server/push.ts (web-push + VAPID)
```

- **Frontend**: Uygulama açılışında `public/sw.js` service worker olarak kaydedilir. Kullanıcı Ayarlar sekmesinden bildirim izni verdiğinde `pushClient.ts`, tarayıcının Push API'si üzerinden VAPID public key ile abone olur ve `{endpoint, keys, location, calculationMethod, notifications}` içeriğini `POST /api/subscribe` ile backend'e gönderir. `location`, `calculationMethod` veya `notifications` her değiştiğinde aynı endpoint tekrar çağrılarak backend'deki kayıt güncellenir (upsert, anahtar: `endpoint`).
- **Backend**: `server/index.ts`, `tsx` ile çalışan bir Express sunucusu. `data/subscriptions.json` dosyasında abonelikleri tutar (`subscriptionStore.ts`). `server/scheduler.ts` içindeki `setInterval` her 60 saniyede bir tüm abonelikleri gezer; her biri için **mevcut, değiştirilmeyen** `src/utils/prayerCalculator.ts::calculatePrayerTimes()` çağrılarak o anki vakit tablosu hesaplanır (Node'da da çalışır, DOM bağımlılığı yok). Saf bir `shouldNotifyNow(prayer, now, notificationSettings)` fonksiyonu, şu anki dakikanın bir vakte veya "erken uyarı" anına denk gelip gelmediğini ve o vaktin "sessiz" olmadığını kontrol eder. Eşleşme varsa `server/push.ts` üzerinden `web-push` ile push gönderilir.
- **Service Worker**: `public/sw.js`, gelen `push` event'inde `self.registration.showNotification(title, {body, icon})` çağırır; `notificationclick` event'inde açık bir pencere varsa odaklar, yoksa yeni sekme açar.

## Veri Modeli

`data/subscriptions.json` (gitignore'da, örnek şema):

```json
[
  {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": { "p256dh": "...", "auth": "..." },
    "location": { "id": "uskudar-istanbul", "cityName": "İstanbul", "districtName": "Üsküdar", "country": "Türkiye", "lat": 41.0264, "lng": 29.0152 },
    "calculationMethod": "Diyanet",
    "notifications": { "imsak": "ezan", "gunes": "sessiz", "...": "...", "earlyWarningMinutes": 15, "earlyWarningSound": "tini" },
    "updatedAt": "2026-08-01T10:00:00.000Z"
  }
]
```

Bugün-gönderildi takibi (çift bildirim önleme) yalnızca sunucu hafızasında (`Map<endpoint:prayer, dateISO>`) tutulur; kalıcı olması gerekmez çünkü eşleştirme zaten dar bir zaman penceresine (±30sn) dayanıyor.

## Yeni/Değişen Dosyalar

| Dosya | Açıklama |
|---|---|
| `server/index.ts` | Express app, `/api/subscribe`, `/api/unsubscribe` route'ları, scheduler'ı başlatır |
| `server/scheduler.ts` | 60sn interval döngüsü + saf `shouldNotifyNow()` fonksiyonu |
| `server/subscriptionStore.ts` | JSON dosya okuma/yazma (upsert, sil) |
| `server/push.ts` | `web-push` + VAPID kurulumu, gönderim + 404/410'da otomatik silme |
| `public/sw.js` | Service worker: `push`, `notificationclick` event handler'ları |
| `src/utils/pushClient.ts` | SW kaydı, izin isteme, abone olma/güncelleme, backend'e senkronizasyon |
| `src/App.tsx` | Mount + ayar değişikliklerinde `pushClient` çağrıları, izin reddi durumunda uyarı |
| `vite.config.ts` | Dev'de `/api` isteklerini `http://localhost:8787`'ye proxy'leme |
| `.env.example` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SERVER_PORT` |
| `.gitignore` | `data/subscriptions.json` (veya `data/`) eklenir |
| `package.json` | Yeni bağımlılıklar: `web-push`, `@types/web-push`, `concurrently`; yeni script'ler: `dev:server`, `dev:all` |

`src/utils/prayerCalculator.ts` **değiştirilmez** — backend'den doğrudan import edilir, tek doğruluk kaynağı korunur.

## Hata Yönetimi

- Push gönderiminde 404/410 (süresi dolmuş abonelik) → o kayıt store'dan otomatik silinir.
- Bildirim izni reddedilirse → Ayarlar sekmesinde "Bildirimler kapalı, izin ver" uyarısı ve tekrar deneme butonu gösterilir; uygulamanın geri kalanı normal çalışmaya devam eder.
- Backend'e ulaşılamıyorsa (çalışmıyor/ağ hatası) → abonelik isteği sessizce değil, kullanıcıya görünür bir hata mesajıyla başarısız olur; vakit gösterimi gibi diğer özellikler etkilenmez.
- Sunucu yeniden başlarsa → abonelikler JSON dosyasında kalıcıdır, kaybolmaz; hafızadaki "bugün gönderildi" takibi sıfırlanır ama dar zaman penceresi sayesinde pratik bir çift-gönderim riski oluşturmaz.
- `POST /api/subscribe` gövdesi eksik/hatalıysa → `400` döner, store'a yazılmaz.

## Test Yaklaşımı

- **Birim testi**: `node:test` (yeni framework eklenmez) ile `shouldNotifyNow()` saf fonksiyonu için birkaç senaryo (tam vakit anı, erken uyarı anı, "sessiz" modda tetiklenmemesi, vakit dışı zamanda tetiklenmemesi) test edilir.
- **Manuel uçtan uca doğrulama**: `npm run dev:all` ile Vite + Express birlikte başlatılır; Chrome'da bildirim izni verilir, `data/subscriptions.json`'da kaydın oluştuğu doğrulanır, yakın bir zamana denk gelen bir vakit için (veya geçici bir test konumu/saatiyle) gerçek push bildiriminin sekme arka plandayken de geldiği gözlemlenir.

## Yerel Geliştirme Akışı

```bash
npm install                          # web-push, concurrently vb. yeni bağımlılıklar dahil
npx web-push generate-vapid-keys     # bir kereye mahsus VAPID anahtar çifti üretir
cp .env.example .env                 # üretilen public/private key'leri .env'e yapıştır
npm run dev:all                      # Vite (3000) + Express (8787) birlikte, /api proxy'li
```
