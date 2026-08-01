/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Header } from './components/Header';
import { MainCountdownRing } from './components/MainCountdownRing';
import { DailyFlowList } from './components/DailyFlowList';
import { SpiritualSettings } from './components/SpiritualSettings';
import { SpiritualHub } from './components/SpiritualHub';
import { Navbar, TabType } from './components/Navbar';
import { LocationModal } from './components/LocationModal';
import { QiblaCompassModal } from './components/QiblaCompassModal';
import { ZikirmatikModal } from './components/ZikirmatikModal';
import { LiveActivityWidgetModal } from './components/LiveActivityWidgetModal';
import {
  registerServiceWorker,
  subscribeToPush,
  syncSubscription,
  getExistingPushSubscription,
  PushStatus,
} from './utils/pushClient';

import { AppSettings, LocationItem, PrayerName, SoundMode } from './types';
import { DEFAULT_LOCATION } from './data/locations';
import { getHijriDate } from './utils/hijri';
import { calculateDaySchedule, deriveLiveSchedule } from './utils/prayerCalculator';
import { playSoundForMode } from './utils/audio';
import { ZikirmatikState, loadZikirmatikState, saveZikirmatikState } from './utils/zikirmatikStorage';

const LOCAL_STORAGE_KEY = 'vakit_app_settings_v1';

const PRAYER_ACCENT_VAR: Record<PrayerName, string> = {
  imsak: '--v-imsak',
  gunes: '--v-gunes',
  ogle: '--v-ogle',
  ikindi: '--v-ikindi',
  aksam: '--v-aksam',
  yatsi: '--v-yatsi',
};

