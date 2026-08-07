import React from 'react';
import { BellIcon } from './icons';

interface PushNotificationHintProps {
  onOpenSettings: () => void;
  onDismiss: () => void;
}

/**
 * PWA'da bildirim izni açıkça istenmediği sürece verilmez — kullanıcı
 * bunu hiç fark etmeyebilir. App.tsx'teki çevrimdışı/güncelleme/konum
 * önerisi şeritleriyle aynı desende, tek seferlik ve kapatılabilir
 * (design-refresh-v3 Faz 22 Commit 4). Otomatik izin isteme yok — Ayarlar
 * yalnızca sekmeye götürür, izin isteği kullanıcının oradaki açık
 * eylemiyle tetiklenir.
 */
export const PushNotificationHint: React.FC<PushNotificationHintProps> = ({ onOpenSettings, onDismiss }) => {
  return (
    <div className="w-full max-w-[var(--shell-w)] mx-auto px-4 mt-2">
      <div className="p-3 rounded-xl bg-card border border-hairline">
        <div className="flex items-start gap-2">
          <BellIcon className="w-4 h-4 text-gold-ink shrink-0 mt-0.5" />
          <p className="text-xs text-ink flex-1">Vakit bildirimleri kapalı — açmak için Ayarlar'a gidin.</p>
        </div>
        <div className="flex items-center justify-end gap-4 mt-2">
          <button
            onClick={onDismiss}
            className="min-h-[44px] px-3 text-xs font-semibold text-mist hover:text-ink transition-colors cursor-pointer"
          >
            Kapat
          </button>
          <button
            onClick={onOpenSettings}
            className="min-h-[44px] px-3 text-xs font-semibold text-gold-ink hover:underline cursor-pointer"
          >
            Ayarlar
          </button>
        </div>
      </div>
    </div>
  );
};
