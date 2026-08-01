import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PushSubscriptionRecord } from './types';

export interface SubscriptionStore {
  loadSubscriptions(): PushSubscriptionRecord[];
  upsertSubscription(record: PushSubscriptionRecord): void;
  removeSubscription(endpoint: string): void;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DATA_FILE = path.resolve(currentDir, '..', 'data', 'subscriptions.json');

export function createSubscriptionStore(filePath: string): SubscriptionStore {
  function ensureFile(): void {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '[]', 'utf-8');
    }
  }

  function loadSubscriptions(): PushSubscriptionRecord[] {
    ensureFile();
    const raw = readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as PushSubscriptionRecord[];
    } catch (err) {
      console.warn(`Bozuk abonelik dosyası (${filePath}), boş liste ile devam ediliyor:`, err);
      return [];
    }
  }

  function saveSubscriptions(subs: PushSubscriptionRecord[]): void {
    ensureFile();
    writeFileSync(filePath, JSON.stringify(subs, null, 2), 'utf-8');
  }

  function upsertSubscription(record: PushSubscriptionRecord): void {
    const subs = loadSubscriptions();
    const idx = subs.findIndex((s) => s.endpoint === record.endpoint);
    if (idx >= 0) {
      subs[idx] = record;
    } else {
      subs.push(record);
    }
    saveSubscriptions(subs);
  }

  function removeSubscription(endpoint: string): void {
    const subs = loadSubscriptions().filter((s) => s.endpoint !== endpoint);
    saveSubscriptions(subs);
  }

  return { loadSubscriptions, upsertSubscription, removeSubscription };
}
