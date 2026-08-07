import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PushNotificationHint } from './PushNotificationHint';

const noop = () => {};

test('PushNotificationHint renders the notice text and two 44px-tall actions', () => {
  const html = renderToStaticMarkup(
    React.createElement(PushNotificationHint, { onOpenSettings: noop, onDismiss: noop })
  );

  assert.match(html, /Vakit bildirimleri kapalı/);
  assert.match(html, /Ayarlar/);
  assert.match(html, /Kapat/);
  const minHeightMatches = html.match(/min-h-\[44px\]/g) ?? [];
  assert.equal(minHeightMatches.length, 2);
});

test('PushNotificationHint does not use dangerouslySetInnerHTML', () => {
  const html = renderToStaticMarkup(
    React.createElement(PushNotificationHint, { onOpenSettings: noop, onDismiss: noop })
  );
  assert.doesNotMatch(html, /<script/i);
});
