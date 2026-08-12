import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunArcDial } from './SunArcDial';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

// design-refresh-v3 Faz 25 Commit 3 — the ring's gold kerahet arcs read as a
// "broken/dashed" ring on real devices because the three kerahet windows are
// hours apart and are rendered as separate <path> segments outside the
// track. There's no fix that makes disjoint time windows look like one
// unbroken line, so the indicator moved off the ring entirely; kerahet info
// now lives only in KerahetStrip and HomeContextSlot.
test('SunArcDial renders no kerahet element on the ring, even during an active kerahet window', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule, now: duringSunriseKerahet })
  );

  assert.doesNotMatch(html, /kerahet/i);
});
