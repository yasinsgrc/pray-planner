import { Preferences } from '@capacitor/preferences';
import { registerPlugin } from '@capacitor/core';
import { AppSettings } from '../types';
import { buildWidgetPayload } from './widgetBridge';
import { isNativePlatform } from './platform';
import { ESMA_UL_HUSNA, EsmaName } from '../data/esmaulHusna';

/**
 * App-local Capacitor eklentisi (ayrı bir npm paketi değil —
 * android/app/src/main/java/com/vakit/widget/WidgetBridgePlugin.kt).
 * Yeni yük yazıldıktan hemen sonra widget'ı yeniden çizdirir; aksi halde
 * yeni veri ancak bir sonraki vakit sınırı alarmına kadar (saatler
 * sürebilir) görünmezdi (design-refresh-v3 Faz 23 Commit 4).
 */
interface WidgetBridgePlugin {
  refresh(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/**
 * Preferences' default group ("CapacitorStorage") backs a real Android
 * SharedPreferences file of the same name — the Kotlin widget provider
 * (Commit 4) reads this exact key from that same file via
 * `context.getSharedPreferences("CapacitorStorage", MODE_PRIVATE)`. Do not
 * override the group here without updating the widget side to match.
 */
export const WIDGET_PAYLOAD_KEY = 'vakit_widget_payload_v1';

/**
 * Günün Esması widget'ının SharedPreferences anahtarı. Vakit widget'larından
 * tamamen bağımsız bir yük/receiver zinciri — bkz. EsmaWidgetProvider.kt.
 */
export const ESMA_PAYLOAD_KEY = 'vakit_esma_payload_v1';

export interface EsmaWidgetPayload {
  schemaVersion: 1;
  names: EsmaName[];
}

/**
 * Native taraf günün ismini kendisi seçer (DAY_OF_YEAR % names.length);
 * bu yüzden JS burada tek bir isim seçmez, ESMA_UL_HUSNA'nın tamamını yazar.
 */
export function buildEsmaPayload(): EsmaWidgetPayload {
  return { schemaVersion: 1, names: ESMA_UL_HUSNA };
}

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
  await Preferences.set({ key: ESMA_PAYLOAD_KEY, value: JSON.stringify(buildEsmaPayload()) });
  await WidgetBridge.refresh();
}
