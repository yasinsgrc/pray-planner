import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DialLegend } from './DialLegend';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');
const schedule = deriveLiveSchedule(day, new Date('2026-08-01T12:00:00'));

test('DialLegend marks the active prayer and the next prayer with distinct states', () => {
  const html = renderToStaticMarkup(React.createElement(DialLegend, { schedule }));

  assert.match(
    html,
    new RegExp(`data-state="active"[^>]*data-prayer="${schedule.activePrayer.name}"`),
    'active prayer column should be marked data-state="active"'
  );
  assert.match(
    html,
    new RegExp(`data-state="next"[^>]*data-prayer="${schedule.nextPrayer.name}"`),
    'next prayer column should be marked data-state="next"'
  );
});

test('DialLegend gives the active prayer and the next prayer different visual weight', () => {
  const html = renderToStaticMarkup(React.createElement(DialLegend, { schedule }));

  const activeMatch = html.match(/data-state="active"[\s\S]*?<span[^>]*style="([^"]*)"/);
  const nextMatch = html.match(/data-state="next"[\s\S]*?<span[^>]*style="([^"]*)"/);

  assert.ok(activeMatch, 'active column should carry an inline style on its time span');
  assert.ok(nextMatch, 'next column should carry an inline style on its time span');
  assert.notStrictEqual(
    activeMatch![1],
    nextMatch![1],
    'active and next columns must not share the exact same style'
  );
});
