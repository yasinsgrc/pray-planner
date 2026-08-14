import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunArcDial } from './SunArcDial';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

// Kerahet yayları geri sayım halkasından kaldırıldı — kerahet bilgisi
// halkanın altındaki KERAHET metin bölümünde (KerahetStrip) zaten veriliyor;
// halka üzerindeki kalın yaylar vakit ilerleme yayıyla karışan görsel gürültü
// yaratıyordu. Bu test halkanın artık kerahet'e özgü hiçbir eleman
// render etmediğini doğrular.
test('SunArcDial no longer renders kerahet arc elements', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /data-kerahet-type/);
  assert.doesNotMatch(html, /animate-kerahet-pulse/);
});

// Sıradaki vakit dot'u (r=4.5, beyaz stroke) ile "şu an" işaretçisi (r=9,
// beyaz stroke) vakit yaklaşınca üst üste binip tek bir blob gibi
// görünüyordu. Vakte çok az kala sıradaki vakit dot'u gizlenmeli.
// Öğle→ikindi aralığı (~234 dk) hem 11 dk hem 2 saat öncesini aynı
// "sıradaki vakit = ikindi" penceresinde test edebilecek kadar geniş —
// imsak→güneş aralığı (~105 dk) bunun için yeterince geniş değil.
const ikindiTime = day.rawPrayers.find((p) => p.name === 'ikindi')!.dateObj;

test('SunArcDial vakte 11 dakika kala sıradaki vakit dot\'unu gizler', () => {
  const elevenMinutesBefore = new Date(ikindiTime.getTime() - 11 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, elevenMinutesBefore);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /data-next-prayer-dot="true"/);
});

test('SunArcDial vakte 2 saat kala sıradaki vakit dot\'unu gösterir', () => {
  const twoHoursBefore = new Date(ikindiTime.getTime() - 2 * 60 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, twoHoursBefore);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.match(html, /data-next-prayer-dot="true"/);
});
