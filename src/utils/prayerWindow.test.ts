import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaySchedule, deriveLiveSchedule } from './prayerCalculator';
import { computePrayerWindow } from './prayerWindow';
import { LocationItem } from '../types';

// Faz 22 Commit 2 — gerçek Çayırova (40.80, 29.37) koordinatları,
// 2026-08-07 için Diyanet yöntemiyle hesaplanmış gerçek vakitler:
// imsak 04:17, güneş 05:58, öğle 13:13, ikindi 17:05, akşam 20:18,
// yatsı 21:52, ertesi gün imsak 04:18 (Europe/Istanbul, hesaplayıcıdan
// doğrudan doğrulandı — spekülatif değil).
const CAYIROVA: LocationItem = {
  id: 'cayirova-test',
  cityName: 'Kocaeli',
  districtName: 'Çayırova',
  country: 'Türkiye',
  lat: 40.8,
  lng: 29.37,
  timeZone: 'Europe/Istanbul',
};

const REF_INSTANT = new Date('2026-08-07T10:00:00Z'); // gün seçimi için herhangi bir an, 07 Ağustos'a denk düşüyor
const day = calculateDaySchedule(CAYIROVA, REF_INSTANT, 'Diyanet');

test('normal gün içi pencere: öğle 13:13 -> ikindi 17:05, 14:40’ta doğru elapsed/oran', () => {
  const now = new Date(day.dhuhr.getTime() + 87 * 60 * 1000); // 13:13 + 1s27dk = 14:40
  const schedule = deriveLiveSchedule(day, now);

  assert.equal(schedule.activePrayer.name, 'ogle');

  const window = computePrayerWindow(schedule, now);

  assert.equal(window.startMs, day.dhuhr.getTime());
  assert.equal(window.totalSeconds, 13920);
  assert.equal(window.elapsedSeconds, 5220);
  assert.ok(Math.abs(window.elapsedRatio - 0.375) < 1e-9);
});

test('gece yarısını aşan pencere: yatsı -> ertesi gün imsak, negatif veya 24 saatten büyük olmamalı', () => {
  const now = new Date(day.tomorrowFajr.getTime() - 60 * 60 * 1000); // yatsıdayken, imsağa 1 saat kala
  const schedule = deriveLiveSchedule(day, now);

  assert.equal(schedule.activePrayer.name, 'yatsi');

  const window = computePrayerWindow(schedule, now);

  assert.ok(window.endMs > window.startMs);
  assert.ok(window.totalSeconds > 0);
  assert.ok(window.totalSeconds > 6 * 3600 && window.totalSeconds < 9 * 3600);
});

test('pencere başlangıcında elapsedRatio 0', () => {
  const tickInsideWindow = new Date(day.dhuhr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, tickInsideWindow);

  const window = computePrayerWindow(schedule, day.dhuhr);

  assert.equal(window.elapsedRatio, 0);
});

test('pencere bitişinde elapsedRatio 1\'i aşmaz', () => {
  const tickInsideWindow = new Date(day.dhuhr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, tickInsideWindow);
  const ikindiStart = schedule.prayers.find((p) => p.name === 'ikindi')!.dateObj;

  const atEnd = computePrayerWindow(schedule, ikindiStart);
  const pastEnd = computePrayerWindow(schedule, new Date(ikindiStart.getTime() + 60 * 60 * 1000));

  assert.equal(atEnd.elapsedRatio, 1);
  assert.equal(pastEnd.elapsedRatio, 1);
});

test('sınır dışı savunma: now pencereden önceyse elapsedRatio 0\'a kırpılır, NaN/negatif olmaz', () => {
  const tickInsideWindow = new Date(day.dhuhr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, tickInsideWindow);

  const beforeStart = computePrayerWindow(schedule, new Date(day.dhuhr.getTime() - 60 * 60 * 1000));

  assert.equal(beforeStart.elapsedRatio, 0);
  assert.equal(beforeStart.elapsedSeconds, 0);
  assert.ok(!Number.isNaN(beforeStart.elapsedRatio));
});

test('imsak -> güneş, en kısa pencere, ~101 dakika', () => {
  const now = new Date(day.fajr.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, now);

  assert.equal(schedule.activePrayer.name, 'imsak');

  const window = computePrayerWindow(schedule, now);

  assert.equal(window.totalSeconds, 101 * 60);
});
