import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPushHint } from './pushHint';

// Faz 22 Commit 4 — bildirim izni hiç sorulmadıysa (permission 'default')
// kullanıcı bunu fark etmeyebilir; bu, eksik bir kurulum adımını
// bildiriyor. Ama ısrarcı olmamalı: reddedilmişse, zaten abone edilmişse,
// sunucu yoksa veya kullanıcı daha önce kapattıysa hiç gösterilmemeli.
const BASE = {
  notificationPermission: 'default' as const,
  hasExistingSubscription: false,
  apiAvailable: true as boolean | null,
  pushHintDismissedAt: null as number | null,
};

test('shows the hint when permission is default, no subscription, server available, never dismissed', () => {
  assert.equal(shouldShowPushHint(BASE), true);
});

test('hides the hint once the user has dismissed it', () => {
  assert.equal(shouldShowPushHint({ ...BASE, pushHintDismissedAt: 1754500000000 }), false);
});

test('hides the hint when permission was already granted', () => {
  assert.equal(shouldShowPushHint({ ...BASE, notificationPermission: 'granted' }), false);
});

test('hides the hint when permission was denied (must not nag)', () => {
  assert.equal(shouldShowPushHint({ ...BASE, notificationPermission: 'denied' }), false);
});

test('hides the hint when the Notification API is unsupported', () => {
  assert.equal(shouldShowPushHint({ ...BASE, notificationPermission: 'unsupported' }), false);
});

test('hides the hint when a push subscription already exists', () => {
  assert.equal(shouldShowPushHint({ ...BASE, hasExistingSubscription: true }), false);
});

test('hides the hint when the API server is unavailable (serverless deploy)', () => {
  assert.equal(shouldShowPushHint({ ...BASE, apiAvailable: false }), false);
});

test('hides the hint while the API availability check is still in flight (null)', () => {
  assert.equal(shouldShowPushHint({ ...BASE, apiAvailable: null }), false);
});
