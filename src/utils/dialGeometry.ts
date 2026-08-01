/**
 * Point on a circle at `fraction` of a full turn (0..1), measured clockwise
 * from 12 o'clock. No CSS transforms involved — every angle SunArcDial
 * needs is computed directly here, replacing the old -rotate-90 (parent) +
 * rotate() (per-element) combination that silently required both to agree
 * on the same reference point (a real bug, fixed once already, that a
 * polar-coordinate approach can't reintroduce the same way).
 */
export function polarPoint(cx: number, cy: number, r: number, fraction: number) {
  const theta = fraction * 2 * Math.PI;
  return {
    x: cx + r * Math.sin(theta),
    y: cy - r * Math.cos(theta),
  };
}

/** SVG path `d` for a clockwise arc from `startFrac` to `endFrac` (both 0..1 fractions of a full day). */
export function arcPath(cx: number, cy: number, r: number, startFrac: number, endFrac: number): string {
  const clampedEnd = Math.min(endFrac, startFrac + 0.9998); // SVG arcs can't span a full 360° in one command
  const start = polarPoint(cx, cy, r, startFrac);
  const end = polarPoint(cx, cy, r, clampedEnd);
  const span = (clampedEnd - startFrac) * 360;
  const largeArcFlag = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}
