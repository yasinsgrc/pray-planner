import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './platform';

export function resolveStatusBarAppearance(isDarkMode: boolean): { lightStatusBarIcons: boolean } {
  return { lightStatusBarIcons: isDarkMode };
}

interface StatusBarAppearancePlugin {
  setAppearance(options: { lightStatusBarIcons: boolean }): Promise<void>;
}

const StatusBarAppearance = registerPlugin<StatusBarAppearancePlugin>('StatusBarAppearance');

export async function applyStatusBarAppearance(isDarkMode: boolean): Promise<void> {
  if (!isNativePlatform()) return;
  await StatusBarAppearance.setAppearance(resolveStatusBarAppearance(isDarkMode));
}
