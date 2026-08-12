import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunArcDial } from './SunArcDial';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

// Faz 25 Commit 3 — kerahet yayları çembere geri döndü (7b9e884'te kısaca
// kaldırılmıştı), bu kez 5px kalınlıkta ve çember izinin dışında, 3 ayrı
// kısa yay olarak (İşrâk/İstivâ/Gurûb saatlerce arayla olduğu için tek
// kesiksiz yay olamazlar — bu, "kesik" görünümün kaçınılmaz sonucu, bir
// dasharray hatası değil).
test('SunArcDial renders exactly 3 kerahet arcs, each tagged with its type and 5px stroke', () => {
  const now = day.dhuhr;
  const schedule = deriveLiveSchedule(day, now);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule, now }));

  const matches = [...html.matchAll(/data-kerahet-type="([^"]+)"/g)];
  assert.equal(matches.length, 3);
  assert.match(html, /data-kerahet-type="[^"]+"[^>]*stroke-width="5"/);
});

test('SunArcDial marks the active kerahet arc urgent (pulse class) during its window', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule, now: duringSunriseKerahet })
  );

  assert.match(html, /animate-kerahet-pulse/);
});
