/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiSlashIcon, ArrowsClockwiseIcon, MapPinIcon } from './components/icons';
import { Header } from './components/Header';
import { MainCountdownRing } from './components/MainCountdownRing';
import { DailyFlowList } from './components/DailyFlowList';
import { RamadanModeCard } from './components/RamadanModeCard';
import { SpiritualSettings } from './components/SpiritualSettings';
import { SpiritualHub } from './components/SpiritualHub';
import { ExploreHub } from './components/ExploreHub';
import { Navbar, TabType } from './components/Navbar';
import { LocationSearchScreen } from './components/LocationSearchScreen';
import { ZikirmatikModal } from './components/ZikirmatikModal';
import { KnowledgeSheet } from './components/KnowledgeSheet';
import { KERAHET_KNOWLEDGE } from './data/knowledge';
import {
  registerServiceWorker,
  applyServiceWorkerUpdate,
  subscribeToPush,
  refreshPushSchedule,
  getExistingPushSubscription,
  unsubscribeFromPush,
  PushStatus,
} from './utils/pushClient';
import { shouldShowPushHint } from './utils/pushHint';
import { isNativePlatform } from './utils/platform';
import {
  ensureNotificationChannels,
  requestNativeNotificationPermission,
  checkNativeNotificationPermissionGranted,
  scheduleNativeNotifications,
  cancelAllNativeNotifications,
  getNativeNotificationPermissionState,
  hasScheduledNativeNotifications,
} from './utils/nativeNotifications';
import { writeWidgetPayload } from './utils/widgetStorage';
import { useApiAvailable } from './hooks/useApiAvailable';

import { AppSettings, LocationItem, PrayerName, SoundMode } from './types';
import { getHijriDate } from './utils/hijri';
import { calculateDaySchedule, deriveLiveSchedule } from './utils/prayerCalculator';
import { playEzanAudio } from './utils/audio';
import { findNearestLocation } from './utils/geo';
import { resolveDistrict } from './utils/districtLookup';
import { shouldSuggestLocationChange, isLocationDriftCheckAllowed, LocationDriftPoint } from './utils/locationDrift';
import {
  ZikirmatikState,
  loadZikirmatikState,
  saveZikirmatikState,
  ZikirLog,
  loadZikirLog,
  saveZikirLog,
  addZikirCount,
  pruneOldZikirLogEntries,
  getDayTotal,
} from './utils/zikirmatikStorage';
import { loadAppSettings, saveAppSettings } from './utils/appSettingsStorage';
import { dateKeyInZone } from './utils/timezone';

// 30 günlük zamanlama penceresi sessizce dolarsa bildirimler de sessizce
// durur — kullanıcı bunu Ayarlar'da "son güncelleme" olarak görüp fark
// edebilsin diye her başarılı subscribe/schedule sonrası güncellenir
// (design-refresh-v3 Faz 16).
const PUSH_LAST_SYNC_STORAGE_KEY = 'vakit_push_last_sync_v1';

const PRAYER_ACCENT_VAR: Record<PrayerName, string> = {
  imsak: '--v-imsak',
  gunes: '--v-gunes',
  ogle: '--v-ogle',
  ikindi: '--v-ikindi',
  aksam: '--v-aksam',
  yatsi: '--v-yatsi',
};

const PRAYER_ACCENT_INK_VAR: Record<PrayerName, string> = {
  imsak: '--v-imsak-ink',
  gunes: '--v-gunes-ink',
  ogle: '--v-ogle-ink',
  ikindi: '--v-ikindi-ink',
  aksam: '--v-aksam-ink',
  yatsi: '--v-yatsi-ink',
};

