import React from 'react';
import { KerahetInfo } from '../types';
import { KERAHET_SHORT_LABEL, formatKerahetRange } from '../utils/kerahetLabels';
import { KERAHET_WINDOW_DESCRIPTION } from '../data/strings';

interface KerahetStripProps {
  kerahetTimes: KerahetInfo[];
  timeZone: string;
  onOpenInfo: () => void;
}

/**
 * Persistent kerahet strip for the home screen — always shows all 3
 * windows (past/active/future) instead of only appearing when one happens
 * to be active, so it doesn't pop in and out of the layout unpredictably
 * (design-refresh-v3 F3). A 3-column grid instead of a horizontal-scroll
 * row: the scroll version measured wider than the viewport in a real
 * browser (its .no-scrollbar class was never even defined in index.css),
 * and a 3-equal-column grid can't overflow the shell width it lives in.
 * Every label opens the shared "Kerahet Vakitleri Nedir?" sheet
 * (design-refresh-v3 Faz 7 F2) so a curious user finds the answer right
 * where the question comes up.
 */
export const KerahetStrip: React.FC<KerahetStripProps> = ({ kerahetTimes, timeZone, onOpenInfo }) => {
  const now = new Date();
  const active = kerahetTimes.find((k) => k.isActiveNow) ?? null;

  return (
    <div className="w-full mt-1" data-testid="kerahet-strip">
      <button
        onClick={onOpenInfo}
        className="min-h-[44px] flex items-center text-label text-mist font-semibold cursor-pointer hover:text-gold-ink transition-colors"
      >
        Kerahet
      </button>
      <div className="grid grid-cols-3 gap-2">
        {kerahetTimes.map((k) => {
          const isPast = !k.isActiveNow && now > k.endTime;
          return (
            <button
              key={k.type}
              onClick={onOpenInfo}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg cursor-pointer ${k.isActiveNow ? 'bg-accent/10' : 'hover:bg-paper'}`}
              style={isPast ? { opacity: 0.4 } : undefined}
            >
              <span
                className={`text-[10px] font-semibold ${k.isActiveNow ? 'text-accent-ink' : 'text-ink'}`}
              >
                {KERAHET_SHORT_LABEL[k.type]}
              </span>
              <span className="font-numbers text-[10px] text-mist">{formatKerahetRange(k, timeZone)}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <p className="mt-1 text-micro text-mist text-center">
          {KERAHET_WINDOW_DESCRIPTION[active.type]}
        </p>
      )}
    </div>
  );
};
