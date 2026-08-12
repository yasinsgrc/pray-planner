import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveHomeContextSlot } from './homeContextSlot';
import { calculateDaySchedule, deriveLiveSchedule, DayPrayerSchedule } from './prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

// Faz 22 Commit 3 — ana ekranda ne kerahet ne dinî gün göstergesi vardı.
// Faz 24 Commit 5 — fallback zinciri genişletildi: (1) aktif VEYA 15 dk
// içinde başlayacak kerahet, (2) 7 gün içinde dinî gün, (3) yarınki imsak
// farkı, (4) hiçbiri yoksa null (bildirim ipucu, saf bir schedule
// fonksiyonunun bilemeyeceği React state'ine bağlı olduğu için burada değil,
// çağıran component'te ele alınır).
//
// `schedule` (kerahet durumu) ve `now` (dinî gün geri sayımı) bilerek ayrı
// parametreler — prayerWindow.ts'teki aynı ayrımın devamı: schedule'ın
// hangi tick'te türetildiği ile fonksiyonun sorguladığı an birbirinden
// bağımsız olabilir (ör. "kerahet penceresinin son saniyesi" testi).
const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

function scheduleAt(now: Date): DayPrayerSchedule {
  return deriveLiveSchedule(day, now);
}

// Gerçek RELIGIOUS_DAYS verisinden: Mevlid Kandili, 2026-08-24.
const MEVLID_KANDILI = new Date('2026-08-24T12:00:00+03:00');
function daysBefore(target: Date, days: number): Date {
  return new Date(target.getTime() - days * 24 * 60 * 60 * 1000);
}

test('kerahet penceresi içindeyken, yakında bir dini gün olsa bile öncelik kerahettedir', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = scheduleAt(duringSunriseKerahet);
  assert.ok(schedule.currentKerahet);

  const now = daysBefore(MEVLID_KANDILI, 3);
  const result = resolveHomeContextSlot(schedule, now);

  assert.ok(result);
  assert.equal(result?.kind, 'kerahet');
  if (result?.kind === 'kerahet') {
    assert.equal(result.isUpcoming, false);
  }
});

test('kerahet dışında, 5 gün sonra bir dini gün varsa onu gösterir', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = scheduleAt(outsideKerahet);
  assert.equal(schedule.currentKerahet, null);

  const now = daysBefore(MEVLID_KANDILI, 5);
  const result = resolveHomeContextSlot(schedule, now);

  assert.ok(result);
  assert.equal(result?.kind, 'religiousDay');
  if (result?.kind === 'religiousDay') {
    assert.equal(result.daysUntil, 5);
    assert.equal(result.name, 'Mevlid Kandili');
  }
});

test('kerahet ve yakın dini gün yokken, 8 gün sonraki dini gün 7 günlük eşiği aşınca null döner', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = scheduleAt(outsideKerahet);

  const now = daysBefore(MEVLID_KANDILI, 8);
  const result = resolveHomeContextSlot(schedule, now);

  assert.equal(result, null);
});

test('kerahet, dini gün ve takvim de tükenmişse null döner (Faz 25 Commit 2 — yarınki imsak farkı kaldırıldı)', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = scheduleAt(outsideKerahet);

  const now = new Date('2028-01-01T12:00:00+03:00'); // RELIGIOUS_DAYS son tarihi 2027-12-24
  const result = resolveHomeContextSlot(schedule, now);

  assert.equal(result, null);
});

test('dini gün bugünse daysUntil 0 döner', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = scheduleAt(outsideKerahet);

  const result = resolveHomeContextSlot(schedule, MEVLID_KANDILI);

  assert.ok(result);
  assert.equal(result?.kind, 'religiousDay');
  if (result?.kind === 'religiousDay') {
    assert.equal(result.daysUntil, 0);
  }
});

test('kerahet penceresinin son saniyesinde hâlâ kerahet döner, remainingSeconds negatif olmaz', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = scheduleAt(duringSunriseKerahet);
  const endTime = schedule.currentKerahet!.endTime;

  const result = resolveHomeContextSlot(schedule, endTime);

  assert.ok(result);
  assert.equal(result?.kind, 'kerahet');
  if (result?.kind === 'kerahet') {
    assert.ok(result.remainingSeconds >= 0);
  }
});

test('dini gün mesafesi schedule\'ın kendi zaman diliminde hesaplanır, cihaz dilimi değil', () => {
  // Asia/Tokyo (UTC+9) ile Europe/Istanbul (UTC+3) arasındaki 6 saatlik fark
  // gün sınırını değiştirebilir — religiousDaysSchedule.test.ts'teki aynı
  // senaryo. resolveHomeContextSlot yalnızca currentKerahet ve
  // resolvedTimeZone'a bakar, bu yüzden minimal bir schedule yeterli.
  const fakeSchedule = { currentKerahet: null, resolvedTimeZone: 'Asia/Tokyo' } as DayPrayerSchedule;

  // 2026-08-23T23:30:00Z hâlâ 2026-08-23 UTC'de, ama Tokyo'da (UTC+9)
  // zaten 2026-08-24 08:30 — Mevlid Kandili artık "bugün".
  const now = new Date('2026-08-23T23:30:00Z');
  const result = resolveHomeContextSlot(fakeSchedule, now);

  assert.ok(result);
  assert.equal(result?.kind, 'religiousDay');
  if (result?.kind === 'religiousDay') {
    assert.equal(result.daysUntil, 0);
  }
});

// Faz 24 Commit 5 — kerahet BAŞLAMADAN önce de uyarmalı, yalnızca aktifken değil.
const referenceKerahetTimes = scheduleAt(day.dhuhr).kerahetTimes;

test('bir kerahet penceresi 10 dakika içinde başlayacaksa "yaklaşan kerahet" olarak döner', () => {
  const firstKerahet = referenceKerahetTimes[0];
  const tenMinBefore = new Date(firstKerahet.startTime.getTime() - 10 * 60 * 1000);
  const schedule = scheduleAt(tenMinBefore);
  assert.equal(schedule.currentKerahet, null);

  // `now` bilerek `tenMinBefore` ile aynı an — "yaklaşan kerahet" testi,
  // schedule'ın türetildiği tick ile sorgulanan anın uyumlu olmasını
  // gerektirir (dosyanın tepesindeki genel ayrımın aksine, kasıtlı burada).
  const result = resolveHomeContextSlot(schedule, tenMinBefore);

  assert.ok(result);
  assert.equal(result?.kind, 'kerahet');
  if (result?.kind === 'kerahet') {
    assert.equal(result.isUpcoming, true);
    assert.equal(result.kerahetType, firstKerahet.type);
  }
});

test('bir kerahet penceresi 20 dakika sonra başlayacaksa (15 dk penceresinin dışında) tetiklenmez', () => {
  const firstKerahet = referenceKerahetTimes[0];
  const twentyMinBefore = new Date(firstKerahet.startTime.getTime() - 20 * 60 * 1000);
  const schedule = scheduleAt(twentyMinBefore);

  const result = resolveHomeContextSlot(schedule, twentyMinBefore);

  assert.notEqual(result?.kind, 'kerahet');
});
