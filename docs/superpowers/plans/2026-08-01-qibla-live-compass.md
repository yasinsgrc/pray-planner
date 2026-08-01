# Kıble Pusulası Canlı Yön Takibi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `QiblaCompassModal`'daki sabit kıble açısı gösterimini, telefonun gerçek yönünü (`DeviceOrientationEvent`) okuyup ibreyi canlı döndüren ve kıbleye hizalanınca görsel+titreşimli geri bildirim veren bir deneyime dönüştürmek.

**Architecture:** Saf açı/hizalama matematiği (`src/utils/compassHeading.ts`) DOM'dan bağımsız ve `node:test` ile test edilir; tarayıcı sensör API'sine bağımlı kısım ayrı bir hook'a (`src/hooks/useCompassHeading.ts`) taşınır; `QiblaCompassModal.tsx` sadece bu hook'u tüketip arayüzü çizer.

**Tech Stack:** React 19 hooks (`useState`, `useEffect`, `useRef`, `useCallback`), tarayıcı `DeviceOrientationEvent` API'si, Node'un yerleşik `node:test` test çalıştırıcısı (`tsx` üzerinden).

## Global Constraints

- Yalnızca dikey (portrait) kullanım desteklenir; yatay ekran düzeltmesi kapsam dışı.
- `useCompassHeading(active: boolean)` hook'u, `active` (yani modalın `isOpen` durumu) `false` olduğunda veya izin `'granted'` olmadığında sensör event listener'ını bağlamaz/kaldırır — modal kapalıyken arka planda dinleme yapılmaz.
- İzin durumu (`permissionState`) modal kapanıp açıldığında sıfırlanmaz (component hiç unmount olmuyor) — kullanıcı bir oturumda izni bir kez verir.
- Hizalama toleransı: 5°.
- Yeni bir frontend test framework'ü eklenmez; yalnızca DOM'a bağımlı olmayan saf fonksiyonlar `node:test` ile test edilir.
- Tüm kullanıcıya görünen metinler Türkçe.

---

### Task 1: Saf Pusula Matematiği (src/utils/compassHeading.ts)

**Files:**
- Create: `src/utils/compassHeading.ts`
- Test: `src/utils/compassHeading.test.ts`

**Interfaces:**
- Produces: `OrientationEventLike` tipi (`{ webkitCompassHeading?: number; alpha: number | null }`); `computeHeadingFromOrientationEvent(event: OrientationEventLike): number | null`; `getAngularDifference(a: number, b: number): number`; `isAlignedWithBearing(bearing: number, heading: number, toleranceDeg?: number): boolean` (varsayılan `toleranceDeg = 5`)

- [ ] **Step 1: Başarısız testi yaz — src/utils/compassHeading.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHeadingFromOrientationEvent,
  getAngularDifference,
  isAlignedWithBearing,
} from './compassHeading';

test('computeHeadingFromOrientationEvent prefers webkitCompassHeading when present (iOS)', () => {
  const heading = computeHeadingFromOrientationEvent({ webkitCompassHeading: 123.4, alpha: 50 });
  assert.equal(heading, 123.4);
});

test('computeHeadingFromOrientationEvent falls back to alpha-based formula (Android)', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 90 });
  assert.equal(heading, 270);
});

test('computeHeadingFromOrientationEvent normalizes the Android formula into 0-360', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: 0 });
  assert.equal(heading, 0);
});

test('computeHeadingFromOrientationEvent returns null when alpha is null and no iOS heading', () => {
  const heading = computeHeadingFromOrientationEvent({ alpha: null });
  assert.equal(heading, null);
});

test('getAngularDifference returns 0 for identical angles', () => {
  assert.equal(getAngularDifference(90, 90), 0);
});

test('getAngularDifference returns 180 for opposite angles', () => {
  assert.equal(getAngularDifference(0, 180), 180);
});

test('getAngularDifference handles wrap-around near 0/360', () => {
  assert.equal(getAngularDifference(350, 10), 20);
});

test('isAlignedWithBearing is true within the default 5 degree tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 104), true);
});

test('isAlignedWithBearing is false just outside the default tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 106), false);
});

test('isAlignedWithBearing respects a custom tolerance', () => {
  assert.equal(isAlignedWithBearing(100, 108, 10), true);
});

