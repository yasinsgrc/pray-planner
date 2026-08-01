# Gerçek Ezan Sesi + İlahi Sesleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sentetik ezan tonunu gerçek bir ezan kaydıyla değiştirmek, 3 seçilebilir sentezlenmiş "ilahi" sesi eklemek, uygulama açıkken vakit girince otomatik ses çalma özelliği eklemek.

**Architecture:** Gerçek bir CC BY-SA 4.0 lisanslı ezan dosyası `public/sounds/`'a eklenir; `SoundMode` tipi 3 yeni değerle genişler; tüm ses seçimi/çalma mantığı `src/utils/audio.ts`'teki merkezi `playSoundForMode()` üzerinden geçer.

**Tech Stack:** Tarayıcı `Audio`/Web Audio API (ek bağımlılık yok).

## Global Constraints

- Ezan sesi tam olarak şu URL'den indirilir: `https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3` (CC BY-SA 4.0, uploader: Atcovi) — beklenen dosya boyutu **1448294 bayt**, bu doğrulanmalı.
- Ayarlar ekranında bu kaynağa atıf notu bulunmalı.
- `SoundMode` tam olarak: `'ezan' | 'tini' | 'ilahi1' | 'ilahi2' | 'ilahi3' | 'sessiz'`.
- Tüm kullanıcıya görünen metinler Türkçe.
- Yeni npm bağımlılığı eklenmez.

---

### Task 1: Ezan Ses Dosyası + Tip Genişletme + audio.ts

**Files:**
- Create: `public/sounds/ezan.mp3` (binary, indirilecek)
- Modify: `src/types.ts`
- Modify: `src/utils/audio.ts`

**Interfaces:**
- Produces: `SoundMode` tipi genişler (`'ezan' | 'tini' | 'ilahi1' | 'ilahi2' | 'ilahi3' | 'sessiz'`); `playEzanAudio(): void`, `playIlahiSample(variant: 1 | 2 | 3): void`, `playSoundForMode(mode: SoundMode): void` — Task 2/3 bunları kullanacak. Mevcut `playSoftChime()` değişmeden kalır. Eski `playEzanSample()` kaldırılır (artık kullanılmıyor).

- [ ] **Step 1: Ezan dosyasını indir**

```bash
mkdir -p public/sounds
curl -s -o public/sounds/ezan.mp3 "https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3"
```

