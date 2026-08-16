import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useCompanyStore } from '../../stores/useCompanyStore';
import { tauriInvoke } from '../../lib/tauri';
import { currentJalaliYear } from '../../lib/jalali';
import { Button } from '../ui/Button';
import {
  Building2,
  CalendarDays,
  Check,
  Moon,
  Rocket,
  Sparkles,
  Sun,
  ArrowLeft,
  ArrowRight,
  Landmark,
  Users,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';

const FEATURES = [
  { icon: Landmark, title: 'حسابداری کامل', desc: 'سند روزنامه، حساب‌ها، بانک و چک' },
  { icon: Users, title: 'اشخاص و فاکتور', desc: 'مدیریت طرف‌حساب‌ها و فاکتورهای خرید و فروش' },
  { icon: FileSpreadsheet, title: 'گزارش‌های مالی', desc: 'تراز، صورت سود و زیان و گزارش‌ساز شخصی' },
  { icon: ShieldCheck, title: 'امن و آفلاین', desc: 'داده‌ها روی سیستم شما و با پشتیبان‌گیری خودکار' },
];

interface WizardProps {
  open: boolean;
}

export function StartupWizard({ open }: WizardProps) {
  const { theme, setTheme, completeWizard } = useUIStore();
  const { setCompanies, setCurrentCompany } = useCompanyStore();

  const [step, setStep] = useState(0);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [fiscalYear, setFiscalYear] = useState(String(currentJalaliYear()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset state whenever the wizard opens
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError('');
    setCompanyName('');
    setNationalId('');
    setEconomicCode('');
    setFiscalYear(String(currentJalaliYear()));

    tauriInvoke<{ id: number }[]>('get_companies')
      .then((companies) => setHasCompany(Array.isArray(companies) && companies.length > 0))
      .catch(() => setHasCompany(false));
  }, [open]);

  if (!open) return null;

  const next = () => {
    if (step === 1 && !companyName.trim()) {
      setError('نام شرکت الزامی است');
      return;
    }
    setError('');
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => s - 1);

  const skip = () => completeWizard();

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      if (!hasCompany && companyName.trim()) {
        const created = await tauriInvoke<{
          id: number;
          name: string;
          nationalId: string;
          economicCode: string;
        }>('create_company', {
          name: companyName.trim(),
          nationalId: nationalId.trim() || null,
          economicCode: economicCode.trim() || null,
          fiscalYear: fiscalYear || String(currentJalaliYear()),
        });
        if (created) {
          setCompanies([created as never]);
          setCurrentCompany(created as never);
        }
      }
      completeWizard();
    } catch (err) {
      setError('خطا در ایجاد شرکت: ' + err);
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = [currentJalaliYear() - 1, currentJalaliYear(), currentJalaliYear() + 1];

  const stepIndicator = (label: string, idx: number) => (
    <div className="flex items-center gap-2">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
          idx < step
            ? 'bg-emerald-500 text-white'
            : idx === step
              ? 'bg-brand-600 text-white ring-4 ring-brand-600/20'
              : 'bg-slate-200 text-slate-500 dark:bg-[#33415f]'
        }`}
      >
        {idx < step ? <Check className="w-3.5 h-3.5" /> : idx + 1}
      </span>
      <span
        className={`text-[13px] font-medium ${
          idx <= step ? 'text-slate-800' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0d1526] rounded-3xl shadow-2xl border border-slate-200/60 dark:border-[#33425f]/60 animate-scale-in">
        {/* Decorative header gradient */}
        <div className="h-1.5 bg-gradient-to-l from-brand-500 via-teal-500 to-indigo-500 rounded-t-3xl" />

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-6 px-8 pt-6">
          {stepIndicator('خوش‌آمدید', 0)}
          <span className="w-8 h-px bg-slate-200 dark:bg-[#33415f]" />
          {stepIndicator('اطلاعات شرکت', 1)}
          <span className="w-8 h-px bg-slate-200 dark:bg-[#33415f]" />
          {stepIndicator('سال مالی', 2)}
          <span className="w-8 h-px bg-slate-200 dark:bg-[#33415f]" />
          {stepIndicator('ظاهر و شروع', 3)}
        </div>

        <div className="px-8 py-7">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand mb-4">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                  <path d="M4 19V9l8-5 8 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 19v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 19h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900">به حساب‌یار خوش آمدید</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-6">
                نرم‌افزار حسابداری رایگان و آفلاین؛ جایگزین کامل نرم‌افزارهای حسابداری پولی برای شرکت‌ها و کسب‌وکارهای ایرانی.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-7">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="text-right bg-slate-50 dark:bg-[#1a2438] rounded-2xl border border-slate-200/70 dark:border-[#33425f]/60 p-4"
                    >
                      <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-teal-300 flex items-center justify-center mb-2.5">
                        <Icon className="w-4.5 h-4.5" size={18} />
                      </span>
                      <p className="text-[13px] font-bold text-slate-800">{f.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-5">{f.desc}</p>
                    </div>
                  );
                })}
              </div>

              {hasCompany && (
                <button
                  onClick={skip}
                  className="mt-6 text-[13px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-4 transition-colors"
                >
                  یک شرکت از قبل دارید؟ مستقیم وارد شوید
                </button>
              )}
            </div>
          )}

          {/* Step 1: Company info */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-teal-300 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">اطلاعات شرکت</h2>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">مشخصات شرکت یا کسب‌وکار خود را وارد کنید</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label">نام شرکت <span className="text-rose-500">*</span></label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="مثلاً: شرکت بازرگانی نمونه"
                    autoFocus
                    className="w-full rounded-xl border border-slate-300 dark:border-[#4d5f7c] dark:bg-[#1a2438] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">کد ملی / شناسه ملی</label>
                    <input
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder="اختیاری"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#4d5f7c] dark:bg-[#1a2438] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="form-label">کد اقتصادی</label>
                    <input
                      value={economicCode}
                      onChange={(e) => setEconomicCode(e.target.value)}
                      placeholder="اختیاری"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#4d5f7c] dark:bg-[#1a2438] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Fiscal year */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-teal-300 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">سال مالی</h2>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">سال مالی شروع کار شرکت را انتخاب کنید</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="form-label">سال مالی (شمسی)</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        onClick={() => setFiscalYear(String(y))}
                        className={`rounded-xl border py-3 text-sm font-bold transition-all ${
                          fiscalYear === String(y)
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-teal-300 ring-2 ring-brand-500/20'
                            : 'border-slate-300 dark:border-[#4d5f7c] text-slate-600 hover:border-brand-400'
                        }`}
                      >
                        {String(y).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-5 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-500" />
                  با ایجاد سال مالی، نمودار حساب‌های استاندارد (دارایی‌ها، بدهی‌ها، درآمد و هزینه‌ها) به‌صورت خودکار ساخته می‌شود.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Theme + finish */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-teal-300 flex items-center justify-center">
                  <Rocket className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">آماده شروع!</h2>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">حالت نمایش را انتخاب کنید</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`rounded-2xl border p-4 text-right transition-all ${
                    theme === 'light'
                      ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/50 dark:bg-brand-500/10'
                      : 'border-slate-300 dark:border-[#4d5f7c] hover:border-brand-400'
                  }`}
                >
                  <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                    <Sun className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-bold text-slate-800">روشن</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">مناسب کار در روز</p>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`rounded-2xl border p-4 text-right transition-all ${
                    theme === 'dark'
                      ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/50 dark:bg-brand-500/10'
                      : 'border-slate-300 dark:border-[#4d5f7c] hover:border-brand-400'
                  }`}
                >
                  <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                    <Moon className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-bold text-slate-800">تاریک</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">راحت‌تر برای چشم</p>
                </button>
              </div>

              <div className="mt-6 bg-slate-50 dark:bg-[#1a2438] border border-slate-200/70 dark:border-[#33425f]/60 rounded-2xl p-4 text-[13px]">
                <p className="font-bold text-slate-800 mb-2">خلاصه راه‌اندازی</p>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                  {hasCompany ? (
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> از شرکت‌های موجود استفاده می‌شود</li>
                  ) : (
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> شرکت «{companyName.trim() || '…'}» ایجاد می‌شود</li>
                  )}
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> سال مالی {String(fiscalYear).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> نمودار حساب استاندارد و سال مالی به‌صورت خودکار ساخته می‌شود</li>
                </ul>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-[13px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-8 pb-7 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={back}
            disabled={step === 0}
            className={step === 0 ? 'invisible' : ''}
          >
            <span className="flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4" />
              قبلی
            </span>
          </Button>

          <div className="flex items-center gap-2.5">
            {step < 3 ? (
              <>
                <Button variant="ghost" size="sm" onClick={skip}>
                  رد شدن
                </Button>
                <Button size="sm" onClick={next}>
                  ادامه
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={finish} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    در حال ایجاد…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Rocket className="w-4 h-4" />
                    شروع کار
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
