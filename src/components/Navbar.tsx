import React from 'react';
import { ClockIcon, CalendarDotsIcon, BookOpenIcon, GearSixIcon } from '@phosphor-icons/react';

export type TabType = 'focus' | 'flow' | 'spiritual' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'focus',
      label: 'Ana Ekran',
      icon: <ClockIcon className="w-5 h-5" />,
    },
    {
      id: 'flow',
      label: 'Vakitler',
      icon: <CalendarDotsIcon className="w-5 h-5" />,
    },
    {
      id: 'spiritual',
      label: 'Maneviyat',
      icon: <BookOpenIcon className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'Ayarlar',
      icon: <GearSixIcon className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-gold/15 max-w-[430px] mx-auto transition-colors">
      <div className="flex items-center justify-around py-2.5 px-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer py-1 px-3 rounded-xl hover:scale-[1.05] active:scale-95 ${
                isActive
                  ? 'text-gold font-bold'
                  : 'text-mist hover:text-ink'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                )}
              </div>
              <span className="text-[10px] tracking-wide uppercase font-medium">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
