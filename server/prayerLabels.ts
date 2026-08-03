/**
 * A standalone copy of the Turkish prayer names, kept entirely inside
 * server/ (design-refresh-v3 Faz 17). The server must import NOTHING from
 * outside server/ — Railway's Root Directory=server only copies this
 * directory into the build container, so `../src/...` doesn't exist there
 * at all (real-deploy crash: "Cannot find module '/src/data/strings'").
 * This was previously re-exported from src/data/strings.ts; if that file's
 * wording ever changes, mirror the change here too — there is no shared
 * source of truth across the client/server boundary by design now.
 */
export type PrayerName = 'imsak' | 'gunes' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi';

export const PRAYER_LABELS: Record<PrayerName, string> = {
  imsak: 'İmsak',
  gunes: 'Güneş',
  ogle: 'Öğle',
  ikindi: 'İkindi',
  aksam: 'Akşam',
  yatsi: 'Yatsı',
};
