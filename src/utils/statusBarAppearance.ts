import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './platform';
import { THEME_BG } from './themeColors';

export interface StatusBarAppearance {
  lightStatusBarIcons: boolean;
  // safe-area eklentisi eski WebView'lerde inset'i native padding olarak
  // veriyor; o şeridi CSS boyayamadığı için pencere/WebView zemini de
  // temaya göre native tarafta boyanmalı.
  backgroundColor: string;
}

export function resolveStatusBarAppearance(isDarkMode: boolean): StatusBarAppearance {
  return {
    lightStatusBarIcons: isDarkMode,
    backgroundColor: isDarkMode ? THEME_BG.dark : THEME_BG.light,
  };
}

interface StatusBarAppearancePlugin {
  setAppearance(options: StatusBarAppearance): Promise<void>;
}

const StatusBarAppearance = registerPlugin<StatusBarAppearancePlugin>('StatusBarAppearance');

export async function applyStatusBarAppearance(isDarkMode: boolean): Promise<void> {
  if (!isNativePlatform()) return;
  await StatusBarAppearance.setAppearance(resolveStatusBarAppearance(isDarkMode));
}
