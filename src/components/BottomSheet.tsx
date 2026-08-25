import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, PanInfo, useDragControls } from 'motion/react';
import { XIcon } from './icons';
import { useModalShell } from '../hooks/useModalShell';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Shared bottom-sheet chrome for pickers and modals (replaces native
 * <select> per B10, and the centered-box modals per Faz 5 / B9). Renders
 * via a portal to document.body so `inert` on #root doesn't also disable
 * the sheet itself, since the sheet is then a sibling, not a descendant.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Keyboard height is handled by native adjustResize alone; dvh already
  // reflects the shrunk viewport, so no JS-side offset is needed here.

  useModalShell(isOpen, onClose, sheetRef);

  const handleDragEnd = (_e: PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            data-sheet-backdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
          />
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[var(--shell-w)] mx-auto bg-card rounded-t-[28px] shadow-2xl flex flex-col"
            style={{ maxHeight: '80dvh' }}
          >
            {/* Sürükleme yalnızca bu tutamaçtan başlar; içerik alanı normal kaydırılabilir kalır. */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-9 h-1 rounded-full bg-hairline" />
            </div>
            <div className="px-5 pb-2 flex items-center justify-between shrink-0">
              <h3 id={titleId} className="font-bold text-base text-ink">
                {title}
              </h3>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="p-3 rounded-full hover:bg-gold/10 text-mist cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div
              className="px-5 flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide"
              style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