export default function App() {
  // Load settings from localStorage or fallback to defaults
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
    return {
      themeMode: 'auto',
      calculationMethod: 'Diyanet',
      location: DEFAULT_LOCATION,
      notifications: {
        imsak: 'ezan',
        gunes: 'sessiz',
        ogle: 'ezan',
        ikindi: 'ezan',
        aksam: 'ezan',
        yatsi: 'ezan',
        earlyWarningMinutes: 15,
        earlyWarningSound: 'tini',
      },
    };
  });

  const [activeTab, setActiveTab] = useState<TabType>('focus');
  const [now, setNow] = useState(new Date());

  // Modal States
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isQiblaModalOpen, setIsQiblaModalOpen] = useState(false);
  const [isZikirmatikModalOpen, setIsZikirmatikModalOpen] = useState(false);
  const [isLiveActivityModalOpen, setIsLiveActivityModalOpen] = useState(false);

  // Zikirmatik: single source of truth so the modal and the Maneviyat
  // preview card always agree (previously the card read localStorage only
  // at mount and never saw updates made inside the modal).
  const [zikirState, setZikirState] = useState<ZikirmatikState>(loadZikirmatikState);
  useEffect(() => {
    saveZikirmatikState(zikirState);
  }, [zikirState]);

  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushError, setPushError] = useState<string | null>(null);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  // Timer interval: updates every second for ticking countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Service worker'ı kaydet ve daha önce izin verilmişse aboneliği tespit et
  useEffect(() => {
    registerServiceWorker();
    (async () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const existing = await getExistingPushSubscription();
        if (existing) {
          setPushStatus('granted');
        }
      }
    })();
  }, []);

  // Ayarlar değiştikçe backend'deki aboneliği güncel tut
  useEffect(() => {
    if (pushStatus !== 'granted') return;
    (async () => {
      const existing = await getExistingPushSubscription();
      if (existing) {
        await syncSubscription(existing, settings);
      }
    })();
  }, [settings, pushStatus]);

  // Expensive adhan computation: only re-runs when location, method, or the
  // calendar day changes — not on every one-second tick (see B4 in the
  // design-refresh-v2 spec).
  const daySchedule = useMemo(() => {
    return calculateDaySchedule(
      settings.location,
      now,
      settings.calculationMethod
    );
  }, [settings.location, settings.calculationMethod, now.toDateString()]);

  // Cheap per-tick derivation (active/next prayer, countdown, ring
  // progress, kerahet activity) from the memoized day schedule.
  const schedule = useMemo(() => deriveLiveSchedule(daySchedule, now), [daySchedule, now]);

  // Uygulama açıkken vakit değişince seçili sesi bir kez otomatik çal
  const previousActivePrayerRef = useRef<PrayerName | null>(null);
  useEffect(() => {
    const activeName = schedule.activePrayer.name;
    if (
      previousActivePrayerRef.current !== null &&
      previousActivePrayerRef.current !== activeName
    ) {
      const mode = settings.notifications[activeName];
      if (mode !== 'sessiz') {
        playSoundForMode(mode);
      }
    }
    previousActivePrayerRef.current = activeName;
  }, [schedule.activePrayer.name, settings.notifications]);

  // Compute Hijri Date
  const hijriDate = useMemo(() => {
    return getHijriDate(now);
  }, [now]);

  // Dark Mode calculation: checks auto mode or manual mode
  const isDarkMode = useMemo(() => {
    if (settings.themeMode === 'dark') return true;
    if (settings.themeMode === 'light') return false;

    // Auto theme mode: dark from today's real Akşam (maghrib) until
    // today's real İmsak (fajr) — not a fixed hour heuristic.
    const aksamTime = schedule.prayers.find((p) => p.name === 'aksam')!.dateObj;
    const imsakTime = schedule.prayers.find((p) => p.name === 'imsak')!.dateObj;
    return now >= aksamTime || now < imsakTime;
  }, [settings.themeMode, schedule.prayers, now]);

  // Aktif vakte göre --accent değişkenini güncelle ("Gün Kavisi" vurgu rengi)
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--accent',
      `var(${PRAYER_ACCENT_VAR[schedule.activePrayer.name]})`
    );
  }, [schedule.activePrayer.name]);

  // Apply .dark class to root html / body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handlers
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleUpdateNotification = (prayer: PrayerName, mode: SoundMode) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [prayer]: mode,
      },
    }));
  };

  const handleToggleDarkMode = () => {
    setSettings((prev) => ({
      ...prev,
      themeMode: prev.themeMode === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleEnablePush = async () => {
    setPushStatus('loading');
    setPushError(null);
    const result = await subscribeToPush(settings);
    if ('reason' in result) {
      setPushStatus(result.reason === 'Bildirim izni verilmedi.' ? 'denied' : 'error');
      setPushError(result.reason);
    } else {
      setPushStatus('granted');
    }
  };

  return (
    <div className="min-h-[100dvh] max-w-[var(--shell-w)] mx-auto bg-paper text-ink flex flex-col justify-between app-shell-padding selection:bg-gold selection:text-white">
      {/* Üst Bar / Header */}
      <Header
        location={settings.location}
        hijriDate={hijriDate}
        date={now}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenQiblaModal={() => setIsQiblaModalOpen(true)}
        onOpenZikirmatikModal={() => setIsZikirmatikModalOpen(true)}
      />

      {/* Ana İçerik Alanı */}
      <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            {activeTab === 'focus' && (
              <MainCountdownRing
                schedule={schedule}
                onScrollToFlow={() => setActiveTab('flow')}
                onOpenLiveActivity={() => setIsLiveActivityModalOpen(true)}
              />
            )}

            {activeTab === 'flow' && (
              <DailyFlowList
                schedule={schedule}
                notifications={settings.notifications}
                onOpenSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'spiritual' && (
              <SpiritualHub
                location={settings.location}
                zikirState={zikirState}
                onOpenQiblaModal={() => setIsQiblaModalOpen(true)}
                onOpenZikirmatikModal={() => setIsZikirmatikModalOpen(true)}
              />
            )}

            {activeTab === 'settings' && (
              <SpiritualSettings
                settings={settings}
                schedule={schedule}
                onUpdateSettings={handleUpdateSettings}
                onUpdateNotification={handleUpdateNotification}
                pushStatus={pushStatus}
                pushError={pushError}
                onEnablePush={handleEnablePush}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Alt Navigasyon Barı */}
      <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Modallar */}
      <LocationModal
        currentLocation={settings.location}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectLocation={(loc: LocationItem) =>
          handleUpdateSettings({ location: loc })
        }
      />

      <QiblaCompassModal
        location={settings.location}
        isOpen={isQiblaModalOpen}
        onClose={() => setIsQiblaModalOpen(false)}
      />

      <ZikirmatikModal
        isOpen={isZikirmatikModalOpen}
        onClose={() => setIsZikirmatikModalOpen(false)}
        state={zikirState}
        onChange={setZikirState}
      />

      <LiveActivityWidgetModal
        schedule={schedule}
        isOpen={isLiveActivityModalOpen}
        onClose={() => setIsLiveActivityModalOpen(false)}
      />
    </div>
  );
}
