/**
 * Gizlilik Politikası içeriği (design-refresh-v3 Faz 9 M4) — bölüm başlığı +
 * gövde olarak yapılandırılmış, sabit veri. Bu dosyanın metnini üretme veya
 * değiştirme: buradaki içerik design-refresh-v3 Faz 8'de sağlanan taslaktan
 * doğrudan aktarılmıştır (kaynak kodundaki gerçek veri akışlarına göre
 * hazırlanmış, hukuki danışmanlık değildir). Köşeli parantezli alanlar
 * ([AD SOYAD] gibi) VITE_PRIVACY_* ortam değişkenleri dolduruluncaya kadar
 * olduğu gibi kalır — bkz. src/utils/privacyConfig.ts, .env.example.
 *
 * `body` içinde çift satır sonu (\n\n) yeni bir paragraf başlatır; "- " ile
 * başlayan satırlar madde işaretli liste olarak render edilir
 * (PrivacyPolicyModal.tsx). Köşeli parantezli alanların PrivacyPolicyModal
 * içinde ayrıca kırmızı bir "[TANIMLANMADI]" uyarısına dönüştürülmesi
 * gerekmiyor artık — env değeri varsa metne enjekte edilecek yer tutucular
 * ({{ENTITY_NAME}} gibi) kullanılıyor, bkz. PrivacyPolicyModal.tsx'teki
 * interpolate() fonksiyonu.
 */
export interface PrivacySection {
  title: string;
  body: string;
}

