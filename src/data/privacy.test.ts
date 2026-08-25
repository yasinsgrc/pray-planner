import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIVACY_SECTIONS, getPrivacySections, PRIVACY_SUMMARY, getPrivacySummary } from './privacy';

// Bekçi testi: bu metin sağlanan nihai gizlilik/KVKK metninin kendisidir,
// placeholder değil — bir sonraki tur farkında olmadan yeniden yazar veya
// bölüm sırasını bozarsa bu test kırmızıya döner (design-refresh-v3 Faz 9 F4).
const EXPECTED_SECTION_TITLES = [
  '1. Veri Sorumlusu',
  '2. Özet',
  '3. Cihazınızda Saklanan, Bize Gönderilmeyen Veriler',
  '4. Bildirim Özelliğini Açtığınızda İşlenen Veriler',
  '5. Konum Bilgisi',
  '6. Üçüncü Taraf Hizmetler',
  '7. Saklama Süresi',
  '8. Haklarınız',
  '9. Güvenlik',
  '10. Geri Bildirim (Hata Bildirimi)',
  '11. Değişiklikler',
];

test('PRIVACY_SECTIONS has exactly 11 sections', () => {
  assert.equal(PRIVACY_SECTIONS.length, 11);
});

test('PRIVACY_SECTIONS titles are in the expected order', () => {
  assert.deepEqual(
    PRIVACY_SECTIONS.map((section) => section.title),
    EXPECTED_SECTION_TITLES
  );
});

function sectionBody(title: string): string {
  const section = PRIVACY_SECTIONS.find((s) => s.title === title);
  if (!section) throw new Error(`section "${title}" not found`);
  return section.body;
}

// design-refresh-v3 Faz 21 madde 4 — the server is coordinate-free by
// design (server/app.ts's parseScheduleRequest only ever accepts endpoint,
// keys.p256dh, keys.auth, and a schedule of {fireAt, prayerKey} — never a
// location, city, or calculation method; server/pushStore.ts's schema has
// no column for any of those either). This section previously claimed the
// opposite, which was a real, testable contradiction between the privacy
// text and the actual code — not just a wording nitpick.
test('section 4 does not falsely claim the server stores your location, city, or calculation method', () => {
  const body = sectionBody('4. Bildirim Özelliğini Açtığınızda İşlenen Veriler');
  assert.doesNotMatch(body, /konumun (adı|koordinat)/i);
  // The corrected text is allowed to MENTION "hesaplama yöntemi" while
  // explicitly denying it's sent (accurate) — the bug was claiming it
  // as a bullet point of stored data, e.g. "Hesaplama yöntemi
  // tercihiniz — ... için gereklidir", not the phrase's mere presence.
  assert.doesNotMatch(body, /hesaplama yöntemi tercihiniz\s*—.*gereklidir/i);
  assert.match(body, /hesaplama yöntemi.{0,40}(hiçbir zaman gönderilmez|gönderilmez)/i);
});

test('section 4 accurately names what the server actually stores: endpoint, push keys, and a precomputed schedule', () => {
  const body = sectionBody('4. Bildirim Özelliğini Açtığınızda İşlenen Veriler');
  assert.match(body, /endpoint/i);
  assert.match(body, /p256dh/);
  assert.match(body, /auth/);
  // The schedule is pre-computed client-side and sent as bare timestamps +
  // a prayer-key label — the section must say so, not leave it implied.
  assert.match(body, /cihazınızda hesapla/i);
});

test('the new Geri Bildirim section truthfully describes the mailto-only feedback mechanism', () => {
  const body = sectionBody('10. Geri Bildirim (Hata Bildirimi)');
  assert.match(body, /mailto/i);
  assert.doesNotMatch(body, /sunucu(muz|ya)?.{0,40}(kaydedil|sakla|gönderil)/i);
});

// design-refresh-v3 Faz 23 Commit 6 — native local bildirimler
// (nativeNotifications.ts) hiçbir abonelik kaydını sunucuya göndermez;
// web'in "4. Bildirim Özelliğini Açtığınızda İşlenen Veriler" bölümü
// (push endpoint + şifreleme anahtarları sunucuda saklanır) native'de
// birebir aktarılırsa doğrudan yanlış bir iddia olur. getPrivacySections
// bunu platforma göre ayırır; PRIVACY_SECTIONS'ın kendisi (web'in okuduğu
// kaynak) hiç değişmeden kalır — yukarıdaki "tam 11 bölüm" bekçi testi bunu
// zaten garanti ediyor.
test('getPrivacySections(false) (web) returns the unmodified 11-section PRIVACY_SECTIONS verbatim', () => {
  assert.deepEqual(getPrivacySections(false), PRIVACY_SECTIONS);
});

