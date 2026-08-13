import React, { useState } from 'react';
import { Dua, DUALAR } from '../data/dualar';

interface DuaCardProps {
  /** Test seam — production always uses DUALAR[0]. Lets height/behavior
   * tests use short representative fixture text instead of the long
   * bracketed placeholder strings in dualar.ts (which are explanatory
   * markers for the user to replace, not representative of real dua
   * length — Faz 25 Commit 2). */
  dua?: Dua;
}

const PANEL_ID = 'dua-card-panel';

/**
 * Ana ekrandaki sabit dua kartı — imsak ilerleme çubuğunun yerini aldı
 * (Faz 25 Commit 2). Kapalı: Arapça + okunuş + meal (üçü de her zaman
 * görünür, sırasıyla üst üste). Dokununca yalnızca kaynak açılır.
 */
export const DuaCard: React.FC<DuaCardProps> = ({ dua = DUALAR[0] }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full mt-1 rounded-xl bg-card border border-hairline">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={PANEL_ID}
        className="w-full min-h-[44px] flex flex-col items-center gap-1 text-center px-3 py-2 cursor-pointer"
      >
        <p dir="rtl" lang="ar" className="w-full font-arabic text-gold-ink" style={{ fontSize: '22px', lineHeight: 2 }}>
          {dua.arabic}
        </p>
        <p className="w-full text-micro text-ink normal-case">{dua.transliteration}</p>
        <p className="w-full text-micro text-mist normal-case">{dua.meaning}</p>

        <div id={PANEL_ID} hidden={!expanded} className="w-full mt-1 pt-1.5 border-t border-hairline/50">
          <p className="text-micro text-gold-ink normal-case">{dua.source}</p>
        </div>
      </button>
    </div>
  );
};
