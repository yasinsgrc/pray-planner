import React from 'react';
import { CompassIcon, HandHeartIcon, CalendarDotsIcon, BellIcon, Icon } from './icons';

interface QuickAccessChipsProps {
  onOpenQiblaModal: () => void;
  onOpenZikirmatikModal: () => void;
  onOpenMonthlySchedule: () => void;
  onOpenPushSettings: () => void;
}

/**
 * Ana ekranın ikinci boş alanı için hızlı erişim çipleri (design-refresh-v3
 * Faz 24 Commit 5) — her biri MEVCUT bir rotaya/aksiyona bağlanır, yeni bir
 * ekran yaratmaz: Kıble ve Tesbih zaten Maneviyat sekmesinde açılan aynı
 * sheet'leri açar, İmsakiye Vakitler sekmesine (aylık tablo zaten orada
 * render ediliyor), Bildirim Ayarlar sekmesine geçer.
 */
export const QuickAccessChips: React.FC<QuickAccessChipsProps> = ({
  onOpenQiblaModal,
  onOpenZikirmatikModal,
  onOpenMonthlySchedule,
  onOpenPushSettings,
}) => {
  const chips: { label: string; icon: Icon; onClick: () => void }[] = [
    { label: 'Kıble', icon: CompassIcon, onClick: onOpenQiblaModal },
    { label: 'Tesbih', icon: HandHeartIcon, onClick: onOpenZikirmatikModal },
    { label: 'İmsakiye', icon: CalendarDotsIcon, onClick: onOpenMonthlySchedule },
    { label: 'Bildirim', icon: BellIcon, onClick: onOpenPushSettings },
  ];

  return (
    <div className="w-full mt-1 grid grid-cols-4 gap-2">
      {chips.map(({ label, icon: ChipIcon, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="min-h-[44px] flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-card border border-hairline cursor-pointer hover:border-gold/40 transition-colors"
        >
          <ChipIcon className="w-4 h-4 text-gold-ink" />
          <span className="text-[10px] font-semibold text-ink">{label}</span>
        </button>
      ))}
    </div>
  );
};
