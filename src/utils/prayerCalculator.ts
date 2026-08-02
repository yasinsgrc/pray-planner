import { Coordinates, CalculationMethod, PrayerTimes, CalculationParameters } from 'adhan';
import { LocationItem, PrayerTimeDetails, KerahetInfo, PrayerName } from '../types';
import { formatTime } from './formatTime';
import { resolveTimeZone } from './timezone';

export function getCalculationParameters(methodName: string): CalculationParameters {
  switch (methodName) {
    case 'MWL':
      return CalculationMethod.MuslimWorldLeague();
    case 'ISNA':
      return CalculationMethod.NorthAmerica();
    case 'Egypt':
      return CalculationMethod.Egyptian();
    case 'Karachi':
      return CalculationMethod.Karachi();
    case 'Makkah':
      return CalculationMethod.UmmAlQura();
    case 'Diyanet':
    default:
      // Diyanet / Turkey method parameters
      return CalculationMethod.Turkey();
  }
}

// Turkish vowel harmony means a single fixed suffix ('-ye/-ya) is wrong for
// some prayer names (e.g. "Akşam'ye" should be "Akşam'a") — a fixed lookup
// is safer than a runtime vowel-harmony algorithm for six known words.
const PRAYER_LABEL_DATIVE: Record<PrayerName, string> = {
  imsak: "İmsak'a",
  gunes: "Güneş'e",
  ogle: "Öğle'ye",
  ikindi: "İkindi'ye",
  aksam: "Akşam'a",
  yatsi: "Yatsı'ya",
};

export interface DayPrayerSchedule {
  date: Date;
  location: LocationItem;
  /** location.timeZone, resolved via guessTimeZone when absent — every display formatter should use this, not the device's zone. */
  resolvedTimeZone: string;
  prayers: PrayerTimeDetails[];
  activePrayer: PrayerTimeDetails;
  nextPrayer: PrayerTimeDetails;
  timeRemainingSeconds: number; // to next prayer
  timeRemainingFormatted: string; // HH:mm:ss
  ringProgress: number; // 0 to 1 (percentage elapsed between active and next)
  kerahetTimes: KerahetInfo[];
  currentKerahet: KerahetInfo | null;
  /** "Gün Kavisi" full-day dial: imsak-to-imsak cycle containing `now`. */
  dayCycleStart: Date;
  dayCycleEnd: Date;
  dayCyclePrayers: { name: PrayerName; label: string; dateObj: Date }[];
  dayProgress: number; // 0 to 1, elapsed fraction of dayCycleStart..dayCycleEnd
  /** "Yarın" summary for the Vakitler screen. */
  tomorrowImsakTime: string; // HH:mm
  tomorrowAksamTime: string; // HH:mm
}

/**
 * The adhan-derived Date objects for one calendar day. Expensive to build
 * (three `PrayerTimes` instantiations) but independent of the current
 * moment — only location, calculation method, and calendar day affect it.
 */
export interface RawDaySchedule {
  date: Date;
  location: LocationItem;
  rawPrayers: { name: PrayerName; label: string; dateObj: Date }[];
  previousRawPrayers: { name: PrayerName; label: string; dateObj: Date }[];
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  yesterdayFajr: Date;
  yesterdayIsha: Date;
  tomorrowFajr: Date;
  tomorrowMaghrib: Date;
  kerahetWindows: Omit<KerahetInfo, 'isActiveNow'>[];
}

