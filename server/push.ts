import webpush from 'web-push';

export function configureWebPush(publicKey: string, privateKey: string, subject: string): void {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function defaultSendNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<unknown> {
  return webpush.sendNotification(subscription, payload);
}
