import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KerahetStrip } from './KerahetStrip';
import { KerahetInfo } from '../types';
import { KERAHET_WINDOW_DESCRIPTION } from '../data/strings';

const noop = () => {};

function makeKerahetTimes(activeType: KerahetInfo['type'] | null): KerahetInfo[] {
  const types: KerahetInfo['type'][] = ['gunes_sonrasi', 'ogle_oncesi', 'aksam_oncesi'];
  return types.map((type, i) => ({
    type,
    title: type,
    description: type,
    startTime: new Date(2026, 0, 1, 6 + i),
    endTime: new Date(2026, 0, 1, 7 + i),
    isActiveNow: type === activeType,
  }));
}

// Faz 27.14 — Gurûb üç yerde tekrar ediyordu (kerahet chip'i, alt kart
// başlığı, alt kart geri sayımı). Alt kart tamamen kaldırıldı; chip'lerin
// altındaki tek satır artık genel bir metin yerine aktif kerahet vaktinin
// kendi açıklamasını gösteriyor.
test('KerahetStrip shows the active kerahet type\'s own description, not a generic message', () => {
  const html = renderToStaticMarkup(
    React.createElement(KerahetStrip, {
      kerahetTimes: makeKerahetTimes('aksam_oncesi'),
      timeZone: 'Europe/Istanbul',
      onOpenInfo: noop,
    })
  );

  assert.match(html, new RegExp(KERAHET_WINDOW_DESCRIPTION.aksam_oncesi));
  assert.doesNotMatch(html, /Şu an kerahet vaktidir/);
});

test('KerahetStrip renders no description line when no kerahet is active', () => {
  const html = renderToStaticMarkup(
    React.createElement(KerahetStrip, {
      kerahetTimes: makeKerahetTimes(null),
      timeZone: 'Europe/Istanbul',
      onOpenInfo: noop,
    })
  );

  assert.doesNotMatch(html, /nafile namaz/);
});
