import { AppSettings } from '../types';
import { apiUrl } from './apiBaseUrl';
import { buildPushSchedule, PushScheduleEntry } from './pushSchedule';

const SERVICE_WORKER_URL = '/sw.js';

export type PushStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error';
export type PushSyncResult = { ok: true } | { ok: false; reason: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker and, if `onUpdateAvailable` is given, calls
 * it once a NEW version has finished installing and is sitting idle,
 * waiting to take over (design-refresh-v3 Faz 4 F1). It never activates
 * itself — see applyServiceWorkerUpdate, called only from the user's own
 * "Yenile" tap, so a page never gets pulled out from under someone mid-use.
 */
export async function registerServiceWorker(
  onUpdateAvailable?: () => void
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);

  if (onUpdateAvailable) {
    // A worker can already be sitting in "waiting" if this page loaded
    // while an update was pending from an earlier visit.
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateAvailable();
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // controller already set = this is an update to an already-running
        // app, not the very first install (which has nothing to "update").
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          onUpdateAvailable();
        }
      });
    });
  }

  return registration;
}

/** Tells a waiting service worker to activate — only ever called from the user's own "Yenile" tap. */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * iOS Safari only supports web push inside an installed (Add to Home
 * Screen) PWA on iOS 16.4+ — a plain Safari tab's Notification.requestPermission()
 * either doesn't exist or silently never delivers anything. subscribeToPush
 * checks this BEFORE touching the permission API at all (design-refresh-v3
 * Faz 15): the user gets a clear "install first" message instead of a
 * button that appears to work but quietly never notifies them.
 */
export function isIOSStandaloneNoticeNeeded(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

const IOS_STANDALONE_REQUIRED_MESSAGE =
  "iPhone'da bildirim alabilmek için önce Safari'de Paylaş → Ana Ekrana Ekle ile uygulamayı yükleyin.";

/** Shared by subscribeToPush and refreshPushSchedule — both just upsert the
 * subscription + REPLACE its schedule server-side (design-refresh-v3 Faz 15);
 * they differ only in which endpoint expresses the caller's intent. */
async function sendScheduleToServer(
  path: string,
  subscription: PushSubscription,
  schedule: PushScheduleEntry[]
): Promise<PushSyncResult> {
  const { keys } = subscription.toJSON();
  if (!keys) {
    return { ok: false, reason: 'Abonelik anahtarları okunamadı.' };
  }

  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, keys, schedule }),
    });

    if (!res.ok) {
      return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
  }
}

/**
 * Cancels the browser's own push subscription and deletes the matching
 * server record (design-refresh-v3 Faz 9 M5) — the Gizlilik Politikası
 * promises "bildirimleri kapattığınızda kayıt silinir"; before this, only
 * an already-expired (404/410) record was ever cleaned up server-side, a
 * user-initiated disable didn't delete anything. `apiAvailable` must be
 * checked by the caller and passed in — this module has no React state of
 * its own, and on a serverless deployment the DELETE call should never
 * even be attempted (there's nothing to delete, and no /api/* exists to
 * receive it).
 */
export async function unsubscribeFromPush(apiAvailable: boolean): Promise<PushSyncResult> {
  if (!('serviceWorker' in navigator)) {
    return { ok: true };
  }

  try {
    const subscription = await getExistingPushSubscription();
    if (!subscription) {
      return { ok: true };
    }

    const { endpoint } = subscription;
    await subscription.unsubscribe();

    if (apiAvailable) {
      try {
        await fetch(apiUrl('/api/push/unsubscribe'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      } catch {
        // Sunucudaki kayıt silinemedi ama tarayıcı aboneliği zaten iptal
        // edildi — kullanıcı için "bildirimler kapalı" zaten doğru; kayıt
        // en geç bir sonraki başarısız gönderimde otomatik temizlenir
        // (server/pushCron.ts, 404/410 -> removeSubscription).
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'Bildirim aboneliği iptal edilemedi.' };
  }
}

export async function subscribeToPush(settings: AppSettings): Promise<PushSyncResult> {
  if (isIOSStandaloneNoticeNeeded()) {
    return { ok: false, reason: IOS_STANDALONE_REQUIRED_MESSAGE };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Bu tarayıcı bildirimleri desteklemiyor.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Bildirim izni verilmedi.' };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { ok: false, reason: 'Service worker kaydedilemedi.' };
    }

    const keyRes = await fetch(apiUrl('/api/vapid-public-key'));
    if (!keyRes.ok) {
      return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
    }
    const { publicKey } = await keyRes.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const schedule = buildPushSchedule(settings.location, settings.calculationMethod, settings.notifications);
    return await sendScheduleToServer('/api/push/subscribe', subscription, schedule);
  } catch {
    return { ok: false, reason: 'Bildirim aboneliği başarısız oldu.' };
  }
}

/**
 * Re-sends the 30-day schedule for an ALREADY-existing subscription —
 * called whenever settings change (location, calculation method, or sound
 * preferences all change which fire_at instants are correct) and once on
 * every app open, so the rolling 30-day window never runs out
 * (design-refresh-v3 Faz 15). A no-op if the user was never subscribed —
 * there's nothing to refresh.
 */
export async function refreshPushSchedule(settings: AppSettings): Promise<PushSyncResult> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) {
    return { ok: true };
  }
  const schedule = buildPushSchedule(settings.location, settings.calculationMethod, settings.notifications);
  return await sendScheduleToServer('/api/push/schedule', subscription, schedule);
}