export default function App() {
  // Load settings from localStorage or fallback to defaults — parsing and
  // migration logic lives in appSettingsStorage.ts (unit-tested there
  // directly), mirroring zikirmatikStorage.ts's existing load/save split.
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings);

  const [activeTab, setActiveTab] = useState<TabType>('focus');
  const [now, setNow] = useState(new Date());

  // <main> aşağıda tek scroll konteyneri (window değil) — sekme her
  // değiştiğinde onu en üste al, önceki sekmenin kaydırma konumunda kalmasın.
  // useLayoutEffect: boyama öncesi çalışır, kullanıcı eski konumu görüp
  // sonra yukarı zıplamaz. Aynı sekmeye tekrar basmak activeTab'i
  // değiştirmediği (dolayısıyla bu efekti tetiklemediği) için o durum
  // handleChangeTab içinde ayrıca ele alınıyor.
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [activeTab]);

  const handleChangeTab = (tab: TabType) => {
    if (tab === activeTab && mainRef.current) mainRef.current.scrollTop = 0;
    setActiveTab(tab);
  };

  // Modal States
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isZikirmatikModalOpen, setIsZikirmatikModalOpen] = useState(false);
  const [isKerahetSheetOpen, setIsKerahetSheetOpen] = useState(false);

  // Zikirmatik: single source of truth so the modal and the Maneviyat
  // preview card always agree (previously the card read localStorage only
  // at mount and never saw updates made inside the modal).
  const [zikirState, setZikirState] = useState<ZikirmatikState>(loadZikirmatikState);
  useEffect(() => {
    saveZikirmatikState(zikirState);
  }, [zikirState]);

  // Daily zikir log (design-refresh-v3 Faz 7 F3) — same single-source-of-
  // truth reasoning as zikirState above, keyed by the selected location's
  // own calendar day (not the device's), so a user in a different zone
  // than their selected city sees the log roll over at the *location's*
  // midnight.
  const [zikirLog, setZikirLog] = useState<ZikirLog>(loadZikirLog);
  useEffect(() => {
    saveZikirLog(zikirLog);
  }, [zikirLog]);

  const handleDhikrTap = (dhikrTitle: string) => {
    setZikirLog((prev) => {
      const key = dateKeyInZone(new Date(), schedule.resolvedTimeZone);
      return addZikirCount(pruneOldZikirLogEntries(prev, key), key, dhikrTitle, 1);
    });
  };

  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushLastSyncAt, setPushLastSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PUSH_LAST_SYNC_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const apiAvailable = useApiAvailable();

  const recordPushSync = () => {
    const now = new Date().toISOString();
    setPushLastSyncAt(now);
    try {
      localStorage.setItem(PUSH_LAST_SYNC_STORAGE_KEY, now);
    } catch {
      // localStorage yoksa/doluysa sessizce vazgeç — bu yalnızca bir
      // bilgilendirme etiketi, işlevsel akışı etkilemez.
    }
  };

  const clearPushSync = () => {
    setPushLastSyncAt(null);
    try {
      localStorage.removeItem(PUSH_LAST_SYNC_STORAGE_KEY);
    } catch {
      // no-op
    }
  };

  // Offline-ready service worker (design-refresh-v3 Faz 4 F1).
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Save settings to localStorage
  useEffect(() => {
    saveAppSettings(settings);
  }, [settings]);

  // Timer interval: updates every second for ticking countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Service worker'ı kaydet ve daha önce izin verilmişse aboneliği tespit et
  // (native'de registerServiceWorker zaten no-op — bkz. pushClient.ts).
  useEffect(() => {
    registerServiceWorker(() => setIsUpdateAvailable(true)).then((registration) => {
      if (registration) setSwRegistration(registration);
    });
    (async () => {
      if (isNativePlatform()) {
        const granted = await checkNativeNotificationPermissionGranted();
        if (granted) setPushStatus('granted');
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const existing = await getExistingPushSubscription();
        if (existing) {
          setPushStatus('granted');
        }
      }
    })();
  }, []);

  // "Bildirimler kapalı" ana ekran ipucu — bildirim izni hiç sorulmadıysa
  // kullanıcı bunu fark etmeyebilir (design-refresh-v3 Faz 22 Commit 4).
  // apiAvailable henüz belirlenmeden (null) gösterilmez; koşulun geri kalanı
  // shouldShowPushHint'te (birim testli, saf).
  // pushStatus da bağımlılıkta: bildirimler etkinleştirildiğinde ("Bildirimler
  // etkin" durumuna geçtiğinde) ipucu hemen kaybolmalı, bir sonraki alakasız
  // yeniden render'ı beklememeli — elle test sırasında yakalanan gerçek bir
  // hata (design-refresh-v3 Faz 23 Commit 2).
  const [pushHintVisible, setPushHintVisible] = useState(false);
  useEffect(() => {
    // Native local bildirimler sunucuya hiç ihtiyaç duymaz — apiAvailable
    // web push için anlamlı, native'de bu ipucunu apiAvailable'ın henüz
    // çözülmemiş olması (null) yüzünden geciktirmenin bir anlamı yok.
    if (!isNativePlatform() && apiAvailable === null) return;
    let cancelled = false;
    (async () => {
      const notificationPermission: NotificationPermission | 'unsupported' = isNativePlatform()
        ? await getNativeNotificationPermissionState()
        : typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission;
      const hasExistingSubscription =
        notificationPermission === 'default'
          ? isNativePlatform()
            ? await hasScheduledNativeNotifications()
            : !!(await getExistingPushSubscription())
          : false;
      if (cancelled) return;
      setPushHintVisible(
        shouldShowPushHint({
          notificationPermission,
          hasExistingSubscription,
          apiAvailable: isNativePlatform() ? true : apiAvailable,
          pushHintDismissedAt: settings.pushHintDismissedAt,
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [apiAvailable, settings.pushHintDismissedAt, pushStatus]);

  const handleDismissPushHint = () => {
    setSettings((prev) => ({ ...prev, pushHintDismissedAt: Date.now() }));
    setPushHintVisible(false);
  };

  // A new service worker only takes over once the user taps "Yenile" (see
  // handleApplyUpdate) — this reload picks up the version it just
  // activated. Reloading here rather than inside the click handler itself
  // guarantees the page doesn't reload before the new worker is actually
  // controlling it.
  //
  // controllerchange ALSO fires on a page's very first load, the moment
  // the just-installed worker calls clients.claim() to take over a page
  // that loaded before any worker existed — that's not an update (this
  // load already has the freshest content), so it must not trigger a
  // reload. Only reload when this page was already controlled by some
  // worker at load time and control has now passed to a different one.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const handleControllerChange = () => {
      if (!hadControllerAtLoad || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  // Çevrimdışı durum satırı — vakitler zaten cihazda hesaplanıyor, yalnızca
  // bilgilendirme amaçlı (design-refresh-v3 Faz 4 F1).
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (!swRegistration) return;
    applyServiceWorkerUpdate(swRegistration);
    setIsUpdateAvailable(false);
  };

  // "Başka bir şehirdesiniz gibi görünüyor" önerisi — sessizce hiçbir
  // zaman otomatik değiştirmez, yalnızca öneride bulunur (design-refresh-v3
  // Faz 4 F2, karar mantığı Faz 24 Commit 2'de src/utils/locationDrift.ts'e
  // taşındı — bkz. şouldSuggestLocationChange'in doc yorumu: eski mantık
  // soğuk açılışta hiç tetiklenmiyordu, doğruluk hiç kontrol edilmiyordu,
  // reddedilen bir öneri hatırlanmıyordu). watchPosition bilerek
  // kullanılmıyor: sürekli GPS dinlemek pili gereksiz tüketir, namaz vakti
  // bu kadar sık takip gerektirmez. Tetikleyici TEK yerde toplanır: soğuk
  // açılış (mount) + visibilitychange (yalnızca son kontrolden 15+ dk
  // geçmişse) — başka hiçbir yerden çağrılmaz.
  const [locationSuggestion, setLocationSuggestion] = useState<LocationItem | null>(null);
  const settingsLocationRef = useRef(settings.location);
  useEffect(() => {
    settingsLocationRef.current = settings.location;
  }, [settings.location]);
  const dismissedLocationRef = useRef<LocationDriftPoint | null>(null);
  const lastLocationDriftCheckRef = useRef(0);
  const LOCATION_DRIFT_CHECK_COOLDOWN_MS = 15 * 60 * 1000;

  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return;

    const checkLocationDrift = async () => {
      let permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported';
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        permissionState = status.state;
      } catch {
        permissionState = 'unsupported'; // Permissions API desteklenmiyor
      }
      if (!isLocationDriftCheckAllowed(permissionState)) return;

      lastLocationDriftCheckRef.current = Date.now();
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const nearest = findNearestLocation(latitude, longitude);
          // Point-in-polygon over real district boundaries — doesn't share
          // findNearestLocation's nearest-centroid mistake, so prefer it
          // over the centroid guess when it resolves.
          const boundary = await resolveDistrict(latitude, longitude);
          const detectedCityName = boundary?.il ?? nearest.cityName;
          const detectedDistrictName = boundary?.ilce ?? nearest.districtName;
          const current = settingsLocationRef.current;
          const shouldSuggest = shouldSuggestLocationChange({
            current: {
              lat: current.lat,
              lng: current.lng,
              label: current.districtName,
              source: current.isGpsDerived ? 'gps' : 'manual',
            },
            detected: { lat: latitude, lng: longitude, label: detectedDistrictName, accuracy },
            dismissed: dismissedLocationRef.current,
            now: Date.now(),
          });
          if (shouldSuggest) {
            setLocationSuggestion({
              ...nearest,
              cityName: detectedCityName,
              districtName: detectedDistrictName,
              id: `gps-${Date.now()}`,
              lat: latitude,
              lng: longitude,
            });
          }
        },
        () => {
          // Sessiz arka plan kontrolü — hata durumunda kullanıcıyı rahatsız etme
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    };

    checkLocationDrift(); // soğuk açılış

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLocationDriftCheckRef.current < LOCATION_DRIFT_CHECK_COOLDOWN_MS) return;
      checkLocationDrift();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleAcceptLocationSuggestion = () => {
    if (!locationSuggestion) return;
    setSettings((prev) => ({ ...prev, location: locationSuggestion }));
    setLocationSuggestion(null);
  };

  const handleDismissLocationSuggestion = () => {
    if (locationSuggestion) {
      dismissedLocationRef.current = { lat: locationSuggestion.lat, lng: locationSuggestion.lng, ts: Date.now() };
    }
    setLocationSuggestion(null);
  };

  // Ayarlar değiştikçe (konum, hesaplama yöntemi, bildirim tercihleri) 30
  // günlük zamanlamayı sunucuda yenile — eskisi tamamen yerini alır, asla
  // birleşmez (design-refresh-v3 Faz 15: değişmeyen ayarla bildirim almak
  // yanlış şehrin vaktinde bildirim almak demektir). Uygulama her açılışında
  // da çalışır (pushStatus mount sırasında 'granted' olur), zamanlamanın
  // 30 günü aşmasını da böylece önler.
  useEffect(() => {
    if (pushStatus !== 'granted') return;
    if (isNativePlatform()) {
      scheduleNativeNotifications(settings).then((result) => {
        if (result.ok) recordPushSync();
      });
      return;
    }
    refreshPushSchedule(settings).then((result) => {
      if (result.ok) recordPushSync();
    });
  }, [settings, pushStatus]);

  // Widget veri köprüsü: yalnızca native'de yazar (writeWidgetPayload kendi
  // içinde no-op). Açılışta ve konum/hesaplama yöntemi değiştiğinde yazar
  // (design-refresh-v3 Faz 23 Commit 3).
  useEffect(() => {
    writeWidgetPayload(settings);
  }, [settings.location, settings.calculationMethod]);

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

  // Widget verisi: uygulama ön plana geldiğinde takvim günü değiştiyse
  // yeniden yazar — 7 günlük veri birkaç gün açılmadan bayatlamasın diye
  // bir güvenlik payı olsa da, widget'ın en azından gün geçişini kaçırmadan
  // tazelenmesini garanti eder (design-refresh-v3 Faz 23 Commit 3).
  const lastWidgetWriteDateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isNativePlatform()) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const todayKey = dateKeyInZone(new Date(), schedule.resolvedTimeZone);
      if (lastWidgetWriteDateKeyRef.current !== todayKey) {
        lastWidgetWriteDateKeyRef.current = todayKey;
        writeWidgetPayload(settings);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings, schedule.resolvedTimeZone]);

  // Uygulama açıkken vakit değişince ezan sesi çal — bu app'in gerçekten
  // tutabildiği tek ses vaadi (design-refresh-v3 Faz 7 F1): push bildirimi
  // sesi tarayıcı/OS tarafından belirlenir, bu ayardan bağımsızdır.
  const previousActivePrayerRef = useRef<PrayerName | null>(null);
  useEffect(() => {
    const activeName = schedule.activePrayer.name;
    if (
      previousActivePrayerRef.current !== null &&
      previousActivePrayerRef.current !== activeName &&
      settings.playEzanInForeground
    ) {
      playEzanAudio();
    }
    previousActivePrayerRef.current = activeName;
  }, [schedule.activePrayer.name, settings.playEzanInForeground]);

  // Compute Hijri Date
  const hijriDate = useMemo(() => {
    return getHijriDate(now, schedule.resolvedTimeZone);
  }, [now, schedule.resolvedTimeZone]);

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
    document.documentElement.style.setProperty(
      '--accent-ink',
      `var(${PRAYER_ACCENT_INK_VAR[schedule.activePrayer.name]})`
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

  // Native'de web push yerine yerel bildirime geçilir (design-refresh-v3
  // Faz 23 Commit 2) — SpiritualSettings'in görünümü aynı kalır, kullanıcı
  // için "bildirimler açık/kapalı" aynı şeydir, yalnızca altındaki mekanizma
  // farklıdır. Vakitler zaten cihazda hesaplandığı için sunucuya hiç
  // ihtiyaç yok; bu yüzden native'de Railway'e hiçbir abonelik kaydı gitmez.
  const handleEnablePush = async () => {
    setPushStatus('loading');
    setPushError(null);

    if (isNativePlatform()) {
      await ensureNotificationChannels();
      const permResult = await requestNativeNotificationPermission();
      if ('reason' in permResult) {
        setPushStatus(permResult.reason === 'Bildirim izni verilmedi.' ? 'denied' : 'error');
        setPushError(permResult.reason);
        return;
      }
      const scheduleResult = await scheduleNativeNotifications(settings);
      if ('reason' in scheduleResult) {
        setPushStatus('error');
        setPushError(scheduleResult.reason);
        return;
      }
      setPushStatus('granted');
      recordPushSync();
      return;
    }

    const result = await subscribeToPush(settings);
    if ('reason' in result) {
      setPushStatus(result.reason === 'Bildirim izni verilmedi.' ? 'denied' : 'error');
      setPushError(result.reason);
    } else {
      setPushStatus('granted');
      recordPushSync();
    }
  };

  // Gizlilik Politikası'nın sözünü tutar: kullanıcı bildirimleri kapattığında
  // hem tarayıcı aboneliği iptal edilir hem sunucudaki kayıt silinir
  // (design-refresh-v3 Faz 9 M5). apiAvailable === false iken bu buton zaten
  // görünmez (SpiritualSettings'in bildirim bölümü tamamen gizli) — yine de
  // unsubscribeFromPush kendi içinde apiAvailable'ı kontrol ederek sunucu
  // çağrısını atlıyor, tanımsız bir true/false yerine güvenli bir varsayılan.
  const handleDisablePush = async () => {
    setPushStatus('loading');
    if (isNativePlatform()) {
      await cancelAllNativeNotifications();
      setPushStatus('idle');
      clearPushSync();
      return;
    }
    await unsubscribeFromPush(apiAvailable === true);
    setPushStatus('idle');
    clearPushSync();
  };

  return (
    <div className="h-[100dvh] max-w-[var(--shell-w)] mx-auto bg-paper text-ink flex flex-col justify-between app-shell-padding selection:bg-gold selection:text-white">
      {/* Üst Bar / Header */}
      <Header
        location={settings.location}
        hijriDate={hijriDate}
        date={now}
        timeZone={schedule.resolvedTimeZone}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenExplore={() => setActiveTab('explore')}
        onOpenZikirmatikModal={() => setIsZikirmatikModalOpen(true)}
      />

      {/* Çevrimdışı durum satırı — vakitler cihazda hesaplandığı için
          işlevsellik kaybı yok, bu yalnızca bilgilendirme (design-refresh-v3
          Faz 4 F1). */}
      {isOffline && (
        <div className="w-full shrink-0 max-w-[var(--shell-w)] mx-auto px-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-hairline text-micro text-mist">
            <WifiSlashIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Çevrimdışısınız — vakitler cihazınızda hesaplanmaya devam ediyor.</span>
          </div>
        </div>
      )}

      {/* Yeni sürüm hazır satırı — kullanıcı onayı olmadan sayfa yenilenmez.
          Native'de güncelleme Play Store'dan gelir; registerServiceWorker
          zaten native'de null dönüp bu akışı hiç tetiklemiyor, ama yanlışlıkla
          çalışmayan bir buton göstermeyi imkansız kılmak için burada da açıkça
          gate ediliyor (design-refresh-v3 Faz 23 Commit 1). */}
      {isUpdateAvailable && !isNativePlatform() && (
        <div className="w-full shrink-0 max-w-[var(--shell-w)] mx-auto px-4 mt-2">
          <button
            onClick={handleApplyUpdate}
            className="min-h-[44px] w-full flex items-center justify-center gap-2 px-3 rounded-xl bg-gold/10 border border-gold/20 text-xs font-semibold text-gold-ink cursor-pointer hover:bg-gold/15 transition-colors"
          >
            <ArrowsClockwiseIcon className="w-4 h-4 shrink-0" />
            Yeni sürüm hazır — Yenile
          </button>
        </div>
      )}

      {/* Konum değişikliği önerisi — kullanıcı onayı olmadan konum asla
          değişmez, yalnızca öneri sunulur (design-refresh-v3 Faz 4 F2). */}
      {locationSuggestion && (
        <div className="w-full shrink-0 max-w-[var(--shell-w)] mx-auto px-4 mt-2">
          <div className="p-3 rounded-xl bg-card border border-hairline">
            <div className="flex items-start gap-2">
              <MapPinIcon className="w-4 h-4 text-gold-ink shrink-0 mt-0.5" />
              <p className="text-xs text-ink flex-1">
                Başka bir şehirdesiniz gibi görünüyor —{' '}
                <span className="font-semibold">{locationSuggestion.districtName}</span> vakitlerine
                geçilsin mi?
              </p>
            </div>
            <div className="flex items-center justify-end gap-4 mt-2">
              <button
                onClick={handleDismissLocationSuggestion}
                className="min-h-[44px] px-3 text-xs font-semibold text-mist hover:text-ink transition-colors cursor-pointer"
              >
                Kal
              </button>
              <button
                onClick={handleAcceptLocationSuggestion}
                className="min-h-[44px] px-3 text-xs font-semibold text-gold-ink hover:underline cursor-pointer"
              >
                Geç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ana İçerik Alanı */}
      {/* [scrollbar-gutter:stable]: kalıcı genel çözüm — dikey kaydırma
          çubuğu HANGİ sebeple belirip kaybolursa kaybolsun (bu geçiş,
          gelecekte eklenecek başka bir içerik değişikliği), <main>'in
          genişliği sabit kalır; çubuk için yer her zaman ayrılmış olur
          (design-refresh-v3 Faz 18). */}
      <main
        ref={mainRef}
        className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] scrollbar-hide"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            // y ekseninde kayma YOK — yalnızca opacity (design-refresh-v3
            // Faz 18). Kök sebep: transform:translateY, CSS'in tanımına
            // göre bir taşınan torunun geometrisi hâlâ en yakın
            // overflow:visible olmayan atasının (burada <main>) kaydırılabilir
            // taşma alanına dahil olur — iç sarmalayıcıya taşımak bunu
            // gerçekten çözmez, torun yine <main>'in torunu kalır. y:8 ile
            // monte olan panel 8px daha aşağı taşıyor, <main> geçici olarak
            // "taşıyor" sanıyor, dikey kaydırma çubuğu beliriyor → içerik
            // ~15px daralıyor → y sıfırlanınca çubuk kayboluyor → gridler
            // geri genişliyor. Transformu tamamen kaldırmak, scrollbar-gutter
            // gibi bir yan etkiyi gizlemek yerine kök nedeni ortadan kaldırır.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            {activeTab === 'focus' && (
              <>
                <RamadanModeCard schedule={schedule} now={now} />
                <MainCountdownRing
                  schedule={schedule}
                  now={now}
                  onOpenKerahetInfo={() => setIsKerahetSheetOpen(true)}
                  isPushHintVisible={pushHintVisible}
                  onOpenPushSettings={() => setActiveTab('settings')}
                  onDismissPushHint={handleDismissPushHint}
                />
              </>
            )}

            {activeTab === 'flow' && (
              <DailyFlowList
                schedule={schedule}
                notifications={settings.notifications}
                calculationMethod={settings.calculationMethod}
                onOpenSettings={() => setActiveTab('settings')}
                onOpenKerahetInfo={() => setIsKerahetSheetOpen(true)}
              />
            )}

            {activeTab === 'spiritual' && (
              <SpiritualHub
                location={settings.location}
                zikirState={zikirState}
                todayZikirTotal={getDayTotal(zikirLog, dateKeyInZone(now, schedule.resolvedTimeZone))}
                onOpenZikirmatikModal={() => setIsZikirmatikModalOpen(true)}
                onOpenKerahetInfo={() => setIsKerahetSheetOpen(true)}
              />
            )}

            {activeTab === 'explore' && <ExploreHub location={settings.location} />}

            {activeTab === 'settings' && (
              <SpiritualSettings
                settings={settings}
                schedule={schedule}
                onUpdateSettings={handleUpdateSettings}
                onUpdateNotification={handleUpdateNotification}
                pushStatus={pushStatus}
                pushError={pushError}
                pushLastSyncAt={pushLastSyncAt}
                onEnablePush={handleEnablePush}
                onDisablePush={handleDisablePush}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Alt Navigasyon Barı */}
      <Navbar activeTab={activeTab} onChangeTab={handleChangeTab} />

      {/* Modallar */}
      <LocationSearchScreen
        currentLocation={settings.location}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectLocation={(loc: LocationItem) =>
          handleUpdateSettings({ location: loc })
        }
      />

      <ZikirmatikModal
        isOpen={isZikirmatikModalOpen}
        onClose={() => setIsZikirmatikModalOpen(false)}
        state={zikirState}
        onChange={setZikirState}
        onDhikrTap={handleDhikrTap}
      />

      <KnowledgeSheet
        entry={KERAHET_KNOWLEDGE}
        isOpen={isKerahetSheetOpen}
        onClose={() => setIsKerahetSheetOpen(false)}
      />
    </div>
  );
}
