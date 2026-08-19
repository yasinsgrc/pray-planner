import React from 'react';
import { motion } from 'motion/react';
import { ClockIcon, CalendarDotsIcon, BookOpenIcon, CompassIcon, GearSixIcon, Icon } from './icons';

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

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav
      role="tablist"
      aria-label="Ana gezinme"
      className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-gold/15 max-w-[var(--shell-w)] mx-auto transition-colors pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around py-1.5 px-3">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] transition-colors duration-200 cursor-pointer px-3 py-2 rounded-xl ${
                isActive ? 'text-accent-ink' : 'text-mist hover:text-ink'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-accent/10 -z-10"
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.2 }}
                />
              )}
              <tab.Icon weight={isActive ? 'fill' : 'regular'} className="w-5 h-5" />
              <span
                className="text-[10px] tracking-wide uppercase transition-[font-variation-settings] duration-200"
                style={{ fontVariationSettings: `"wght" ${isActive ? 600 : 500}` }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
