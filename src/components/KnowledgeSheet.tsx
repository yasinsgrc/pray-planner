import React from 'react';
import { BottomSheet } from './BottomSheet';
import { KnowledgeEntry } from '../data/knowledge';

interface KnowledgeSheetProps {
  entry: KnowledgeEntry;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Generic renderer for src/data/knowledge.ts entries (design-refresh-v3
 * Faz 7 F2) — title/sections/citation/warning note, reusable for future
 * reference topics beyond kerahet without a new component per topic.
 */
export const KnowledgeSheet: React.FC<KnowledgeSheetProps> = ({ entry, isOpen, onClose }) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={entry.title}>
      <div className="space-y-4 pb-2">
        {entry.sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <div className="text-label font-bold text-gold-ink mb-1">{section.heading}</div>
            )}
            <p className="text-sm text-ink leading-relaxed">{section.body}</p>
          </div>
        ))}

        <p className="text-[11px] text-mist pt-2 border-t border-hairline">{entry.sourceCitation}</p>

        <div className="p-3 rounded-xl bg-gold/10 border border-gold/20">
          <p className="text-[11px] text-mist leading-relaxed">{entry.warningNote}</p>
        </div>
      </div>
    </BottomSheet>
  );
};
