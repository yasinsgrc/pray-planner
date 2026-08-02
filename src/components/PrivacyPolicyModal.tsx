import React from 'react';
import { BottomSheet } from './BottomSheet';
import {
  PRIVACY_ENTITY_NAME,
  PRIVACY_ADDRESS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_HOSTING_PROVIDER,
  PRIVACY_LOG_RETENTION_DAYS,
} from '../utils/privacyConfig';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Belgenin kendi revizyon tarihi — dağıtıma özgü bir alan değil, metin
// değiştikçe elle güncellenir (design-refresh-v3 Faz 8).
const LAST_UPDATED = '2 Ağustos 2026';

/**
 * Doldurulmamış bir dağıtıma-özgü alanı sessizce boş bırakmak yerine,
 * gözden kaçması imkansız bir yer tutucu olarak gösterir — bu metin
 * "taslak, yayınlamadan önce doldur" notuyla verildi.
 */
function Field({ value, placeholder }: { value: string | undefined; placeholder: string }) {
  if (value && value.trim()) return <>{value}</>;
  return (
    <span className="text-danger-ink font-semibold">
      [{placeholder} — .env dosyasında VITE_PRIVACY_* tanımlanmadı]
    </span>
  );
}

// Section 1's field names (Ad/Unvan, Adres, ...) are short enough to
// nowrap on one line without issue. Sections 4/6's left column holds
// multi-word service/data descriptions — forcing those to nowrap too
// pushed the whole table wider than the viewport and shoved the value
// column off-screen (measured while verifying this component: a real bug,
// not a hypothetical one). TdWideLabel wraps normally and caps its own
// width instead.
const TdLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="py-1.5 pr-3 text-mist align-top whitespace-nowrap">{children}</td>
);
const TdWideLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="py-1.5 pr-3 text-mist align-top w-[38%]">{children}</td>
);
const TdValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="py-1.5 align-top">{children}</td>
);

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Gizlilik Politikası">
      <div className="space-y-5 pb-2 text-sm text-ink leading-relaxed">
        <p className="text-[11px] text-mist">Son güncelleme: {LAST_UPDATED}</p>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">1. Veri Sorumlusu</h3>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-hairline">
                <TdLabel>Ad / Unvan</TdLabel>
                <TdValue>
                  <Field value={PRIVACY_ENTITY_NAME} placeholder="AD SOYAD veya ŞİRKET UNVANI" />
                </TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdLabel>Adres</TdLabel>
                <TdValue>
                  <Field value={PRIVACY_ADDRESS} placeholder="ADRES" />
                </TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdLabel>E-posta</TdLabel>
                <TdValue>
                  <Field value={PRIVACY_CONTACT_EMAIL} placeholder="İLETİŞİM E-POSTASI" />
                </TdValue>
              </tr>
              <tr>
                <TdLabel>Web</TdLabel>
                <TdValue>
                  <span className="font-numbers">{appUrl}</span>
                </TdValue>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-mist mt-2">
            6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla hareket
            eden taraf yukarıda belirtilmiştir.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">2. Özet</h3>
          <p className="text-xs mb-2">
            VAKİT bir namaz vakti uygulamasıdır. Tasarım ilkesi, mümkün olan her şeyin cihazınızda kalmasıdır:
          </p>
          <ul className="text-xs space-y-1.5 list-disc pl-4">
            <li>
              <strong>Hesap açmanız gerekmez.</strong> Ad, e-posta, telefon numarası veya benzeri bir kimlik
              bilgisi istenmez ve toplanmaz.
            </li>
            <li>
              <strong>Namaz vakitleri cihazınızda hesaplanır.</strong> Vakit bilgisi için hiçbir sunucuya
              bağlanılmaz; hesaplama, seçtiğiniz konumun enlem ve boylamı kullanılarak telefonunuzun içinde
              yapılır.
            </li>
            <li>
              <strong>Reklam ve izleme yoktur.</strong> Uygulamada hiçbir analitik, ölçümleme, reklam veya
              kullanıcı takip aracı bulunmaz.
            </li>
            <li>
              <strong>Sunucuya yalnızca bildirimleri açarsanız veri gönderilir.</strong> Bildirim özelliğini
              kullanmazsanız hiçbir kişisel veriniz tarafımıza iletilmez.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">3. Cihazınızda Saklanan, Bize Gönderilmeyen Veriler</h3>
          <p className="text-xs mb-2">
            Aşağıdaki bilgiler yalnızca tarayıcınızın yerel deposunda (<code>localStorage</code>) tutulur,
            sunucularımıza <strong>hiçbir koşulda gönderilmez</strong> ve tarafımızca erişilemez:
          </p>
          <ul className="text-xs space-y-1 list-disc pl-4">
            <li>Seçtiğiniz konum (şehir/ilçe, koordinat, saat dilimi)</li>
            <li>Tema tercihiniz (açık / koyu / otomatik)</li>
            <li>Bildirim ses ve erken uyarı tercihleriniz</li>
            <li>Hesaplama yöntemi tercihiniz</li>
            <li>Zikirmatik sayaç durumunuz ve günlük zikir kaydınız</li>
          </ul>
          <p className="text-xs text-mist mt-2">
            Bu verileri istediğiniz an tarayıcınızın site verilerini temizleme özelliğiyle silebilirsiniz.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">4. Bildirim Özelliğini Açtığınızda İşlenen Veriler</h3>
          <p className="text-xs mb-2">
            Vakit bildirimlerini etkinleştirdiğinizde, bildirimin doğru saatte gönderilebilmesi için aşağıdaki
            veriler sunucumuzda saklanır:
          </p>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-hairline">
                <TdWideLabel>Push abonelik adresi (endpoint)</TdWideLabel>
                <TdValue>Bildirimin cihazınıza ulaştırılabilmesi için zorunludur</TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>Push şifreleme anahtarları (p256dh, auth)</TdWideLabel>
                <TdValue>Bildirim içeriğinin yalnızca sizin cihazınızca açılabilmesi için zorunludur</TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>Seçtiğiniz konumun adı ve koordinatları</TdWideLabel>
                <TdValue>Namaz vakitlerinin doğru hesaplanabilmesi için gereklidir</TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>Hesaplama yöntemi tercihiniz</TdWideLabel>
                <TdValue>Vakitlerin tercihinize uygun hesaplanması için gereklidir</TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>Bildirim tercihleriniz (hangi vakit, ses, erken uyarı)</TdWideLabel>
                <TdValue>Yalnızca istediğiniz bildirimlerin gönderilmesi için gereklidir</TdValue>
              </tr>
              <tr>
                <TdWideLabel>Kaydın son güncellenme tarihi</TdWideLabel>
                <TdValue>Kayıt yönetimi ve temizliği için</TdValue>
              </tr>
            </tbody>
          </table>
          <p className="text-xs mt-2">
            <strong>Bu kayıt kimliğinizle ilişkilendirilmez.</strong> Adınız, e-postanız, telefon numaranız
            veya cihaz kimliğiniz saklanmaz. Konum bilgisi, GPS'ten alınan hassas konumunuz değil,{' '}
            <strong>sizin seçtiğiniz şehir/ilçe merkezinin koordinatıdır</strong>.
          </p>
          <p className="text-xs text-mist mt-2">
            <strong>Hukuki sebep:</strong> KVKK m.5/2-c — bir sözleşmenin kurulması veya ifasıyla doğrudan
            doğruya ilgili olması (talep ettiğiniz bildirim hizmetinin sunulabilmesi). Bildirimi
            kapattığınızda bu hukuki sebep ortadan kalkar ve kayıt silinir.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">5. Konum Bilgisi</h3>
          <p className="text-xs mb-2">Konumunuz iki şekilde belirlenebilir:</p>
          <ol className="text-xs space-y-1.5 list-decimal pl-4">
            <li>
              <strong>Listeden seçim (varsayılan):</strong> Uygulamanın içine gömülü şehir/ilçe listesinden
              seçim yaparsınız. Bu işlem tamamen çevrimdışıdır, hiçbir veri dışarı çıkmaz.
            </li>
            <li>
              <strong>"Konumumu Otomatik Kullan (GPS)":</strong> Yalnızca bu butona bastığınızda ve tarayıcı
              izni verdiğinizde cihazınızın konumu okunur. Koordinat, bulunduğunuz yerin adını belirlemek için
              tek seferlik olarak OpenStreetMap Nominatim servisine gönderilir. Koordinatınız tarafımızca{' '}
              <strong>kaydedilmez</strong>.
            </li>
          </ol>
          <p className="text-xs text-mist mt-2">
            Uygulama arka planda konumunuzu takip etmez. Farklı bir şehre gittiğinizde bir öneri gösterilebilir;
            bu kontrol yalnızca uygulama ön plana geldiğinde ve daha önce konum izni vermişseniz yapılır,
            konumunuz hiçbir yere gönderilmez ve konum otomatik olarak değiştirilmez — kararı siz verirsiniz.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">6. Üçüncü Taraf Hizmetler</h3>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-hairline">
                <TdWideLabel>OpenStreetMap Nominatim</TdWideLabel>
                <TdValue>
                  Yerel listede bulunamayan bir yeri "İnternette Ara" ile aradığınızda veya GPS ile konum
                  bulduğunuzda — arama metniniz veya koordinatınız ve sunucumuzun IP adresi (sizin IP'niz
                  değil) ona ulaşır.
                </TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>Tarayıcı push servisi (Google FCM, Apple veya Mozilla)</TdWideLabel>
                <TdValue>
                  Bildirimleri açtığınızda — push abonelik adresiniz ve şifrelenmiş bildirim içeriği ona ulaşır.
                </TdValue>
              </tr>
              <tr className="border-b border-hairline">
                <TdWideLabel>ummahapi.com</TdWideLabel>
                <TdValue>
                  Maneviyat sekmesindeki günlük ayet çekilirken — yalnızca sunucumuzun isteği gider, size ait
                  hiçbir bilgi gönderilmez.
                </TdValue>
              </tr>
              <tr>
                <TdWideLabel>
                  <Field value={PRIVACY_HOSTING_PROVIDER} placeholder="HOSTING SAĞLAYICI" />
                </TdWideLabel>
                <TdValue>
                  Uygulamayı her açtığınızda — standart sunucu erişim kayıtları (IP adresi, tarih, istek yolu)
                  ona ulaşır.
                </TdValue>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-mist mt-2">Bu hizmetlerin kendi gizlilik politikaları geçerlidir.</p>
          <p className="text-xs text-mist mt-2">
            Konum arama sonuçları © OpenStreetMap katkıcıları, ODbL lisansı altında sunulmaktadır.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">7. Saklama Süresi</h3>
          <ul className="text-xs space-y-1.5 list-disc pl-4">
            <li>Bildirim abonelik kaydınız, siz bildirimleri kapatana kadar saklanır.</li>
            <li>Bildirimleri kapattığınızda kayıt sunucudan silinir.</li>
            <li>
              Tarayıcınızın push aboneliği geçersiz hale gelirse (uygulamayı kaldırma, site verilerini silme
              vb.) kayıt ilk başarısız gönderimde otomatik olarak silinir.
            </li>
            <li>
              Sunucu erişim kayıtları{' '}
              {PRIVACY_LOG_RETENTION_DAYS && PRIVACY_LOG_RETENTION_DAYS.trim() ? (
                `${PRIVACY_LOG_RETENTION_DAYS} gün`
              ) : (
                <Field value={undefined} placeholder="SÜRE, ör. 30 gün" />
              )}{' '}
              boyunca tutulur.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">8. Haklarınız</h3>
          <p className="text-xs">
            KVKK m.11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin
            bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya
            yanlış işlenmiş olması hâlinde düzeltilmesini isteme, silinmesini veya yok edilmesini isteme ve bu
            işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme haklarına sahipsiniz.
          </p>
          <p className="text-xs mt-2">
            <strong>En hızlı yol:</strong> Uygulamada Ayarlar ekranından bildirimleri kapatmanız, sunucudaki
            kaydınızın silinmesi için yeterlidir.
          </p>
          <p className="text-xs text-mist mt-2">
            Diğer talepleriniz için: <Field value={PRIVACY_CONTACT_EMAIL} placeholder="İLETİŞİM E-POSTASI" />
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">9. Güvenlik</h3>
          <ul className="text-xs space-y-1 list-disc pl-4">
            <li>Tüm bağlantılar HTTPS üzerinden şifrelenir.</li>
            <li>
              Bildirim içerikleri, yalnızca cihazınızda çözülebilecek şekilde uçtan uca şifrelenerek (VAPID /
              Web Push protokolü) gönderilir.
            </li>
            <li>
              Sunucuda parola, ödeme bilgisi veya kimlik belgesi saklanmaz; bu tür veriler hiçbir aşamada talep
              edilmez.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">10. Değişiklikler</h3>
          <p className="text-xs">
            Bu metinde değişiklik yapılması hâlinde güncelleme tarihi yenilenir ve önemli değişiklikler
            uygulama içinde duyurulur.
          </p>
        </section>

        <p className="text-[10px] text-mist pt-2 border-t border-hairline">
          Bu metin, uygulamanın kaynak kodunda fiilen doğrulanan veri akışlarına göre hazırlanmıştır. Hukuki
          danışmanlık değildir.
        </p>
      </div>
    </BottomSheet>
  );
};
