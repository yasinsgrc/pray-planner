import React from 'react';
import { BottomSheet } from './BottomSheet';
import { ABOUT_USER_SECTIONS, ABOUT_VERIFIED_FACTS } from '../data/about';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFeedback: () => void;
  onOpenLicenses: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, onOpenFeedback, onOpenLicenses }) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Hakkında">
      <div className="space-y-4 pb-2 text-sm text-ink">
        {ABOUT_USER_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-bold text-gold-ink mb-2">{section.title}</h3>
            {section.body ? (
              <p className="text-xs leading-relaxed">{section.body}</p>
            ) : (
              <p className="text-xs text-danger-ink font-semibold">
                [Bu bölüm henüz doldurulmadı — src/data/about.ts içindeki ABOUT_USER_SECTIONS]
              </p>
            )}
          </section>
        ))}

        <div className="pt-3 border-t border-hairline space-y-3">
          {ABOUT_VERIFIED_FACTS.map((fact) => (
            <section key={fact.title}>
              <h3 className="text-xs font-bold text-ink mb-1">{fact.title}</h3>
              <p className="text-[11px] text-mist leading-relaxed">{fact.body}</p>
            </section>
          ))}
        </div>

        <div className="pt-3 border-t border-hairline">
          <button
            onClick={onOpenLicenses}
            className="min-h-[44px] flex items-center text-xs font-semibold text-gold-ink cursor-pointer hover:underline"
          >
            Lisanslar (tam metin) →
          </button>
        </div>

        <div className="pt-3 border-t border-hairline">
          <button
            onClick={onOpenFeedback}
            className="min-h-[44px] flex items-center text-xs font-semibold text-gold-ink cursor-pointer hover:underline"
          >
            Yanlış bir şey mi gördünüz? Geri bildirim gönderin →
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
