import { LocalNotifications } from '@capacitor/local-notifications';
import { AppSettings } from '../types';
import { buildPushSchedule } from './pushSchedule';
import { buildLocalNotificationRequests, EZAN_CHANNEL_ID, SILENT_CHANNEL_ID } from './notificationScheduler';

/** android/app/src/main/res/raw/ezan.mp3 — a bit-for-bit copy of public/sounds/ezan.mp3, verified identical by licenses.test.ts's SHA1 check. */
const EZAN_SOUND_FILE = 'ezan.mp3';

export type NativeNotificationResult = { ok: true } | { ok: false; reason: string };

/**
 * Android 8+ locks a channel's sound in at creation time — calling this
 * with the same channel id again is a safe no-op (design-refresh-v3 Faz 23
 * Commit 2). Both channels are created up front, even though every
 * schedule entry currently lands on EZAN_CHANNEL_ID (see
 * notificationScheduler.ts) — SILENT_CHANNEL_ID exists for when that
 * changes, not for today's traffic.
 */
export async function ensureNotificationChannels(): Promise<void> {
  await LocalNotifications.createChannel({
    id: EZAN_CHANNEL_ID,
    name: 'Vakit Bildirimleri',
    description: 'Namaz vakti girdiğinde ezan sesiyle bildirim.',
    sound: EZAN_SOUND_FILE,
    importance: 4,
    visibility: 1,
  });
  await LocalNotifications.createChannel({
    id: SILENT_CHANNEL_ID,
    name: 'Sessiz Vakit Bildirimleri',
    description: 'Ses olmadan görünen namaz vakti bildirimi.',
    importance: 3,
    visibility: 1,
  });
}

export async function checkNativeNotificationPermissionGranted(): Promise<boolean> {
  const status = await LocalNotifications.checkPermissions();
  return status.display === 'granted';
}

/** POST_NOTIFICATIONS (Android 13+) is requested here — only ever called from the user's own "Bildirimlere İzin Ver" tap (same consent-gated flow as web push), never on app launch. */
export async function requestNativeNotificationPermission(): Promise<NativeNotificationResult> {
  const status = await LocalNotifications.requestPermissions();
  if (status.display !== 'granted') {
    return { ok: false, reason: 'Bildirim izni verilmedi.' };
  }
  return { ok: true };
}

/**
 * Cancels every pending local notification and replaces them with a fresh
 * 30-day batch built from the current settings — mirrors web's
 * refreshPushSchedule semantics (design-refresh-v3 Faz 15: the old
 * schedule is always fully replaced, never merged). SCHEDULE_EXACT_ALARM
 * is declared in AndroidManifest.xml but never required at runtime: if the
 * user hasn't granted it (or disabled it in system settings), Android and
 * this plugin both fall back to inexact delivery automatically — no crash,
 * no forced prompt (design-refresh-v3 Faz 23 Commit 2).
 */
export async function scheduleNativeNotifications(
  settings: AppSettings,
  now: Date = new Date()
): Promise<NativeNotificationResult> {
  try {
    await cancelAllNativeNotifications();

    const entries = buildPushSchedule(settings.location, settings.calculationMethod, settings.notifications, now);
    const requests = buildLocalNotificationRequests(entries, now);
    if (requests.length === 0) return { ok: true };

    await LocalNotifications.schedule({
      notifications: requests.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        channelId: r.channelId,
        schedule: { at: r.at, allowWhileIdle: true },
      })),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Bildirimler zamanlanamadı.' };
  }
}

export async function cancelAllNativeNotifications(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length === 0) return;
  await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
}

/** Maps Capacitor's 4-state PermissionState onto the browser's 3-state NotificationPermission so pushHint.ts's shouldShowPushHint can stay platform-agnostic — 'prompt'/'prompt-with-rationale' both mean "never decided", i.e. the web 'default' state. */
export async function getNativeNotificationPermissionState(): Promise<NotificationPermission | 'unsupported'> {
  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return 'granted';
  if (status.display === 'denied') return 'denied';
  return 'default';
}

export async function hasScheduledNativeNotifications(): Promise<boolean> {
  const pending = await LocalNotifications.getPending();
  return pending.notifications.length > 0;
}

/**
 * SCHEDULE_EXACT_ALARM is declared in the manifest but Android still lets
 * the user revoke it from system settings at any time — this surfaces that
 * state so Ayarlar can show a calm, factual notice instead of silently
 * degrading to approximate delivery with no explanation (design-refresh-v3
 * Faz 23 Commit 2). Both functions return false on web/iOS or if the
 * plugin call fails, rather than throwing — the caller only ever uses this
 * to decide whether to show an informational line, never to block anything.
 */
export async function checkExactAlarmGranted(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return status.exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/** Opens the system's exact-alarm settings screen — only ever called from the user's own tap on the Ayarlar notice, never automatically. */
export async function openExactAlarmSettings(): Promise<boolean> {
  try {
    const status = await LocalNotifications.changeExactNotificationSetting();
    return status.exact_alarm === 'granted';
  } catch {
    return false;
  }
}
