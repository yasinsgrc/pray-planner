import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PushSubscriptionRecord } from './types';

/**
 * Async even for the file-based implementation (design-refresh-v3 Faz 6
 * B5) — a real persistent backend (Postgres) is inherently async, and a
 * single interface both implementations satisfy is simpler than juggling
 * two different call shapes depending on which store is active.
 */
export interface SubscriptionStore {
  loadSubscriptions(): Promise<PushSubscriptionRecord[]>;
  upsertSubscription(record: PushSubscriptionRecord): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DATA_FILE = path.resolve(currentDir, '..', 'data', 'subscriptions.json');

/**
 * Dev-friendly default — a JSON file on local disk. Most PaaS filesystems
 * are ephemeral (wiped on every deploy/restart), so this is NOT suitable
 * for production; see createPostgresSubscriptionStore for that.
 */
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

  async function loadSubscriptions(): Promise<PushSubscriptionRecord[]> {
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

  async function upsertSubscription(record: PushSubscriptionRecord): Promise<void> {
    const subs = await loadSubscriptions();
    const idx = subs.findIndex((s) => s.endpoint === record.endpoint);
    if (idx >= 0) {
      subs[idx] = record;
    } else {
      subs.push(record);
    }
    saveSubscriptions(subs);
  }

  async function removeSubscription(endpoint: string): Promise<void> {
    const subs = (await loadSubscriptions()).filter((s) => s.endpoint !== endpoint);
    saveSubscriptions(subs);
  }

  return { loadSubscriptions, upsertSubscription, removeSubscription };
}

/**
 * Minimal shape of the `pg` Pool this module needs — kept narrow so tests
 * can supply a fake without importing the real driver (design-refresh-v3
 * Faz 6 B5).
 */
export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    record JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * Genuinely persistent backend for hosts with an ephemeral filesystem
 * (design-refresh-v3 Faz 6 B5) — one row per subscription, keyed by
 * endpoint, with the full record kept as JSONB so this table doesn't need
 * a migration every time PushSubscriptionRecord gains a field. Selected in
 * server/index.ts whenever DATABASE_URL is set.
 */
export async function createPostgresSubscriptionStore(pool: PgPoolLike): Promise<SubscriptionStore> {
  await pool.query(CREATE_TABLE_SQL);

  async function loadSubscriptions(): Promise<PushSubscriptionRecord[]> {
    const { rows } = await pool.query('SELECT record FROM push_subscriptions');
    return rows.map((row) => row.record as PushSubscriptionRecord);
  }

  async function upsertSubscription(record: PushSubscriptionRecord): Promise<void> {
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, record, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (endpoint) DO UPDATE SET record = $2, updated_at = now()`,
      [record.endpoint, JSON.stringify(record)]
    );
  }

  async function removeSubscription(endpoint: string): Promise<void> {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  }

  return { loadSubscriptions, upsertSubscription, removeSubscription };
}
