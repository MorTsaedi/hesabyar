import { useState, useEffect } from 'react';
import type { TaxSettings, VatSummary, TaxReturn } from '../../types/database';
import { tauriInvoke } from '../../lib/tauri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';
import {
  Calculator,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  X,
} from 'lucide-react';

type Tab = 'settings' | 'summary' | 'returns';

export function TaxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
            <Calculator className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">مالیات و اظهارنامه</h1>
            <p className="text-[12px] text-slate-400">تنظیمات VAT، محاسبه و مدیریت اظهارنامه‌ها</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1 mb-6">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Save className="w-4 h-4 inline-block ml-2" />
          تنظیمات مالیاتی
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'summary' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 inline-block ml-2" />
          گزارش VAT دوره
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'returns' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 inline-block ml-2" />
          اظهارنامه‌ها
        </button>
      </div>

      {activeTab === 'settings' && <TaxSettingsTab />}
      {activeTab === 'summary' && <VatSummaryTab />}
      {activeTab === 'returns' && <TaxReturnsTab />}
    </div>
  );
}

function TaxSettingsTab() {
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const s = await tauriInvoke<TaxSettings>('get_tax_settings', {});
      setSettings(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      await tauriInvoke('update_tax_settings', {
        vat_enabled: settings.isRegistered,
        vat_number: settings.vatRegistrationNumber ?? '',
        default_vat_rate: settings.vatRate,
      });
      setSavedAt(new Date().toLocaleString('fa-IR'));
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Save className="w-5 h-5 text-emerald-600" />
          تنظیمات VAT (مالیات بر ارزش افزوده)
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {savedAt && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            تنظیمات با موفقیت ذخیره شد — {savedAt}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vat_enabled"
              checked={settings.isRegistered}
              onChange={(e) => setSettings({ ...settings, isRegistered: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="vat_enabled" className="text-sm font-medium text-slate-700">
              فعال‌سازی VAT
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">شماره ثبت VAT</label>
            <Input
              value={settings.vatRegistrationNumber ?? ''}
              onChange={(e) => setSettings({ ...settings, vatRegistrationNumber: e.target.value })}
              placeholder="VAT-REG-XXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">نرخ پیش‌فرض VAT (%)</label>
            <Input
              type="text"
              inputMode="numeric"
              value={settings.vatRate.toString()}
              onChange={(e) =>
                setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })
              }
              persianNumbers
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 ml-1" />
            {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </Button>
          <Button onClick={load} variant="secondary">
            <RefreshCw className="w-4 h-4 ml-1" />
            بارگذاری مجدد
          </Button>
        </div>
      </div>
    </div>
  );
}

function VatSummaryTab() {
  const today = new Date().toISOString().split('T')[0];
  const quarterStart = (() => {
    const q = Math.floor(new Date().getMonth() / 3) * 3 + 1;
    return `${new Date().getFullYear()}-${String(q).padStart(2, '0')}-01`;
  })();
  const [startDate, setStartDate] = useState(quarterStart);
  const [endDate, setEndDate] = useState(today);
  const [summary, setSummary] = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await tauriInvoke<VatSummary>('compute_vat_summary', {
        start_date: toJalali(startDate),
        end_date: toJalali(endDate),
      });
      setSummary(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          محاسبه VAT یک دوره
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تاریخ شروع (میلادی)</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تاریخ پایان (میلادی)</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={compute} disabled={loading}>
            <RefreshCw className="w-4 h-4 ml-1" />
            {loading ? 'در حال محاسبه...' : 'محاسبه'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mt-4">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard
              title="مالیات فروش (خروجی)"
              value={summary.vatOnSales}
              subtotal={summary.totalSales}
              accent="rose"
            />
            <SummaryCard
              title="مالیات خرید (ورودی)"
              value={summary.vatOnPurchases}
              subtotal={summary.totalPurchases}
              accent="green"
            />
            <SummaryCard
              title="مالیات قابل پرداخت"
              value={summary.netVatPayable}
              accent={summary.netVatPayable >= 0 ? 'amber' : 'emerald'}
              highlight
            />
            <div className="md:col-span-2 lg:col-span-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
              دوره مالیاتی از <strong className="ltr-force">{summary.taxPeriodStart}</strong> تا{' '}
              <strong className="ltr-force">{summary.taxPeriodEnd}</strong>.
              فروش خالص: <strong className="ltr-force">{Math.round(summary.totalSales).toLocaleString('fa-IR')}</strong> ریال،
              خرید خالص:{' '}
              <strong className="ltr-force">{Math.round(summary.totalPurchases).toLocaleString('fa-IR')}</strong> ریال.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtotal,
  accent,
  highlight = false,
}: {
  title: string;
  value: number;
  subtotal?: number;
  accent: 'rose' | 'green' | 'amber' | 'emerald';
  highlight?: boolean;
}) {
  const cls = {
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  }[accent];
  return (
    <div className={`p-4 border rounded-lg ${cls} ${highlight ? 'ring-2 ring-offset-1 ring-amber-300' : ''}`}>
      <div className="text-sm opacity-80">{title}</div>
      <div className="text-2xl font-bold ltr-force mt-1">
        {Math.round(value).toLocaleString('fa-IR')}
      </div>
      {typeof subtotal === 'number' && (
        <div className="text-xs opacity-70 mt-1 ltr-force">
          خالص: {Math.round(subtotal).toLocaleString('fa-IR')}
        </div>
      )}
    </div>
  );
}

function TaxReturnsTab() {
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await tauriInvoke<TaxReturn[]>('get_tax_returns', { company_id: 1 });
      setReturns(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    try {
      setError(null);
      await tauriInvoke<number>('create_tax_return', {
        period_label: periodLabel,
      });
      setShowCreate(false);
      setPeriodLabel('');
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setError(null);
      await tauriInvoke('delete_tax_return', { return_id: id });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" />
          اظهارنامه‌های مالیات بر ارزش افزوده
        </h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <X className="w-4 h-4 ml-1" /> : <FileText className="w-4 h-4 ml-1" />}
          {showCreate ? 'بستن' : 'ایجاد اظهارنامه جدید'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-md font-semibold mb-4">ایجاد اظهارنامه جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">عنوان دوره</label>
              <Input
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="مثلاً بهار ۱۴۰۴"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={handleCreate}
              disabled={!periodLabel}
            >
              ایجاد اظهارنامه
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              انصراف
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-500">در حال بارگذاری...</div>
        ) : returns.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            هنوز اظهارنامه‌ای ثبت نشده است. روی «ایجاد اظهارنامه جدید» کلیک کنید.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-right font-semibold text-slate-700">دوره</th>
                <th className="p-3 text-right font-semibold text-slate-700">مالیات فروش</th>
                <th className="p-3 text-right font-semibold text-slate-700">مالیات خرید</th>
                <th className="p-3 text-right font-semibold text-slate-700">قابل پرداخت</th>
                <th className="p-3 text-right font-semibold text-slate-700">پرداخت‌شده</th>
                <th className="p-3 text-right font-semibold text-slate-700">وضعیت</th>
                <th className="p-3 text-center font-semibold text-slate-700">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <TaxReturnRow
                  key={r.id}
                  item={r}
                  onDelete={() => handleDelete(r.id)}
                  onSaved={load}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TaxReturnRow({
  item,
  onDelete,
  onSaved,
}: {
  item: TaxReturn;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(item.paidAmount?.toString() ?? '');
  const [paymentDate, setPaymentDate] = useState(item.paymentDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await tauriInvoke('record_tax_payment', {
        return_id: item.id,
        paid_amount: parseFloat(paymentAmount) || 0,
        payment_date: paymentDate,
      });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const isFiled = item.status === 'filed';

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="p-3 font-medium">{item.period}</td>
        <td className="p-3 ltr-force">{Math.round(item.totalSalesVat).toLocaleString('fa-IR')}</td>
        <td className="p-3 ltr-force">{Math.round(item.totalPurchaseVat).toLocaleString('fa-IR')}</td>
        <td className="p-3 ltr-force font-medium">
          {Math.round(item.netVatPayable).toLocaleString('fa-IR')}
        </td>
        <td className="p-3 ltr-force">{Math.round(item.paidAmount ?? 0).toLocaleString('fa-IR')}</td>
        <td className="p-3">
          {isFiled ? (
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full">
              ثبت شده
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
              پیش‌نویس
            </span>
          )}
        </td>
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="پرداخت مالیات"
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {!isFiled && (
              <button
                onClick={onDelete}
                className="text-rose-500 hover:text-rose-700 p-1"
                title="حذف"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={7} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  مبلغ پرداختی
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  persianNumbers
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  تاریخ پرداخت
                </label>
                <JalaliDatePicker
                  value={paymentDate}
                  onChange={(v) => setPaymentDate(v)}
                  placeholder="مثلاً ۱۴۰۴/۰۴/۱۰"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ثبت پرداخت'}
              </Button>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded mt-2">
                {error}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              مبلغ قابل پرداخت: <strong>{Math.round(item.netVatPayable).toLocaleString('fa-IR')}</strong> ریال
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

// Helpers

function toJalali(input: string): string {
  if (!input) return input;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return input;
  const [, y, mo, d] = m;
  return `${y}/${mo}/${d}`;
}
