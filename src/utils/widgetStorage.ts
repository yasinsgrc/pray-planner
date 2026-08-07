import { Preferences } from '@capacitor/preferences';
import { AppSettings } from '../types';
import { buildWidgetPayload } from './widgetBridge';
import { isNativePlatform } from './platform';

/**
 * Preferences' default group ("CapacitorStorage") backs a real Android
 * SharedPreferences file of the same name — the Kotlin widget provider
 * (Commit 4) reads this exact key from that same file via
 * `context.getSharedPreferences("CapacitorStorage", MODE_PRIVATE)`. Do not
 * override the group here without updating the widget side to match.
 */
export const WIDGET_PAYLOAD_KEY = 'vakit_widget_payload_v1';

/**
 * Writes the widget's 7-day payload to native SharedPreferences — a no-op
 * on web (design-refresh-v3 Faz 23 Commit 3): the payload only exists to
 * feed a native AppWidgetProvider, and Preferences on web would otherwise
 * silently write to localStorage for no reader to ever consume.
 */
export async function writeWidgetPayload(settings: AppSettings, now: Date = new Date()): Promise<void> {
  if (!isNativePlatform()) return;
  const payload = buildWidgetPayload(settings.location, settings.calculationMethod, now);
  await Preferences.set({ key: WIDGET_PAYLOAD_KEY, value: JSON.stringify(payload) });
}
