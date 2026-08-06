import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { CaretDownIcon } from './icons';
import { GENERATED_LICENSES } from '../data/licenses.generated';
import { EZAN_ATTRIBUTION } from '../data/ezanAttribution';

interface LicensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Design-refresh-v3 Faz 21 madde 3 — a bare package-name list does not
 * satisfy MIT's requirement that the license text + copyright notice
 * accompany distribution; this shows the actual text (licenses.generated.ts,
 * programmatically extracted from node_modules, never hand-transcribed) and
 * the full 5-part CC BY-SA 4.0 attribution for the ezan recording.
 */
export const LicensesModal: React.FC<LicensesModalProps> = ({ isOpen, onClose }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Lisanslar">
      <div className="space-y-4 pb-2">
        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">Ezan Sesi — CC BY-SA 4.0 Atfı</h3>
          <div className="p-3 rounded-xl bg-card border border-hairline space-y-1.5 text-[11px]">
            <div>
              <span className="text-mist">Eser: </span>
              <span className="text-ink font-medium">{EZAN_ATTRIBUTION.workTitle}</span>
            </div>
            <div>
              <span className="text-mist">Yükleyen: </span>
              <span className="text-ink font-medium">{EZAN_ATTRIBUTION.uploader}</span>
            </div>
            {/* min-h-[44px] doğrudan <a>'nın kendi kutusunda (inline-flex
                ile) — üstteki div'e koymak yalnızca satırı uzatır, linkin
                KENDİ dokunma kutusunu değil. Bitişik iki bağlantıyı
                ::before ile görünmez büyütmek (Tekrar Dene kalıbı) burada
                birbirine çok yakın durdukları için çakışmaya yol açardı. */}
            <div className="flex items-center gap-1">
              <span className="text-mist shrink-0">Kaynak:</span>
              <a
                href={EZAN_ATTRIBUTION.sourceUrl}
                className="text-gold-ink break-all inline-flex items-center min-h-[44px]"
              >
                {EZAN_ATTRIBUTION.sourceUrl}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-mist shrink-0">Lisans:</span>
              <a
                href={EZAN_ATTRIBUTION.licenseUrl}
                className="text-gold-ink break-all inline-flex items-center min-h-[44px]"
              >
                {EZAN_ATTRIBUTION.licenseUrl}
              </a>
            </div>
            <div>
              <span className="text-mist">Değişiklik: </span>
              <span className="text-ink">{EZAN_ATTRIBUTION.modificationStatement}</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gold-ink mb-2">Açık Kaynak Kütüphaneler</h3>
          <div className="space-y-2">
            {GENERATED_LICENSES.map((entry) => {
              const isOpenRow = expanded.has(entry.name);
              return (
                <div key={entry.name} className="rounded-xl bg-card border border-hairline overflow-hidden">
                  <button
                    onClick={() => toggle(entry.name)}
                    aria-expanded={isOpenRow}
                    className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-ink">
                      {entry.name} <span className="text-mist font-normal">v{entry.version}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gold-ink">{entry.license}</span>
                      <CaretDownIcon
                        className={`w-3.5 h-3.5 text-mist transition-transform ${isOpenRow ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </button>
                  {isOpenRow && (
                    <pre className="px-3 pb-3 text-[10px] text-mist whitespace-pre-wrap font-mono leading-relaxed">
                      {entry.licenseText}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
};