export const PRIVACY_LAST_UPDATED = '2 Ağustos 2026';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. Veri Sorumlusu',
    body:
      'Ad / Unvan: {{ENTITY_NAME}}\nAdres: {{ADDRESS}}\nE-posta: {{CONTACT_EMAIL}}\nWeb: {{APP_URL}}\n\n' +
      '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla hareket eden taraf yukarıda belirtilmiştir.',
  },
  {
    title: '2. Özet',
    body:
      'VAKİT bir namaz vakti uygulamasıdır. Tasarım ilkesi, mümkün olan her şeyin cihazınızda kalmasıdır:\n\n' +
      '- Hesap açmanız gerekmez. Ad, e-posta, telefon numarası veya benzeri bir kimlik bilgisi istenmez ve toplanmaz.\n' +
      '- Namaz vakitleri cihazınızda hesaplanır. Vakit bilgisi için hiçbir sunucuya bağlanılmaz; hesaplama, seçtiğiniz konumun enlem ve boylamı kullanılarak telefonunuzun içinde yapılır.\n' +
      '- Reklam ve izleme yoktur. Uygulamada hiçbir analitik, ölçümleme, reklam veya kullanıcı takip aracı bulunmaz.\n' +
      '- Sunucuya yalnızca bildirimleri açarsanız veri gönderilir. Bildirim özelliğini kullanmazsanız hiçbir kişisel veriniz tarafımıza iletilmez.',
  },
  {
    title: '3. Cihazınızda Saklanan, Bize Gönderilmeyen Veriler',
    body:
      'Aşağıdaki bilgiler yalnızca tarayıcınızın yerel deposunda (localStorage) tutulur, sunucularımıza hiçbir koşulda gönderilmez ve tarafımızca erişilemez:\n\n' +
      '- Seçtiğiniz konum (şehir/ilçe, koordinat, saat dilimi)\n' +
      '- Tema tercihiniz (açık / koyu / otomatik)\n' +
      '- Bildirim ses ve erken uyarı tercihleriniz\n' +
      '- Hesaplama yöntemi tercihiniz\n' +
      '- Zikirmatik sayaç durumunuz ve günlük zikir kaydınız\n\n' +
      'Bu verileri istediğiniz an tarayıcınızın site verilerini temizleme özelliğiyle silebilirsiniz.',
  },
  {
    title: '4. Bildirim Özelliğini Açtığınızda İşlenen Veriler',
    body:
      'Vakit bildirimlerini etkinleştirdiğinizde, bildirimin doğru saatte gönderilebilmesi için aşağıdaki veriler sunucumuzda saklanır:\n\n' +
      '- Tarayıcı push abonelik adresi (endpoint) — bildirimin cihazınıza ulaştırılabilmesi için zorunludur\n' +
      '- Push şifreleme anahtarları (p256dh, auth) — bildirim içeriğinin yalnızca sizin cihazınızca açılabilmesi için zorunludur\n' +
      '- Önümüzdeki 30 güne ait bildirim zamanları listesi — her biri sadece bir tarih/saat damgası ve hangi vakit olduğunu belirten bir etiket (örn. "öğle" veya "öğleden 15 dakika önce") içerir\n' +
      '- Aboneliğin oluşturulma tarihi — kayıt yönetimi için\n\n' +
      'Bu liste, namaz vakitleri gibi, TAMAMEN cihazınızda hesaplanır. Konumunuz, şehir/ilçe adınız ve hesaplama yöntemi tercihiniz sunucumuza HİÇBİR ZAMAN gönderilmez; sunucu bunları bilmez, sadece "ne zaman" bilgisini bilir, "nerede" veya "nasıl hesaplandığını" bilmez.\n\n' +
      'Bu kayıt kimliğinizle ilişkilendirilmez. Adınız, e-postanız, telefon numaranız veya cihaz kimliğiniz saklanmaz.\n\n' +
      'Hukuki sebep: KVKK m.5/2-c — bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (talep ettiğiniz bildirim hizmetinin sunulabilmesi). Bildirimi kapattığınızda bu hukuki sebep ortadan kalkar ve kayıt silinir.',
  },
  {
    title: '5. Konum Bilgisi',
    body:
      'Konumunuz iki şekilde belirlenebilir:\n\n' +
      '- Listeden seçim (varsayılan): Uygulamanın içine gömülü şehir/ilçe listesinden seçim yaparsınız. Bu işlem tamamen çevrimdışıdır, hiçbir veri dışarı çıkmaz.\n' +
      '- "Konumumu Otomatik Kullan (GPS)": Yalnızca bu butona bastığınızda ve tarayıcı izni verdiğinizde cihazınızın konumu okunur. Koordinat, bulunduğunuz yerin adını belirlemek için tek seferlik olarak OpenStreetMap Nominatim servisine gönderilir. Koordinatınız tarafımızca kaydedilmez.\n\n' +
      'Uygulama arka planda konumunuzu takip etmez. Farklı bir şehre gittiğinizde bir öneri gösterilebilir; bu kontrol yalnızca uygulama ön plana geldiğinde ve daha önce konum izni vermişseniz yapılır, konumunuz hiçbir yere gönderilmez ve konum otomatik olarak değiştirilmez — kararı siz verirsiniz.',
  },
  {
    title: '6. Üçüncü Taraf Hizmetler',
    body:
      '- OpenStreetMap Nominatim: Yerel listede bulunamayan bir yeri "İnternette Ara" ile aradığınızda veya GPS ile konum bulduğunuzda — arama metniniz veya koordinatınız ve sunucumuzun IP adresi (sizin IP\'niz değil) ona ulaşır.\n' +
      '- Tarayıcı push servisi (Google FCM, Apple veya Mozilla): Bildirimleri açtığınızda — push abonelik adresiniz ve şifrelenmiş bildirim içeriği ona ulaşır.\n' +
      '- ummahapi.com: Maneviyat sekmesindeki günlük ayet çekilirken — yalnızca sunucumuzun isteği gider, size ait hiçbir bilgi gönderilmez.\n' +
      '- {{HOSTING_PROVIDER}}: Uygulamayı her açtığınızda — standart sunucu erişim kayıtları (IP adresi, tarih, istek yolu) ona ulaşır.\n\n' +
      'Bu hizmetlerin kendi gizlilik politikaları geçerlidir.\n\n' +
      'Konum arama sonuçları © OpenStreetMap katkıcıları, ODbL lisansı altında sunulmaktadır.',
  },
  {
    title: '7. Saklama Süresi',
    body:
      '- Bildirim abonelik kaydınız, siz bildirimleri kapatana kadar saklanır.\n' +
      '- Bildirimleri kapattığınızda kayıt sunucudan silinir.\n' +
      '- Tarayıcınızın push aboneliği geçersiz hale gelirse (uygulamayı kaldırma, site verilerini silme vb.) kayıt ilk başarısız gönderimde otomatik olarak silinir.\n' +
      '- Sunucu erişim kayıtlarını biz tutmuyoruz; barındırma sağlayıcılarımız bu kayıtları kendi politikaları uyarınca geçici olarak saklar.',
  },
  {
    title: '8. Haklarınız',
    body:
      'KVKK m.11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme, silinmesini veya yok edilmesini isteme ve bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme haklarına sahipsiniz.\n\n' +
      'En hızlı yol: Uygulamada Ayarlar ekranından bildirimleri kapatmanız, sunucudaki kaydınızın silinmesi için yeterlidir.\n\n' +
      'Diğer talepleriniz için: {{CONTACT_EMAIL}}',
  },
  {
    title: '9. Güvenlik',
    body:
      '- Tüm bağlantılar HTTPS üzerinden şifrelenir.\n' +
      '- Bildirim içerikleri, yalnızca cihazınızda çözülebilecek şekilde uçtan uca şifrelenerek (VAPID / Web Push protokolü) gönderilir.\n' +
      '- Sunucuda parola, ödeme bilgisi veya kimlik belgesi saklanmaz; bu tür veriler hiçbir aşamada talep edilmez.',
  },
  {
    title: '10. Geri Bildirim (Hata Bildirimi)',
    body:
      'Uygulama içinden "Geri Bildirim Gönder" ile bir hata bildirdiğinizde, bu sunucumuza bir form gönderimi DEĞİLDİR — cihazınızın kendi e-posta uygulamasını (mailto:) açan bir bağlantıdır. Siz e-postayı göndermediğiniz sürece hiçbir şey bize ulaşmaz; biz bu adımda hiçbir veri toplamaz, saklamaz.\n\n' +
      'Gönderdiğiniz e-postanın gövdesine otomatik olarak şu teşhis bilgileri eklenir (göndermeden önce görüp düzenleyebilir veya silebilirsiniz): uygulama sürümü, tarayıcı/işletim sisteminiz ve konumunuzu GPS ile mi yoksa elle mi seçtiğiniz. Şehir adınız, koordinatınız veya başka bir konum bilgisi ASLA otomatik eklenmez.\n\n' +
      'E-postayı gönderdiğinizde, içeriği (adresiniz dahil) doğrudan e-posta sağlayıcınız üzerinden {{CONTACT_EMAIL}} adresine ulaşır; bu noktadan sonrası genel e-posta yazışması olarak değerlendirilir, bu politikanın kapsamındaki otomatik veri işleme süreçlerinin bir parçası değildir.',
  },
  {
    title: '11. Değişiklikler',
    body: 'Bu metinde değişiklik yapılması hâlinde güncelleme tarihi yenilenir ve önemli değişiklikler uygulama içinde duyurulur.',
  },
];

