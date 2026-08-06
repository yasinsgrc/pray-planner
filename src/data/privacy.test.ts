import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIVACY_SECTIONS } from './privacy';

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
