/**
 * Kalan milisaniyeyi dakikaya çeviren tek kaynak. "X dk kaldı" diyen her
 * yer bu formülü kullanmalı — aksi halde aynı an için iki farklı sayı
 * gösterilir. Aşağı yuvarlar (namaz için güvenli taraf: az süre göstermek,
 * fazla değil) ve negatif değerleri 0'a clamp eder.
 */
export function formatRemainingMinutes(remainingMs: number): number {
  return Math.max(0, Math.floor(remainingMs / 60000));
}
