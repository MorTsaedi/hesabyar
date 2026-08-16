import { useState, useEffect, useCallback, useRef } from 'react';
import { tauriInvoke } from '../../lib/tauri';
import { formatNumber } from '../../lib/persian-number';
import { useCompanyStore } from '../../stores/useCompanyStore';
import { EnhancedChart } from '../../components/ui/EnhancedChart';
import { exportToPdf, exportToExcel, prepareExportData } from '../../lib/export';
import { DollarSign, Users, Clock, AlertTriangle, TrendingUp, FileDown, Table2 } from 'lucide-react';
import { JalaliDatePicker } from '../../components/ui/JalaliDatePicker';

interface AgingRow {
  id: number;
  number: string;
  date: string;
  due_date: string;
  total: number;
  paid_amount: number;
  balance: number;
  status: string;
  contact_name: string;
  contact_id: number;
  days_overdue: number;
  aging_bucket: string;
}

interface AgingSummary {
  total_current: number;
  total_1_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
  grand_total: number;
  items: AgingRow[];
}

interface AgingTotal {
  receivables_total: number;
  payables_total: number;
  net_receivables: number;
  receivables_count: number;
  payables_count: number;
}

type AgingTab = 'receivables' | 'payables';

export function AgingPage() {
  const { currentCompany } = useCompanyStore();
  const [activeTab, setActiveTab] = useState<AgingTab>('receivables');
  const [receivables, setReceivables] = useState<AgingSummary | null>(null);
  const [payables, setPayables] = useState<AgingSummary | null>(null);
  const [totals, setTotals] = useState<AgingTotal | null>(null);
  const [asOfDate, setAsOfDate] = useState('1404/06/31');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const [rec, pay, summary] = await Promise.all([
        tauriInvoke<AgingSummary>('get_receivables_aging', {
          companyId: currentCompany.id,
          asOfDate,
        }),
        tauriInvoke<AgingSummary>('get_payables_aging', {
          companyId: currentCompany.id,
          asOfDate,
        }),
        tauriInvoke<AgingTotal>('get_aging_summary', {
          companyId: currentCompany.id,
          asOfDate,
        }),
      ]);
      setReceivables(rec);
      setPayables(pay);
      setTotals(summary);
    } catch (err) {
      console.error('Failed to load aging data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, asOfDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refs & Export handlers
  const agingRef = useRef<HTMLDivElement>(null);

  const exportAgingPdf = () => {
    if (agingRef.current) exportToPdf(agingRef.current, `aging_${activeTab}`, `گزارش سنی ${activeTab === 'receivables' ? 'دریافتنی' : 'پرداختنی'}`);
  };

  const exportAgingExcel = () => {
    const data = prepareExportData(
      [
        { key: 'number', label: 'شماره' },
        { key: 'contact_name', label: 'طرف حساب' },
        { key: 'date', label: 'تاریخ' },
        { key: 'due_date', label: 'سررسید' },
        { key: 'total', label: 'مبلغ کل' },
        { key: 'balance', label: 'مانده' },
        { key: 'aging_bucket', label: 'سن' },
      ],
      (summary?.items || []) as unknown as Record<string, unknown>[]
    );
    exportToExcel(data, `aging_${activeTab}`, `گزارش سنی ${activeTab === 'receivables' ? 'دریافتنی' : 'پرداختنی'}`);
  };

  const getBucketData = () => {
    const buckets = ['current', '1-30', '31-60', '61-90', '90+'];
    return buckets.map((bucket) => ({
      bucket,
      label: bucketLabel(bucket),
      total: (summary?.items || [])
        .filter((r) => r.aging_bucket === bucket)
        .reduce((s, r) => s + r.balance, 0),
    }));
  };

  const bucketStyle = (bucket: string) => {
    switch (bucket) {
      case 'current': return { bg: 'bg-green-50', text: 'text-green-700' };
      case '1-30': return { bg: 'bg-yellow-50', text: 'text-yellow-700' };
      case '31-60': return { bg: 'bg-orange-50', text: 'text-orange-700' };
      case '61-90': return { bg: 'bg-red-50', text: 'text-red-700' };
      case '90+': return { bg: 'bg-red-100', text: 'text-red-800' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-700' };
    }
  };

  const bucketLabel = (bucket: string) => {
    switch (bucket) {
      case 'current': return 'جاری';
      case '1-30': return '۱-۳۰ روز';
      case '31-60': return '۳۱-۶۰ روز';
      case '61-90': return '۶۱-۹۰ روز';
      case '90+': return 'بیش از ۹۰ روز';
      default: return bucket;
    }
  };

  const summary = activeTab === 'receivables' ? receivables : payables;
  const overdueTotal = summary?.items
    .filter((r) => r.aging_bucket !== 'current')
    .reduce((s, r) => s + r.balance, 0) ?? 0;

  return (
    <div ref={agingRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-brand">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">دریافتنی‌ها و پرداختنی‌ها</h1>
              <p className="text-[12px] text-slate-400">گزارش سنی حساب‌ها</p>
            </div>
          </div>
        <div className="flex items-end gap-2">
          <button
            onClick={exportAgingPdf}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="خروجی PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={exportAgingExcel}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="خروجی Excel"
          >
            <Table2 className="w-3.5 h-3.5" />
            Excel
          </button>
          <JalaliDatePicker
            label="تاریخ گزارش"
            value={asOfDate}
            onChange={(val) => setAsOfDate(val)}
            placeholder="۱۴۰۴/۰۶/۳۱"
          />
          <button
            onClick={loadData}
            className="bg-primary-600 hover:bg-primary-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            بارگذاری
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <h3 className="text-xs font-bold text-green-800">دریافتنی</h3>
            </div>
            <p className="text-lg font-bold text-green-900 ltr-force">{formatNumber(totals.receivables_total)}</p>
            <p className="text-xs text-green-600">{totals.receivables_count} فاکتور</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-red-600" />
              <h3 className="text-xs font-bold text-red-800">پرداختنی</h3>
            </div>
            <p className="text-lg font-bold text-red-900 ltr-force">{formatNumber(totals.payables_total)}</p>
            <p className="text-xs text-red-600">{totals.payables_count} فاکتور</p>
          </div>
          <div className={`border rounded-lg p-4 ${totals.net_receivables >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`w-4 h-4 ${totals.net_receivables >= 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
              <h3 className={`text-xs font-bold ${totals.net_receivables >= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>خالص</h3>
            </div>
            <p className="text-lg font-bold text-slate-900 ltr-force">{formatNumber(Math.abs(totals.net_receivables))}</p>
            <p className={`text-xs ${totals.net_receivables >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {totals.net_receivables >= 0 ? 'دریافتنی خالص' : 'پرداختنی خالص'}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-purple-800">سررسید گذشته</h3>
            </div>
            <p className="text-lg font-bold text-purple-900 ltr-force">{formatNumber(overdueTotal)}</p>
            <p className="text-xs text-purple-600">{activeTab === 'receivables' ? 'دریافتنی' : 'پرداختنی'}</p>
          </div>
        </div>
      )}

      {/* Aging Chart */}
      {summary && summary.items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedChart
            title={`توزیع سنی ${activeTab === 'receivables' ? 'دریافتنی‌ها' : 'پرداختنی‌ها'}`}
            type="doughnut"
            labels={getBucketData().filter(b => b.total > 0).map(b => b.label)}
            datasets={[{
              label: 'مانده',
              data: getBucketData().filter(b => b.total > 0).map(b => b.total),
              backgroundColor: [
                'rgba(34, 197, 94, 0.7)',
                'rgba(234, 179, 8, 0.7)',
                'rgba(249, 115, 22, 0.7)',
                'rgba(239, 68, 68, 0.7)',
                'rgba(185, 28, 28, 0.7)',
              ],
            }]}
          />
          <EnhancedChart
            title={`مقایسه سنی ${activeTab === 'receivables' ? 'دریافتنی‌ها' : 'پرداختنی‌ها'}`}
            type="bar"
            labels={getBucketData().map(b => b.label)}
            datasets={[{
              label: 'مانده',
              data: getBucketData().map(b => b.total),
              backgroundColor: [
                'rgba(34, 197, 94, 0.7)',
                'rgba(234, 179, 8, 0.7)',
                'rgba(249, 115, 22, 0.7)',
                'rgba(239, 68, 68, 0.7)',
                'rgba(185, 28, 28, 0.7)',
              ],
            }]}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('receivables')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'receivables' ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          دریافتنی‌ها (مطالبات)
        </button>
        <button
          onClick={() => setActiveTab('payables')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'payables' ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          پرداختنی‌ها (بدهی‌ها)
        </button>
      </div>

      {/* Aging Buckets */}
      {summary && summary.items.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {(['current', '1-30', '31-60', '61-90', '90+'] as const).map((bucket) => {
            const total = summary.items
              .filter((r) => r.aging_bucket === bucket)
              .reduce((s, r) => s + r.balance, 0);
            const style = bucketStyle(bucket);
            return (
              <div key={bucket} className={`${style.bg} rounded-lg p-3 border border-slate-200`}>
                <p className={`text-xs font-medium ${style.text}`}>{bucketLabel(bucket)}</p>
                <p className={`text-sm font-bold ${style.text} ltr-force mt-1`}>{formatNumber(total)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <svg className="animate-spin h-5 w-5 ml-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            در حال بارگذاری...
          </div>
        ) : !summary || summary.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <AlertTriangle className="w-12 h-12 mb-3 opacity-30" />
            <p>{activeTab === 'receivables' ? 'هیچ دریافتنی‌ای' : 'هیچ پرداختنی‌ای'} یافت نشد</p>
            <p className="text-xs mt-1">فاکتورهای {activeTab === 'receivables' ? 'فروش' : 'خرید'} را ثبت کنید</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">شماره</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">طرف حساب</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">تاریخ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">سررسید</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">مبلغ کل</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">مانده</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">سن</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((row) => {
                const style = bucketStyle(row.aging_bucket);
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 ltr-force">{row.number}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.contact_name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 ltr-force">{row.date}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 ltr-force">{row.due_date}</td>
                    <td className="px-4 py-2.5 text-xs ltr-force text-left font-medium">{formatNumber(row.total)}</td>
                    <td className={`px-4 py-2.5 text-xs ltr-force text-left font-bold ${style.text}`}>
                      {formatNumber(row.balance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {row.aging_bucket === 'current' ? 'جاری' : `${row.days_overdue} ماه`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                <td colSpan={5} className="px-4 py-3 text-right text-sm text-slate-700">جمع کل</td>
                <td className="px-4 py-3 text-xs ltr-force text-left">{formatNumber(summary.grand_total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}