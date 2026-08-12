import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RamadanModeCard } from './RamadanModeCard';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

// Faz 25 Commit 1 — ana ekranda başlık/tarih satırının altında Ramazan
// dışında da yer kaplayan bir kart kalmamalı. RamadanModeCard zaten
// `if (!ramadan) return null` ile hiçbir sarmalayıcı olmadan boş string
// döner (design-refresh-v3 Faz 19 Ekleme 6) — bu test o davranışı
// regresyona karşı sabitler: DOM'da hiçbir iz kalmamalı, min-height/
// placeholder yok.
test('RamadanModeCard renders nothing (no wrapper element) outside Ramadan', () => {
  const outsideRamadan = new Date('2026-08-01T13:30:00');
  const day = calculateDaySchedule(DEFAULT_LOCATION, outsideRamadan, 'Diyanet');
  const schedule = deriveLiveSchedule(day, outsideRamadan);

  const html = renderToStaticMarkup(React.createElement(RamadanModeCard, { schedule, now: outsideRamadan }));

  assert.equal(html, '');
});

test('RamadanModeCard renders the countdown card during Ramadan', () => {
  const duringRamadan = new Date('2026-03-01T13:30:00');
  const day = calculateDaySchedule(DEFAULT_LOCATION, duringRamadan, 'Diyanet');
  const schedule = deriveLiveSchedule(day, duringRamadan);

  const html = renderToStaticMarkup(React.createElement(RamadanModeCard, { schedule, now: duringRamadan }));

  assert.match(html, /Ramazan/);
});
