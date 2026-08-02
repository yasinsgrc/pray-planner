import {
  MoonStarsIcon,
  SunIcon,
  CloudSunIcon,
  SunDimIcon,
  SunHorizonIcon,
  SparkleIcon,
  Icon,
} from './icons';
import { PrayerName } from '../types';

/** Shared per-prayer icon component, keyed by prayer name — each consumer applies its own size/className. */
export const PRAYER_ICON_COMPONENTS: Record<PrayerName, Icon> = {
  imsak: MoonStarsIcon,
  gunes: SunHorizonIcon,
  ogle: SunIcon,
  ikindi: SunDimIcon,
  aksam: CloudSunIcon,
  yatsi: SparkleIcon,
};
