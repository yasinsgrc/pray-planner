# Hicri Tarih Doğruluğu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ev yapımı hicri tarih hesaplamasını `hijri-converter` kütüphanesiyle değiştirmek ve kullanıcıya doğruluk sınırını bildiren bir bilgi kartı eklemek.

**Architecture:** `hijri-converter` (Ümmü'l-Kura resmi veri tablosu, bağımlılıksız) `src/utils/hijri.ts` içine sarmalanır; aynı `getHijriDate()` imzası korunduğu için hiçbir çağıran kod değişmez.

**Tech Stack:** `hijri-converter@^1.1.1` (yeni npm bağımlılığı, `deps: none`), `node:test`.

## Global Constraints

- `getHijriDate(date?: Date): HijriDateInfo` imzası ve `HijriDateInfo` şekli değişmez.
- `hijri-converter`'ın TypeScript tip tanımı yok — `src/utils/hijri-converter.d.ts` ambient module declaration'ı gereklidir.
- Bilgi kartı, Ayarlar sekmesindeki "Hesaplama Yöntemi" kartının hemen altına eklenir.
- Tüm kullanıcıya görünen metinler Türkçe.

---

### Task 1: hijri-converter'a Geçiş

**Files:**
- Create: `src/utils/hijri-converter.d.ts`
- Modify: `src/utils/hijri.ts` (tüm dosya değiştirilir)
- Create: `src/utils/hijri.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getHijriDate(date?: Date): HijriDateInfo` (imza aynı kalır, sadece iç implementasyon değişir) — hiçbir başka dosya bu task'tan bir şey import etmez, mevcut çağıranlar (`App.tsx`, `Header.tsx`) hiç değişmez.

- [ ] **Step 1: Bağımlılığı kur**

`package.json`'ın `dependencies` bölümüne `"hijri-converter": "^1.1.1"` ekle (alfabetik sırada `express` ile `lucide-react` arasına).

Run: `npm install`
Expected: Hatasız kurulum, `deps: none` olduğu için başka paket eklenmez.

- [ ] **Step 2: Ambient module declaration'ı oluştur — src/utils/hijri-converter.d.ts**

```ts
declare module 'hijri-converter' {
  export function toHijri(gy: number, gm: number, gd: number): { hy: number; hm: number; hd: number };
  export function toGregorian(hy: number, hm: number, hd: number): { gy: number; gm: number; gd: number };
}
```

- [ ] **Step 3: Başarısız testi yaz — src/utils/hijri.test.ts**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHijriDate } from './hijri';

test('converts a known Gregorian date to the correct Hijri new year', () => {
  const result = getHijriDate(new Date(2025, 5, 26));
  assert.equal(result.day, 1);
  assert.equal(result.monthName, 'Muharrem');
  assert.equal(result.year, 1447);
  assert.equal(result.formatted, '1 Muharrem 1447');
});

test('converts another known date correctly', () => {
  const result = getHijriDate(new Date(2026, 7, 1));
  assert.equal(result.day, 18);
  assert.equal(result.monthName, 'Safer');
  assert.equal(result.year, 1448);
});
```

- [ ] **Step 4: Testin başarısız olduğunu doğrula**

Run: `node --import tsx --test "src/utils/hijri.test.ts"`
Expected: FAIL — eski algoritma farklı değerler döndüreceği için assertion hataları (`getHijriDate` fonksiyonu zaten var ama farklı hesaplama yapıyor).

- [ ] **Step 5: src/utils/hijri.ts'nin tamamını şu içerikle değiştir**

```ts
import { toHijri } from 'hijri-converter';
import { HijriDateInfo } from '../types';

const HIJRI_MONTHS = [
  'Muharrem',
  'Safer',
  'Rebiülevvel',
  'Rebiülahir',
  'Cemaziyelevvel',
  'Cemaziyelahir',
  'Recep',
  'Şaban',
  'Ramazan',
  'Şevval',
  'Zilkade',
  'Zilhicce',
];

/**
 * Ümmü'l-Kura resmi takvim verisine (hijri-converter) dayanır. Diyanet'in
 * resmi açıklamasından ±1 gün farklı olabilir; kullanıcıya bu bilgi
 * SpiritualSettings ekranındaki bilgi kartında ayrıca gösterilir.
 */
export function getHijriDate(date: Date = new Date()): HijriDateInfo {
  const { hy, hm, hd } = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const monthName = HIJRI_MONTHS[hm - 1] || 'Muharrem';

  return {
    day: hd,
    monthName,
    year: hy,
    formatted: `${hd} ${monthName} ${hy}`,
  };
}
```

- [ ] **Step 6: Testlerin geçtiğini doğrula**

Run: `node --import tsx --test "src/utils/hijri.test.ts"`
Expected: 2 test, hepsi PASS

- [ ] **Step 7: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit` (NOT `npm run lint`)
Expected: `TypeScript: No errors found`

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/utils/hijri.ts src/utils/hijri.test.ts src/utils/hijri-converter.d.ts
git commit -m "feat: switch Hijri date calculation to hijri-converter (Umm al-Qura data)"
```

---

### Task 2: Ayarlar Ekranına Bilgi Kartı Ekle

**Files:**
- Modify: `src/components/SpiritualSettings.tsx`

**Interfaces:** Yok — bu task sadece statik JSX ekler, hiçbir prop/state değişmez.

- [ ] **Step 1: lucide-react import listesine CalendarDays ekle**

Dosyanın en üstündeki import bloğunda:

```tsx
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
  CalendarDays,
} from 'lucide-react';
```

- [ ] **Step 2: "Hesaplama Yöntemi" kartının hemen altına yeni kartı ekle**

`</select>` kapanışının ardından gelen `</div>` (Hesaplama Yöntemi kartının kapanışı) ile `{/* 5. İnternetsiz Çevrimdışı Bellek (30 Günlük Local DB) */}` yorumu arasına ekle:

```tsx
      {/* 4.5 Hicri Tarih Hakkında */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#D6A84D]" />
          <div className="text-sm font-bold text-[var(--ink)] font-serif-title">
            Hicri Tarih Hakkında
          </div>
        </div>
        <p className="text-[11px] text-[var(--mist)] leading-relaxed">
          Uygulamadaki hicri tarih, Ümmü'l-Kura takvim verisine dayanan astronomik bir hesaplamadır. Diyanet İşleri Başkanlığı'nın resmi açıklamasından bazı aylarda ±1 gün farklı olabilir; kesin tarih için resmi Diyanet duyurularını esas alınız.
        </p>
      </div>

```

- [ ] **Step 3: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 4: Manuel doğrulama**

Run: `npm run dev`, tarayıcıda uygulamayı aç, Ayarlar sekmesine git.
Expected: "Hesaplama Yöntemi" kartının altında yeni "Hicri Tarih Hakkında" kartı görünür; üst bardaki (Header) hicri tarih güncel/doğru görünür.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpiritualSettings.tsx
git commit -m "feat: add Hijri date accuracy disclaimer to settings screen"
```
