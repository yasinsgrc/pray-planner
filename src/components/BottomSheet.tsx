import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { XIcon } from '@phosphor-icons/react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Shared bottom-sheet chrome for in-brand pickers (replaces native <select>, see B10). */
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto bg-card rounded-t-[28px] shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-hairline" />
            </div>
            <div className="px-5 pb-2 flex items-center justify-between shrink-0">
              <h3 className="font-serif-title font-bold text-base text-ink">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-mist cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div
              className="px-5 overflow-y-auto"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
