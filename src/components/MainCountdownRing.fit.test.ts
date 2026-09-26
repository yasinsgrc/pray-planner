import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MainCountdownRing } from './MainCountdownRing';
import { ringInnerDiameter, contentFitsRing } from '../utils/ringFit';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

// Eski yöntem boş bir height:1rem prob'un yüksekliğini ölçüyordu; WebView
// textZoom rem kutuları büyütmediği için cihazda hiç tetiklenmedi. Yerine
// halkadan bağımsız, görünmez bir metin kopyası ölçülüyor.
const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');
const schedule = deriveLiveSchedule(day, new Date(day.sunrise.getTime() + 60 * 60 * 1000));
const html = renderToStaticMarkup(
  React.createElement(MainCountdownRing, {
    schedule,
    now: new Date(day.sunrise.getTime() + 60 * 60 * 1000),
    onOpenKerahetInfo: () => {},
    isPushHintVisible: false,
    onOpenPushSettings: () => {},
    onDismissPushHint: () => {},
  })
);

test('eski height:1rem prob elemani render edilmez', () => {
  assert.equal(html.includes('height:1rem'), false);
});

test('gorunmez olcum kopyasi tam bir kez render edilir ve gizlidir', () => {
  const copies = html.match(/<div[^>]*data-testid="ring-measure"[^>]*>/g) ?? [];
  assert.equal(copies.length, 1);
  assert.equal(/visibility:hidden/.test(copies[0]), true);
  assert.equal(/aria-hidden="true"/.test(copies[0]), true);
});

// İç çap = stroke'un iç kenarı: SunArcDial viewBox 288, stroke 6.
test('ringInnerDiameter stroke ic kenarini verir', () => {
  assert.equal(ringInnerDiameter(288), 276);
  assert.equal(ringInnerDiameter(150), 143.75);
});

// Merkezli w×h dikdörtgen, çapı d olan daireye ancak w²+h² <= d² ise sığar.
test('contentFitsRing kosegen <= cap kosulunu uygular', () => {
  assert.deepEqual(
    [contentFitsRing(3, 4, 5), contentFitsRing(3, 4, 4.99), contentFitsRing(0, 0, 0)],
    [true, false, true]
  );
});
