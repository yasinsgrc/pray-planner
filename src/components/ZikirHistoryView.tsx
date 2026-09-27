import React, { useMemo, useState } from 'react';
import { CaretLeftIcon } from './icons';
import { PRESET_DHIKRS, ZikirLog, getZikirHistory, getZikirTrend } from '../utils/zikirmatikStorage';

interface ZikirHistoryViewProps {
  zikirLog: ZikirLog;
  /** "YYYY-MM-DD" of today in the selected location's zone. */
  todayKey: string;
  onBack: () => void;
}

const TREND_DAYS = 14;

// dateKey'ler "YYYY-MM-DD" takvim günü; UTC gece yarısına kurup UTC'de
// biçimlendirmek cihaz dilimi ne olursa olsun günü kaydırmaz.
const dayMonthFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('tr-TR');

function keyToUtcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatHistoryDay(dateKey: string, todayKey: string): { title: string; subtitle: string } {
  const date = keyToUtcDate(dateKey);
  const yesterday = keyToUtcDate(todayKey);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const weekday = weekdayFormat.format(date);
  if (dateKey === todayKey) return { title: 'Bugün', subtitle: `${dayMonthFormat.format(date)} ${weekday}` };
  if (date.getTime() === yesterday.getTime()) return { title: 'Dün', subtitle: `${dayMonthFormat.format(date)} ${weekday}` };
  return { title: dayMonthFormat.format(date), subtitle: weekday };
}

const targetByTitle = new Map(PRESET_DHIKRS.map((d) => [d.title, d.target]));

/**
 * Zikir Geçmişi — özet kartı (30 gün toplamı, aktif gün, 14 günlük sütun
 * grafiği) + gün kartları. Yalnızca tema token'ları kullanır (card, hairline,
 * gold, gold-ink, ink, mist); açık/koyu tema kendiliğinden uyar. Metin hiçbir
 * zaman seri renginde değil, ink/mist/gold-ink'te.
 */
export const ZikirHistoryView: React.FC<ZikirHistoryViewProps> = ({ zikirLog, todayKey, onBack }) => {
  const history = useMemo(() => getZikirHistory(zikirLog), [zikirLog]);
  const trend = useMemo(() => getZikirTrend(zikirLog, todayKey, TREND_DAYS), [zikirLog, todayKey]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthTotal = history.reduce((sum, day) => sum + day.total, 0);
  const activeDays = history.length;
  const trendMax = Math.max(1, ...trend.map((d) => d.total));

  const selected = selectedKey ? trend.find((d) => d.dateKey === selectedKey) : undefined;
  const caption = selected
    ? `${formatHistoryDay(selected.dateKey, todayKey).title} · ${numberFormat.format(selected.total)} zikir`
    : `Son ${TREND_DAYS} gün`;

  return (
    <div className="space-y-4 pb-2">
      <button
        onClick={onBack}
        className="relative flex items-center gap-1 text-xs text-mist hover:text-ink transition-colors cursor-pointer before:content-[''] before:absolute before:-inset-3"
      >
        <CaretLeftIcon className="w-3.5 h-3.5" /> Zikirmatiğe dön
      </button>

      {history.length === 0 ? (
        <div className="rounded-2xl bg-card border border-hairline px-5 py-10 text-center">
          <div className="font-arabic text-2xl text-gold-ink" lang="ar" dir="rtl">
            سُبْحَانَ اللَّهِ
          </div>
          <p className="mt-3 text-sm font-semibold text-ink">Henüz kayıtlı zikir yok</p>
          <p className="mt-1 text-xs text-mist">Çektiğin zikirler burada gün gün birikir.</p>
        </div>
      ) : (
        <>
          {/* Özet kartı */}
          <section className="rounded-2xl bg-card border border-hairline p-4" aria-label="Son 30 gün özeti">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <div className="text-label text-mist">Son 30 gün</div>
                <div className="mt-1 font-numbers text-3xl font-extrabold tracking-tight text-gold-ink">
                  {numberFormat.format(monthTotal)}
                </div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-label text-mist">Zikirli gün</div>
                <div className="mt-1 font-numbers text-3xl font-extrabold tracking-tight text-ink">
                  {activeDays}
                  <span className="text-sm font-semibold text-mist"> / 30</span>
                </div>
              </div>
            </div>

            {/* 14 günlük sütun grafiği: tek seri → tek renk (gold), bugün tam
                ton, diğer günler aynı tonun yarı saydamı; boş gün ince çizgi. */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-micro">
                <span className="text-mist" aria-live="polite">{caption}</span>
                {trend.some((d) => d.total > 0) && (
                  <span className="font-numbers text-mist">en çok {numberFormat.format(trendMax)}</span>
                )}
              </div>
              <div className="mt-2 flex items-end gap-[2px] h-14" role="list" aria-label={`Son ${TREND_DAYS} günün zikir sayıları`}>
                {trend.map((day) => {
                  const isToday = day.dateKey === todayKey;
                  const isSelected = day.dateKey === selectedKey;
                  const pct = day.total > 0 ? Math.max(8, (day.total / trendMax) * 100) : 0;
                  const label = formatHistoryDay(day.dateKey, todayKey).title;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      role="listitem"
                      aria-label={`${label}: ${day.total} zikir`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedKey(isSelected ? null : day.dateKey)}
                      className="flex-1 h-full flex items-end cursor-pointer"
                    >
                      {day.total > 0 ? (
                        <span
                          className={`block w-full rounded-t-[4px] transition-opacity ${
                            isToday || isSelected ? 'bg-gold' : 'bg-gold opacity-55'
                          } ${isSelected ? 'ring-2 ring-gold/40' : ''}`}
                          style={{ height: `${pct}%` }}
                        />
                      ) : (
                        <span className="block w-full h-[2px] rounded-full bg-hairline" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-micro text-mist">
                <span>{formatHistoryDay(trend[0].dateKey, todayKey).title}</span>
                <span>Bugün</span>
              </div>
            </div>
          </section>

          {/* Gün kartları */}
          <div>
            <h3 className="text-label text-mist mb-2 px-1">Günler</h3>
            <ul className="space-y-2.5">
              {history.map((day) => {
                const { title, subtitle } = formatHistoryDay(day.dateKey, todayKey);
                const dayMax = day.entries[0]?.[1] ?? 1;
                return (
                  <li key={day.dateKey} className="rounded-2xl bg-card border border-hairline px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{title}</div>
                        <div className="text-micro text-mist capitalize">{subtitle}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-numbers text-xs font-bold text-gold-ink">
                        {numberFormat.format(day.total)}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2.5">
                      {day.entries.map(([dhikr, count]) => {
                        const target = targetByTitle.get(dhikr);
                        const laps = target ? Math.floor(count / target) : 0;
                        return (
                          <li key={dhikr}>
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <span className="min-w-0 text-ink font-medium">
                                {dhikr}
                                {laps > 0 && <span className="ml-1.5 text-micro text-mist">{laps} tur</span>}
                              </span>
                              <span className="shrink-0 font-numbers font-semibold text-ink">{numberFormat.format(count)}</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-gold/15 overflow-hidden" aria-hidden="true">
                              <div className="h-full rounded-full bg-gold" style={{ width: `${(count / dayMax) * 100}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <p className="text-center text-micro text-mist">Son 30 gün saklanır · sıfırlanan zikirler geçmişten düşer.</p>
    </div>
  );
};
