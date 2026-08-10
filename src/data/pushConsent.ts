/**
 * Bildirim izni istenmeden ÖNCE gösterilen açık rıza metni (design-refresh-v3
 * Faz 16, native ayrımı ve gerçek metin Faz 23 denetim düzeltmesi Commit 2).
 * Web ve native için içerik kasıtlı olarak farklıdır:
 *
 * - PUSH_CONSENT_TEXT_WEB: abonelik bilgilerinin (push endpoint + şifreleme
 *   anahtarları + gelecek bildirim zamanları, bkz. pushClient.ts'teki
 *   sendScheduleToServer) AB içinde barındırılan sunucuda saklandığını
 *   belirtir.
 * - PUSH_CONSENT_TEXT_NATIVE: yerel bildirimler cihaz dışına hiçbir veri
 *   göndermez (bkz. src/utils/nativeNotifications.ts — sunucuya hiçbir
 *   istek yapılmaz), bu yüzden web metnindeki "sunucuda saklanır" iddiası
 *   native'de doğrudan YANLIŞ olur.
 *
 * Metinleri kendi başına yazma veya değiştirme; verilen metni olduğu gibi
 * aktar (bkz. src/data/privacy.ts'teki aynı kural).
 */
export const PUSH_CONSENT_TITLE = 'Bildirim İzni Onayı';

export const PUSH_CONSENT_TEXT_WEB =
  'Bildirimleri açtığınızda tarayıcınızın oluşturduğu bildirim adresi, şifreleme anahtarları ve önümüzdeki 30 güne ait vakit saatleri sunucumuzda saklanır. Sunucu Avrupa Birliği içinde barındırılmaktadır. Konum koordinatlarınız gönderilmez; yalnızca cihazınızda hesaplanmış saatler iletilir. Bildirimleri kapattığınızda bu kayıt silinir.';

export const PUSH_CONSENT_TEXT_NATIVE =
  'Bildirimler tamamen cihazınızda kurulur. Vakitler cihazınızda hesaplanır ve bildirimler cihazınızın kendi zamanlayıcısına yazılır. Bu işlem için hiçbir veri cihazınızdan çıkmaz ve sunucumuzda hiçbir kayıt oluşmaz.';

export const PUSH_CONSENT_CONFIRM_LABEL = 'Onaylıyorum, Devam Et';
export const PUSH_CONSENT_DECLINE_LABEL = 'Vazgeç';
