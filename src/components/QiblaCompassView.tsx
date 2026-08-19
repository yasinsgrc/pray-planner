import React, { useEffect, useRef, useState } from 'react';
import { CompassIcon, WarningCircleIcon, CopyIcon, CheckIcon } from './icons';
import { LocationItem } from '../types';
import { useCompassHeading, CompassDebugInfo } from '../hooks/useCompassHeading';
import { isAlignedWithBearing, getTurnInstruction, DriftCharacter } from '../utils/compassHeading';
import { calculateQiblaBearing } from '../utils/qibla';

interface QiblaCompassViewProps {
  location: LocationItem;
  /** Gates the device-orientation listeners in useCompassHeading — only the
   * currently visible Keşfet sub-view should keep sensors active. */
  active: boolean;
}

// Tapping the degree readout this many times within DEV_TAP_WINDOW_MS
// reveals a raw-sensor debug panel — a temporary diagnostic aid for
// verifying real-device compass behavior (design-refresh-v3 Faz 13), not a
// permanent feature. No UI entry point advertises it on purpose.
const DEV_TAP_COUNT = 7;
const DEV_TAP_WINDOW_MS = 3000;

const ACTIVE_EVENT_TYPE_LABEL: Record<CompassDebugInfo['activeEventType'], string> = {
  webkitCompassHeading: 'webkitCompassHeading (iOS)',
  deviceorientationabsolute: 'deviceorientationabsolute',
  deviceorientation: 'deviceorientation (absolute:true)',
  none: 'yok — kullanılabilir kaynak yok',
};

const DRIFT_CHARACTER_LABEL: Record<DriftCharacter, string> = {
  'insufficient-data': 'ölçülüyor… (yetersiz veri)',
  stable: 'sabit (gerçek hareket yok)',
  monotonic: 'tek yönlü (muhtemel sürüklenme)',
  oscillating: 'salınımlı (gürültü, sürüklenme değil)',
};

