import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navbar } from './Navbar';

const noop = () => {};

// jsdom/node:test render env() ifadelerini asla değerlendirmez — bu test
// yalnızca `pb-[env(safe-area-inset-bottom)]` deklarasyonunun DOM'a
// yazıldığını doğrular, gerçek inset piksel değerini ölçmez. Gerçek cihazda
// (Android, plugin aktif) doğrulama gerekir. Bu test Header'daki eşdeğer
// safeArea testinin Navbar için eksik olan kapsam boşluğunu kapatır.
test('Navbar reserves env(safe-area-inset-bottom) so gesture/nav bar does not overlap it', () => {
  const html = renderToStaticMarkup(
    React.createElement(Navbar, {
      activeTab: 'focus',
      onChangeTab: noop,
    })
  );

  assert.match(
    html,
    /<nav[^>]*pb-\[env\(safe-area-inset-bottom\)\][^>]*>/,
    'nav element should carry the safe-area-inset-bottom padding utility'
  );
});
