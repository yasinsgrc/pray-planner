export function computeKeyboardOverlap(
  innerHeight: number,
  visualHeight: number,
  offsetTop: number
): number {
  const raw = innerHeight - visualHeight - offsetTop;
  if (raw < 80) return 0;
  return Math.round(raw);
}
