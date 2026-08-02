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

export type SoundMode = 'ezan' | 'tini' | 'ilahi1' | 'ilahi2' | 'ilahi3' | 'sessiz';

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
  calculationMethod: 'Diyanet' | 'MWL' | 'ISNA' | 'Egypt' | 'Karachi' | 'Makkah';
  location: LocationItem;
  notifications: NotificationSettings;
}

export interface DailyInspiration {
  verse: string;
  verseRef: string;
  hadith: string;
  hadithRef: string;
  dua: string;
  duaRef: string;
}
