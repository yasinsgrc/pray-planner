import webpush from 'web-push';
import type { NotificationEvent } from './scheduler';
import type { PushSubscriptionRecord } from './types';

export function configureWebPush(publicKey: string, privateKey: string, subject: string): void {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function defaultSendNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<unknown> {
  return webpush.sendNotification(subscription, payload);
}

function buildPayload(event: NotificationEvent): string {
  const title =
    event.type === 'prayer'
      ? `${event.label} Vakti Girdi`
      : `${event.label} Vaktine ${event.minutesBefore} Dakika Kaldı`;
  const body =
    event.type === 'prayer' ? 'Hayırlı namazlar.' : 'Abdest ve hazırlık için hatırlatma.';

  return JSON.stringify({ title, body });
}

export interface PushSenderDeps {
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
  onExpired: (endpoint: string) => void;
}

export function createPushSender(
  deps: PushSenderDeps
): (record: PushSubscriptionRecord, event: NotificationEvent) => Promise<void> {
  return async function sendPushNotification(record, event) {
    const payload = buildPayload(event);

    try {
      await deps.sendNotification({ endpoint: record.endpoint, keys: record.keys }, payload);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deps.onExpired(record.endpoint);
      } else {
        console.error('Push gönderim hatası:', err);
      }
    }
  };
}
