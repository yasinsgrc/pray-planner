/**
 * Kalan saniyeyi dakikaya çeviren tek kaynak. Halkanın kendi saniyeli
 * sayacından ayrı olarak, "X dk kaldı/sonra" diyen her yer (kerahet kartı,
 * ekran okuyucu anonsu) bu formülü kullanmalı — aksi halde aynı an için
 * iki farklı sayı gösterilir.
 */
export function remainingMinutesCeil(remainingSeconds: number): number {
  return Math.max(1, Math.ceil(remainingSeconds / 60));
}
