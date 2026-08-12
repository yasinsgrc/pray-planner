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
