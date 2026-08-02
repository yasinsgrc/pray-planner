/**
 * "Destek Ol" seçenekleri tamamen ortam değişkenlerine bağlı — hiçbiri
 * koda gömülmez. Bir değişken tanımlı değilse ilgili seçenek hiç render
 * edilmez (bkz. SupportSection.tsx).
 */
export const SUPPORT_IBAN = import.meta.env.VITE_SUPPORT_IBAN as string | undefined;
export const SUPPORT_NAME = import.meta.env.VITE_SUPPORT_NAME as string | undefined;
export const SUPPORT_PAYMENT_URL = import.meta.env.VITE_SUPPORT_PAYMENT_URL as string | undefined;
export const SUPPORT_STORE_URL = import.meta.env.VITE_SUPPORT_STORE_URL as string | undefined;

export const hasBankTransfer = Boolean(SUPPORT_IBAN && SUPPORT_NAME);
export const hasCardPayment = Boolean(SUPPORT_PAYMENT_URL);
export const hasStoreReview = Boolean(SUPPORT_STORE_URL);
