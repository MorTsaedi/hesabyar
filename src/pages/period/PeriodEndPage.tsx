import { useState, useEffect, useCallback } from 'react';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { useCompanyStore } from '../../stores/useCompanyStore';
import { Calendar, FileCheck, RotateCcw, ArrowLeftRight, AlertTriangle, Check, X, History } from 'lucide-react';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';

interface PeriodStatus {
  is_balanced: boolean;
  total_debit: number;
  total_credit: number;
  difference: number;
  has_opening_entry: boolean;
  has_closing_entry: boolean;
  is_period_closed: boolean;
}

interface OpeningClosingResult {
  opening_entry_id: number;
  closing_entry_id: number;
  total_debit: number;
  total_credit: number;
  accounts_closed: number;
}

export function PeriodEndPage() {
  const { currentCompany } = useCompanyStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PeriodStatus | null>(null);
  const [openingDate, setOpeningDate] = useState('1404/01/01');
  const [closingDate, setClosingDate] = useState('1404/12/29');
  const [result, setResult] = useState<OpeningClosingResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'opening' | 'closing' | 'both'>('both');

  const loadStatus = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      const s = await tauriInvoke<PeriodStatus>('get_period_status', {
        company_id: currentCompany.id,
        fiscal_year_id: 1, // Default fiscal year
      });
      setStatus(s);
    } catch (err) {
      console.error('Failed to load period status:', err);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const generateOpeningEntry = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const id = await tauriInvoke<number>('generate_opening_entry', {
        company_id: currentCompany.id,
        fiscal_year_id: 1,
        date: openingDate,
      });
      alert(`سند افتتاحیه با شماره ${id} ایجاد شد`);
      loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateClosingEntry = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const id = await tauriInvoke<number>('generate_closing_entry', {
        company_id: currentCompany.id,
        fiscal_year_id: 1,
        date: closingDate,
      });
      alert(`سند اختتامیه با شماره ${id} ایجاد شد`);
      loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateBothEntries = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const r = await tauriInvoke<OpeningClosingResult>('generate_opening_closing_entries', {
        company_id: currentCompany.id,
        fiscal_year_id: 1,
        opening_date: openingDate,
        closing_date: closingDate,
      });
      setResult(r);
      loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">پایان دوره مالی</h1>
              <p className="text-[12px] text-slate-400">ایجاد اسناد افتتاحیه و اختتامیه</p>
            </div>
          </div>
      </div>

      {/* Period Status Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          وضعیت دوره جاری
        </h2>

        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg border ${status.is_balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {status.is_balanced ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <X className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-bold ${status.is_balanced ? 'text-green-700' : 'text-red-700'}`}>
                  تراز اسناد
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {status.is_balanced ? 'تراز است' : 'تراز نیست'}
              </p>
              {!status.is_balanced && (
                <p className="text-xs text-red-500 mt-1">
                  اختلاف: {formatNumber(Math.abs(status.difference))}
                </p>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">جمع بدهکار</div>
              <div className="text-lg font-bold text-slate-900 ltr-force">{formatNumber(status.total_debit)}</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">جمع بستانکار</div>
              <div className="text-lg font-bold text-slate-900 ltr-force">{formatNumber(status.total_credit)}</div>
            </div>

            <div className={`p-4 rounded-lg border ${status.is_period_closed ? 'bg-primary-50 border-primary-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {status.is_period_closed ? (
                  <Check className="w-5 h-5 text-primary-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
                <span className={`font-bold ${status.is_period_closed ? 'text-primary-700' : 'text-amber-700'}`}>
                  وضعیت دوره
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {status.is_period_closed ? 'بسته شده' : 'باز'}
              </p>
            </div>
          </div>
        )}

        {/* Status Indicators */}
        {status && (
          <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              {status.has_opening_entry ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <X className="w-4 h-4 text-slate-400" />
              )}
              <span className={`text-sm ${status.has_opening_entry ? 'text-slate-900' : 'text-slate-500'}`}>
                سند افتتاحیه
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status.has_closing_entry ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <X className="w-4 h-4 text-slate-400" />
              )}
              <span className={`text-sm ${status.has_closing_entry ? 'text-slate-900' : 'text-slate-500'}`}>
                سند اختتامیه
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Action Tabs */}
        <div className="border-b border-slate-200 mb-4">
          <div className="flex gap-4">
            {[
              { key: 'both', label: 'هردو سند', icon: ArrowLeftRight },
              { key: 'opening', label: 'فقط افتتاحیه', icon: RotateCcw },
              { key: 'closing', label: 'فقط اختتامیه', icon: FileCheck },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">تاریخ سند افتتاحیه</label>
            <JalaliDatePicker value={openingDate} onChange={(v) => setOpeningDate(v)} placeholder="۱۴۰۴/۰۱/۰۱" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">تاریخ سند اختتامیه</label>
            <JalaliDatePicker value={closingDate} onChange={(v) => setClosingDate(v)} placeholder="۱۴۰۴/۱۲/۲۹" />
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-3">
          <button
            onClick={
              activeTab === 'both' ? generateBothEntries :
              activeTab === 'opening' ? generateOpeningEntry :
              generateClosingEntry
            }
            disabled={loading || !currentCompany?.id}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                در حال پردازش...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                {activeTab === 'both' ? 'ایجاد هر دو سند' :
                 activeTab === 'opening' ? 'ایجاد سند افتتاحیه' :
                 'ایجاد سند اختتامیه'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result Modal */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-2 rounded-full">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-green-800">اسناد با موفقیت ایجاد شدند</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">سند افتتاحیه</div>
              <div className="font-bold text-slate-900 ltr-force">{result.opening_entry_id}</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">سند اختتامیه</div>
              <div className="font-bold text-slate-900 ltr-force">{result.closing_entry_id}</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">جمع بدهکار</div>
              <div className="font-bold text-slate-900 ltr-force">{formatNumber(result.total_debit)}</div>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">حسابهای بسته شده</div>
              <div className="font-bold text-slate-900">{result.accounts_closed}</div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-bold text-blue-800 mb-2">راهنما</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>سند افتتاحیه:</strong> مانده حسابها را به دوره جدید منتقل میکند</li>
          <li>• <strong>سند اختتامیه:</strong> حسابهای درآمد و هزینه را به خلاصه سود/زیان منتقل میکند</li>
          <li>• پس از ایجاد این اسناد، دوره مالی بسته میشود و قابل ویرایش نخواهد بود</li>
          <li>• تاریخها باید به فرمت YYYY/MM/DD و به زبان فارسی (اعداد فارسی) وارد شوند</li>
        </ul>
      </div>
    </div>
  );
}