export const QiblaCompassView: React.FC<QiblaCompassViewProps> = ({ location, active }) => {
  const { heading, permissionState, requestPermission, needsCalibration, debug } =
    useCompassHeading(active);
  const wasAlignedRef = useRef(false);
  const [devPanelVisible, setDevPanelVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const tapTimesRef = useRef<number[]>([]);

  const qiblaBearing = calculateQiblaBearing(location);
  const qiblaFormatted = Math.round(qiblaBearing);

  const needleRotation =
    heading !== null ? (qiblaBearing - heading + 360) % 360 : qiblaBearing;
  const aligned = heading !== null && isAlignedWithBearing(qiblaBearing, heading, 5);
  const turnInstruction = heading !== null ? getTurnInstruction(qiblaBearing, heading, 5) : null;

  useEffect(() => {
    if (aligned && !wasAlignedRef.current && navigator.vibrate) {
      navigator.vibrate(50);
    }
    wasAlignedRef.current = aligned;
  }, [aligned]);

  const needleColorClass = aligned ? 'text-success' : 'text-gold';

  const handleDegreeTap = () => {
    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t < DEV_TAP_WINDOW_MS);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= DEV_TAP_COUNT) {
      setDevPanelVisible((prev) => !prev);
      tapTimesRef.current = [];
    }
  };

  const buildDebugReportText = () =>
    [
      `platform: ${debug.userAgentSummary || 'bilinmiyor'}`,
      `aktif API: ${ACTIVE_EVENT_TYPE_LABEL[debug.activeEventType]}`,
      `absolute: ${debug.isAbsolute}`,
      `alpha: ${debug.alpha ?? 'null'}`,
      `webkitCompassHeading: ${debug.webkitCompassHeading ?? 'yok'}`,
      `webkitCompassAccuracy: ${debug.webkitCompassAccuracy ?? 'yok'}`,
      `screen.orientation.angle: ${debug.screenAngle}`,
      `ham heading: ${debug.rawHeading ?? 'null'}`,
      `yumuşatılmış heading: ${debug.smoothedHeading?.toFixed(2) ?? 'null'}`,
      `son heading (dönüşüm telafili): ${heading?.toFixed(2) ?? 'null'}`,
      `kıble açısı: ${qiblaBearing.toFixed(2)}`,
      `fark: ${heading !== null ? Math.abs(qiblaBearing - heading).toFixed(2) : 'null'}`,
      `kalibrasyon uyarısı: ${needsCalibration}`,
      `oturum ilk okuması: ${debug.firstRawHeadingDeg ?? 'null'}`,
      `60sn sürüklenme (uç-uca): ${debug.driftDeg !== null ? `${debug.driftDeg.toFixed(1)}°` : 'ölçülüyor…'}`,
      `60sn min/maks/ort: ${debug.stats ? `${debug.stats.min.toFixed(1)} / ${debug.stats.max.toFixed(1)} / ${debug.stats.average.toFixed(1)}` : 'ölçülüyor…'}`,
      `60sn toplam yayılım (dairesel): ${debug.stats ? `${debug.stats.spread.toFixed(1)}°` : 'ölçülüyor…'}`,
      `kayma karakteri: ${DRIFT_CHARACTER_LABEL[debug.driftCharacter]}`,
    ].join('\n');

  const directionText = aligned
    ? 'Kıbleye yönelik'
    : turnInstruction
      ? `${turnInstruction.degrees}° ${turnInstruction.direction === 'right' ? 'sağa' : 'sola'} dönün`
      : null;

  return (
    <div className="text-center space-y-4 pb-2">
      <div>
        <h2 className="font-bold text-base text-ink">Kıble Pusulası</h2>
        <p className="text-[11px] text-mist mt-1">
          {location.districtName}, {location.cityName} için derece açısı
        </p>
      </div>

      {/* Pusula Görsel Alanı */}
      <div
        className={`relative w-52 h-52 mx-auto flex items-center justify-center rounded-full border-2 bg-paper shadow-inner transition-colors duration-300 ${
          aligned ? 'border-success/50' : 'border-gold/30'
        }`}
      >
        {/* Kuzey / Güney / Doğu / Batı İşaretleri */}
        <span className="absolute top-2 text-[10px] font-bold text-danger-ink">N (Kuzey)</span>
        <span className="absolute bottom-2 text-[10px] font-bold text-mist">S (Güney)</span>
        <span className="absolute right-2 text-[10px] font-bold text-mist">E (Doğu)</span>
        <span className="absolute left-2 text-[10px] font-bold text-mist">W (Batı)</span>

        {/* Dönen Kıble İbresi */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${needleRotation}deg)` }}
        >
          <div className="flex flex-col items-center justify-start h-full py-3">
            {/* Kâbe Simgesi / Altın İbre Başı — bilerek temadan bağımsız koyu (gerçek Kâbe rengi) */}
            <div
              className={`w-7 h-7 rounded-lg bg-[#2D2D2D] border-2 flex items-center justify-center shadow-md transition-colors duration-300 ${
                aligned ? 'border-success' : 'border-gold'
              }`}
            >
              <span className={`text-[10px] font-bold ${needleColorClass}`}>KÂBE</span>
            </div>
            <div
              className={`w-0.5 h-16 transition-colors duration-300 ${
                aligned ? 'bg-success' : 'bg-gold'
              }`}
            />
          </div>
        </div>

        {/* Merkez Nokta */}
        <div
          className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors duration-300 ${
            aligned ? 'bg-success' : 'bg-gold'
          }`}
        />
      </div>

      <div className="p-3 rounded-xl bg-gold/10 border border-gold/20 text-xs">
        <div className="text-[11px] text-mist">Kâbe-i Muazzama Açısı</div>
        {/* Bilerek <button>/role değil: bu, gizli geliştirici hata ayıklama
            paneli için 7 dokunuşluk bir aktivasyon (handleDegreeTap) —
            gerçek bir kontrol değil, dokunma hedefi denetimine veya
            ekran okuyucuya "burada bir işlem var" izlenimi vermemeli. */}
        <div
          onClick={handleDegreeTap}
          className="font-numbers text-xl font-extrabold text-gold-ink mt-0.5"
        >
          {qiblaFormatted}°
        </div>
        <p className="text-[10px] text-mist mt-1">
          Telefonunuzu düz bir zemin üzerinde tutarak pusula ibresini Kâbe yönüne çeviriniz.
        </p>
      </div>

      {permissionState === 'idle' && (
        <button
          onClick={requestPermission}
          className="w-full min-h-[48px] px-4 rounded-xl bg-gold hover:bg-gold-hover text-on-gold font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <CompassIcon className="w-4 h-4" />
          <span>Pusulayı Etkinleştir</span>
        </button>
      )}

      {permissionState === 'denied' && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
          <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-danger-ink">
              İzin reddedildi. Tarayıcı ayarlarından hareket sensörü iznini açıp tekrar deneyin.
            </p>
            <button
              onClick={requestPermission}
              className="relative text-[11px] font-semibold text-gold-ink hover:underline cursor-pointer mt-1 before:content-[''] before:absolute before:-inset-4"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {permissionState === 'unsupported' && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
          <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-danger-ink">
              Cihazınız pusula sensörünü desteklemiyor, açı bilgisini yukarıdan kullanabilirsiniz.
            </p>
            <button
              onClick={requestPermission}
              className="relative text-[11px] font-semibold text-gold-ink hover:underline cursor-pointer mt-1 before:content-[''] before:absolute before:-inset-4"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* aria-live: ekran okuyucu kullanan biri de pusulaya bakmadan,
          sadece bu duyuruyu dinleyerek yönelebilsin. */}
      {directionText && (
        <p
          aria-live="polite"
          className={`text-[11px] font-semibold ${aligned ? 'text-success-ink' : 'text-gold-ink'}`}
        >
          {directionText}
        </p>
      )}

      {needsCalibration && heading !== null && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-start gap-2 text-left">
          <WarningCircleIcon className="w-4 h-4 text-danger-ink shrink-0 mt-0.5" />
          <p className="text-[11px] text-danger-ink">
            Pusula sensörü kararsız görünüyor. Telefonunuzu havada 8 çizerek kalibre edin.
          </p>
        </div>
      )}

      {devPanelVisible && (
        <div className="p-3 rounded-xl bg-card border border-hairline text-left text-[10px] font-mono text-mist space-y-0.5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-label font-bold text-ink">Geliştirici — ham sensör verisi</div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(buildDebugReportText());
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-gold-ink cursor-pointer before:content-[''] before:absolute before:-inset-2"
              aria-label="Hata ayıklama verisini panoya kopyala"
            >
              {copied ? <CheckIcon className="w-4 h-4 text-success-ink" /> : <CopyIcon className="w-4 h-4" />}
            </button>
          </div>
          <div>platform: {debug.userAgentSummary || 'bilinmiyor'}</div>
          <div>aktif API: {ACTIVE_EVENT_TYPE_LABEL[debug.activeEventType]}</div>
          <div>absolute: {String(debug.isAbsolute)}</div>
          <div>alpha: {debug.alpha ?? 'null'}</div>
          <div>webkitCompassHeading: {debug.webkitCompassHeading ?? 'yok'}</div>
          <div>webkitCompassAccuracy: {debug.webkitCompassAccuracy ?? 'yok'}</div>
          <div>screen.orientation.angle: {debug.screenAngle}</div>
          <div>ham heading: {debug.rawHeading ?? 'null'}</div>
          <div>yumuşatılmış heading: {debug.smoothedHeading?.toFixed(2) ?? 'null'}</div>
          <div>son heading (dönüşüm telafili): {heading?.toFixed(2) ?? 'null'}</div>
          <div>kıble açısı: {qiblaBearing.toFixed(2)}</div>
          <div>fark: {heading !== null ? Math.abs(qiblaBearing - heading).toFixed(2) : 'null'}</div>
          <div>kalibrasyon uyarısı: {String(needsCalibration)}</div>
          <div className="pt-1 border-t border-hairline/50 mt-1">
            oturum ilk okuması: {debug.firstRawHeadingDeg ?? 'null'}
          </div>
          <div>
            60sn sürüklenme (uç-uca): {debug.driftDeg !== null ? `${debug.driftDeg.toFixed(1)}°` : 'ölçülüyor…'}
          </div>
          <div>
            60sn min/maks/ort: {debug.stats
              ? `${debug.stats.min.toFixed(1)} / ${debug.stats.max.toFixed(1)} / ${debug.stats.average.toFixed(1)}`
              : 'ölçülüyor…'}
          </div>
          <div>
            60sn toplam yayılım (dairesel): {debug.stats ? `${debug.stats.spread.toFixed(1)}°` : 'ölçülüyor…'}
          </div>
          <div>kayma karakteri: {DRIFT_CHARACTER_LABEL[debug.driftCharacter]}</div>
          <div className="text-[9px] text-mist/80 pt-1">
            Telefonu 60 sn aynı yönde sabit tutup bu değerleri okuyun. Sabit bir fark (kayma karakteri "sabit",
            sürüklenme ~0) deklinasyona işaret edebilir; büyüyen/tek yönlü bir fark ("tek yönlü") sensör
            füzyonunda bir sorun olduğunu gösterir. "Salınımlı" ise gürültüdür, sürüklenme değildir.
          </div>
        </div>
      )}
    </div>
  );
};
