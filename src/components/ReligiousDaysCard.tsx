import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { MoonStarsIcon } from './icons';
import { LocationItem } from '../types';
import { resolveTimeZone } from '../utils/timezone';
import { getUpcomingReligiousDays } from '../utils/religiousDaysSchedule';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatDateKey(dateKey: string): string {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${day} ${MONTH_NAMES_TR[month - 1]}`;
}

interface ReligiousDaysCardProps {
  location: LocationItem;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Design-refresh-v3 Faz 19 Ekleme 5. Yalnızca isim ve tarih gösterir — dini
 * yorum, fazilet anlatımı veya hadis metni ÜRETİLMEZ (kullanıcı isteği).
 * Tarihler religiousDays.ts'ten (Diyanet'in resmi yayınından elle girilmiş,
 * hesaplanmamış) gelir; getUpcomingReligiousDays veri tükendiğinde boş dizi
 * döner, bu durumda "takvim güncellenecek" gösterilir.
 */
export const ReligiousDaysCard: React.FC<ReligiousDaysCardProps> = ({ location }) => {
  const timeZone = resolveTimeZone(location);
  const upcoming = useMemo(() => getUpcomingReligiousDays(new Date(), timeZone), [timeZone]);

  const next = upcoming[0];
  const rest = upcoming.slice(1, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.145, duration: 0.5, ease: EASE }}
      className="w-full max-w-[var(--shell-w)] mx-auto px-4 mt-3"
    >
      <div className="p-4 rounded-2xl bg-card border border-hairline">
        <div className="flex items-center gap-1.5 text-label text-mist font-bold mb-2">
          <MoonStarsIcon className="w-3.5 h-3.5 text-gold-ink" />
          <span>Dini Günler ve Kandiller</span>
        </div>

        {!next ? (
          <p className="text-sm text-mist">Takvim güncellenecek</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-numbers text-2xl font-extrabold text-gold-ink">
                {next.daysRemaining}
              </span>
              <span className="text-sm text-mist">
                gün kaldı · <span className="font-semibold text-ink">{next.name}</span>
                <span className="text-mist"> ({formatDateKey(next.date)})</span>
              </span>
            </div>

            {rest.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-hairline/50 pt-3">
                {rest.map((entry) => (
                  <li
                    key={`${entry.date}-${entry.name}`}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-ink">{entry.name}</span>
                    <span className="text-mist font-numbers">
                      {formatDateKey(entry.date)} · {entry.daysRemaining} gün
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
