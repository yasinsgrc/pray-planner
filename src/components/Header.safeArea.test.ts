import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from './Header';
import { DEFAULT_LOCATION } from '../data/locations';

const noop = () => {};

test('Header reserves env(safe-area-inset-top) so native status bar does not overlap it', () => {
  const html = renderToStaticMarkup(
    React.createElement(Header, {
      location: DEFAULT_LOCATION,
      hijriDate: { day: 24, monthName: 'Muharrem', year: 1448, formatted: '24 Muharrem 1448' },
      date: new Date('2026-08-14T09:00:00+03:00'),
      timeZone: 'Europe/Istanbul',
      isDarkMode: false,
      onToggleDarkMode: noop,
      onOpenLocationModal: noop,
      onOpenExplore: noop,
      onOpenZikirmatikModal: noop,
    })
  );

  assert.match(
    html,
    /<header[^>]*pt-\[env\(safe-area-inset-top\)\][^>]*>/,
    'header element should carry the safe-area-inset-top padding utility'
  );
});
