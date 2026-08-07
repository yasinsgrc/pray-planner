/**
 * PLACEHOLDER — kullanıcı bu metinleri kendisi yazacak (design-refresh-v3
 * Faz 16, native ayrımı Faz 23 Commit 2). Bildirim izni istenmeden ÖNCE
 * gösterilen açık rıza metni; web ve native için içerik gerçekten farklı
 * olmalı, aynı metin ikisine de gösterilemez:
 *
 * - PUSH_CONSENT_TEXT_WEB: abonelik bilgilerinin (push endpoint + şifreleme
 *   anahtarları + gelecek bildirim zamanları) yurt dışındaki bir sunucuda
 *   saklanacağını netçe belirtmeli.
 * - PUSH_CONSENT_TEXT_NATIVE: yerel bildirimler cihaz dışına hiçbir veri
 *   göndermez (bkz. src/utils/nativeNotifications.ts — sunucuya hiçbir
 *   istek yapılmaz), bu yüzden web metnindeki "yurt dışında saklanır"
 *   iddiası native'de doğrudan YANLIŞ olur. Doğru metni kullanıcı yazacak.
 *
 * Metinleri kendi başına yazma veya değiştirme; verilen metni olduğu gibi
 * aktar (bkz. src/data/privacy.ts'teki aynı kural).
 */
export const PUSH_CONSENT_TITLE = 'Bildirim İzni Onayı';

export const PUSH_CONSENT_TEXT_WEB =
  '[YER TUTUCU — gerçek onay metni buraya gelecek] Bildirimleri açtığınızda, abonelik bilgileriniz (cihazınızın push adresi ve gelecek bildirim zamanları) yurt dışındaki bir sunucuda saklanır.';

export const PUSH_CONSENT_TEXT_NATIVE = '[YER TUTUCU — native onay metni buraya gelecek]';

export const PUSH_CONSENT_CONFIRM_LABEL = 'Onaylıyorum, Devam Et';
export const PUSH_CONSENT_DECLINE_LABEL = 'Vazgeç';
