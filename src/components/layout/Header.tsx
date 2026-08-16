import { useUIStore } from '../../stores/useUIStore';
import { CompanySwitcher } from './CompanySwitcher';
import { Menu, Settings, CalendarDays, ChevronsLeft, Moon, Sun } from 'lucide-react';
import { todayJalali } from '../../lib/jalali';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  const { toggleSidebar, sidebarOpen, theme, toggleTheme } = useUIStore();

  return (
    <header className="bg-white border-b border-slate-200/80 h-16 flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title={sidebarOpen ? 'بستن منو' : 'باز کردن منو'}
      >
        {sidebarOpen ? <ChevronsLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <div className="flex items-center gap-2 text-slate-400">
        <CalendarDays className="w-4 h-4" />
        <span className="text-[13px] font-medium">{todayJalali()}</span>
      </div>

      <CompanySwitcher />

      <div className="flex-1" />

      <button
        onClick={toggleTheme}
        className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:text-slate-400 dark:hover:bg-[#24324d]"
        title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <button
        onClick={onSettingsClick}
        className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors dark:text-slate-400 dark:hover:bg-[#24324d]"
        title="ابزارها و تنظیمات"
      >
        <Settings className="w-5 h-5" />
      </button>
    </header>
  );
}
