import React, { useEffect, useState } from 'react';
import { BookOpen, Copy, Check, Quote, Share2 } from 'lucide-react';
import { DAILY_INSPIRATIONS } from '../data/dailyContent';

export const DailyInspirationCard: React.FC = () => {
  const [tab, setTab] = useState<'verse' | 'hadith' | 'dua'>('verse');
  const [copied, setCopied] = useState(false);
  const [apiVerse, setApiVerse] = useState<{ verse: string; verseRef: string } | null>(null);

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
      });

    return () => {
      ignore = true;
    };
  }, []);

  const verseText = apiVerse?.verse ?? content.verse;
  const verseRefText = apiVerse?.verseRef ?? content.verseRef;

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

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4">
      <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm space-y-4">
        {/* Üst Sekme Başlıkları */}
        <div className="flex items-center justify-between border-b border-[#D6A84D]/15 pb-2.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#D6A84D]" />
            <span className="text-sm font-bold text-[var(--ink)] font-serif-title">
              Günün Manevi Notu
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-xl">
            <button
              onClick={() => setTab('verse')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'verse'
                  ? 'bg-[#D6A84D] text-white'
                  : 'text-[var(--mist)] hover:text-[var(--ink)]'
              }`}
            >
              Âyet
            </button>
            <button
              onClick={() => setTab('hadith')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'hadith'
                  ? 'bg-[#D6A84D] text-white'
                  : 'text-[var(--mist)] hover:text-[var(--ink)]'
              }`}
            >
              Hadis
            </button>
            <button
              onClick={() => setTab('dua')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                tab === 'dua'
                  ? 'bg-[#D6A84D] text-white'
                  : 'text-[var(--mist)] hover:text-[var(--ink)]'
              }`}
            >
              Dua
            </button>
          </div>
        </div>

        {/* Metin İçeriği */}
        <div className="relative py-2">
          <Quote className="w-8 h-8 text-[#D6A84D]/15 absolute -top-1 -left-2 pointer-events-none" />

          <p className="text-sm font-serif-title text-[var(--ink)] leading-relaxed italic relative z-10 px-2">
            {tab === 'verse' && verseText}
            {tab === 'hadith' && content.hadith}
            {tab === 'dua' && content.dua}
          </p>

          <div className="text-right text-xs font-semibold text-[#D6A84D] mt-3">
            {tab === 'verse' && verseRefText}
            {tab === 'hadith' && content.hadithRef}
            {tab === 'dua' && content.duaRef}
          </div>
        </div>

        {/* Kopyala / Paylaş */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800/40 pt-2.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[var(--mist)] hover:text-[#D6A84D] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopyala</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