function buildDaySchedule(
  location: LocationItem,
  date: Date,
  methodName: string
): RawDaySchedule {
  const coords = new Coordinates(location.lat, location.lng);
  const params = getCalculationParameters(methodName);

  const ptToday = new PrayerTimes(coords, date, params);

  // Tomorrow's Fajr for Isha->Fajr next day calculation
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ptTomorrow = new PrayerTimes(coords, tomorrow, params);

  // Yesterday's Isha for Fajr previous day calculation
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const ptYesterday = new PrayerTimes(coords, yesterday, params);

  const rawPrayers: { name: PrayerName; label: string; dateObj: Date }[] = [
    { name: 'imsak', label: 'İmsak', dateObj: ptToday.fajr },
    { name: 'gunes', label: 'Güneş', dateObj: ptToday.sunrise },
    { name: 'ogle', label: 'Öğle', dateObj: ptToday.dhuhr },
    { name: 'ikindi', label: 'İkindi', dateObj: ptToday.asr },
    { name: 'aksam', label: 'Akşam', dateObj: ptToday.maghrib },
    { name: 'yatsi', label: 'Yatsı', dateObj: ptToday.isha },
  ];

  // ptYesterday is already fully built above (for yesterdayIsha) — reading
  // its other fields is free, so the dial's pre-fajr wrap case (see
  // dayCyclePrayers below) gets a real previous-day tick set at no extra
  // adhan cost.
  const previousRawPrayers: { name: PrayerName; label: string; dateObj: Date }[] = [
    { name: 'imsak', label: 'İmsak', dateObj: ptYesterday.fajr },
    { name: 'gunes', label: 'Güneş', dateObj: ptYesterday.sunrise },
    { name: 'ogle', label: 'Öğle', dateObj: ptYesterday.dhuhr },
    { name: 'ikindi', label: 'İkindi', dateObj: ptYesterday.asr },
    { name: 'aksam', label: 'Akşam', dateObj: ptYesterday.maghrib },
    { name: 'yatsi', label: 'Yatsı', dateObj: ptYesterday.isha },
  ];

  const kerahatGunesStart = new Date(ptToday.sunrise);
  const kerahatGunesEnd = new Date(ptToday.sunrise.getTime() + 45 * 60 * 1000);

  const kerahatOgleStart = new Date(ptToday.dhuhr.getTime() - 45 * 60 * 1000);
  const kerahatOgleEnd = new Date(ptToday.dhuhr);

  const kerahatAksamStart = new Date(ptToday.maghrib.getTime() - 45 * 60 * 1000);
  const kerahatAksamEnd = new Date(ptToday.maghrib);

  const kerahetWindows: Omit<KerahetInfo, 'isActiveNow'>[] = [
    {
      type: 'gunes_sonrasi',
      title: 'İşrâk Vakti',
      description: 'Güneş doğduktan sonra yaklaşık 45 dakika süren bu aralıkta nafile namaz kılınmaz.',
      startTime: kerahatGunesStart,
      endTime: kerahatGunesEnd,
    },
    {
      type: 'ogle_oncesi',
      title: 'İstivâ Vakti',
      description: 'Güneşin tam tepede olduğu ana kadar süren ~45 dakikalık aralıkta nafile namaz kılınmaz.',
      startTime: kerahatOgleStart,
      endTime: kerahatOgleEnd,
    },
    {
      type: 'aksam_oncesi',
      title: 'Gurûb Vakti',
      description: 'Güneş batmadan önceki ~45 dakikada nafile namaz kılınmaz; günün ikindi namazı bu vakitte kılınabilir.',
      startTime: kerahatAksamStart,
      endTime: kerahatAksamEnd,
    },
  ];

  return {
    date,
    location,
    rawPrayers,
    previousRawPrayers,
    fajr: ptToday.fajr,
    sunrise: ptToday.sunrise,
    dhuhr: ptToday.dhuhr,
    yesterdayFajr: ptYesterday.fajr,
    yesterdayIsha: ptYesterday.isha,
    tomorrowFajr: ptTomorrow.fajr,
    tomorrowMaghrib: ptTomorrow.maghrib,
    kerahetWindows,
  };
}

