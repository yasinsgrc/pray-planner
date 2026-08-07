import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeContextSlot } from './HomeContextSlot';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';
import { KERAHET_WINDOW_TITLE, KERAHET_WINDOW_DESCRIPTION } from '../data/strings';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');
const noop = () => {};

test('HomeContextSlot renders nothing when there is no kerahet and no nearby religious day', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, outsideKerahet);
  // Takvimin tükendiği bir an: hiçbir dinî gün 7 gün ufkunda değil.
  const farFuture = new Date('2028-06-01T12:00:00Z');

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, { schedule, now: farFuture, onOpenKerahetInfo: noop })
  );

  assert.equal(html, '');
});

test('HomeContextSlot renders the kerahet card with title, description and remaining time as a clickable button', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, { schedule, now: duringSunriseKerahet, onOpenKerahetInfo: noop })
  );

  assert.match(html, /<button/);
  assert.match(html, new RegExp(KERAHET_WINDOW_TITLE.gunes_sonrasi));
  assert.match(html, new RegExp(KERAHET_WINDOW_DESCRIPTION.gunes_sonrasi));
  assert.match(html, /dk kaldı/);
});

test('HomeContextSlot renders the upcoming religious day when outside kerahet', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, outsideKerahet);
  const fiveDaysBeforeMevlid = new Date('2026-08-19T12:00:00+03:00');

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, { schedule, now: fiveDaysBeforeMevlid, onOpenKerahetInfo: noop })
  );

  assert.match(html, /Mevlid Kandili/);
  assert.match(html, /5 gün sonra/);
});
