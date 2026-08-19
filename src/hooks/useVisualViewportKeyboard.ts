import { useEffect, useState } from 'react';

const KB_HEIGHT_PROPERTY = '--kb-height';

export function computeKeyboardOffset(
  windowInnerHeight: number,
  vvHeight: number,
  vvOffsetTop: number
): number {
  const offset = windowInnerHeight - (vvHeight + vvOffsetTop);
  return offset > 0 ? offset : 0;
}

/**
 * Tracks how far the on-screen keyboard has shrunk `visualViewport`. Writes
 * the value onto `--kb-height` (document.documentElement) so CSS calc()s
 * (max-height, padding) can react without a React re-render, and also
 * returns the same number for callers that need it as a Framer Motion
 * `animate` value — Framer owns the `transform` property once it's
 * animating `y`, so a CSS-var-driven `transform` on that same element would
 * just get overwritten.
 */
export function useVisualViewportKeyboard(active: boolean): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const root = document.documentElement;
    let frameId = 0;

    const applyOffset = () => {
      frameId = 0;
      const next = computeKeyboardOffset(window.innerHeight, vv.height, vv.offsetTop);
      root.style.setProperty(KB_HEIGHT_PROPERTY, `${next}px`);
      setOffset(next);
    };
    const scheduleApply = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(applyOffset);
    };

    scheduleApply();
    vv.addEventListener('resize', scheduleApply);
    vv.addEventListener('scroll', scheduleApply);

    return () => {
      vv.removeEventListener('resize', scheduleApply);
      vv.removeEventListener('scroll', scheduleApply);
      if (frameId) cancelAnimationFrame(frameId);
      root.style.removeProperty(KB_HEIGHT_PROPERTY);
      setOffset(0);
    };
  }, [active]);

  return offset;
}
