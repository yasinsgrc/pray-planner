// Navbar: etiketler eşit sütunlara bölünür; her etiketin doğal genişliği
// kendi sütununun içerik genişliğine (sütun − iki yan padding) sığmalı.
// Değerler ölçümden gelir, sabit piksel eşiği yok.
export function allNavLabelsFit(labelWidths: number[], rowContentWidth: number, tabPaddingX: number): boolean {
  const columnContent = rowContentWidth / labelWidths.length - 2 * tabPaddingX;
  return labelWidths.every((w) => w <= columnContent);
}

// Bir metin kutusunun kaç satıra sardığı (yükseklik / line-height).
export function lineCount(height: number, lineHeight: number): number {
  return Math.round(height / lineHeight);
}
