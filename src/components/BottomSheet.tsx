import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, PanInfo, useDragControls } from 'motion/react';
import { XIcon } from './icons';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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

  // Read via a ref, not a dependency, inside the effect below. `onClose` is
  // an inline arrow function at nearly every call site (e.g. App.tsx), so
  // it gets a new identity on every parent render — and App re-renders
  // every second from its countdown timer. If `onClose` were a dependency,
  // this effect would tear down and re-run every second the sheet is open,
  // including its `.focus()` call — silently yanking focus back to the
  // sheet's first focusable element (e.g. LocationModal's GPS button) away
  // from whatever the user had actually focused (e.g. its search input),
  // making it look like the field stopped accepting keystrokes after ~1s
  // (found via a real Playwright repro, bisected to 4c6a411).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // design-refresh-v3 Faz 24 Commit 4 — the virtual keyboard shrinks
  // `visualViewport`, not the layout viewport; a `bottom-0`-pinned sheet
  // stays where it is relative to the (now keyboard-obscured) layout
  // viewport, so the focused input can end up hidden behind the keyboard.
  // Tracks how far the visual viewport's bottom edge has risen above the
  // layout viewport's, and feeds that into the sheet's own `animate.y` as a
  // `transform: translateY(...)` — never touches `bottom`, which wouldn't
  // react to visualViewport at all.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const updateOffset = () => {
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(offset > 0 ? offset : 0);
    };
    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
      setKeyboardOffset(0);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = sheetRef.current;
      if (!node) return;
      const focusable = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeydown);

    sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [isOpen]);

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
            animate={{ y: -keyboardOffset }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-[var(--shell-w)] mx-auto bg-card rounded-t-[28px] shadow-2xl max-h-[80dvh] flex flex-col"
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
              className="px-5 flex-1 min-h-0 overflow-y-auto overscroll-contain"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
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
