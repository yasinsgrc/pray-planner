import React from 'react';
import { motion } from 'motion/react';
import { ClockIcon, CalendarDotsIcon, BookOpenIcon, CompassIcon, GearSixIcon, Icon } from './icons';
import { allNavLabelsFit } from '../utils/textFit';

export type TabType = 'focus' | 'flow' | 'spiritual' | 'explore' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

const TABS: { id: TabType; label: string; Icon: Icon }[] = [
  { id: 'focus', label: 'Ana Ekran', Icon: ClockIcon },
  { id: 'flow', label: 'Vakitler', Icon: CalendarDotsIcon },
  { id: 'spiritual', label: 'Maneviyat', Icon: BookOpenIcon },
  { id: 'explore', label: 'Keşfet', Icon: CompassIcon },
  { id: 'settings', label: 'Ayarlar', Icon: GearSixIcon },
];

// Etiket 0.6875rem'in (ölçek 1'de 11px) altına inmez.
const LABEL_CLASS = 'text-[0.6875rem] tracking-wide uppercase whitespace-nowrap';

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  // Beş etiket 5 eşit sütuna sığıyor mu? Görünmez ölçüm kopyası (aynı
  // stiller, aktif ağırlık 600 — her sekme aktif olabilir) sütun içerik
  // genişliğiyle karşılaştırılır. Sığmıyorsa yalnızca aktif sekmenin
  // etiketi görünür, diğerleri ikon + aria-label. Kopya karardan
  // etkilenmez → salınım yok.
  const rowRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [labelsFit, setLabelsFit] = React.useState(true);

  React.useLayoutEffect(() => {
    const rowEl = rowRef.current;
    const measureEl = measureRef.current;
    if (!rowEl || !measureEl || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const rowStyle = getComputedStyle(rowEl);
      const rowContent = rowEl.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
      const tabPaddingX = parseFloat(getComputedStyle(rowEl.querySelector('[role="tab"]')!).paddingLeft);
      const widths = [...measureEl.children].map((c) => c.getBoundingClientRect().width);
      setLabelsFit(allNavLabelsFit(widths, rowContent, tabPaddingX));
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(rowEl);
    resizeObserver.observe(measureEl);
    // Web fontu yüklenince kopyanın genişliği değişir; ResizeObserver
    // yüksekliği 0 olan kaba bakarken bunu görmeyebilir.
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      resizeObserver.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, []);

  return (
    <nav
      role="tablist"
      aria-label="Ana gezinme"
      className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-gold/15 max-w-[var(--shell-w)] mx-auto transition-colors pb-[env(safe-area-inset-bottom)]"
    >
      <div ref={measureRef} aria-hidden="true" className="absolute left-0 top-0 h-0 flex overflow-hidden invisible pointer-events-none">
        {TABS.map((tab) => (
          <span key={tab.id} className={`${LABEL_CLASS} shrink-0`} style={{ fontVariationSettings: '"wght" 600' }}>
            {tab.label}
          </span>
        ))}
      </div>
      {/* Sığıyorsa 5 eşit sütun. Sığmıyorsa aktif sekme etiketi kadar
          genişler, diğerleri kalan alanı eşit paylaşır. */}
      <div ref={rowRef} className={`${labelsFit ? 'grid grid-cols-5' : 'flex'} items-center py-1.5 px-1`}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const showLabel = labelsFit || isActive;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-label={tab.label}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-0 min-h-[48px] transition-colors duration-200 cursor-pointer px-1 py-2 rounded-xl ${
                labelsFit ? '' : isActive ? 'flex-[1_0_auto]' : 'flex-1'
              } ${isActive ? 'text-accent-ink' : 'text-mist hover:text-ink'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-accent/10 -z-10"
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.2 }}
                />
              )}
              <tab.Icon weight={isActive ? 'fill' : 'regular'} className="w-5 h-5" />
              {showLabel && (
                <span
                  data-nav-label
                  className={`${LABEL_CLASS} transition-[font-variation-settings] duration-200`}
                  style={{ fontVariationSettings: `"wght" ${isActive ? 600 : 500}` }}
                >
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
