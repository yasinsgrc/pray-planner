import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './platform';

interface FontScalePlugin {
  getFontScale(): Promise<{ fontScale: number }>;
}

const FontScale = registerPlugin<FontScalePlugin>('FontScale');

// Android'de sistem yazı boyutu --os-font-scale olarak html'e yazılır ve
// index.css'te --ui-scale (1..1.3) üzerinden rem'i ölçekler. Normalde
// FontScalePlugin bunu document-start script ile React'ten önce yazar;
// WebView DOCUMENT_START_SCRIPT desteklemiyorsa değer boş gelir ve render
// öncesi eklentiden okunur. Web/PWA'da değişken hiç yazılmaz (1 kalır).
export async function ensureOsFontScale(): Promise<void> {
  if (!isNativePlatform()) return;
  const style = document.documentElement.style;
  if (style.getPropertyValue('--os-font-scale') !== '') return;
  try {
    const { fontScale } = await FontScale.getFontScale();
    style.setProperty('--os-font-scale', String(fontScale));
  } catch {
    // Eklenti yoksa ölçek 1 kalır — uygulama yine açılmalı.
  }
}
