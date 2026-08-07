import { AppSettings, SoundMode } from '../types';
import { DEFAULT_LOCATION } from '../data/locations';

const LOCAL_STORAGE_KEY = 'vakit_app_settings_v1';

// Faz 7 F1: SoundMode dropped 'ezan'/'tini'/'ilahi1-3' down to just
// 'bildirim'/'sessiz' (a web push notification's sound was never actually
// controllable by this app — see types.ts). Migrate any older stored value
// instead of letting an unrecognized string silently reach the sound-select
// UI.
function migrateSoundMode(value: unknown): SoundMode {
  return value === 'sessiz' ? 'sessiz' : 'bildirim';
}

export function defaultAppSettings(): AppSettings {
  return {
    themeMode: 'auto',
    calculationMethod: 'Diyanet',
    location: DEFAULT_LOCATION,
    notifications: {
      imsak: 'bildirim',
      gunes: 'sessiz',
      ogle: 'bildirim',
      ikindi: 'bildirim',
      aksam: 'bildirim',
      yatsi: 'bildirim',
      earlyWarningMinutes: 15,
      earlyWarningSound: 'bildirim',
    },
    playEzanInForeground: true,
    pushHintDismissedAt: null,
  };
}

/**
 * Parses and migrates a raw localStorage value into a valid AppSettings.
 * Exported (not just used internally by loadAppSettings) so this can be
 * unit-tested directly without touching the real localStorage global — see
 * appSettingsStorage.test.ts, mirroring zikirmatikStorage.ts's existing
 * load/migrate split.
 *
 * `prayerAdjustments` (design-refresh-v3 Faz 19 — removed entirely: the
 * ±10min "Vakit Düzeltmesi" only ever compensated for adhan's measured
 * <=1min rounding difference from Diyanet's own published times, giving
 * users a way to make times WRONG, not right) is deliberately stripped
 * here even if present in `raw` — a value saved by an older build must not
 * silently survive the upgrade. The blind `...parsed` spread below would
 * otherwise carry it straight through (JS doesn't strip unknown
 * properties), so it's explicitly deleted from the result before
 * returning; the very next automatic save (App.tsx's settings-persist
 * effect) then overwrites localStorage with the now-clean object.
 *
 * `calculationMethod` (design-refresh-v3 Faz 19 — MWL/ISNA/Egypt/Karachi/
 * Makkah options removed, Diyanet only) is force-set to `'Diyanet'`
 * unconditionally, not merely defaulted when absent — a user who had
 * actually picked one of the removed methods has that exact value sitting
 * in `parsed.calculationMethod`, which the blind spread would otherwise
 * preserve verbatim (it's a *present, valid-looking* string, not a gap the
 * `{...defaults, ...parsed}` merge would leave for `defaults` to fill).
 */
export function parseStoredAppSettings(raw: string | null): AppSettings {
  const defaults = defaultAppSettings();
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    const migrated: AppSettings = {
      ...defaults,
      ...parsed,
      calculationMethod: 'Diyanet',
      notifications: {
        imsak: migrateSoundMode(parsed?.notifications?.imsak),
        gunes: migrateSoundMode(parsed?.notifications?.gunes),
        ogle: migrateSoundMode(parsed?.notifications?.ogle),
        ikindi: migrateSoundMode(parsed?.notifications?.ikindi),
        aksam: migrateSoundMode(parsed?.notifications?.aksam),
        yatsi: migrateSoundMode(parsed?.notifications?.yatsi),
        earlyWarningMinutes: parsed?.notifications?.earlyWarningMinutes ?? defaults.notifications.earlyWarningMinutes,
        earlyWarningSound: migrateSoundMode(parsed?.notifications?.earlyWarningSound),
      },
      playEzanInForeground: typeof parsed?.playEzanInForeground === 'boolean' ? parsed.playEzanInForeground : true,
      pushHintDismissedAt:
        typeof parsed?.pushHintDismissedAt === 'number' ? parsed.pushHintDismissedAt : null,
    };
    delete (migrated as unknown as Record<string, unknown>).prayerAdjustments;
    return migrated;
  } catch (e) {
    console.error('LocalStorage error:', e);
    return defaults;
  }
}

export function loadAppSettings(): AppSettings {
  try {
    return parseStoredAppSettings(localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch (e) {
    console.error('LocalStorage error:', e);
    return defaultAppSettings();
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}
