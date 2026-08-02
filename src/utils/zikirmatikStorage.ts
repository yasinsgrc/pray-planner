const STORAGE_KEY = 'vakit_zikirmatik_state_v2';
const LOG_STORAGE_KEY = 'vakit_zikir_log_v1';
const LOG_RETENTION_DAYS = 30;

export interface ZikirmatikPreset {
  title: string;
  arabic: string;
  target: number;
}

export const PRESET_DHIKRS: ZikirmatikPreset[] = [
  { title: 'Subhânallah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { title: 'Elhamdulillâh', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { title: 'Allâhu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 33 },
  { title: 'Lâ ilâhe illallâh', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', target: 100 },
  { title: 'Estagfirullâh', arabic: 'أَسْتَغْفِرُ اللَّهَ', target: 100 },
];

export interface ZikirmatikCounter {
  counter: number;
  lap: number;
}

/**
 * One counter/lap pair *per dhikr* (design-refresh-v3 Faz 7 F3) — switching
 * the selected dhikr must never lose progress on the others. `counters` is
 * keyed by index into PRESET_DHIKRS.
 */
export interface ZikirmatikState {
  selectedDhikrIndex: number;
  counters: Record<number, ZikirmatikCounter>;
}

const EMPTY_COUNTER: ZikirmatikCounter = { counter: 0, lap: 0 };

function defaultCounters(): Record<number, ZikirmatikCounter> {
  const counters: Record<number, ZikirmatikCounter> = {};
  PRESET_DHIKRS.forEach((_, idx) => {
    counters[idx] = { counter: 0, lap: 0 };
  });
  return counters;
}

const DEFAULT_STATE: ZikirmatikState = { selectedDhikrIndex: 0, counters: defaultCounters() };

export function getCounterFor(state: ZikirmatikState, index: number): ZikirmatikCounter {
  return state.counters[index] ?? EMPTY_COUNTER;
}

/**
 * v1 stored a single flat {selectedDhikrIndex, counter, lap} shared across
 * all five dhikr (design-refresh-v3 Faz 7 F3 fixed the bug where switching
 * dhikr silently zeroed whichever one wasn't selected). Migrates that lone
 * counter onto whichever dhikr it belonged to, so nobody's in-progress count
 * is lost by the upgrade itself.
 */
function migrate(raw: unknown): ZikirmatikState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE, counters: defaultCounters() };
  const obj = raw as Record<string, unknown>;

  if (typeof obj.counters === 'object' && obj.counters !== null && typeof obj.selectedDhikrIndex === 'number') {
    const counters = defaultCounters();
    for (const [key, value] of Object.entries(obj.counters as Record<string, unknown>)) {
      const idx = Number(key);
      const v = value as Partial<ZikirmatikCounter> | undefined;
      if (Number.isInteger(idx) && idx >= 0 && idx < PRESET_DHIKRS.length && v) {
        counters[idx] = {
          counter: typeof v.counter === 'number' ? v.counter : 0,
          lap: typeof v.lap === 'number' ? v.lap : 0,
        };
      }
    }
    return { selectedDhikrIndex: obj.selectedDhikrIndex, counters };
  }

  // v1 shape: { selectedDhikrIndex, counter, lap }
  if (
    typeof obj.selectedDhikrIndex === 'number' &&
    typeof obj.counter === 'number' &&
    typeof obj.lap === 'number'
  ) {
    const counters = defaultCounters();
    counters[obj.selectedDhikrIndex] = { counter: obj.counter, lap: obj.lap };
    return { selectedDhikrIndex: obj.selectedDhikrIndex, counters };
  }

  return { ...DEFAULT_STATE, counters: defaultCounters() };
}

export function loadZikirmatikState(): ZikirmatikState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, counters: defaultCounters() };
    return migrate(JSON.parse(raw));
  } catch {
    // Bozuk veri: varsayılana düş
  }
  return { ...DEFAULT_STATE, counters: defaultCounters() };
}

export function saveZikirmatikState(state: ZikirmatikState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage kullanılamıyor: sessizce yok say
  }
}

/**
 * "YYYY-MM-DD" (selected location's calendar day, see dateKeyInZone) ->
 * dhikr title -> count that day (design-refresh-v3 Faz 7 F3). Deliberately
 * no notification is ever built on top of this — a "you didn't zikir today"
 * nudge would cut against the app's whole unhurried tone.
 */
export type ZikirLog = Record<string, Record<string, number>>;

export function loadZikirLog(): ZikirLog {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveZikirLog(log: ZikirLog): void {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage kullanılamıyor: sessizce yok say
  }
}

/**
 * Drops entries older than 30 days — keys are "YYYY-MM-DD" so lexicographic
 * comparison is chronological. Cutoff arithmetic stays entirely in UTC
 * (Date.UTC + getUTC* accessors) rather than mixing local-time Date
 * construction with a UTC-based toISOString() read — that mix silently
 * shifts the cutoff by a day whenever the device's zone is ahead of UTC
 * (e.g. Europe/Istanbul, UTC+3), since local midnight for `todayKey` is
 * still the *previous* UTC day.
 */
export function pruneOldZikirLogEntries(log: ZikirLog, todayKey: string): ZikirLog {
  const [y, m, d] = todayKey.split('-').map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - LOG_RETENTION_DAYS));
  const cutoffKey = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(
    cutoff.getUTCDate()
  ).padStart(2, '0')}`;
  const pruned: ZikirLog = {};
  for (const [key, value] of Object.entries(log)) {
    if (key >= cutoffKey) pruned[key] = value;
  }
  return pruned;
}

/** Adds `delta` to `dhikrTitle`'s count on `dateKey`, returning a new log (pure — safe to call from a setState updater). */
export function addZikirCount(log: ZikirLog, dateKey: string, dhikrTitle: string, delta: number): ZikirLog {
  const day = log[dateKey] ?? {};
  return {
    ...log,
    [dateKey]: {
      ...day,
      [dhikrTitle]: (day[dhikrTitle] ?? 0) + delta,
    },
  };
}

/** Sum of all dhikr counts on `dateKey`, 0 if nothing logged yet. */
export function getDayTotal(log: ZikirLog, dateKey: string): number {
  const day = log[dateKey];
  if (!day) return 0;
  return Object.values(day).reduce((sum, n) => sum + n, 0);
}
