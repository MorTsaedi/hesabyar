import { useUIStore } from '../../stores/useUIStore';
import { useCompanyStore } from '../../stores/useCompanyStore';
import {
  LayoutDashboard,
  BookOpen,
  NotebookPen,
  Repeat,
  Target,
  CalendarX2,
  Users,
  ReceiptText,
  Package,
  Landmark,
  Banknote,
  Scale,
  ArrowLeftRight,
  Tags,
  BadgeDollarSign,
  Boxes,
  BarChart3,
  Hourglass,
  FileSpreadsheet,
  Percent,
  Building2,
  DatabaseBackup,
  ShieldCheck,
  Wrench,
  ChevronsRight,
  Building,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'اصلی',
    items: [{ id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard }],
  },
  {
    title: 'حسابداری',
    items: [
      { id: 'accounts', label: 'حساب‌ها', icon: BookOpen },
      { id: 'journal', label: 'سند روزنامه', icon: NotebookPen },
      { id: 'recurring', label: 'قالب‌های تکرار', icon: Repeat },
      { id: 'budget', label: 'بودجه', icon: Target },
      { id: 'period', label: 'پایان دوره', icon: CalendarX2 },
    ],
  },
  {
    title: 'عملیات',
    items: [
      { id: 'contacts', label: 'اشخاص', icon: Users },
      { id: 'invoices', label: 'فاکتورها', icon: ReceiptText },
      { id: 'products', label: 'کالا و خدمات', icon: Package },
      { id: 'price-lists', label: 'لیست قیمت', icon: Tags },
      { id: 'banking', label: 'بانکداری', icon: Landmark },
      { id: 'checks', label: 'مدیریت چک', icon: Banknote },
      { id: 'reconciliation', label: 'مغایرت بانکی', icon: Scale },
      { id: 'currency', label: 'نرخ ارز و تسعیر', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'حقوق و دارایی',
    items: [
      { id: 'payroll', label: 'حقوق و دستمزد', icon: BadgeDollarSign },
      { id: 'assets', label: 'دارایی ثابت', icon: Boxes },
    ],
  },
  {
    title: 'گزارش‌ها',
    items: [
      { id: 'reports', label: 'گزارش‌های مالی', icon: BarChart3 },
      { id: 'aging', label: 'دریافتنی/پرداختنی', icon: Hourglass },
      { id: 'custom-reports', label: 'گزارش‌ساز', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'مالیات',
    items: [
      { id: 'tax', label: 'مالیات و اظهارنامه', icon: Percent },
      { id: 'moadian', label: 'سامانه مودیان', icon: Building2 },
    ],
  },
  {
    title: 'سیستم',
    items: [
      { id: 'backup', label: 'پشتیبان‌گیری', icon: DatabaseBackup },
      { id: 'audit', label: 'بازرسی و رویدادها', icon: ShieldCheck },
      { id: 'tools', label: 'ابزارها و تنظیمات', icon: Wrench },
    ],
  },
];

export function Sidebar() {
  const { sidebarOpen, currentPage, setCurrentPage } = useUIStore();
  const { currentCompany } = useCompanyStore();

  return (
    <aside
      className={`bg-white border-l border-slate-200/80 flex flex-col transition-all duration-200 shrink-0 ${
        sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-slate-100 shrink-0">
        <img src="/logo.png" alt="حساب‌یار" className="w-9 h-9 rounded-lg object-contain shrink-0" />
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-slate-900">حساب‌یار</p>
          <p className="text-[10px] text-slate-400 font-medium">نرم‌افزار حسابداری رایگان</p>
        </div>
      </div>

      {/* Company card */}
      {currentCompany && (
        <div className="px-3 pt-3 shrink-0">
          <div className="flex items-center gap-2.5 bg-surface rounded-xl px-3 py-2.5 border border-slate-200/60">
            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-800 truncate">{currentCompany.name}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentCompany.nationalId ? `کد ملی: ${currentCompany.nationalId}` : 'شرکت فعال'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="section-title px-2.5 mb-1.5">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setCurrentPage(item.id)}
                      className={`w-full text-right px-2.5 py-2 rounded-lg text-[13px] flex items-center gap-2.5 transition-all ${
                        isActive
                          ? 'bg-brand-50 text-brand-800 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          isActive ? 'text-brand-600' : 'text-slate-400'
                        }`}
                        strokeWidth={isActive ? 2.2 : 2}
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && <span className="w-1 h-4 rounded-full bg-brand-600 mr-auto" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div className="flex items-center justify-between px-1.5">
          <p className="text-[11px] text-slate-400">حساب‌یار نسخه ۱.۰</p>
          <button
            onClick={() => useUIStore.getState().setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="بستن منو"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
