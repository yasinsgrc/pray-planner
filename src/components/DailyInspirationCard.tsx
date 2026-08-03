import React, { useEffect, useState } from 'react';
import { BookOpenIcon, CopyIcon, CheckIcon, QuotesIcon, ShareNetworkIcon } from './icons';
import { DAILY_INSPIRATIONS } from '../data/dailyContent';
import { useApiAvailable } from '../hooks/useApiAvailable';
import { apiUrl } from '../utils/apiBaseUrl';

export const DailyInspirationCard: React.FC = () => {
  const [tab, setTab] = useState<'verse' | 'hadith' | 'dua'>('verse');
  const [copied, setCopied] = useState(false);
  const [apiVerse, setApiVerse] = useState<{ verse: string; verseRef: string } | null>(null);
  const apiAvailable = useApiAvailable();
  // Sunucu yokken zaten sessizce statik havuza düşüyordu (aşağıdaki catch),
  // yani "çalışıyordu" — ama her açılışta gereksiz bir istek (ve statik
  // dağıtımda tüm SPA fallback HTML'inin indirilmesi) anlamına geliyordu.
  // apiAvailable === true olana kadar deneme bile yapılmaz (design-refresh-v3
  // Faz 9 M2); null iken (kontrol sürüyor) iskelet zaten aynı görünür.
  const [verseLoading, setVerseLoading] = useState(true);

  // Pick today's inspiration based on day of year
  const todayIndex = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  ) % DAILY_INSPIRATIONS.length;

  const content = DAILY_INSPIRATIONS[todayIndex] || DAILY_INSPIRATIONS[0];

  useEffect(() => {
    if (apiAvailable === null) return; // henüz bilinmiyor — bekle
    if (apiAvailable === false) {
      setVerseLoading(false);
      return;
    }

    let ignore = false;

    fetch(apiUrl('/api/daily-verse'))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!ignore && data?.verse && data?.verseRef) {
          setApiVerse({ verse: data.verse, verseRef: data.verseRef });
        }
      })
      .catch(() => {
        // Ağ hatası: sessizce statik havuzdaki ayete düş
      })
      .finally(() => {
        if (!ignore) setVerseLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [apiAvailable]);

  const verseText = apiVerse?.verse ?? content.verse;
  const verseRefText = apiVerse?.verseRef ?? content.verseRef;
  const isLoadingCurrentTab = tab === 'verse' && verseLoading;

  const getTextToCopy = () => {
    if (tab === 'verse') return `"${verseText}" — ${verseRefText}`;
    if (tab === 'hadith') return `"${content.hadith}" — ${content.hadithRef}`;
    return `"${content.dua}" — ${content.duaRef}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getTextToCopy());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = getTextToCopy();
    if (navigator.share) {
      try {
        await navigator.share({ text, title: 'VAKİT — Günün Manevi Notu' });
      } catch {
        // Kullanıcı paylaşımı iptal etti: sessizce yok say
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 py-4">
      <div className="p-5 rounded-2xl bg-card border border-hairline shadow-sm space-y-4">
        {/* Üst Sekme Başlıkları */}
        <div className="flex items-center justify-between border-b border-gold/15 pb-2.5">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4 text-gold-ink" />
            <span className="text-sm font-bold text-ink">
              Günün Manevi Notu
            </span>
          </div>

          <div className="flex items-center gap-1 bg-paper p-1 rounded-xl">
            <button
              onClick={() => setTab('verse')}
              className={`relative px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer before:content-[''] before:absolute before:-top-3 before:-bottom-3 before:-left-0.5 before:-right-0.5 ${
                tab === 'verse'
                  ? 'bg-gold text-on-gold'
                  : 'text-mist hover:text-ink'
              }`}
            >
              Âyet
            </button>
            <button
              onClick={() => setTab('hadith')}
              className={`relative px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer before:content-[''] before:absolute before:-top-3 before:-bottom-3 before:-left-0.5 before:-right-0.5 ${
                tab === 'hadith'
                  ? 'bg-gold text-on-gold'
                  : 'text-mist hover:text-ink'
              }`}
            >
              Hadis
            </button>
            <button
              onClick={() => setTab('dua')}
              className={`relative px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer before:content-[''] before:absolute before:-top-3 before:-bottom-3 before:-left-0.5 before:-right-0.5 ${
                tab === 'dua'
                  ? 'bg-gold text-on-gold'
                  : 'text-mist hover:text-ink'
              }`}
            >
              Dua
            </button>
          </div>
        </div>

        {/* Metin İçeriği */}
        <div className="relative py-2 min-h-[88px]">
          <QuotesIcon className="w-8 h-8 text-gold/15 absolute -top-1 -left-2 pointer-events-none" />

          {isLoadingCurrentTab ? (
            <div className="space-y-2 px-2 animate-pulse" aria-hidden="true">
              <div className="h-4 rounded bg-mist/20 w-full" />
              <div className="h-4 rounded bg-mist/20 w-5/6" />
              <div className="h-3 rounded bg-mist/20 w-1/3 ml-auto mt-3" />
            </div>
          ) : (
            <>
              <p className="text-xl font-serif-title text-ink leading-[1.55] italic relative z-10 px-2">
                {tab === 'verse' && verseText}
                {tab === 'hadith' && content.hadith}
                {tab === 'dua' && content.dua}
              </p>

              <div className="text-right text-xs font-semibold text-gold-ink mt-3">
                {tab === 'verse' && verseRefText}
                {tab === 'hadith' && content.hadithRef}
                {tab === 'dua' && content.duaRef}
              </div>
            </>
          )}
        </div>

        {/* Kopyala / Paylaş */}
        <div className="flex items-center justify-end gap-4 border-t border-hairline pt-2.5">
          <button
            onClick={handleShare}
            className="relative flex items-center gap-1.5 text-xs text-mist hover:text-gold transition-colors cursor-pointer before:content-[''] before:absolute before:-top-4 before:-bottom-4 before:-left-1.5 before:-right-1.5"
          >
            <ShareNetworkIcon className="w-3.5 h-3.5" />
            <span>Paylaş</span>
          </button>
          <button
            onClick={handleCopy}
            className="relative flex items-center gap-1.5 text-xs text-mist hover:text-gold transition-colors cursor-pointer before:content-[''] before:absolute before:-top-4 before:-bottom-4 before:-left-1.5 before:-right-1.5"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-success-ink" />
                <span className="text-success-ink font-medium">Kopyalandı</span>
              </>
            ) : (
              <>
                <CopyIcon className="w-3.5 h-3.5" />
                <span>Kopyala</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
