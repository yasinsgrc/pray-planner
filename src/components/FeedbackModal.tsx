import React, { useMemo, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { WarningCircleIcon } from './icons';
import { LocationItem } from '../types';
import { PRIVACY_CONTACT_EMAIL } from '../utils/privacyConfig';
import { buildFeedbackBody, buildFeedbackMailtoUrl } from '../utils/feedback';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationItem;
}

const SUBJECT = 'VAKİT geri bildirim';

/**
 * Sunucuya form göndermez, mailto: bağlantısı kullanır — hiçbir şey
 * saklanmaz (design-refresh-v3 Faz 20 madde 5, açık tasarım kararı: bir
 * form kurmak, e-posta+mesajı saklamak anlamına gelir, ki bu gizlilik
 * politikasını yeniden değiştirmeyi gerektirirdi). Konum ASLA şehir adı
 * veya koordinat olarak eklenmez — sadece GPS mi elle seçim mi.
 */
export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, location }) => {
  const initialBody = useMemo(
    () =>
      buildFeedbackBody('', {
        appVersion: __APP_VERSION__,
        userAgent: navigator.userAgent,
        locationSource: location.isGpsDerived ? 'GPS' : 'Elle seçim',
      }),
    [location.isGpsDerived]
  );
  const [body, setBody] = useState(initialBody);

  // Sheet her açıldığında en güncel tanı bilgisiyle sıfırlanır — kapatıp
  // yeniden açmak eski bir düzenlemeyi göstermemeli.
  React.useEffect(() => {
    if (isOpen) setBody(initialBody);
  }, [isOpen, initialBody]);

  const email = PRIVACY_CONTACT_EMAIL;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Geri Bildirim Gönder">
      <div className="space-y-3 pb-2">
        <p className="text-[11px] text-mist leading-relaxed">
          Yanlış gördüğünüz bir şeyi (vakit, metin, davranış) aşağıya yazın. Hiçbir şey sunucuya
          kaydedilmez — "Gönder"e bastığınızda e-posta uygulamanız açılır, siz göndermeden hiçbir
          veri gitmez. Aşağıdaki teşhis bilgisini (sürüm, tarayıcı, konum yöntemi) dilerseniz
          silebilirsiniz.
        </p>

        {!email ? (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
            <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
            <p className="text-[11px] text-danger-ink">
              Geri bildirim adresi henüz yapılandırılmadı (VITE_PRIVACY_CONTACT_EMAIL tanımlı değil).
            </p>
          </div>
        ) : (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-hairline bg-paper p-3 text-xs text-ink leading-relaxed focus:outline-none focus:border-gold/50"
            />
            <a
              href={buildFeedbackMailtoUrl(email, SUBJECT, body)}
              className="w-full min-h-[48px] px-4 rounded-xl bg-gold hover:bg-gold-hover text-on-gold font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              Gönder (e-posta uygulamasını aç)
            </a>
          </>
        )}
      </div>
    </BottomSheet>
  );
};