function deriveFromDay(day: RawDaySchedule, now: Date): DayPrayerSchedule {
  const { rawPrayers } = day;
  const resolvedTimeZone = resolveTimeZone(day.location);

  // Determine active prayer index
  let activeIndex = 5; // Default to Yatsı
  if (now < day.fajr) {
    activeIndex = 5; // Previous night's Yatsı
  } else if (now < day.sunrise) {
    activeIndex = 0; // İmsak
  } else if (now < day.dhuhr) {
    activeIndex = 1; // Güneş
  } else if (now < rawPrayers[3].dateObj) {
    activeIndex = 2; // Öğle
  } else if (now < rawPrayers[4].dateObj) {
    activeIndex = 3; // İkindi
  } else if (now < rawPrayers[5].dateObj) {
    activeIndex = 4; // Akşam
  } else {
    activeIndex = 5; // Yatsı
  }

  // Active start date & Next start date for timer & ring calculation
  let activeStartDate: Date;
  let nextStartDate: Date;
  let nextPrayerName: PrayerName;
  let nextPrayerLabel: string;

  if (now < day.fajr) {
    // Before today's Fajr: active is yesterday's Yatsı, next is today's Fajr
    activeStartDate = day.yesterdayIsha;
    nextStartDate = day.fajr;
    nextPrayerName = 'imsak';
    nextPrayerLabel = 'İmsak';
  } else if (activeIndex === 5) {
    // After today's Isha: active is today's Isha, next is tomorrow's Fajr
    activeStartDate = rawPrayers[5].dateObj;
    nextStartDate = day.tomorrowFajr;
    nextPrayerName = 'imsak';
    nextPrayerLabel = 'İmsak';
  } else {
    const activeItem = rawPrayers[activeIndex];
    const nextItem = rawPrayers[activeIndex + 1];
    activeStartDate = activeItem.dateObj;
    nextStartDate = nextItem.dateObj;
    nextPrayerName = nextItem.name;
    nextPrayerLabel = nextItem.label;
  }

  // Calculate remaining seconds to next prayer
  const diffMs = Math.max(0, nextStartDate.getTime() - now.getTime());
  const timeRemainingSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = timeRemainingSeconds % 60;
  const timeRemainingFormatted = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Calculate ring progress (0 to 1)
  const totalDurationMs = nextStartDate.getTime() - activeStartDate.getTime();
  const elapsedMs = now.getTime() - activeStartDate.getTime();
  const ringProgress = Math.min(1, Math.max(0, elapsedMs / totalDurationMs));

  // Build PrayerTimeDetails array
  const prayers: PrayerTimeDetails[] = rawPrayers.map((p, idx) => {
    const isActive = idx === activeIndex;
    const isNext = p.name === nextPrayerName;

    return {
      name: p.name,
      label: p.label,
      labelDative: PRAYER_LABEL_DATIVE[p.name],
      timeString: formatTime(p.dateObj, resolvedTimeZone),
      dateObj: p.dateObj,
      isPast: now > p.dateObj && !isActive,
      isActive,
      isNext,
    };
  });

  const activePrayer = prayers[activeIndex] || prayers[0];
  const nextPrayer: PrayerTimeDetails = {
    name: nextPrayerName,
    label: nextPrayerLabel,
    labelDative: PRAYER_LABEL_DATIVE[nextPrayerName],
    timeString: formatTime(nextStartDate, resolvedTimeZone),
    dateObj: nextStartDate,
    isPast: false,
    isActive: false,
    isNext: true,
  };

  const kerahetTimes: KerahetInfo[] = day.kerahetWindows.map((k) => ({
    ...k,
    isActiveNow: now >= k.startTime && now <= k.endTime,
  }));

  const currentKerahet = kerahetTimes.find((k) => k.isActiveNow) || null;

  // "Gün Kavisi" full-day cycle: imsak-to-imsak containing `now`. Before
  // today's fajr, `now` still belongs to yesterday's imsak-to-imsak span.
  const dayCycleStart = now < day.fajr ? day.yesterdayFajr : day.fajr;
  const dayCycleEnd = now < day.fajr ? day.fajr : day.tomorrowFajr;
  const dayCyclePrayers = now < day.fajr ? day.previousRawPrayers : rawPrayers;
  const dayProgress = Math.min(
    1,
    Math.max(0, (now.getTime() - dayCycleStart.getTime()) / (dayCycleEnd.getTime() - dayCycleStart.getTime()))
  );

  return {
    date: day.date,
    location: day.location,
    resolvedTimeZone,
    prayers,
    activePrayer,
    nextPrayer,
    timeRemainingSeconds,
    timeRemainingFormatted,
    ringProgress,
    kerahetTimes,
    currentKerahet,
    dayCycleStart,
    dayCycleEnd,
    dayCyclePrayers,
    dayProgress,
    tomorrowImsakTime: formatTime(day.tomorrowFajr, resolvedTimeZone),
    tomorrowAksamTime: formatTime(day.tomorrowMaghrib, resolvedTimeZone),
  };
}

/**
 * Builds one calendar day's adhan-derived prayer times. Expensive
 * (3x `PrayerTimes` construction) — memoize on
 * `location + calculationMethod + calendar day`, not on the ticking clock.
 */
export function calculateDaySchedule(
  location: LocationItem,
  date: Date = new Date(),
  methodName: string = 'Diyanet'
): RawDaySchedule {
  return buildDaySchedule(location, date, methodName);
}

/**
 * Cheap per-tick derivation (active/next prayer, countdown, ring progress,
 * kerahet activity) from an already-built `RawDaySchedule`. Safe to call
 * every second.
 */
export function deriveLiveSchedule(
  day: RawDaySchedule,
  now: Date = new Date()
): DayPrayerSchedule {
  return deriveFromDay(day, now);
}

export function calculatePrayerTimes(
  location: LocationItem,
  date: Date = new Date(),
  methodName: string = 'Diyanet'
): DayPrayerSchedule {
  const day = buildDaySchedule(location, date, methodName);
  return deriveFromDay(day, new Date());
}