/** Ayarlar > Hakkında kartındaki kısa özet — tam metnin ilk paragrafı değil, ayrı ve daha kısa bir giriş. */
export const PRIVACY_SUMMARY =
  'VAKİT hesap açmanızı istemez, reklam göstermez ve sizi takip etmez. Namaz vakitleri telefonunuzda hesaplanır; bunun için hiçbir sunucuya bağlanılmaz. ' +
  'Sunucumuza yalnızca vakit bildirimlerini açarsanız veri gönderilir. Bildirimleri kapattığınızda bu kayıt silinir.';

const SUMMARY_SUBSCRIPTION_SENTENCE =
  ' Sunucumuza yalnızca vakit bildirimlerini açarsanız veri gönderilir. Bildirimleri kapattığınızda bu kayıt silinir.';

/** getPrivacySections'la aynı gerekçe: native'de bildirim için sunucuya hiçbir veri gitmez, bu yüzden özet cümlesi de o iddiayı taşıyamaz. */
export function getPrivacySummary(isNative: boolean): string {
  if (!isNative) return PRIVACY_SUMMARY;
  return PRIVACY_SUMMARY.replace(SUMMARY_SUBSCRIPTION_SENTENCE, '');
}

const SUBSCRIPTION_ONLY_SECTION_TITLE = '4. Bildirim Özelliğini Açtığınızda İşlenen Veriler';
const DEVICE_DATA_SECTION_TITLE = '3. Cihazınızda Saklanan, Bize Gönderilmeyen Veriler';