test('isAlignedWithBearing handles wrap-around alignment near 0/360', () => {
  assert.equal(isAlignedWithBearing(358, 2, 5), true);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --import tsx --test "src/utils/compassHeading.test.ts"`
Expected: FAIL — `Cannot find module './compassHeading'`

- [ ] **Step 3: src/utils/compassHeading.ts implementasyonunu yaz**

```ts
export interface OrientationEventLike {
  webkitCompassHeading?: number;
  alpha: number | null;
}

export function computeHeadingFromOrientationEvent(
  event: OrientationEventLike
): number | null {
  if (typeof event.webkitCompassHeading === 'number') {
    return event.webkitCompassHeading;
  }
  if (event.alpha === null) {
    return null;
  }
  return (360 - event.alpha + 360) % 360;
}

export function getAngularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function isAlignedWithBearing(
  bearing: number,
  heading: number,
  toleranceDeg = 5
): boolean {
  return getAngularDifference(bearing, heading) <= toleranceDeg;
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "src/utils/compassHeading.test.ts"`
Expected: 11 test, hepsi PASS

- [ ] **Step 5: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit` (NOT `npm run lint` — bu makinede bir shell hook çıktısını bozuyor)
Expected: `TypeScript: No errors found`

- [ ] **Step 6: Commit**

```bash
git add src/utils/compassHeading.ts src/utils/compassHeading.test.ts
git commit -m "feat: add pure compass heading and alignment math"
```

---

### Task 2: Cihaz Pusulası Hook'u (src/hooks/useCompassHeading.ts)

**Files:**
- Create: `src/hooks/useCompassHeading.ts`

**Interfaces:**
- Consumes: `computeHeadingFromOrientationEvent` (Task 1, `../utils/compassHeading`)
- Produces: `CompassPermissionState` tipi (`'idle' | 'granted' | 'denied' | 'unsupported'`); `CompassHeadingState` tipi (`{ heading: number | null; permissionState: CompassPermissionState; requestPermission: () => Promise<void> }`); `useCompassHeading(active: boolean): CompassHeadingState` — Task 3 bunu `useCompassHeading(isOpen)` şeklinde çağıracak.

Bu dosya tarayıcı sensör API'sine doğrudan bağımlı olduğu için (önceki özellikteki `src/utils/pushClient.ts` gibi) otomatik testi yoktur — Task 4'te gerçek cihazda doğrulanır.

- [ ] **Step 1: src/hooks/useCompassHeading.ts oluştur**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeHeadingFromOrientationEvent } from '../utils/compassHeading';

export type CompassPermissionState = 'idle' | 'granted' | 'denied' | 'unsupported';

export interface CompassHeadingState {
  heading: number | null;
  permissionState: CompassPermissionState;
  requestPermission: () => Promise<void>;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const NO_DATA_TIMEOUT_MS = 2000;

export function useCompassHeading(active: boolean): CompassHeadingState {
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] = useState<CompassPermissionState>('idle');
  const hasReceivedDataRef = useRef(false);

  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermissionState('unsupported');
      return;
    }

    const DOE = DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;

    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        setPermissionState(result === 'granted' ? 'granted' : 'denied');
      } catch {
        setPermissionState('denied');
      }
    } else {
      setPermissionState('granted');
    }
  }, []);

  useEffect(() => {
    if (!active || permissionState !== 'granted') return;

    hasReceivedDataRef.current = false;

    function handleOrientation(event: DeviceOrientationEvent) {
      const nextHeading = computeHeadingFromOrientationEvent({
        webkitCompassHeading: (event as unknown as { webkitCompassHeading?: number })
          .webkitCompassHeading,
        alpha: event.alpha,
      });

      if (nextHeading !== null) {
        hasReceivedDataRef.current = true;
        setHeading(nextHeading);
      }
    }

    const eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

    window.addEventListener(eventName, handleOrientation);

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setPermissionState('unsupported');
      }
    }, NO_DATA_TIMEOUT_MS);

    return () => {
      window.removeEventListener(eventName, handleOrientation);
      window.clearTimeout(timeoutId);
    };
  }, [active, permissionState]);

  return { heading, permissionState, requestPermission };
}
```

Not: `window.addEventListener(eventName, handleOrientation)` çağrısında `handleOrientation`'ı `EventListener`'a cast etmeye gerek yok — bu projenin `tsconfig.json`'ında `strictFunctionTypes` kapalı olduğu için (`strict` set edilmemiş) doğrudan derleniyor; bu önceden doğrulandı.

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCompassHeading.ts
git commit -m "feat: add device compass heading hook"
```

