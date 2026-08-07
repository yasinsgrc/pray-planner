import { Capacitor } from '@capacitor/core';

/**
 * Whether this bundle is running inside the native Capacitor shell
 * (Android), not a browser tab or PWA (design-refresh-v3 Faz 23 Commit 1).
 * Several behaviors must diverge on this: service worker registration
 * (pushClient.ts — native has no SW, assets come from disk), the
 * "yeni sürüm hazır" update ribbon (App.tsx — native updates come from
 * Play Store, not a waiting SW), and notification delivery (Commit 2).
 * Wrapped defensively: must never throw even where the Capacitor global
 * doesn't exist at all (plain node:test, a web page that never loaded
 * Capacitor's runtime).
 */
export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
