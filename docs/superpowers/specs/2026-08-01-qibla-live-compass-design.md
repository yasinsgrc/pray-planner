# Kıble Pusulası — Canlı Cihaz Yönü Takibi — Tasarım

## Amaç

`QiblaCompassModal` şu an sadece konuma göre sabit bir kıble açısı hesaplayıp gösteriyor; telefonun gerçek yönünü okumuyor, ibre telefonu çevirince dönmüyor. Bu tasarım, tarayıcının `DeviceOrientationEvent` API'siyle telefonun gerçek yönünü okuyup ibreyi buna göre canlı döndürür ve kullanıcı kıbleye hizalanınca görsel + titreşimli geri bildirim verir.

Kapsam dışı (bu tasarımın konusu değil): yatay ekran (landscape) düzeltmesi — sadece dikey kullanım desteklenir. Konum arama/geocoding, PWA/Play Store paketleme, tasarım cilası — ayrı alt projeler.

## Mimari

```
[QiblaCompassModal.tsx]
        │ kullanır
        ▼
[useCompassHeading() hook]  ──kullanır──►  [compassHeading.ts — saf fonksiyonlar]
        │
        ▼ (tarayıcı API'leri)
  DeviceOrientationEvent.requestPermission() (iOS)
  window.addEventListener('deviceorientationabsolute' | 'deviceorientation', ...)
```

- **`src/utils/compassHeading.ts`** — DOM'a bağımlı olmayan saf fonksiyonlar:
  - `computeHeadingFromOrientationEvent(event: { webkitCompassHeading?: number; alpha: number | null }): number | null` — iOS'ta `webkitCompassHeading` varsa onu döner; yoksa `alpha !== null` ise `(360 - alpha + 360) % 360` formülüyle Android muadilini döner; `alpha === null` ise `null`.
  - `getAngularDifference(a: number, b: number): number` — iki açı arasındaki en kısa açısal fark, 0-180° aralığında.
  - `isAlignedWithBearing(bearing: number, heading: number, toleranceDeg?: number): boolean` — varsayılan tolerans 5°.
- **`src/hooks/useCompassHeading.ts`** — tarayıcı API'siyle konuşan katman (projede ilk `hooks/` klasörü):
  - State: `heading: number | null`, `permissionState: 'idle' | 'granted' | 'denied' | 'unsupported'`.
  - `requestPermission()`: `DeviceOrientationEvent` yoksa `'unsupported'`; `DeviceOrientationEvent.requestPermission` bir fonksiyonsa (iOS 13+) onu çağırıp sonucu `'granted'`/`'denied'`e çevirir; yoksa (Android/diğer) direkt `'granted'`.
  - `'granted'` olunca `'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'` event'ini dinler, her event'te `computeHeadingFromOrientationEvent()` ile `heading`'i günceller.
  - `'granted'`dan sonra 2000ms içinde hiç event gelmezse (`heading` hâlâ `null`) `permissionState`'i `'unsupported'`a çevirir.
- **`src/components/QiblaCompassModal.tsx`** — mevcut sabit açı hesaplamasını (`qiblaBearing`) korur, `useCompassHeading()`'i kullanır:
  - `permissionState === 'idle'`: bugünkü sabit ibre + "Pusulayı Etkinleştir" butonu.
  - `heading !== null`: ibre `rotate(${(qiblaBearing - heading + 360) % 360}deg)` ile canlı döner.
  - `heading === null` (henüz izin yok / veri gelmedi): ibre bugünkü gibi `rotate(${qiblaBearing}deg)` ile sabit kalır.
  - `isAlignedWithBearing(qiblaBearing, heading, 5)` `false → true` geçişinde (önceki durum bir `ref`'te tutulur) ibre/halka rengi yeşile döner ve tek seferlik `navigator.vibrate(50)` çağrılır (Zikirmatik'te zaten kullanılan aynı API).
  - `permissionState === 'denied' | 'unsupported'`: bugünkü sabit gösterim + açıklayıcı Türkçe uyarı metni + (yalnızca `'denied'` için) tekrar deneme butonu.

## Hata Yönetimi

- `DeviceOrientationEvent` tanımsızsa → doğrudan `'unsupported'`, "Cihazınız pusula sensörünü desteklemiyor, açı bilgisini yukarıdan kullanabilirsiniz" uyarısı.
- iOS'ta `requestPermission()` reddedilir veya reject olursa → `'denied'`, "İzin reddedildi. Tarayıcı ayarlarından hareket sensörü iznini açıp tekrar deneyin." + tekrar deneme butonu.
- İzin verildi ama 2 saniye içinde event gelmediyse → otomatik `'unsupported'`, aynı uyarı.
- Modal her açılışta hook'u yeniden mount eder, izin durumu sıfırlanır — global state eklenmez (basitlik tercih edildi); iOS'ta ikinci `requestPermission()` çağrısı native izin penceresini tekrar açmadığı için bu pratikte sorun yaratmaz.

## Test Yaklaşımı

- `src/utils/compassHeading.test.ts`: `node:test` ile saf fonksiyonlar test edilir — iOS yolu (`webkitCompassHeading`), Android yolu (`alpha`), `alpha === null` → `null`, açısal fark sınır durumları (0°, 180°, 350°↔10° gibi wrap-around), hizalama toleransının sınırındaki true/false davranışı. Yeni bir frontend test framework'ü eklenmez (mevcut kısıt korunur), bu dosyalar DOM'a bağımlı olmadığı için `tsx --test` ile aynı şekilde çalışır.
- `useCompassHeading.ts` ve `QiblaCompassModal.tsx`: tarayıcı API'sine bağımlı olduğundan (önceki özellikteki `pushClient.ts` gibi) otomatik test yok; gerçek telefonda manuel uçtan uca doğrulama yapılır.

## Yerel Geliştirme / Doğrulama Akışı

Bu özellik ek bir backend/env değişikliği gerektirmez; mevcut `npm run dev` (veya `npm run dev:all`) yeterlidir.

Önemli kısıt: `DeviceOrientationEvent`/sensör API'leri modern tarayıcılarda yalnızca "güvenli bağlam"da (HTTPS veya `localhost`) çalışır. Telefondan yerel ağ IP'si (`http://<bilgisayar-ip>:3000`) üzerinden açmak bu koşulu sağlamaz, sensör API'si sessizce çalışmaz. Android + Chrome için pratik çözüm: telefonu USB ile bağlayıp `chrome://inspect`'ten port yönlendirme (`adb reverse tcp:3000 tcp:3000`) kurmak — telefon o zaman `http://localhost:3000`'i güvenli bağlam olarak görür. iOS Safari için eşdeğer bir yöntem bir Mac gerektirir; bu ortamda (Windows) iOS'ta canlı doğrulama yapılamayabilir — bu durumda iOS dalı (`webkitCompassHeading`) yalnızca kod incelemesiyle doğrulanır, gerçek cihazda değil.
