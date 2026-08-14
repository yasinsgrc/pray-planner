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

// Halka üzerindeki "şu an" işaretçisi gece boyunca hilal olarak çiziliyordu,
// ama eski uygulama sabit koordinatlarda tanımlı bir <mask> kullanıyordu
// (işaretçi hareket ederken kesim rastgele yerden geçip yamuk bir kama
// oluşturuyordu). Hilal artık kendi lokal koordinatlarında sabit bir <path>
// olarak çizilip <g transform="translate(x,y)"> ile konumlandırılmalı —
// böylece şekil konumdan bağımsız olur.
test('SunArcDial no longer uses an SVG mask for the crescent marker', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /<mask/);
  assert.doesNotMatch(html, /dial-crescent-mask/);
});

test('SunArcDial renders a fixed crescent path during the night', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.match(html, /data-crescent-shape/);
});

test('SunArcDial crescent path "d" is identical across two different moments, only the transform differs', () => {
  const firstMoment = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const secondMoment = new Date(day.fajr.getTime() + 45 * 60 * 1000);

  const htmlFirst = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule: deriveLiveSchedule(day, firstMoment) })
  );
  const htmlSecond = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule: deriveLiveSchedule(day, secondMoment) })
  );

  const extractCrescent = (html: string) => {
    const match = html.match(/<g transform="translate\(([^,]+),([^)]+)\)">\s*<path[^>]*data-crescent-shape[^>]*d="([^"]+)"/);
    assert.ok(match, 'crescent <g><path data-crescent-shape d="..."/></g> not found');
    return { x: match![1], y: match![2], d: match![3] };
  };

  const first = extractCrescent(htmlFirst);
  const second = extractCrescent(htmlSecond);

  assert.equal(first.d, second.d, 'crescent shape "d" must be identical regardless of position');
  assert.notEqual(`${first.x},${first.y}`, `${second.x},${second.y}`, 'translate must differ between moments');
});
