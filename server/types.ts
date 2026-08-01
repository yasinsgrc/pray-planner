import type { LocationItem, NotificationSettings } from '../src/types';

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  location: LocationItem;
  calculationMethod: string;
  notifications: NotificationSettings;
  updatedAt: string;
}
