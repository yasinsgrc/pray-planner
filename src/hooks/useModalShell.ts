import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Shared full-screen/sheet modal chrome: #root inert, body scroll lock,
 * Escape-to-close, Tab focus trap, and initial focus. Extracted from
 * BottomSheet so LocationSearchScreen gets the same behavior without a
 * second, drifting implementation.
 */
export function useModalShell(
  isOpen: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>
) {
  // Read via a ref, not a dependency, inside the effect below. `onClose` is
  // an inline arrow function at nearly every call site (e.g. App.tsx), so
  // it gets a new identity on every parent render — and App re-renders
  // every second from its countdown timer. If `onClose` were a dependency,
  // this effect would tear down and re-run every second the sheet is open,
  // including its `.focus()` call — silently yanking focus back to the
  // sheet's first focusable element away from whatever the user had
  // actually focused (e.g. a search input), making it look like the field
  // stopped accepting keystrokes after ~1s (found via a real Playwright
  // repro, bisected to 4c6a411).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
      const node = ref.current;
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

    ref.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [isOpen]);
}
