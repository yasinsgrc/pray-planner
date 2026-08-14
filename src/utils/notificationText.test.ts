import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalNotificationText } from './notificationText';

// Faz 23 Commit 2 — native bildirimler sunucuya hiç uğramaz (server/
// pushPayload.ts'in web push için yaptığı metin üretimi orada kalıyor,
// server/ dokunulmaz), bu yüzden aynı metin client tarafında da üretilmeli.
// Bu test dosyası, server/pushPayload.test.ts (varsa) ile aynı vakaları
// kapsayarak iki tarafın birbirinden asla ayrışmadığını garanti eder —
// metinler server/pushPayload.ts'ten birebir (harf harf) kopyalandı, yeni
// bir ifade icat edilmedi.
test('buildLocalNotificationText: bir ana vakit için "X Vakti Girdi"', () => {
  const result = buildLocalNotificationText('ikindi');
  assert.deepEqual(result, { title: 'İkindi Vakti Girdi', body: 'Hayırlı namazlar.' });
});

test('buildLocalNotificationText: güneş vakti özel metinle ele alınır (namaz vakti değil)', () => {
  const result = buildLocalNotificationText('gunes');
  assert.deepEqual(result, {
    title: 'Sabah Namazı Vakti Sona Erdi',
    body: 'Güneş doğdu, kerahet vakti başladı.',
  });
});

test('buildLocalNotificationText: Cuma günü öğle için "ogle-cuma" anahtarı özel metin döner', () => {
  const result = buildLocalNotificationText('ogle-cuma');
  assert.deepEqual(result, { title: 'Cuma Vakti', body: 'Hayırlı Cumalar' });
});

test('buildLocalNotificationText: diğer günler "ogle" anahtarı değişmeden kalır', () => {
  const result = buildLocalNotificationText('ogle');
  assert.deepEqual(result, { title: 'Öğle Vakti Girdi', body: 'Hayırlı namazlar.' });
});

test('buildLocalNotificationText: erken uyarı için "X Vaktine N Dakika Kaldı"', () => {
  const result = buildLocalNotificationText('ikindi-early:15');
  assert.deepEqual(result, {
    title: 'İkindi Vaktine 15 Dakika Kaldı',
    body: 'Abdest ve hazırlık için hatırlatma.',
  });
});

test('buildLocalNotificationText: güneş için erken uyarı da özel metinle ele alınır', () => {
  const result = buildLocalNotificationText('gunes-early:15');
  assert.deepEqual(result, {
    title: 'Sabah Namazı Vaktinin Bitmesine 15 Dakika Kaldı',
    body: 'Bu sürenin sonunda kerahet vakti başlar.',
  });
});

test('buildLocalNotificationText: tanınmayan bir anahtar için null döner (bozuk bildirim gönderilmez)', () => {
  assert.equal(buildLocalNotificationText('not-a-real-key'), null);
  assert.equal(buildLocalNotificationText('ikindi-early:abc'), null);
});
