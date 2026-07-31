/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MainCountdownRing } from './components/MainCountdownRing';
import { DailyFlowList } from './components/DailyFlowList';
import { SpiritualSettings } from './components/SpiritualSettings';
import { DailyInspirationCard } from './components/DailyInspirationCard';
import { Navbar, TabType } from './components/Navbar';
import { LocationModal } from './components/LocationModal';
import { QiblaCompassModal } from './components/QiblaCompassModal';
import { ZikirmatikModal } from './components/ZikirmatikModal';
import { LiveActivityWidgetModal } from './components/LiveActivityWidgetModal';

import { AppSettings, LocationItem, PrayerName, SoundMode } from './types';
import { DEFAULT_LOCATION } from './data/locations';
import { getHijriDate } from './utils/hijri';
import { calculatePrayerTimes } from './utils/prayerCalculator';

const LOCAL_STORAGE_KEY = 'vakit_app_settings_v1';

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

  // Compute prayer schedule for selected location and time
  const schedule = useMemo(() => {
    return calculatePrayerTimes(
      settings.location,
      now,
      settings.calculationMethod
    );
  }, [settings.location, settings.calculationMethod, now]);

  // Compute Hijri Date
  const hijriDate = useMemo(() => {
    return getHijriDate(now);
  }, [now]);

  // Dark Mode calculation: checks auto mode or manual mode
  const isDarkMode = useMemo(() => {
    if (settings.themeMode === 'dark') return true;
    if (settings.themeMode === 'light') return false;

    // Auto theme mode: Dark after Maghrib (Akşam) or before Fajr (İmsak)
    const currentHour = now.getHours();
    return currentHour >= 20 || currentHour < 6;
  }, [settings.themeMode, now]);

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

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between pb-20 selection:bg-[#D6A84D] selection:text-white">
      {/* Üst Bar / Header */}
      <Header
        location={settings.location}
        hijriDate={hijriDate}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenQiblaModal={() => setIsQiblaModalOpen(true)}
        onOpenZikirmatikModal={() => setIsZikirmatikModalOpen(true)}
      />

      {/* Ana İçerik Alanı */}
      <main className="flex-1 flex flex-col">
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
          <div className="flex-1 flex flex-col justify-center">
            <DailyInspirationCard />
            <div className="w-full max-w-md mx-auto px-4 mt-2 grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsQiblaModalOpen(true)}
                className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] text-left hover:border-[#D6A84D] transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-[#D6A84D] uppercase tracking-wider">
                  Pusula
                </div>
                <div className="text-sm font-serif-title font-bold text-[var(--ink)] mt-1">
                  Kıble Açısı
                </div>
              </button>

              <button
                onClick={() => setIsZikirmatikModalOpen(true)}
                className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] text-left hover:border-[#D6A84D] transition-colors cursor-pointer"
              >
                <div className="text-xs font-bold text-[#D6A84D] uppercase tracking-wider">
                  Tesbihat
                </div>
                <div className="text-sm font-serif-title font-bold text-[var(--ink)] mt-1">
                  Sakin Zikirmatik
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <SpiritualSettings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onUpdateNotification={handleUpdateNotification}
          />
        )}
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
      />

      <LiveActivityWidgetModal
        schedule={schedule}
        isOpen={isLiveActivityModalOpen}
        onClose={() => setIsLiveActivityModalOpen(false)}
      />
    </div>
  );
}
