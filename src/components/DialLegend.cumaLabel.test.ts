import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DialLegend } from './DialLegend';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

test('DialLegend shows "Cuma" instead of "Öğle" on a Friday', () => {
  // 2026-08-14 is a Friday for DEFAULT_LOCATION's zone (Europe/Istanbul).
  const anchor = new Date('2026-08-14T09:00:00+03:00');
  const day = calculateDaySchedule(DEFAULT_LOCATION, anchor, 'Diyanet');
  const schedule = deriveLiveSchedule(day, anchor);

  const html = renderToStaticMarkup(React.createElement(DialLegend, { schedule }));

  assert.match(html, /Cuma/, 'Friday should show the Cuma label');
  assert.doesNotMatch(html, /Öğle/, 'Friday should not still show Öğle in the legend');
});

test('DialLegend keeps "Öğle" on a Thursday', () => {
  // 2026-08-13 is a Thursday for DEFAULT_LOCATION's zone (Europe/Istanbul).
  const anchor = new Date('2026-08-13T09:00:00+03:00');
  const day = calculateDaySchedule(DEFAULT_LOCATION, anchor, 'Diyanet');
  const schedule = deriveLiveSchedule(day, anchor);

  const html = renderToStaticMarkup(React.createElement(DialLegend, { schedule }));

  assert.match(html, /Öğle/, 'Thursday should keep the Öğle label');
  assert.doesNotMatch(html, /Cuma/, 'Thursday should not show the Cuma label');
});

test('DialLegend shows every other prayer name label alongside its time', () => {
  const anchor = new Date('2026-08-13T09:00:00+03:00');
  const day = calculateDaySchedule(DEFAULT_LOCATION, anchor, 'Diyanet');
  const schedule = deriveLiveSchedule(day, anchor);

  const html = renderToStaticMarkup(React.createElement(DialLegend, { schedule }));

  for (const name of ['İmsak', 'Güneş', 'İkindi', 'Akşam', 'Yatsı']) {
    assert.match(html, new RegExp(name), `legend should show the ${name} label`);
  }
});
