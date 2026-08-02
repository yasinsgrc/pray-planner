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
  '10. Değişiklikler',
];

test('PRIVACY_SECTIONS has exactly 10 sections', () => {
  assert.equal(PRIVACY_SECTIONS.length, 10);
});

test('PRIVACY_SECTIONS titles are in the expected order', () => {
  assert.deepEqual(
    PRIVACY_SECTIONS.map((section) => section.title),
    EXPECTED_SECTION_TITLES
  );
});
