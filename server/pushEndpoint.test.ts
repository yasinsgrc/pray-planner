import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedPushEndpoint } from './pushEndpoint';

for (const endpoint of [
  'https://fcm.googleapis.com/fcm/send/abc:APA91b',
  'https://android.googleapis.com/gcm/send/abc',
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
  'https://wns2-db5p.notify.windows.com/w/?token=abc',
  'https://web.push.apple.com/QGx3',
]) {
  test(`isAllowedPushEndpoint accepts a real push service: ${new URL(endpoint).host}`, () => {
    assert.equal(isAllowedPushEndpoint(endpoint), true);
  });
}

for (const [reason, endpoint] of [
  ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
  ['cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
  ['localhost', 'https://localhost:8787/api'],
  ['arbitrary host', 'https://push.example.com/a'],
  ['suffix look-alike', 'https://evilfcm.googleapis.com.attacker.net/x'],
  ['allowed name as a subdomain of another host', 'https://fcm.googleapis.com.attacker.net/x'],
  ['explicit port', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
  ['embedded credentials', 'https://user:pass@fcm.googleapis.com/fcm/send/abc'],
  ['not a URL', 'e1'],
] as const) {
  test(`isAllowedPushEndpoint rejects ${reason}`, () => {
    assert.equal(isAllowedPushEndpoint(endpoint), false);
  });
}