/**
 * Section 4 tamamen abonelik hakkında olduğu için native'de bütünüyle
 * düşer, ama aynı iddia (push abonelik adresi/şifreleme anahtarları
 * sunucuda saklanır) tek tek satırlar olarak 6. ve 7. bölümlerin içine de
 * serpiştirilmiş — bunları da bırakmak aynı yanlış iddiayı başka bir
 * yerden tekrar etmek olurdu. Yalnızca bu satırlar (mevcut metinden
 * birebir, yeni ifade yok) native'de elenir; her iki bölümün geri kalanı
 * (OpenStreetMap, ummahapi, hosting sağlayıcı, sunucu erişim kaydı
 * saklama süresi — hepsi native'de de gerçekleşen, sunucu tabanlı akışlar)
 * olduğu gibi kalır.
 */
const NATIVE_LINE_EXCLUSIONS: Record<string, RegExp[]> = {
  '6. Üçüncü Taraf Hizmetler': [/^- Tarayıcı push servisi/],
  '7. Saklama Süresi': [
    /^- Bildirim abonelik kaydınız/,
    /^- Bildirimleri kapattığınızda kayıt sunucudan silinir\.$/,
    /^- Tarayıcınızın push aboneliği geçersiz hale gelirse/,
  ],
};

/**
 * Native bir sunucu abonelik kaydı asla oluşturmaz (design-refresh-v3 Faz
 * 23 Commit 2 — nativeNotifications.ts hiçbir /api/* isteği yapmaz, yerel
 * bildirimler tamamen cihazda zamanlanır); PRIVACY_SECTIONS'ın web için
 * yazılmış abonelik iddiaları native'de olduğu gibi gösterilirse doğrudan
 * yanlış olur. PRIVACY_SECTIONS'ın kendisi (web'in okuduğu kaynak) burada
 * asla değiştirilmez — yalnızca filtrelenip yeniden numaralandırılmış bir
 * KOPYASI döner. Widget verisinin cihazda kaldığına dair tek cümle
 * (widgetStorage.ts + gerçek cihazda doğrulandı: SharedPreferences'a
 * yazar, hiçbir ağ isteği yapmaz) mevcut "cihazda saklanan" bölümüne
 * eklenir.
 */
export function getPrivacySections(isNative: boolean): PrivacySection[] {
  if (!isNative) return PRIVACY_SECTIONS;

  return PRIVACY_SECTIONS.filter((section) => section.title !== SUBSCRIPTION_ONLY_SECTION_TITLE)
    .map((section) => {
      if (section.title === DEVICE_DATA_SECTION_TITLE) {
        return {
          ...section,
          body:
            section.body +
            "\n- Kilit ekranı/ana ekran widget'ı için üretilen 7 günlük vakit verisi (cihazınızdaki SharedPreferences) — yalnızca cihazınızda tutulur, hiçbir sunucuya gönderilmez.",
        };
      }
      const exclusions = NATIVE_LINE_EXCLUSIONS[section.title];
      if (!exclusions) return section;
      return {
        ...section,
        body: section.body
          .split('\n')
          .filter((line) => !exclusions.some((pattern) => pattern.test(line)))
          .join('\n'),
      };
    })
    .map((section, i) => ({
      ...section,
      title: section.title.replace(/^\d+\./, `${i + 1}.`),
    }));
}
