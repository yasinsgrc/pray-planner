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
 * (design-refresh-v3 F3).
 */
export const KerahetStrip: React.FC<KerahetStripProps> = ({ kerahetTimes }) => {
  const now = new Date();
  const active = kerahetTimes.find((k) => k.isActiveNow) ?? null;

  return (
    <div className="w-full mt-3">
      <div className="flex items-center gap-2 text-micro overflow-x-auto no-scrollbar">
        <span className="text-label text-mist font-semibold shrink-0">Kerahet</span>
        {kerahetTimes.map((k) => {
          const isPast = !k.isActiveNow && now > k.endTime;
          return (
            <div
              key={k.type}
              className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full ${
                k.isActiveNow ? 'bg-accent/10' : ''
              }`}
              style={isPast ? { opacity: 0.4 } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: k.isActiveNow ? 'var(--accent)' : 'transparent',
                  border: k.isActiveNow ? 'none' : '1.5px solid var(--mist)',
                }}
                aria-hidden="true"
              />
              <span className={k.isActiveNow ? 'text-accent font-semibold' : 'text-mist'}>
                {KERAHET_SHORT_LABEL[k.type]} {formatKerahetRange(k)}
              </span>
            </div>
          );
        })}
      </div>

      {active && (
        <p className="mt-1 text-micro text-mist">
          Şu an kerahet vaktidir — nafile namaz kılınmaz.
        </p>
      )}
    </div>
  );
};
