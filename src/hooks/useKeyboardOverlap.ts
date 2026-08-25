import { useEffect, useState } from 'react';
import { computeKeyboardOverlap } from '../utils/keyboardOverlap';

/**
 * Tracks how much of the layout viewport's bottom is covered by the
 * on-screen keyboard, using visualViewport rather than dvh so it works
 * whether or not the platform actually resizes the layout viewport (see
 * computeKeyboardOverlap for why the formula self-corrects either way).
 */
export function useKeyboardOverlap(): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const next = computeKeyboardOverlap(window.innerHeight, vv.height, vv.offsetTop);
      setOverlap((prev) => (prev === next ? prev : next));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return overlap;
}