test('getPrivacySections(true) (native) does not include a section claiming push subscription data is stored server-side', () => {
  const sections = getPrivacySections(true);
  const fullText = sections.map((s) => `${s.title}\n${s.body}`).join('\n');
  assert.doesNotMatch(fullText, /push abonelik adresi/i);
  assert.doesNotMatch(fullText, /p256dh/);
  assert.doesNotMatch(fullText, /şifreleme anahtarları/i);
});

test('getPrivacySections(true) (native) mentions that widget data stays on-device in SharedPreferences and is never sent anywhere', () => {
  const sections = getPrivacySections(true);
  const fullText = sections.map((s) => s.body).join('\n');
  assert.match(fullText, /widget/i);
  assert.match(fullText, /SharedPreferences/i);
  assert.match(fullText, /(cihazınızda|hiçbir sunucuya gönderilmez)/i);
});

test('getPrivacySections(true) (native) keeps section titles sequentially renumbered with no gap', () => {
  const sections = getPrivacySections(true);
  const numbers = sections.map((s) => Number(s.title.match(/^(\d+)\./)?.[1]));
  assert.deepEqual(
    numbers,
    Array.from({ length: numbers.length }, (_, i) => i + 1)
  );
});

test('getPrivacySections(true) (native) drops exactly one section (the subscription-only one) relative to web', () => {
  const nativeSections = getPrivacySections(true);
  assert.equal(nativeSections.length, PRIVACY_SECTIONS.length - 1);
});

// SpiritualSettings'in "Gizlilik ve Kişisel Veriler" kartında ve
// PrivacyPolicyModal'ın üstünde gösterilen kısa özet — tam metnin ayrı bir
// kopyası, aynı abonelik yanlışlığını taşıyordu (design-refresh-v3 Faz 23
// Commit 6).
test('getPrivacySummary(false) (web) returns PRIVACY_SUMMARY verbatim', () => {
  assert.equal(getPrivacySummary(false), PRIVACY_SUMMARY);
});

test('getPrivacySummary(true) (native) does not claim server data is sent/stored for notifications', () => {
  const summary = getPrivacySummary(true);
  assert.doesNotMatch(summary, /sunucumuza.{0,40}bildirim/i);
  assert.doesNotMatch(summary, /kayıt silinir/i);
});

// design-refresh-v3 Faz 24 Commit 2 — the policy used to promise access
// logs are kept for exactly {{LOG_RETENTION_DAYS}} days, a number nothing
// in server/ actually enforces (no access-log table, no retention job);
// the real, verifiable fact is that we don't keep them ourselves at all —
// only the hosting providers do, per their own policies.
test('no section claims a specific server access-log retention period', () => {
  const fullText = PRIVACY_SECTIONS.map((s) => s.body).join('\n');
  assert.doesNotMatch(fullText, /LOG_RETENTION_DAYS/);
});

// design-refresh-v3 Faz 27.15 — GPS coordinates never leave the device:
// LocationModal.tsx's handleUseGPS makes no network request, and
// /api/reverse-geocode was removed in Faz 16 (rejected by
// server/app.ts:155, asserted by server/app.test.ts:338). Section 5
// previously claimed the coordinate was sent to Nominatim to resolve the
// place name — false since Faz 16, when on-device district boundary
// resolution replaced that flow.
test('section 5 (Konum Bilgisi) does not claim the GPS coordinate is sent to Nominatim', () => {
  const body = sectionBody('5. Konum Bilgisi');
  assert.doesNotMatch(body, /GPS[\s\S]{0,200}Nominatim/i);
  assert.match(body, /GPS[\s\S]{0,200}(cihaz[ıi]n[ıi]zdan hiçbir zaman çıkmaz|çevrimdışı|tamamen cihaz)/i);
});

test('section 6 (Üçüncü Taraf Hizmetler) Nominatim bullet only describes text search, not GPS', () => {
  const body = sectionBody('6. Üçüncü Taraf Hizmetler');
  const nominatimLine = body.split('\n').find((line) => /Nominatim/i.test(line));
  assert.ok(nominatimLine, 'expected a Nominatim bullet line');
  assert.doesNotMatch(nominatimLine!, /GPS/i);
  assert.doesNotMatch(nominatimLine!, /koordinat/i);
});

// Guards the {{TOKEN}} contract itself: PrivacyPolicyModal.tsx only knows
// how to fill these five tokens (renderWithFields' `values` map) — an
// unexpected token would silently render as a raw "[TOKEN — .env dosyasında
// tanımlanmadı]" placeholder in production with no test ever catching it.
test('only the five known {{TOKEN}} placeholders appear anywhere in PRIVACY_SECTIONS', () => {
  const fullText = PRIVACY_SECTIONS.map((s) => s.body).join('\n');
  const knownTokens = new Set(['ENTITY_NAME', 'ADDRESS', 'CONTACT_EMAIL', 'HOSTING_PROVIDER', 'APP_URL']);
  const found = new Set([...fullText.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
  for (const token of found) {
    assert.ok(knownTokens.has(token), `unexpected {{${token}}} placeholder with no known filler`);
  }
});
