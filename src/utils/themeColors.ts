// Uygulama zemin rengi (index.css --bg-current) — tek kaynak. index.html
// theme-color meta'ları ve Android res vakit_bg aynı değerleri taşır;
// themeColors.test.ts hepsinin birebir eşit kaldığını kilitler.
export const THEME_BG = {
  light: '#F9F7F2',
  dark: '#1A1B1E',
} as const;
