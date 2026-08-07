export type PrayerName = 'imsak' | 'gunes' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi';

export interface LocationItem {
  id: string;
  cityName: string;
  districtName: string;
  country: string;
  lat: number;
  lng: number;
  /**
   * IANA zone name (e.g. "Europe/Istanbul"). Optional because it comes
   * from the server's geocoding response for searched/GPS locations
   * (server/geocoding.ts, which this app's rules keep off-limits to edit)
   * — those responses never include one. Every consumer must fall back to
   * `guessTimeZone(lat, lng)` (see utils/timezone.ts) when absent, never
   * silently assume the device's own zone.
   */
  timeZone?: string;
  /**
   * True only when this location came from the device's GPS, not a
   * user's deliberate choice from the list. GPS gives a precise
   * coordinate but the district NAME attached to it is a nearest-known-
   * center guess (or a reverse-geocoding result) — never something the
   * user actually confirmed. Claiming it as a definite district name is
   * misleading (design-refresh-v3 Faz 14 — real-device report: GPS in
   * Darıca matched "Çayırova", an adjacent district with a very close
   * center coordinate). The header shows "Mevcut Konum" + coordinates +
   * "en yakın merkez: X" instead of asserting X as fact.
   */
  isGpsDerived?: boolean;
}

export interface PrayerTimeDetails {
  name: PrayerName;
  label: string;
  /** label with the Turkish dative suffix (-a/-e) already applied, e.g. "Akşam'a" — use instead of concatenating a suffix onto `label` (Turkish vowel harmony makes a single fixed suffix wrong for some prayers). */
  labelDative: string;
  timeString: string; // HH:mm
  dateObj: Date;
  isPast: boolean;
  isActive: boolean;
  isNext: boolean;
}

export interface KerahetInfo {
  type: 'gunes_sonrasi' | 'ogle_oncesi' | 'aksam_oncesi';
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  isActiveNow: boolean;
}

export interface HijriDateInfo {
  day: number;
  monthName: string;
  year: number;
  formatted: string; // e.g. "24 Muharrem 1448"
}

/**
 * Only 'bildirim'/'sessiz' (design-refresh-v3 Faz 7 F1) — a web push
 * notification's sound is controlled by the OS/browser, never by the app
 * (no browser implements the Notification API's `sound` option; only a
 * silent on/off toggle exists). Offering "Ezan"/"İlahi 1-3" as selectable
 * *notification* sounds promised something the platform can't deliver. The
 * one real, working sound feature — playing the ezan recording out loud —
 * only works while the app is open in a tab, and is a separate global
 * setting (AppSettings.playEzanInForeground), not a per-prayer choice.
 */
export type SoundMode = 'bildirim' | 'sessiz';

export interface NotificationSettings {
  imsak: SoundMode;
  gunes: SoundMode;
  ogle: SoundMode;
  ikindi: SoundMode;
  aksam: SoundMode;
  yatsi: SoundMode;
  earlyWarningMinutes: number; // 0, 15, 30, 45, 60
  earlyWarningSound: SoundMode;
}

export interface AppSettings {
  themeMode: 'auto' | 'light' | 'dark';
  /**
   * Diyanet only (design-refresh-v3 Faz 19) — MWL/ISNA/Egypt/Karachi/Makkah
   * were removed: this app's users are in Turkey, and any other method
   * produces times that disagree with the local mosque, which is the one
   * thing a prayer-time app cannot get wrong. Narrowed to a single-value
   * literal type (not just "always happens to be Diyanet at runtime") so
   * the type system itself makes any other value a compile error —
   * appSettingsStorage.ts's migration is what guarantees a value loaded
   * from an older build's localStorage also collapses to this at runtime.
   */
  calculationMethod: 'Diyanet';
  location: LocationItem;
  notifications: NotificationSettings;
  /** Plays the real ezan recording out loud when the active prayer changes while the app is open in a tab — the one sound behavior this app can actually promise (design-refresh-v3 Faz 7 F1). */
  playEzanInForeground: boolean;
  /** Epoch ms of when the user dismissed the "bildirimler kapalı" home-screen hint, or null if never dismissed (design-refresh-v3 Faz 22 Commit 4) — the hint must not reappear once dismissed, even across reloads. */
  pushHintDismissedAt: number | null;
}

export interface DailyInspiration {
  verse: string;
  verseRef: string;
  hadith: string;
  hadithRef: string;
  dua: string;
  duaRef: string;
}
