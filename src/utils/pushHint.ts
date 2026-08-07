export interface PushHintConditions {
  notificationPermission: NotificationPermission | 'unsupported';
  hasExistingSubscription: boolean;
  /** null while the one-time /health probe (useApiAvailable) is still in flight. */
  apiAvailable: boolean | null;
  pushHintDismissedAt: number | null;
}

/**
 * Ana ekranda "bildirimler kapalı" ipucunu göstermenin koşulu — eksik bir
 * kurulum adımını bildirir, ısrar etmez: yalnızca izin hiç sorulmamışsa
 * (`'default'`) gösterilir, reddedilmişse bir daha gösterilmez
 * (design-refresh-v3 Faz 22 Commit 4).
 */
export function shouldShowPushHint(conditions: PushHintConditions): boolean {
  if (conditions.pushHintDismissedAt !== null) return false;
  if (conditions.notificationPermission !== 'default') return false;
  if (conditions.hasExistingSubscription) return false;
  if (conditions.apiAvailable !== true) return false;
  return true;
}