Doğrula:
```bash
ls -la public/sounds/ezan.mp3
```
Expected: Dosya boyutu **1448294** bayt olmalı (Global Constraints'te belirtilen boyutla eşleşmeli). Eşleşmiyorsa indirme başarısız olmuş demektir, durup rapor et.

- [ ] **Step 2: src/types.ts'teki SoundMode satırını güncelle**

```ts
export type SoundMode = 'ezan' | 'tini' | 'ilahi1' | 'ilahi2' | 'ilahi3' | 'sessiz';
```

- [ ] **Step 3: src/utils/audio.ts'i güncelle**

Dosyanın en üstüne, `/** Web Audio API based... */` yorumundan hemen sonra, `export function playSoftChime()`'dan önce ekle:

```ts
import type { SoundMode } from '../types';

const EZAN_AUDIO_SRC = '/sounds/ezan.mp3';

const ILAHI_NOTE_SEQUENCES: Record<1 | 2 | 3, number[]> = {
  1: [392.0, 440.0, 493.88, 523.25, 587.33], // G4 A4 B4 C5 D5 - yükselen sakin dizi
  2: [523.25, 493.88, 440.0, 392.0, 349.23], // C5 B4 A4 G4 F4 - alçalan sakin dizi
  3: [440.0, 493.88, 587.33, 493.88, 440.0], // A4 B4 D5 B4 A4 - dalgalı sakin dizi
};
```

Dosyanın sonunda, `export function playEzanSample() { ... }` fonksiyonunun **tamamını** (tüm gövdesiyle) şununla değiştir:

```ts
/**
 * Plays the real Wikimedia Commons ezan recording (CC BY-SA 4.0, see
 * attribution note in SpiritualSettings). Falls back to silence on
 * playback failure (e.g. browser autoplay restrictions) rather than
 * throwing.
 */
export function playEzanAudio() {
  try {
    const audio = new Audio(EZAN_AUDIO_SRC);
    audio.play().catch((err) => {
      console.log('Ezan sesi çalınamadı:', err);
    });
  } catch (err) {
    console.log('Ezan sesi çalınamadı:', err);
  }
}

export function playIlahiSample(variant: 1 | 2 | 3) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const notes = ILAHI_NOTE_SEQUENCES[variant];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const startTime = ctx.currentTime + idx * 0.35;
      const duration = 1.2;

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (err) {
    console.log('İlahi sesi çalınamadı:', err);
  }
}

/**
 * Central dispatcher used by both the settings preview buttons and the
 * foreground auto-play effect in App.tsx, so the SoundMode -> player
 * mapping lives in exactly one place.
 */
export function playSoundForMode(mode: SoundMode) {
  switch (mode) {
    case 'ezan':
      playEzanAudio();
      break;
    case 'tini':
      playSoftChime();
      break;
    case 'ilahi1':
      playIlahiSample(1);
      break;
    case 'ilahi2':
      playIlahiSample(2);
      break;
    case 'ilahi3':
      playIlahiSample(3);
      break;
    case 'sessiz':
    default:
      break;
  }
}
```

- [ ] **Step 4: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit` (NOT `npm run lint` — bu makinede bir shell hook çıktısını bozuyor)
Expected: `TypeScript: No errors found`

- [ ] **Step 5: Dosyanın Vite tarafından servis edildiğini doğrula**

Run: `npm run dev` (arka planda başlat), sonra başka bir terminalde:
```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" http://localhost:3000/sounds/ezan.mp3
```
Expected: `200 1448294`

Sunucuyu durdur.

- [ ] **Step 6: Commit**

```bash
git add public/sounds/ezan.mp3 src/types.ts src/utils/audio.ts
git commit -m "feat: replace synthesized ezan tone with real Wikimedia recording, add ilahi sound variants"
```

---

### Task 2: Ayarlar Ekranı — Ses Seçici ve Atıf Notu

**Files:**
- Modify: `src/components/SpiritualSettings.tsx`

**Interfaces:**
- Consumes: `playSoundForMode` (Task 1, `../utils/audio`)

- [ ] **Step 1: Import bloğunu güncelle**

```tsx
import {
  Bell,
  Clock,
  Moon,
  ShieldCheck,
  Check,
  Play,
  Settings2,
  CalendarDays,
} from 'lucide-react';
import { AppSettings, PrayerName, SoundMode } from '../types';
import { playSoundForMode } from '../utils/audio';
```

(Not: `Volume2`, `VolumeX` importları kaldırıldı — kullanıldıkları 3'lü buton grubu bu task'ta select'e dönüşüyor, başka yerde kullanılmıyorlar.)

- [ ] **Step 2: Vakit başına 3'lü buton grubunu select ile değiştir**

**Not:** Task 1'in implementer'ı, sildiği `playEzanSample()`'a olan tek referansı (bu dosyada) zaten `playEzanAudio()` ile değiştirerek geçici bir derleme hatasını önledi — yani şu an dosyada `playEzanSample()` değil `playEzanAudio()` yazıyor. Aşağıdaki anchor buna göre güncellenmiştir.

Aşağıdaki bloğu (mevcut "Ezan"/"Tını"/"Sessiz" üç butonlu `<div>`) bul:

```tsx
                <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-xl border border-[#D6A84D]/15">
                  <button
                    onClick={() => {
                      onUpdateNotification(prayer, 'ezan');
                      playEzanAudio();
                    }}
```

...ve o `<div>`'in kapanışına kadar olan tüm bloğu şununla değiştir:

```tsx
                <select
                  value={currentMode}
                  onChange={(e) => {
                    const mode = e.target.value as SoundMode;
                    onUpdateNotification(prayer, mode);
                    playSoundForMode(mode);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper)] border border-[#D6A84D]/15 text-[var(--ink)] focus:outline-none focus:border-[#D6A84D] cursor-pointer"
                >
                  <option value="ezan">Ezan</option>
                  <option value="ilahi1">İlahi 1</option>
                  <option value="ilahi2">İlahi 2</option>
                  <option value="ilahi3">İlahi 3</option>
                  <option value="tini">Tını</option>
                  <option value="sessiz">Sessiz</option>
                </select>
```

- [ ] **Step 3: Atıf notu ekle**

Vakit listesini oluşturan `{(Object.keys(PRAYER_LABELS) as PrayerName[]).map(...)}` bloğunun kapanışı (`})}`) ile "1. Vakit Bazlı Bildirim Seçimi" kartının kapanış `</div>`'i arasına ekle:

```tsx

        <p className="text-[10px] text-[var(--mist)] pt-1">
          Ezan sesi:{' '}
          <a
            href="https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#D6A84D]"
          >
            Wikimedia Commons, Atcovi
          </a>{' '}
          (CC BY-SA 4.0)
        </p>