---

### Task 3: QiblaCompassModal'ı Canlı Pusulaya Bağla

**Files:**
- Modify: `src/components/QiblaCompassModal.tsx` (tüm dosya değiştirilir)

**Interfaces:**
- Consumes: `useCompassHeading` (Task 2, `../hooks/useCompassHeading`), `isAlignedWithBearing` (Task 1, `../utils/compassHeading`)

- [ ] **Step 1: src/components/QiblaCompassModal.tsx dosyasının tamamını şu içerikle değiştir**

```tsx
import React, { useEffect, useRef } from 'react';
import { Compass, X, AlertCircle } from 'lucide-react';
import { LocationItem } from '../types';
import { useCompassHeading } from '../hooks/useCompassHeading';
import { isAlignedWithBearing } from '../utils/compassHeading';

interface QiblaCompassModalProps {
  location: LocationItem;
  isOpen: boolean;
  onClose: () => void;
}

export const QiblaCompassModal: React.FC<QiblaCompassModalProps> = ({
  location,
  isOpen,
  onClose,
}) => {
  const { heading, permissionState, requestPermission } = useCompassHeading(isOpen);
  const wasAlignedRef = useRef(false);

  // Calculate Qibla bearing from user coordinates to Kaaba (Makkah: 21.4225 N, 39.8262 E)
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const userLat = (location.lat * Math.PI) / 180;
  const userLng = (location.lng * Math.PI) / 180;

  const y = Math.sin(kaabaLng - userLng);
  const x =
    Math.cos(userLat) * Math.tan(kaabaLat) -
    Math.sin(userLat) * Math.cos(kaabaLng - userLng);

  let qiblaBearing = (Math.atan2(y, x) * 180) / Math.PI;
  qiblaBearing = (qiblaBearing + 360) % 360;
  const qiblaFormatted = Math.round(qiblaBearing);

  const needleRotation =
    heading !== null ? (qiblaBearing - heading + 360) % 360 : qiblaBearing;
  const aligned = heading !== null && isAlignedWithBearing(qiblaBearing, heading, 5);

  useEffect(() => {
    if (aligned && !wasAlignedRef.current && navigator.vibrate) {
      navigator.vibrate(50);
    }
    wasAlignedRef.current = aligned;
  }, [aligned]);

  if (!isOpen) return null;

  const needleColorClass = aligned ? 'text-emerald-500' : 'text-[#D6A84D]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-xl p-5 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#D6A84D]/15 pb-3">
          <div className="flex items-center gap-2 text-left">
            <Compass className="w-5 h-5 text-[#D6A84D]" />
            <div>
              <h3 className="font-serif-title font-bold text-base text-[var(--ink)]">
                Kıble Pusulası
              </h3>
              <p className="text-[10px] text-[var(--mist)]">
                {location.districtName}, {location.cityName} için derece açısı
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--mist)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pusula Görsel Alanı */}
        <div
          className={`relative w-52 h-52 mx-auto my-4 flex items-center justify-center rounded-full border-2 bg-[var(--paper)] shadow-inner transition-colors duration-300 ${
            aligned ? 'border-emerald-500/50' : 'border-[#D6A84D]/30'
          }`}
        >
          {/* Kuzey / Güney / Doğu / Batı İşaretleri */}
          <span className="absolute top-2 text-[10px] font-bold text-red-500">N (Kuzey)</span>
          <span className="absolute bottom-2 text-[10px] font-bold text-[var(--mist)]">S (Güney)</span>
          <span className="absolute right-2 text-[10px] font-bold text-[var(--mist)]">E (Doğu)</span>
          <span className="absolute left-2 text-[10px] font-bold text-[var(--mist)]">W (Batı)</span>

          {/* Dönen Kıble İbresi */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out"
            style={{ transform: `rotate(${needleRotation}deg)` }}
          >
            <div className="flex flex-col items-center justify-start h-full py-3">
              {/* Kâbe Simgesi / Altın İbre Başı */}
              <div
                className={`w-7 h-7 rounded-lg bg-[#2D2D2D] border-2 flex items-center justify-center shadow-md transition-colors duration-300 ${
                  aligned ? 'border-emerald-500' : 'border-[#D6A84D]'
                }`}
              >
                <span className={`text-[10px] font-bold ${needleColorClass}`}>KÂBE</span>
              </div>
              <div
                className={`w-0.5 h-16 transition-colors duration-300 ${
                  aligned ? 'bg-emerald-500' : 'bg-[#D6A84D]'
                }`}
              />
            </div>
          </div>

          {/* Merkez Nokta */}
          <div
            className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors duration-300 ${
              aligned ? 'bg-emerald-500' : 'bg-[#D6A84D]'
            }`}
          />
        </div>

        <div className="p-3 rounded-xl bg-[#D6A84D]/10 border border-[#D6A84D]/20 text-xs">
          <div className="text-[11px] text-[var(--mist)]">Kâbe-i Muazzama Açısı</div>
          <div className="font-numbers text-xl font-extrabold text-[#D6A84D] mt-0.5">
            {qiblaFormatted}°
          </div>
          <p className="text-[10px] text-[var(--mist)] mt-1">
            Telefonunuzu düz bir zemin üzerinde tutarak pusula ibresini Kâbe yönüne çeviriniz.
          </p>
        </div>

        {permissionState === 'idle' && (
          <button
            onClick={requestPermission}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D6A84D] hover:bg-[#c4983e] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Pusulayı Etkinleştir</span>
          </button>
        )}

        {permissionState === 'denied' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-red-500">
                İzin reddedildi. Tarayıcı ayarlarından hareket sensörü iznini açıp tekrar deneyin.
              </p>
              <button
                onClick={requestPermission}
                className="text-[11px] font-semibold text-[#D6A84D] hover:underline cursor-pointer mt-1"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {permissionState === 'unsupported' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-500">
              Cihazınız pusula sensörünü desteklemiyor, açı bilgisini yukarıdan kullanabilirsiniz.
            </p>
          </div>
        )}

        {aligned && (
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Kıble yönüne hizalandınız
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add src/components/QiblaCompassModal.tsx
git commit -m "feat: wire live device heading into Qibla compass modal"
```

---

### Task 4: Gerçek Cihazda Uçtan Uca Doğrulama

**Files:** Yok (kod değişikliği içermez, önceki task'ları doğrular)

- [ ] **Step 1: Tüm birim testlerini çalıştır**

Run: `node --import tsx --test "src/utils/compassHeading.test.ts"`
Expected: 11 test, hepsi PASS

- [ ] **Step 2: Uygulamayı başlat**

Run: `npm run dev` (bu özellik backend gerektirmez, `npm run dev` yeterlidir)

- [ ] **Step 3: Android + Chrome ile gerçek cihazdan bağlan**

Telefon USB ile bilgisayara bağlanır, Chrome'da `chrome://inspect` açılır, "Port forwarding" ile `3000` → `localhost:3000` yönlendirmesi kurulur (`DeviceOrientationEvent` güvenli bağlam — HTTPS veya `localhost` — gerektirir, salt ağ IP'si üzerinden çalışmaz). Telefonda Chrome'da `http://localhost:3000` açılır.

- [ ] **Step 4: Pusulayı etkinleştir ve doğrula**

Ana ekranda pusula ikonuna basıp Kıble Pusulası modalını aç, "Pusulayı Etkinleştir" butonuna bas.
Expected: Telefonu çevirince ibre gerçek zamanlı döner (statik kalmaz).

- [ ] **Step 5: Hizalama geri bildirimini doğrula**

Telefonu, ibrenin "KÂBE" etiketi ekranın üstüne (12 yönüne) gelecek şekilde çevir.
Expected: İbre/halka/merkez nokta yeşile döner, "Kıble yönüne hizalandınız" metni belirir, kısa bir titreşim hissedilir (yalnızca hizalanma anında, sürekli değil).

- [ ] **Step 6: Modal kapat/aç davranışını doğrula**

Modalı kapatıp tekrar aç.
Expected: "Pusulayı Etkinleştir" butonu tekrar görünmez — izin zaten verildiği için pusula direkt canlı çalışmaya devam eder (component hiç unmount olmadığı için izin durumu korunur).

- [ ] **Step 7: (Varsa) iOS Safari ile doğrula**

Bu ortamda (Windows) bir Mac yoksa bu adım atlanabilir; `webkitCompassHeading` dalı yalnızca kod incelemesiyle doğrulanmış sayılır — bunu kullanıcıya açıkça belirt.

Bu task bir commit içermez — önceki task'larda yapılan işi doğrular.
