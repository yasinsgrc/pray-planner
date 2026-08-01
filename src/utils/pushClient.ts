import { AppSettings } from '../types';

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

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register(SERVICE_WORKER_URL);
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function syncSubscription(
  subscription: PushSubscription,
  settings: AppSettings
): Promise<PushSyncResult> {
  const { keys } = subscription.toJSON();
  if (!keys) {
    return { ok: false, reason: 'Abonelik anahtarları okunamadı.' };
  }

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys,
        location: settings.location,
        calculationMethod: settings.calculationMethod,
        notifications: settings.notifications,
      }),
    });

    if (!res.ok) {
      return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Bildirim sunucusuna ulaşılamadı.' };
  }
}

export async function subscribeToPush(settings: AppSettings): Promise<PushSyncResult> {
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

    const keyRes = await fetch('/api/vapid-public-key');
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

    return await syncSubscription(subscription, settings);
  } catch {
    return { ok: false, reason: 'Bildirim aboneliği başarısız oldu.' };
  }
}