```

- [ ] **Step 4: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 5: Commit**

```bash
git add src/components/SpiritualSettings.tsx
git commit -m "feat: replace prayer sound buttons with 6-option select, add ezan attribution"
```

---

### Task 3: Otomatik Çalma (App.tsx) + Vakit Listesi Göstergesi

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DailyFlowList.tsx`

**Interfaces:**
- Consumes: `playSoundForMode` (Task 1, `./utils/audio`)

- [ ] **Step 1: src/App.tsx'i güncelle**

`import React, { useState, useEffect, useMemo } from 'react';` satırını şununla değiştir:

```tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
```

`import { calculatePrayerTimes } from './utils/prayerCalculator';` satırının hemen altına ekle:

```tsx
import { playSoundForMode } from './utils/audio';
```

`// Compute Hijri Date` yorumunun hemen üstüne ekle:

```tsx
  // Uygulama açıkken vakit değişince seçili sesi bir kez otomatik çal
  const previousActivePrayerRef = useRef<PrayerName | null>(null);
  useEffect(() => {
    const activeName = schedule.activePrayer.name;
    if (
      previousActivePrayerRef.current !== null &&
      previousActivePrayerRef.current !== activeName
    ) {
      const mode = settings.notifications[activeName];
      if (mode !== 'sessiz') {
        playSoundForMode(mode);
      }
    }
    previousActivePrayerRef.current = activeName;
  }, [schedule.activePrayer.name, settings.notifications]);

```

- [ ] **Step 2: src/components/DailyFlowList.tsx'e ilahi göstergesi ekle**

`{soundMode === 'tini' && ( ... )}` bloğunun hemen altına, `{soundMode === 'sessiz' && ( ... )}` bloğundan önce ekle:

```tsx
                      {(soundMode === 'ilahi1' || soundMode === 'ilahi2' || soundMode === 'ilahi3') && (
                        <span className="flex items-center gap-0.5 text-[#E8C68C]">
                          <Volume2 className="w-2.5 h-2.5" /> İlahi {soundMode.slice(-1)}
                        </span>
                      )}
```

- [ ] **Step 3: Tip kontrolünü doğrula**

Run: `npx tsc --noEmit`
Expected: `TypeScript: No errors found`

- [ ] **Step 4: Manuel doğrulama**

Run: `npm run dev`, tarayıcıda uygulamayı aç, Ayarlar sekmesinde bir vakit için "Ezan" seç.
Expected: Gerçek ezan sesi (sentetik ton değil) çalar. "İlahi 1/2/3" seçildiğinde birbirinden farklı sakin melodiler duyulur.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/DailyFlowList.tsx
git commit -m "feat: auto-play selected sound on prayer transition while app is open"
```
