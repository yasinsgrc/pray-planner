import React from 'react';
import { KerahetInfo } from '../types';
import { KERAHET_SHORT_LABEL, formatKerahetRange } from '../utils/kerahetLabels';

interface KerahetStripProps {
  kerahetTimes: KerahetInfo[];
}

/**
 * Persistent kerahet strip for the home screen — always shows all 3
 * windows (past/active/future) instead of only appearing when one happens
 * to be active, so it doesn't pop in and out of the layout unpredictably
 * (design-refresh-v3 F3). A 3-column grid instead of a horizontal-scroll
 * row: the scroll version measured wider than the viewport in a real
 * browser (its .no-scrollbar class was never even defined in index.css),
 * and a 3-equal-column grid can't overflow the shell width it lives in.
 */
export const KerahetStrip: React.FC<KerahetStripProps> = ({ kerahetTimes }) => {
  const now = new Date();
  const active = kerahetTimes.find((k) => k.isActiveNow) ?? null;

  return (
    <div className="w-full mt-3">
      <div className="text-label text-mist font-semibold mb-1">Kerahet</div>
      <div className="grid grid-cols-3 gap-2">
        {kerahetTimes.map((k) => {
          const isPast = !k.isActiveNow && now > k.endTime;
          return (
            <div
              key={k.type}
              className={`flex flex-col items-center gap-0.5 py-1 rounded-lg ${k.isActiveNow ? 'bg-accent/10' : ''}`}
              style={isPast ? { opacity: 0.4 } : undefined}
            >
              <span
                className={`text-[10px] font-semibold ${k.isActiveNow ? 'text-accent' : 'text-ink'}`}
              >
                {KERAHET_SHORT_LABEL[k.type]}
              </span>
              <span className="font-numbers text-[10px] text-mist">{formatKerahetRange(k)}</span>
            </div>
          );
        })}
      </div>

      {active && (
        <p className="mt-1 text-micro text-mist text-center">
          Şu an kerahet vaktidir — nafile namaz kılınmaz.
        </p>
      )}
    </div>
  );
};
