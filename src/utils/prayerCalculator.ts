import { Coordinates, CalculationMethod, PrayerTimes, CalculationParameters } from 'adhan';
import { LocationItem, PrayerTimeDetails, KerahetInfo, PrayerName } from '../types';

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

function formatTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export interface DayPrayerSchedule {
  date: Date;
  location: LocationItem;
  prayers: PrayerTimeDetails[];
  activePrayer: PrayerTimeDetails;
  nextPrayer: PrayerTimeDetails;
  timeRemainingSeconds: number; // to next prayer
  timeRemainingFormatted: string; // HH:mm:ss
  ringProgress: number; // 0 to 1 (percentage elapsed between active and next)
  kerahetTimes: KerahetInfo[];
  currentKerahet: KerahetInfo | null;
}

export function calculatePrayerTimes(
  location: LocationItem,
  date: Date = new Date(),
  methodName: string = 'Diyanet'
): DayPrayerSchedule {
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

  const now = new Date();

  // Define 6 key times for today
  const rawPrayers: { name: PrayerName; label: string; dateObj: Date }[] = [
    { name: 'imsak', label: 'İmsak', dateObj: ptToday.fajr },
    { name: 'gunes', label: 'Güneş', dateObj: ptToday.sunrise },
    { name: 'ogle', label: 'Öğle', dateObj: ptToday.dhuhr },
    { name: 'ikindi', label: 'İkindi', dateObj: ptToday.asr },
    { name: 'aksam', label: 'Akşam', dateObj: ptToday.maghrib },
    { name: 'yatsi', label: 'Yatsı', dateObj: ptToday.isha },
  ];

  // Determine active prayer index
  let activeIndex = 5; // Default to Yatsı
  if (now < ptToday.fajr) {
    activeIndex = 5; // Previous night's Yatsı
  } else if (now < ptToday.sunrise) {
    activeIndex = 0; // İmsak
  } else if (now < ptToday.dhuhr) {
    activeIndex = 1; // Güneş
  } else if (now < ptToday.asr) {
    activeIndex = 2; // Öğle
  } else if (now < ptToday.maghrib) {
    activeIndex = 3; // İkindi
  } else if (now < ptToday.isha) {
    activeIndex = 4; // Akşam
  } else {
    activeIndex = 5; // Yatsı
  }

  // Active start date & Next start date for timer & ring calculation
  let activeStartDate: Date;
  let nextStartDate: Date;
  let nextPrayerName: PrayerName;
  let nextPrayerLabel: string;

  if (now < ptToday.fajr) {
    // Before today's Fajr: active is yesterday's Yatsı, next is today's Fajr
    activeStartDate = ptYesterday.isha;
    nextStartDate = ptToday.fajr;
    nextPrayerName = 'imsak';
    nextPrayerLabel = 'İmsak';
  } else if (activeIndex === 5) {
    // After today's Isha: active is today's Isha, next is tomorrow's Fajr
    activeStartDate = ptToday.isha;
    nextStartDate = ptTomorrow.fajr;
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
    const isPast = now > p.dateObj && idx !== activeIndex;
    const isActive = idx === activeIndex;
    const isNext = p.name === nextPrayerName;

    return {
      name: p.name,
      label: p.label,
      timeString: formatTimeString(p.dateObj),
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
    timeString: formatTimeString(nextStartDate),
    dateObj: nextStartDate,
    isPast: false,
    isActive: false,
    isNext: true,
  };

  // Kerahet Times (45 minutes window for sunrise, pre-noon, pre-sunset)
  const kerahatGunesStart = new Date(ptToday.sunrise);
  const kerahatGunesEnd = new Date(ptToday.sunrise.getTime() + 45 * 60 * 1000);

  const kerahatOgleStart = new Date(ptToday.dhuhr.getTime() - 45 * 60 * 1000);
  const kerahatOgleEnd = new Date(ptToday.dhuhr);

  const kerahatAksamStart = new Date(ptToday.maghrib.getTime() - 45 * 60 * 1000);
  const kerahatAksamEnd = new Date(ptToday.maghrib);

  const kerahetTimes: KerahetInfo[] = [
    {
      type: 'gunes_sonrasi',
      title: 'Güneş Keraheti',
      description: 'Güneş doğduktan sonra 45 dakika kerahet vaktidir.',
      startTime: kerahatGunesStart,
      endTime: kerahatGunesEnd,
      isActiveNow: now >= kerahatGunesStart && now <= kerahatGunesEnd,
    },
    {
      type: 'ogle_oncesi',
      title: 'İstivâ Keraheti',
      description: 'Öğle vaktine 45 dakika kala kerahet vaktidir.',
      startTime: kerahatOgleStart,
      endTime: kerahatOgleEnd,
      isActiveNow: now >= kerahatOgleStart && now <= kerahatOgleEnd,
    },
    {
      type: 'aksam_oncesi',
      title: 'İstifrâ Keraheti',
      description: 'Güneş batmadan önceki 45 dakika kerahet vaktidir.',
      startTime: kerahatAksamStart,
      endTime: kerahatAksamEnd,
      isActiveNow: now >= kerahatAksamStart && now <= kerahatAksamEnd,
    },
  ];

  const currentKerahet = kerahetTimes.find((k) => k.isActiveNow) || null;

  return {
    date,
    location,
    prayers,
    activePrayer,
    nextPrayer,
    timeRemainingSeconds,
    timeRemainingFormatted,
    ringProgress,
    kerahetTimes,
    currentKerahet,
  };
}
