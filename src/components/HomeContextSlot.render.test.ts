import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeContextSlot } from './HomeContextSlot';
import { calculateDaySchedule, deriveLiveSchedule, DayPrayerSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';
import { KERAHET_WINDOW_TITLE, KERAHET_WINDOW_DESCRIPTION } from '../data/strings';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');
const noop = () => {};

// Faz 25 Commit 2 — resolveHomeContextSlot's rule 3 (tomorrowImsakDiff) was
// removed, so "renders nothing" is now the common case whenever there's no
// active/upcoming kerahet and no religious day within the horizon, not just
// a pathological edge case.
test('HomeContextSlot renders nothing when the schedule has no imsak data and no push hint is due', () => {
  const fakeSchedule = { currentKerahet: null, resolvedTimeZone: 'Europe/Istanbul' } as DayPrayerSchedule;
  const farFuture = new Date('2028-06-01T12:00:00Z');

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, {
      schedule: fakeSchedule,
      now: farFuture,
      onOpenKerahetInfo: noop,
      isPushHintVisible: false,
      onOpenPushSettings: noop,
      onDismissPushHint: noop,
    })
  );

  assert.equal(html, '');
});

test('HomeContextSlot renders the push notification hint when nothing else matches and the hint is due', () => {
  const fakeSchedule = { currentKerahet: null, resolvedTimeZone: 'Europe/Istanbul' } as DayPrayerSchedule;
  const farFuture = new Date('2028-06-01T12:00:00Z');

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, {
      schedule: fakeSchedule,
      now: farFuture,
      onOpenKerahetInfo: noop,
      isPushHintVisible: true,
      onOpenPushSettings: noop,
      onDismissPushHint: noop,
    })
  );

  assert.match(html, /Vakit bildirimleri kapalı/);
});

test('HomeContextSlot renders the kerahet card with title, description and remaining time as a clickable button', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, {
      schedule,
      now: duringSunriseKerahet,
      onOpenKerahetInfo: noop,
      isPushHintVisible: false,
      onOpenPushSettings: noop,
      onDismissPushHint: noop,
    })
  );

  assert.match(html, /<button/);
  assert.match(html, new RegExp(KERAHET_WINDOW_TITLE.gunes_sonrasi));
  assert.match(html, new RegExp(KERAHET_WINDOW_DESCRIPTION.gunes_sonrasi));
  assert.match(html, /dk kaldı/);
});

test('HomeContextSlot renders "sonra başlıyor" (not "kaldı") for an upcoming, not-yet-active kerahet', () => {
  const settled = deriveLiveSchedule(day, day.dhuhr);
  const firstKerahet = settled.kerahetTimes[0];
  const tenMinBefore = new Date(firstKerahet.startTime.getTime() - 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, tenMinBefore);

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, {
      schedule,
      now: tenMinBefore,
      onOpenKerahetInfo: noop,
      isPushHintVisible: false,
      onOpenPushSettings: noop,
      onDismissPushHint: noop,
    })
  );

  assert.match(html, /sonra başlıyor/);
  assert.doesNotMatch(html, /dk kaldı/);
});

test('HomeContextSlot renders the upcoming religious day when outside kerahet', () => {
  const outsideKerahet = new Date(day.dhuhr.getTime() + 2 * 60 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, outsideKerahet);
  const fiveDaysBeforeMevlid = new Date('2026-08-19T12:00:00+03:00');

  const html = renderToStaticMarkup(
    React.createElement(HomeContextSlot, {
      schedule,
      now: fiveDaysBeforeMevlid,
      onOpenKerahetInfo: noop,
      isPushHintVisible: false,
      onOpenPushSettings: noop,
      onDismissPushHint: noop,
    })
  );

  assert.match(html, /Mevlid Kandili/);
  assert.match(html, /5 gün sonra/);
});
