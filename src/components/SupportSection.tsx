import React, { useState } from 'react';
import { FadeIn } from './FadeIn';
import { BottomSheet } from './BottomSheet';
import {
  HandHeartIcon,
  CopyIcon,
  CheckIcon,
  ArrowSquareOutIcon,
  ShareNetworkIcon,
  StarIcon,
} from './icons';
import {
  SUPPORT_IBAN,
  SUPPORT_NAME,
  SUPPORT_PAYMENT_URL,
  SUPPORT_STORE_URL,
  hasBankTransfer,
  hasCardPayment,
  hasStoreReview,
} from '../utils/supportConfig';

/**
 * Ayarlar > Hakkında bölümünün en üstünde, sakin ve isteğe bağlı bir
 * "Destek Ol" girişi. Bilinçli olarak burada: ana ekranda, kadranda veya
 * navbar'da hiçbir giriş noktası yok — bu bir ibadet uygulaması, para
 * isteyen bir öğe kullanıcının önüne çıkmamalı.
 */
export const SupportSection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyIban = () => {
    if (!SUPPORT_IBAN) return;
    navigator.clipboard.writeText(SUPPORT_IBAN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'VAKİT',
      text: 'VAKİT — sakin ve manevi bir namaz vakti uygulaması',
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Kullanıcı paylaşımı iptal etti: sessizce yok say
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
    }
  };

  return (
    <>
      <FadeIn delay={0.3} className="p-4 rounded-2xl bg-card border border-hairline shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
            <HandHeartIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink">Destek Ol</div>
            <p className="text-[11px] text-mist leading-relaxed mt-0.5">
              VAKİT reklamsız ve ücretsiz. Geliştirme ve sunucu masraflarına
              katkıda bulunmak isterseniz destek olabilirsiniz — tamamen
              isteğe bağlıdır.
            </p>
            <button
              onClick={() => setIsOpen(true)}
              className="min-h-[44px] mt-3 px-4 rounded-xl bg-paper border border-hairline text-xs font-semibold text-gold-ink cursor-pointer hover:bg-gold/10 transition-colors"
            >
              Destek Ol
            </button>
          </div>
        </div>
      </FadeIn>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Destek Ol">
        <div className="space-y-3 pb-2">
          {hasBankTransfer && (
            <div className="p-3.5 rounded-xl bg-paper border border-hairline">
              <div className="text-xs font-bold text-ink mb-1">Havale / EFT</div>
              <div className="text-[11px] text-mist mb-2">{SUPPORT_NAME}</div>
              <button
                onClick={handleCopyIban}
                className="min-h-[44px] w-full flex items-center justify-between gap-2 px-3 rounded-lg bg-card border border-hairline cursor-pointer"
              >
                <span className="font-numbers text-xs text-ink [overflow-wrap:anywhere] text-left">
                  {SUPPORT_IBAN}
                </span>
                {copied ? (
                  <CheckIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <CopyIcon className="w-4 h-4 text-mist shrink-0" />
                )}
              </button>
              {copied && (
                <div className="text-[11px] text-emerald-500 font-medium mt-1.5">Kopyalandı</div>
              )}
            </div>
          )}

          {hasCardPayment && (
            <a
              href={SUPPORT_PAYMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Kart ile destek ol, yeni sekmede açılır"
              className="min-h-[44px] flex items-center justify-between gap-2 p-3.5 rounded-xl bg-paper border border-hairline cursor-pointer"
            >
              <span className="text-xs font-bold text-ink">Kart ile destek</span>
              <ArrowSquareOutIcon className="w-4 h-4 text-mist shrink-0" />
            </a>
          )}

          <div className="p-3.5 rounded-xl bg-gold/10 border border-gold/20">
            <div className="text-xs font-bold text-gold-ink mb-2">Ücretsiz destek</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleShareApp}
                className="min-h-[44px] flex items-center gap-2 px-3 rounded-lg bg-card border border-hairline text-xs font-semibold text-ink cursor-pointer"
              >
                <ShareNetworkIcon className="w-4 h-4 shrink-0" /> Uygulamayı Paylaş
              </button>
              {hasStoreReview && (
                <a
                  href={SUPPORT_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Mağazada değerlendir, yeni sekmede açılır"
                  className="min-h-[44px] flex items-center gap-2 px-3 rounded-lg bg-card border border-hairline text-xs font-semibold text-ink cursor-pointer"
                >
                  <StarIcon className="w-4 h-4 shrink-0" /> Mağazada Değerlendir
                </a>
              )}
            </div>
          </div>

          <p className="text-micro text-mist text-center pt-1">
            Destekler gönüllüdür ve iade edilmez. Uygulamanın hiçbir özelliği ücretli değildir.
          </p>
        </div>
      </BottomSheet>
    </>
  );
};
