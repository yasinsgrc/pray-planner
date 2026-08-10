# Play Console — Data Safety formu kaynak eşlemesi

Bu doküman, Play Console'un "Data Safety" (Veri Güvenliği) formunda işaretlenecek her kalemi, VAKİT'in gerçek kodundaki kaynağıyla eşler. **Hukuki danışmanlık değildir** — nihai form seçimleri (özellikle "toplanıyor" / "yalnızca işleniyor" ayrımı gibi Play'in kendi taksonomisine bağlı sınır durumlar) uygulamayı yayınlayan kişinin kararıdır. Buradaki her satır kodda doğrulanmıştır; hiçbir kalem varsayımla eklenmedi.

**Kapsam:** Bu doküman yalnızca **native (Android) build**'i kapsar. Web PWA'nın kendi ayrı gizlilik anlatımı `src/data/privacy.ts`'te (`getPrivacySections(false)` yolu) zaten var. Native ile web arasındaki en büyük fark: **native'de bildirim için sunucuya hiçbir abonelik kaydı gitmez** (design-refresh-v3 Faz 23 Commit 2 — `src/utils/nativeNotifications.ts`, tamamen cihaz üzerinde `@capacitor/local-notifications` ile zamanlanır, hiçbir `/api/*` isteği yapmaz).

---

## 1. Konum (Location)

| Alan | Değer |
|---|---|
| Toplanıyor mu? | Hayır — cihaz dışına hiç çıkmıyor |
| Kaynak | `src/utils/geo.ts` (`findNearestLocation`, `haversineDistanceKm` — saf yerel matematik, `src/data/locations.ts`'teki gömülü ~430 kayıtlık liste üzerinde) |
| GPS okuma | `src/components/LocationModal.tsx` — yalnızca kullanıcı "Konumumu Otomatik Kullan" butonuna bastığında (`navigator.geolocation`), tek seferlik |
| Ters coğrafi kodlama | **Kasıtlı olarak kaldırıldı** — `LocationModal.tsx:144-149`, `server/app.ts:155-162`'de reddedilen eski uç nokta. Koordinat hiçbir zaman sunucuya gönderilmez. |
| Not | Konum önerisi kontrolü (`App.tsx`, `checkLocationDrift`) da tamamen yereldir; konum hiçbir yere gönderilmez, yalnızca kullanıcıya bir öneri gösterilir. |

**Play formu önerisi:** "Konum verisi toplanmıyor" seçilebilir — koordinat asla cihaz dışına çıkmıyor. Aşağıdaki madde 2'deki arama metni (şehir adı) farklı bir kategori.

## 2. Arama sorgusu (şehir/ilçe adı) → üçüncü taraf

| Alan | Değer |
|---|---|
| Toplanıyor mu? | Evet, yalnızca kullanıcı elle arama yaptığında |
| Kaynak | `src/components/LocationModal.tsx:106` → `GET /api/geocode?q=...` |
| Tetikleyici | Kullanıcının en az 3 karakter yazıp Enter'a basması veya "İnternette Ara"ya dokunması — asla tuş vuruşunda otomatik değil |
| Sunucu tarafı | `server/app.ts:163` → `server/geocoding.ts:68`, üçüncü tarafa (OpenStreetMap Nominatim, `nominatim.openstreetmap.org`) proxy'lenir |
| Üçüncü taraf | OpenStreetMap Nominatim — yalnızca yazılan arama metni gider, GPS/IP/kimlik bilgisi gitmez |
| Saklanıyor mu? | Sunucuda kalıcı saklanmaz (istek anında proxy'lenir, önbelleklenir) |

**Play formu önerisi:** "Kullanıcı içeriği" veya "Konum" alt kategorisi altında, isteğe bağlı/kullanıcı tetiklemeli arama olarak işaretlenebilir.

## 3. Bildirimler — native'de sıfır veri toplama

| Alan | Değer |
|---|---|
| Toplanıyor mu? | **Hayır** (native) |
| Kaynak | `src/utils/nativeNotifications.ts` — `scheduleNativeNotifications`, `@capacitor/local-notifications` ile tamamen cihazda zamanlar; kodda hiçbir `fetch`/`XMLHttpRequest` yok |
| Web ile fark | Web'de aynı özellik `src/utils/pushClient.ts`'teki `POST /api/push/subscribe` / `/api/push/schedule` ile push endpoint + şifreleme anahtarları (p256dh, auth) + 30 günlük zamanlama sunucuya gönderirdi (bkz. `server/app.ts:115`, `:132`, Postgres'e yazar). **Native bu akışın hiçbirini kullanmaz.** |
| İzin | `POST_NOTIFICATIONS` (Android 13+) — yalnızca kullanıcı "Bildirimlere İzin Ver"e bastığında istenir (`App.tsx`, `handleEnablePush`), açılışta otomatik değil |

**Play formu önerisi:** Native build için "Bildirimler" ile ilişkili hiçbir veri toplama/paylaşma kalemi işaretlenmemeli — bu web PWA'dan native'i ayıran en önemli fark.

## 4. Günün Ayeti (Maneviyat sekmesi)

| Alan | Değer |
|---|---|
| Toplanıyor mu? | Hayır — istek kullanıcıyla ilişkilendirilebilecek hiçbir veri taşımaz |
| Kaynak | `src/components/DailyInspirationCard.tsx:36` → `GET /api/daily-verse` |
| Tetikleyici | Otomatik, sekme açıldığında (yalnızca `apiAvailable === true` iken) |
| Sunucu tarafı | `server/app.ts:183` → `server/dailyVerse.ts:59`, üçüncü tarafa (ummahapi.com) proxy'lenir, günlük önbelleklenir |
| Üçüncü taraf | ummahapi.com — sunucumuzun kendi isteği gider, kullanıcıya ait hiçbir bilgi gitmez |

## 5. Sunucu erişim kayıtları (tüm `/api/*` ve `/health` istekleri)

| Alan | Değer |
|---|---|
| Toplanıyor mu? | Evet — her HTTP isteğinde standart web sunucu davranışı |
| Kaynak | `src/hooks/useApiAvailable.ts:31` (`/health`, her açılışta bir kez), yukarıdaki 2 ve 4. maddelerdeki istekler |
| İçerik | IP adresi, zaman damgası, istek yolu — uygulama kodu tarafından okunmaz/işlenmez, yalnızca standart sunucu/hosting sağlayıcısı log altyapısı |
| Saklama süresi | Biz tutmuyoruz — barındırma sağlayıcılarımız (Netlify, Railway) bu kayıtları kendi politikaları uyarınca geçici olarak saklar; bu doküman bir sayı iddia etmez |

## 6. Cihazda kalan, hiç toplanmayan veriler

| Veri | Kaynak |
|---|---|
| Uygulama ayarları (konum seçimi, tema, bildirim tercihleri, hesaplama yöntemi) | `src/utils/appSettingsStorage.ts` — localStorage-eşdeğeri, WebView kökenine özel, cihaz dışına çıkmaz |
| Zikirmatik sayaç durumu ve günlük zikir kaydı | `src/utils/zikirmatikStorage.ts` — aynı şekilde yalnızca cihazda |
| Widget'ın 7 günlük vakit verisi | `src/utils/widgetStorage.ts` → Android `SharedPreferences` ("CapacitorStorage" grubu, `vakit_widget_payload_v1` anahtarı) — `android/app/src/main/java/com/vakit/widget/VakitWidgetProvider.kt` yalnızca bu yerel depodan okur, hiçbir ağ isteği yapmaz (design-refresh-v3 Faz 23 Commit 3/4, gerçek cihazda `adb shell run-as` ile doğrulandı) |
| Geri bildirim (hata bildirimi) | `src/utils/feedback.ts`, `src/components/FeedbackModal.tsx` — yalnızca cihazın kendi e-posta uygulamasını açan bir `mailto:` bağlantısı üretir; uygulama hiçbir isteği kendisi göndermez, hiçbir şeyi saklamaz |

## 7. Analitik, reklam, izleme

| Alan | Değer |
|---|---|
| Var mı? | Hayır |
| Kaynak | `src/data/privacy.ts`, "2. Özet" bölümü: "Reklam ve izleme yoktur. Uygulamada hiçbir analitik, ölçümleme, reklam veya kullanıcı takip aracı bulunmaz." — kod tabanında da bu iddiayı çürütecek hiçbir analytics/ads SDK bağımlılığı yok (`package.json`'da yalnızca üretim bağımlılıkları: React, adhan, hijri-converter, motion, Capacitor çekirdek+eklentileri, Express/pg/web-push — sunucu tarafı, hiçbiri istemci analitik SDK'sı değil). |

## 8. Şifreleme

| Alan | Değer |
|---|---|
| Aktarımda şifreleme | Evet — tüm `/api/*` istekleri HTTPS üzerinden (hosting sağlayıcısının TLS sonlandırması) |
| Native'e özgü not | Widget verisi (madde 6) hiç ağa çıkmadığı için "aktarımda şifreleme" sorusu bu veri için uygulanamaz — zaten cihaz dışına çıkmıyor |

---

## Değişiklik geçmişi

- 2026-08-07: İlk sürüm — design-refresh-v3 Faz 23 Commit 6 kapsamında, Commit 1-4'te doğrulanan native veri akışlarına göre hazırlandı.
