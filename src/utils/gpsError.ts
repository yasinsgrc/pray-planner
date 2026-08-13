const TIMEOUT_MESSAGE =
  'Konum alma zaman aşımına uğradı. Tekrar deneyebilir veya listeden şehir seçebilirsiniz.';
const GENERIC_MESSAGE = 'Konum alınamadı. Aşağıdaki listeden şehir seçebilirsiniz.';

/**
 * PERMISSION_DENIED (code 1) tarayıcıda "Tarayıcı ayarları"na, native'de
 * (Capacitor'ün kendi izin promptu reddedildiğinde) telefonun sistem
 * ayarlarına yönlendirmeli — aynı metin ikisinde de yanlış yer gösterir
 * (Faz 26 Commit 1).
 */
export function getGpsErrorMessage(code: number, isNative: boolean): string {
  if (code === 1) {
    return isNative
      ? 'Konum izni verilmedi. Telefon ayarlarından VAKİT\'e konum izni verebilirsiniz.'
      : 'Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açabilirsiniz.';
  }
  if (code === 3) {
    return TIMEOUT_MESSAGE;
  }
  return GENERIC_MESSAGE;
}
