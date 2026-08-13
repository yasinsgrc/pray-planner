import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DailyFlowList } from './DailyFlowList';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';
import { PrayerName, SoundMode } from '../types';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');
const schedule = deriveLiveSchedule(day, new Date('2026-08-01T12:00:00'));

const notifications: Record<PrayerName, SoundMode> = {
  imsak: 'bildirim',
  gunes: 'bildirim',
  ogle: 'bildirim',
  ikindi: 'bildirim',
  aksam: 'bildirim',
  yatsi: 'bildirim',
};

const noop = () => {};

test('DailyFlowList does not render a "Ses Ayarları" button next to the title', () => {
  const html = renderToStaticMarkup(
    React.createElement(DailyFlowList, {
      schedule,
      notifications,
      calculationMethod: 'Diyanet',
      onOpenSettings: noop,
      onOpenKerahetInfo: noop,
    })
  );

  assert.doesNotMatch(html, /Ses Ayarları/);
  assert.match(html, /Günlük Vakit Akışı/);
});
