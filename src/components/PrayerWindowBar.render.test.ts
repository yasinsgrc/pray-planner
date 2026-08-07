import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrayerWindowBar } from './PrayerWindowBar';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { LocationItem } from '../types';

// Faz 22 Commit 2 — gerçek Çayırova koordinatları ve 2026-08-07 vakitleri
// (öğle 13:13, ikindi 17:05), prayerWindow.test.ts'teki ile aynı referans
// veri seti.
const CAYIROVA: LocationItem = {
  id: 'cayirova-test',
  cityName: 'Kocaeli',
  districtName: 'Çayırova',
  country: 'Türkiye',
  lat: 40.8,
  lng: 29.37,
  timeZone: 'Europe/Istanbul',
};

const REF_INSTANT = new Date('2026-08-07T10:00:00Z');
const day = calculateDaySchedule(CAYIROVA, REF_INSTANT, 'Diyanet');

test('PrayerWindowBar renders the active window range and a matching progressbar value', () => {
  const now = new Date(day.dhuhr.getTime() + 87 * 60 * 1000); // 14:40, %37.5
  const schedule = deriveLiveSchedule(day, now);

  const html = renderToStaticMarkup(React.createElement(PrayerWindowBar, { schedule, now }));

  assert.match(html, /13:13/);
  assert.match(html, /17:05/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="38"/); // round(0.375 * 100)
  assert.match(html, /Öğle vaktinin ilerleyişi/);
});

test('PrayerWindowBar shows the closing-soon message and gold fill under the 30-minute threshold', () => {
  const ikindiTime = day.rawPrayers.find((p) => p.name === 'ikindi')!.dateObj;
  const now = new Date(ikindiTime.getTime() - 25 * 60 * 1000); // ikindiye 25 dk kala
  const schedule = deriveLiveSchedule(day, now);

  const html = renderToStaticMarkup(React.createElement(PrayerWindowBar, { schedule, now }));

  assert.match(html, /Vaktin çıkmasına 25 dk/);
  assert.match(html, /var\(--gold\)/);
});

test('PrayerWindowBar shows the total duration message and accent fill when not closing soon', () => {
  const now = new Date(day.dhuhr.getTime() + 5 * 60 * 1000); // öğlenin başına yakın, 3sa47dk kaldı
  const schedule = deriveLiveSchedule(day, now);

  const html = renderToStaticMarkup(React.createElement(PrayerWindowBar, { schedule, now }));

  assert.match(html, /sürüyor/);
  assert.match(html, /var\(--accent\)/);
});
