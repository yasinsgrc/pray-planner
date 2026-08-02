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

/** Per-prayer minute offset applied only to the already-computed display time, never to the adhan calculation itself (design-refresh-v3 Faz 7 F5). Range -10..+10, default 0, global (not per-location). */
export type PrayerAdjustments = Record<PrayerName, number>;

export interface AppSettings {
  themeMode: 'auto' | 'light' | 'dark';
  calculationMethod: 'Diyanet' | 'MWL' | 'ISNA' | 'Egypt' | 'Karachi' | 'Makkah';
  location: LocationItem;
  notifications: NotificationSettings;
  /** Plays the real ezan recording out loud when the active prayer changes while the app is open in a tab — the one sound behavior this app can actually promise (design-refresh-v3 Faz 7 F1). */
  playEzanInForeground: boolean;
  prayerAdjustments: PrayerAdjustments;
}

export interface DailyInspiration {
  verse: string;
  verseRef: string;
  hadith: string;
  hadithRef: string;
  dua: string;
  duaRef: string;
}
