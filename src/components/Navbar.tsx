import React from 'react';
import { Clock, CalendarDays, BookOpen, Settings } from 'lucide-react';

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
      icon: <Clock className="w-5 h-5 stroke-[1.5]" />,
    },
    {
      id: 'flow',
      label: 'Vakitler',
      icon: <CalendarDays className="w-5 h-5 stroke-[1.5]" />,
    },
    {
      id: 'spiritual',
      label: 'Maneviyat',
      icon: <BookOpen className="w-5 h-5 stroke-[1.5]" />,
    },
    {
      id: 'settings',
      label: 'Ayarlar',
      icon: <Settings className="w-5 h-5 stroke-[1.5]" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)]/90 backdrop-blur-md border-t border-[#D6A84D]/15 max-w-md mx-auto transition-colors">
      <div className="flex items-center justify-around py-2.5 px-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-3 rounded-xl ${
                isActive
                  ? 'text-[#D6A84D] font-bold'
                  : 'text-[var(--mist)] hover:text-[var(--ink)]'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D6A84D]" />
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
