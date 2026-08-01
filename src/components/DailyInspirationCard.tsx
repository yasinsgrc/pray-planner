import React, { useEffect, useState } from 'react';
import { BookOpenIcon, CopyIcon, CheckIcon, QuotesIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import { DAILY_INSPIRATIONS } from '../data/dailyContent';

export const DailyInspirationCard: React.FC = () => {
  const [tab, setTab] = useState<'verse' | 'hadith' | 'dua'>('verse');
  const [copied, setCopied] = useState(false);
  const [apiVerse, setApiVerse] = useState<{ verse: string; verseRef: string } | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);

  // Pick today's inspiration based on day of year
  const todayIndex = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  ) % DAILY_INSPIRATIONS.length;

  const content = DAILY_INSPIRATIONS[todayIndex] || DAILY_INSPIRATIONS[0];

  useEffect(() => {
    let ignore = false;

    fetch('/api/daily-verse')
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
  }, []);

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
            <BookOpenIcon className="w-4 h-4 text-gold" />
            <span className="text-sm font-bold text-ink">
              Günün Manevi Notu
            </span>
          </div>

          <div className="flex items-center gap-1 bg-paper p-1 rounded-xl">
            <button
              onClick={() => setTab('verse')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'verse'
                  ? 'bg-gold text-white'
                  : 'text-mist hover:text-ink'
              }`}
            >
              Âyet
            </button>
            <button
              onClick={() => setTab('hadith')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'hadith'
                  ? 'bg-gold text-white'
                  : 'text-mist hover:text-ink'
              }`}
            >
              Hadis
            </button>
            <button
              onClick={() => setTab('dua')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'dua'
                  ? 'bg-gold text-white'
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

              <div className="text-right text-xs font-semibold text-gold mt-3">
                {tab === 'verse' && verseRefText}
                {tab === 'hadith' && content.hadithRef}
                {tab === 'dua' && content.duaRef}
              </div>
            </>
          )}
        </div>

        {/* Kopyala / Paylaş */}
        <div className="flex items-center justify-end gap-4 border-t border-gray-100 dark:border-gray-800/40 pt-2.5">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs text-mist hover:text-gold transition-colors cursor-pointer"
          >
            <ShareNetworkIcon className="w-3.5 h-3.5" />
            <span>Paylaş</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-mist hover:text-gold transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Kopyalandı</span>
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
